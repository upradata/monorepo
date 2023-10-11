import { IScopedLogger } from '@rushstack/heft';
import { InternalError } from '@rushstack/node-core-library';
import path from 'node:path';

// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.
import type * as TTypescript from 'typescript';
import type { ExtendedTypeScript } from './internalTypings/TypeScriptInternals';
import type { ICachedOutputsToBeEmitted } from './types';


// symbols for attaching hidden metadata to ts.Program instances.
const INNER_GET_COMPILER_OPTIONS_SYMBOL: unique symbol = Symbol('getCompilerOptions');
const INNER_EMIT_SYMBOL: unique symbol = Symbol('emit');

const JS_EXTENSION_REGEX: RegExp = /\.js(\.map)?$/;

function wrapWriteFile(
    this: void,
    baseWriteFile: TTypescript.WriteFileCallback,
    jsExtensionOverride: string | undefined
): TTypescript.WriteFileCallback {
    if (!jsExtensionOverride) {
        return baseWriteFile;
    }

    const replacementExtension: string = `${jsExtensionOverride}$1`;
    return (
        fileName: string,
        data: string,
        writeBOM: boolean,
        onError?: ((message: string) => void) | undefined,
        sourceFiles?: readonly TTypescript.SourceFile[] | undefined
    ) => {
        return baseWriteFile(
            fileName.replace(JS_EXTENSION_REGEX, replacementExtension),
            data,
            writeBOM,
            onError,
            sourceFiles
        );
    };
}

export function configureProgramForMultiEmit(
    this: void,
    args: {
        innerProgram: TTypescript.Program,
        ts: ExtendedTypeScript,
        outputsToBeEmitted: ICachedOutputsToBeEmitted[],
        mode: 'transpile' | 'declaration' | 'both',
        buildFolderPath: string,
        logger?: IScopedLogger;
    }): { changedFiles: Set<TTypescript.SourceFile>; } {

    const { innerProgram, ts, outputsToBeEmitted, mode, buildFolderPath, logger } = args;
    interface IProgramWithMultiEmit extends TTypescript.Program {
        // Attach the originals to the Program instance to avoid modifying the same Program twice.
        // Don't use WeakMap because this Program could theoretically get a { ... } applied to it.
        [ INNER_GET_COMPILER_OPTIONS_SYMBOL ]?: TTypescript.Program[ 'getCompilerOptions' ];
        [ INNER_EMIT_SYMBOL ]?: TTypescript.Program[ 'emit' ];
    }

    const program: IProgramWithMultiEmit = innerProgram;

    // Check to see if this Program has already been modified.
    let { [ INNER_EMIT_SYMBOL ]: innerEmit, [ INNER_GET_COMPILER_OPTIONS_SYMBOL ]: innerGetCompilerOptions } = program;

    if (!innerGetCompilerOptions) {
        program[ INNER_GET_COMPILER_OPTIONS_SYMBOL ] = innerGetCompilerOptions = program.getCompilerOptions;
    }

    if (!innerEmit) {
        program[ INNER_EMIT_SYMBOL ] = innerEmit = program.emit;
    }

    let foundPrimary: boolean = false;
    let defaultModule: TTypescript.ModuleKind;

    const multiEmitMap: Map<ICachedOutputsToBeEmitted, TTypescript.CompilerOptions> = new Map();

    for (const toBeEmitted of outputsToBeEmitted) {
        const compilerOptions: TTypescript.CompilerOptions = toBeEmitted.isPrimary
            ? {
                ...innerGetCompilerOptions()
            }
            : {
                ...toBeEmitted.typescriptResolvedOptions,
                // ...innerGetCompilerOptions(),
                // module: moduleKindToEmit.moduleKind,
                // target: moduleKindToEmit.target,
                // outDir: moduleKindToEmit.outDir,

                // Don't emit declarations for secondary module kinds
                // declaration: false,
                // declarationMap: false
            };

        if (!compilerOptions.outDir) {
            throw new InternalError('Expected compilerOptions.outDir to be assigned');
        }
        if (mode === 'transpile') {
            compilerOptions.declaration = false;
            compilerOptions.declarationMap = false;
        } else if (mode === 'declaration') {
            compilerOptions.emitDeclarationOnly = true;
        }


        if (toBeEmitted.isPrimary || mode !== 'declaration') {
            multiEmitMap.set(toBeEmitted, compilerOptions);

            if (logger) {
                const module: string | undefined =
                    Object.entries(ts.ModuleKind).find(([ , value ]) => value === toBeEmitted.typescriptResolvedOptions.module)?.[ 0 ];

                const target: string | undefined =
                    Object.entries(ts.ScriptTarget).find(([ , value ]) => value === toBeEmitted.typescriptResolvedOptions.target)?.[ 0 ];

                logger.terminal.writeLine(
                    `will compile and emit (module: "${module}", target: "${target}")` +
                    ` --> "${path.relative(buildFolderPath, toBeEmitted.typescriptResolvedOptions.outDir || '')}`
                );
            }
        }

        if (toBeEmitted.isPrimary) {
            if (foundPrimary) {
                throw new Error('Multiple primary module emit kinds encountered.');
            } else {
                foundPrimary = true;
            }

            defaultModule = toBeEmitted.typescriptResolvedOptions.module || ts.ModuleKind.CommonJS;
        }
    }

    const changedFiles: Set<TTypescript.SourceFile> = new Set();
    // const outdirDone: Set<string> = new Set();

    program.emit = (
        targetSourceFile?: TTypescript.SourceFile,
        writeFile?: TTypescript.WriteFileCallback,
        cancellationToken?: TTypescript.CancellationToken,
        emitOnlyDtsFiles?: boolean,
        customTransformers?: TTypescript.CustomTransformers
    ) => {

        if (emitOnlyDtsFiles) {
            return program[ INNER_EMIT_SYMBOL ]!(
                targetSourceFile,
                writeFile,
                cancellationToken,
                emitOnlyDtsFiles,
                customTransformers
            );
        }


        if (targetSourceFile && changedFiles) {
            changedFiles.add(targetSourceFile);
        }

        const originalCompilerOptions: TTypescript.CompilerOptions = program[ INNER_GET_COMPILER_OPTIONS_SYMBOL ]!();

        let defaultModuleKindResult: TTypescript.EmitResult;
        const diagnostics: TTypescript.Diagnostic[] = [];
        let emitSkipped: boolean = false;

        try {
            for (const [ moduleToEmit, compilerOptions ] of multiEmitMap) {
                program.getCompilerOptions = () => compilerOptions;
                // Need to mutate the compiler options for the `module` field specifically, because emitWorker() captures
                // options in the closure and passes it to `ts.getTransformers()`
                originalCompilerOptions.module = moduleToEmit.typescriptResolvedOptions.module;

                // const moduleTarget: string = JSON.stringify({
                //     moduleKind: moduleToEmit.typescriptResolvedOptions.module,
                //     target: moduleToEmit.typescriptResolvedOptions.target
                // });

                // if (logger && !outdirDone.has(moduleTarget)) {

                //     const module: string | undefined =
                //         Object.entries(ts.ModuleKind).find(([ , value ]) => value === moduleToEmit.typescriptResolvedOptions.module)?.[ 0 ];

                //     const target: string | undefined =
                //         Object.entries(ts.ScriptTarget).find(([ , value ]) => value === moduleToEmit.typescriptResolvedOptions.target)?.[ 0 ];

                //     logger.terminal.writeLine(
                //         `compiling (module: "${module}", target: "${target}")` +
                //         ` --> "${path.relative(buildFolderPath, moduleToEmit.typescriptResolvedOptions.outDir || '')}`
                //     );

                //     // console.log(kindCompilerOptions);
                //     outdirDone.add(moduleTarget);
                // }


                const flavorResult: TTypescript.EmitResult = program[ INNER_EMIT_SYMBOL ]!(
                    targetSourceFile,
                    writeFile && wrapWriteFile(writeFile, moduleToEmit.jsExtensionOverride),
                    cancellationToken,
                    emitOnlyDtsFiles,
                    customTransformers
                );

                emitSkipped = emitSkipped || flavorResult.emitSkipped;
                // Need to aggregate diagnostics because some are impacted by the target module type
                for (const diagnostic of flavorResult.diagnostics) {
                    diagnostics.push(diagnostic);
                }

                if (moduleToEmit.typescriptResolvedOptions.module === defaultModule) {
                    defaultModuleKindResult = flavorResult;
                }
            }

            const mergedDiagnostics: readonly TTypescript.Diagnostic[] =
                ts.sortAndDeduplicateDiagnostics(diagnostics);

            return {
                ...defaultModuleKindResult!,
                changedSourceFiles: changedFiles,
                diagnostics: mergedDiagnostics,
                emitSkipped
            };
        } finally {
            // Restore the original compiler options and module kind for future calls
            program.getCompilerOptions = program[ INNER_GET_COMPILER_OPTIONS_SYMBOL ]!;
            originalCompilerOptions.module = defaultModule;
        }
    };
    return { changedFiles };
}
