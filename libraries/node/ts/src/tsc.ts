// import { createCompilerHost } from './compiler-host';

// import type { TsConfig } from './tsconfig.json';

import { createTmpDir } from '@upradata/fs';
import { AssignOptions, assignRecursive } from '@upradata/util';
import fs from 'fs-extra';
import path from 'node:path';
// import tsconfig from 'tsconfig';
import ts from 'typescript';


export const defaultTscOptions = (): ts.CompilerOptions => ({
    noEmitOnError: true, // false,
    noErrorTruncation: true,
    noImplicitAny: false,
    listEmittedFiles: true,
    downlevelIteration: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    /* lib: [ 'ESNext' ], */
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true
});


export const getErrorMessageFromDiagnostics = (diagnostics: ts.Diagnostic[]): string => {
    return diagnostics.reduce((errorMessages, diagnostic) => {

        if (diagnostic.file && diagnostic.start) {

            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

            return `${errorMessages}${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}\n`;
        }

        return `${errorMessages}${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}\n`;

    }, '');
};


export type TsCompileOptions = ts.CompilerOptions & { useTsConfig?: boolean | string; host?: ts.CompilerHost; };

// type LoadTsConfigResult = { path?: string; config: ts.ParsedCommandLine; };

const loadTsConfig = (
    // eslint-disable-next-line default-param-last
    tsconfigPath: string = 'tsconfig.json',
    host?: Partial<Pick<ts.ParseConfigHost, 'readFile' | 'fileExists' | 'readDirectory'>>
): ts.ParsedCommandLine => {

    const jsonTsConfigFile = ts.readConfigFile(
        tsconfigPath,
        host?.readFile || ts.sys.readFile
    );

    if (jsonTsConfigFile.error)
        throw new Error(getErrorMessageFromDiagnostics([ jsonTsConfigFile.error ]));


    const currentFolder: string = path.dirname(tsconfigPath);

    const parsedTsconfig = ts.parseJsonConfigFileContent(
        jsonTsConfigFile.config /* json to be parsed */,
        {
            fileExists: host?.fileExists || ts.sys.fileExists,
            readFile: host?.readFile || ts.sys.readFile,
            readDirectory: host?.readDirectory || ts.sys.readDirectory,
            useCaseSensitiveFileNames: true
        },
        currentFolder,
        /* existingOptions */ undefined,
        tsconfigPath
    );

    if (parsedTsconfig.errors?.length > 0)
        throw new Error(getErrorMessageFromDiagnostics(parsedTsconfig.errors));

    return parsedTsconfig;
};


const getParsedCompilerOptions = (options: TsCompileOptions = {}): ts.ParsedCommandLine[ 'options' ] => {
    const { useTsConfig, host } = options;

    if (useTsConfig) {
        const tsconfigPath = typeof useTsConfig === 'string' ? useTsConfig : undefined;

        return assignRecursive(
            {},
            loadTsConfig(tsconfigPath, host).options,
            options,
            new AssignOptions({ arrayMode: 'replace' })
        );
    }

    return assignRecursive(defaultTscOptions(), options);
};

export const compile = (fileNames: string[], options: TsCompileOptions = {}) => {

    const parsedCompilerOptions = getParsedCompilerOptions(options);

    /* if (!compilerOptions.outDir) {
        const { path: tsconfigPath, config } = loadTsConfig();
        const projectDir = path.dirname(tsconfigPath);

        assignRecursive(compilerOptions, {
            outDir: path.join(projectDir, 'dist'),
            baseUrl: path.join(projectDir, config.compilerOptions.baseUrl),
            paths: config.compilerOptions.paths
        });
    } */
    /* debugger;
    const host = createCompilerHost(compilerOptions, {}); */
    // const host = createCompilerHost(compilerOptions, {});
    const program = ts.createProgram({
        rootNames: fileNames,
        options: parsedCompilerOptions,
        host: options.host
    });

    const emitResult = program.emit();
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    if (allDiagnostics?.length > 0) {
        throw new Error(getErrorMessageFromDiagnostics(allDiagnostics));
    }

    const exitCode = emitResult.emitSkipped ? 1 : 0;
    return { emittedFiles: emitResult.emittedFiles, exitCode };
    // console.log(`Process exiting with code '${exitCode}'.`);
    // process.exit(exitCode);
};

export const compileModuleFromString = (source: string, options?: TsCompileOptions) => {
    return ts.transpileModule(source, { compilerOptions: getParsedCompilerOptions(options) });
};


export const compileAndEmit = (filepath: string, options: ts.CompilerOptions = {}) => {
    const outDir = options.outDir || createTmpDir.sync();

    const { emittedFiles } = compile([ filepath ], options);
    // emittedFiles is all emitted file, but we want only filepath file to be required

    const stem = (file: string) => {
        const rel = file.replace(/^\.\//, '');
        return rel.replace(/\..*$/, '');
    };

    const isAbs = path.isAbsolute(filepath);

    const jsCompiledFile = emittedFiles?.find(file => {
        if (!isAbs)
            return stem(path.relative(outDir, file)) === stem(filepath);

        return stem(filepath).endsWith(stem(path.relative(outDir, file)));
    });


    return { emittedFiles, jsCompiledFile, outDir };
};

export const compileAndLoadModule = <Module = any>(filepath: string, options: ts.CompilerOptions & { deleteOutDirAfterCompilation?: boolean; } = {}) => {
    const { jsCompiledFile, outDir } = compileAndEmit(filepath, options);
    const requiredModule = jsCompiledFile ? require(jsCompiledFile) as Module : undefined;

    if (options?.deleteOutDirAfterCompilation || !options.outDir)
        fs.removeSync(outDir);

    return { module: requiredModule, filepath: jsCompiledFile };
};



/* compile(process.argv.slice(2), {
    noEmitOnError: true, noImplicitAny: true,
    target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
}); */
