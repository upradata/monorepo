// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { FileError, type IPackageJson, type ITerminal, JsonFile, Path } from '@rushstack/node-core-library';
import * as crypto from 'crypto';
import * as path from 'path';
import * as semver from 'semver';
import * as TTypescript from 'typescript';
import { Worker } from 'worker_threads';
import { configureProgramForMultiEmit } from './configureProgramForMultiEmit';

import type { IScopedLogger } from '@rushstack/heft';
import type { ExtendedTypeScript, IExtendedSolutionBuilder } from './internalTypings/TypeScriptInternals';
import type { PerformanceMeasurer, PerformanceMeasurerAsync } from './Performance';
import type { IRigTypeScriptConfigurationJson, ITypescriptConfig } from './plugin-options';
import type { ICachedOutputsToBeEmitted, ITranspilationRequestMessage, ITranspilationResponseMessage, ITypescriptWorkerData } from './types';


type RequiredITypeScriptConfigurationJson = {
    [ K in keyof Required<IRigTypeScriptConfigurationJson> ]: IRigTypeScriptConfigurationJson[ K ] | undefined
};


export interface ITypeScriptBuilderConfiguration extends Omit<
    RequiredITypeScriptConfigurationJson, /* 'project' | */ 'tsconfigs' | 'staticAssetsToCopy' /* | 'emit.inheritanceType' */
> {
    // rigConfig: HeftConfiguration[ 'rigConfig' ];
    tsconfigs: ITypescriptConfig[];

    /**
     * The root folder of the build.
     */
    buildFolderPath: string;

    /**
     * The folder to write build metadata.
     */
    buildMetadataFolderPath: string;

    /**
     * The path to the TypeScript tool.
     */
    typeScriptToolPath: string;

    // watchMode: boolean;

    /**
     * The path to the tsconfig file being built.
     */
    // tsconfigPath: string;

    /**
     * The scoped logger that the builder will log to.
     */
    scopedLogger: IScopedLogger;

    /**
     * The callback used to emit the typescript program (or programs) from the builder.
     */
    emitChangedFilesCallback: (
        program: TTypescript.Program,
        changedFiles?: Set<TTypescript.SourceFile>
    ) => void;
}

type TSolutionHost = TTypescript.SolutionBuilderHost<TTypescript.EmitAndSemanticDiagnosticsBuilderProgram>;
type TWatchCompilerHost =
    TTypescript.WatchCompilerHostOfFilesAndCompilerOptions<TTypescript.EmitAndSemanticDiagnosticsBuilderProgram>;
type TWatchSolutionHost =
    TTypescript.SolutionBuilderWithWatchHost<TTypescript.EmitAndSemanticDiagnosticsBuilderProgram>;
type TWatchProgram =
    TTypescript.WatchOfFilesAndCompilerOptions<TTypescript.EmitAndSemanticDiagnosticsBuilderProgram>;

interface ICompilerCapabilities {
    /**
     * Support for incremental compilation via `ts.createIncrementalProgram()`.
     * Introduced with TypeScript 3.6.
     */
    incrementalProgram: boolean;

    /**
     * Support for composite projects via `ts.createSolutionBuilder()`.
     * Introduced with TypeScript 3.0.
     */
    solutionBuilder: boolean;
}

interface IFileToWrite {
    filePath: string;
    data: string;
}

interface IEmitReason {
    target: TTypescript.ScriptTarget | undefined;
    module: TTypescript.ModuleKind;
    outDir: string;
    extension: '.js' | '.cjs' | '.mjs';
    reason: string;
}

interface IExtendedEmitResult extends TTypescript.EmitResult {
    changedSourceFiles: Set<TTypescript.SourceFile>;
    filesToWrite: IFileToWrite[];
}

interface IPendingWork {
    (): void;
}

interface ITranspileSignal {
    resolve: (result: TTypescript.EmitResult) => void;
    reject: (error: Error) => void;
}

const OLDEST_SUPPORTED_TS_MAJOR_VERSION: number = 2;
const OLDEST_SUPPORTED_TS_MINOR_VERSION: number = 9;

const NEWEST_SUPPORTED_TS_MAJOR_VERSION: number = 5;
const NEWEST_SUPPORTED_TS_MINOR_VERSION: number = 0;

interface ITypeScriptTool {
    ts: ExtendedTypeScript;
    measureSync: PerformanceMeasurer;
    measureAsync: PerformanceMeasurerAsync;
    sourceFileCache: Map<string, TTypescript.SourceFile>;

    watchProgram: TWatchProgram | undefined;

    solutionBuilder: IExtendedSolutionBuilder | undefined;

    rawDiagnostics: TTypescript.Diagnostic[];
    pendingOperations: Set<IPendingWork>;

    executing: boolean;

    worker: Worker | undefined;
    pendingTranspilePromises: Map<number, Promise<TTypescript.EmitResult>>;
    pendingTranspileSignals: Map<number, ITranspileSignal>;

    reportDiagnostic: TTypescript.DiagnosticReporter;
    clearTimeout: (timeout: IPendingWork) => void;
    setTimeout: <T extends unknown[]>(timeout: (...args: T) => void, ms: number, ...args: T) => IPendingWork;
}




export class TypeScriptBuilder {
    private readonly _configuration: ITypeScriptBuilderConfiguration;
    private readonly _typescriptLogger: IScopedLogger;
    private readonly _typescriptTerminal: ITerminal;

    private _typescriptVersion!: string;
    private _typescriptParsedVersion!: semver.SemVer;

    private _capabilities!: ICompilerCapabilities;
    private _useSolutionBuilder!: boolean;

    private _outputsToBeEmitted!: ICachedOutputsToBeEmitted[];
    private readonly _suppressedDiagnosticCodes: Set<number> = new Set();

    private __tsCacheFilePath: string | undefined;

    private _tool: ITypeScriptTool | undefined = undefined;

    private _nextRequestId: number = 0;


    public constructor(configuration: ITypeScriptBuilderConfiguration) {
        this._configuration = configuration;
        this._typescriptLogger = configuration.scopedLogger;
        this._typescriptTerminal = configuration.scopedLogger.terminal;
        this.__tsCacheFilePath = this._tsCacheFilePath();
    }

    private _tsCacheFilePath(): string {
        if (!this.__tsCacheFilePath) {
            // TypeScript internally handles if the tsconfig options have changed from when the tsbuildinfo file was created.
            // We only need to hash our additional Heft configuration.
            const configHash: crypto.Hash = crypto.createHash('sha1');

            configHash.update(JSON.stringify(this._configuration.tsconfigs));
            const serializedConfigHash: string = configHash
                .digest('base64')
                .slice(0, 8)
                .replace(/\+/g, '-')
                .replace(/\//g, '_');

            // This conversion is theoretically redundant, but it is here to make absolutely sure that the path is formatted
            // using only '/' as the directory separator so that incremental builds don't break on Windows.
            // TypeScript will normalize to '/' when serializing, but not on the direct input, and uses exact string equality.
            const normalizedCacheFolderPath: string = Path.convertToSlashes(
                this._configuration.buildMetadataFolderPath
            );
            this.__tsCacheFilePath = `${normalizedCacheFolderPath}/ts_${serializedConfigHash}.json`;
        }

        return this.__tsCacheFilePath;
    }



    private _loadTsconfig(args: {
        ts: ExtendedTypeScript;
        tsconfigPath: string;
        existingOptions?: TTypescript.CompilerOptions;
        overrideOptions?: TTypescript.CompilerOptions;
        tsCacheFilePath?: string;
    }): TTypescript.ParsedCommandLine {
        const { ts, tsconfigPath, existingOptions, overrideOptions = {}, tsCacheFilePath } = args;

        const parsedConfigFile: ReturnType<typeof ts.readConfigFile> = ts.readConfigFile(
            tsconfigPath,
            ts.sys.readFile
        );

        const currentFolder: string = path.dirname(tsconfigPath);
        const tsconfig: TTypescript.ParsedCommandLine = ts.parseJsonConfigFileContent(
            parsedConfigFile.config,
            {
                fileExists: ts.sys.fileExists,
                readFile: ts.sys.readFile,
                readDirectory: ts.sys.readDirectory,
                useCaseSensitiveFileNames: true
            },
            currentFolder,
            existingOptions /* : undefined */,
            tsconfigPath
        );

        if (tsconfig.options.incremental) {
            tsconfig.options.tsBuildInfoFile = tsCacheFilePath;
        }

        return {
            ...tsconfig,
            options: {
                ...tsconfig.options,
                // outDir: partialTsConfigJson.compilerOptions?.outDir,
                ...overrideOptions
            }
        };
    };


    public async invokeAsync(onChangeDetected?: () => void): Promise<void> {
        if (!this._tool) {
            // Determine the compiler version
            const compilerPackageJsonFilename: string = path.join(
                this._configuration.typeScriptToolPath,
                'package.json'
            );
            const packageJson: IPackageJson = await JsonFile.loadAsync(compilerPackageJsonFilename);
            this._typescriptVersion = packageJson.version;
            const parsedVersion: semver.SemVer | null = semver.parse(this._typescriptVersion);
            if (!parsedVersion) {
                throw new Error(
                    `Unable to parse version "${this._typescriptVersion}" for TypeScript compiler package in: ` +
                    compilerPackageJsonFilename
                );
            }
            this._typescriptParsedVersion = parsedVersion;

            // Detect what features this compiler supports.  Note that manually comparing major/minor numbers
            // loosens the matching to accept prereleases such as "3.6.0-dev.20190530"
            this._capabilities = {
                incrementalProgram: false,
                solutionBuilder: this._typescriptParsedVersion.major >= 3
            };

            if (
                this._typescriptParsedVersion.major > 3 ||
                (this._typescriptParsedVersion.major === 3 && this._typescriptParsedVersion.minor >= 6)
            ) {
                this._capabilities.incrementalProgram = true;
            }

            this._useSolutionBuilder = !!this._configuration.buildProjectReferences;
            if (this._useSolutionBuilder && !this._capabilities.solutionBuilder) {
                throw new Error(
                    `Building project references requires TypeScript@>=3.0, but the current version is ${this._typescriptVersion}`
                );
            }

            // Report a warning if the TypeScript version is too old/new.  The current oldest supported version is
            // TypeScript 2.9. Prior to that the "ts.getConfigFileParsingDiagnostics()" API is missing; more fixups
            // would be required to deal with that.  We won't do that work unless someone requests it.
            if (
                this._typescriptParsedVersion.major < OLDEST_SUPPORTED_TS_MAJOR_VERSION ||
                (this._typescriptParsedVersion.major === OLDEST_SUPPORTED_TS_MAJOR_VERSION &&
                    this._typescriptParsedVersion.minor < OLDEST_SUPPORTED_TS_MINOR_VERSION)
            ) {
                // We don't use writeWarningLine() here because, if the person wants to take their chances with
                // a seemingly unsupported compiler, their build should be allowed to succeed.
                this._typescriptTerminal.writeLine(
                    `The TypeScript compiler version ${this._typescriptVersion} is very old` +
                    ` and has not been tested with Heft; it may not work correctly.`
                );
            } else if (
                this._typescriptParsedVersion.major > NEWEST_SUPPORTED_TS_MAJOR_VERSION ||
                (this._typescriptParsedVersion.major === NEWEST_SUPPORTED_TS_MAJOR_VERSION &&
                    this._typescriptParsedVersion.minor > NEWEST_SUPPORTED_TS_MINOR_VERSION)
            ) {
                this._typescriptTerminal.writeLine(
                    `The TypeScript compiler version ${this._typescriptVersion} is newer` +
                    ' than the latest version that was tested with Heft ' +
                    `(${NEWEST_SUPPORTED_TS_MAJOR_VERSION}.${NEWEST_SUPPORTED_TS_MINOR_VERSION}); it may not work correctly.`
                );
            }

            const ts: ExtendedTypeScript = require(this._configuration.typeScriptToolPath);

            ts.performance.enable();

            const suppressedCodes: (number | undefined)[] = [
                ts.Diagnostics.Property_0_has_no_initializer_and_is_not_definitely_assigned_in_the_constructor?.code,
                // This diagnostic code is not present in old versions of TypeScript
                ts.Diagnostics
                    .Element_implicitly_has_an_any_type_because_expression_of_type_0_can_t_be_used_to_index_type_1?.code
            ];
            for (const code of suppressedCodes) {
                if (code !== undefined) {
                    this._suppressedDiagnosticCodes.add(code);
                }
            }

            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            const makeMeasureTsPerformance = <M extends 'sync' | 'async'>(mode: M) => <TResult extends object | void>(
                measurementName: string,
                fn: () => TResult | Promise<TResult>
            ): M extends 'sync' ? TResult & { duration: number; } : Promise<TResult & { duration: number; }> => {

                const beforeName: string = `before${measurementName}`;
                ts.performance.mark(beforeName);

                const after = (result: TResult): TResult & { duration: number; count: number; } => {
                    const afterName: string = `after${measurementName}`;
                    ts.performance.mark(afterName);
                    ts.performance.measure(measurementName, beforeName, afterName);

                    return {
                        ...result,
                        duration: ts.performance.getDuration(measurementName),
                        count: ts.performance.getCount(beforeName)
                    };
                };

                if (mode === 'sync') {
                    const result: TResult = fn() as TResult;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return after(result) as any;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (fn() as Promise<TResult>).then(result => after(result)) as any;
            };

            this._typescriptTerminal.writeLine(`Using TypeScript version ${ts.version}`);

            const rawDiagnostics: TTypescript.Diagnostic[] = [];

            const pendingOperations: Set<IPendingWork> = new Set();

            this._tool = {
                ts,

                measureSync: makeMeasureTsPerformance('sync'),
                measureAsync: makeMeasureTsPerformance('async'),

                sourceFileCache: new Map(),

                watchProgram: undefined,
                solutionBuilder: undefined,

                rawDiagnostics,

                pendingOperations,

                executing: false,

                reportDiagnostic: (diagnostic: TTypescript.Diagnostic) => {
                    rawDiagnostics.push(diagnostic);
                },

                clearTimeout(timeout: IPendingWork): void {
                    pendingOperations.delete(timeout);
                },

                setTimeout<T extends unknown[]>(fn: (...args: T) => void, ms: number, ...args: T): IPendingWork {
                    const timeout: IPendingWork = () => {
                        fn(...args);
                    };
                    pendingOperations.add(timeout);
                    if (!this.executing && onChangeDetected) {
                        onChangeDetected();
                    }
                    return timeout;
                },

                worker: undefined,

                pendingTranspilePromises: new Map(),
                pendingTranspileSignals: new Map()
            };
        }

        const { performance } = this._tool.ts;
        // Reset the performance counters to 0 to avoid contamination from previous runs
        performance.disable();
        performance.enable();

        if (onChangeDetected !== undefined) {
            await this._runWatchAsync(this._tool);
        } else if (this._useSolutionBuilder) {
            await this._runSolutionBuildAsync(this._tool);
        } else {
            await this._runBuildAsync(this._tool);
        }
    }

    public async _runWatchAsync(tool: ITypeScriptTool): Promise<void> {
        const {
            ts,
            measureSync,
            pendingOperations,
            rawDiagnostics,
            pendingTranspilePromises
        } = tool;


        if (!tool.solutionBuilder && !tool.watchProgram) {
            const typescriptConfig: ITypescriptConfig = this._configuration.tsconfigs.find(config => config.isPrimary)!;
            const { tsconfigPath } = typescriptConfig;

            //#region CONFIGURE
            const { duration: configureDurationMs, primaryTsConfig } = measureSync('Configure', () => {
                // eslint-disable-next-line @typescript-eslint/typedef
                const outputs = this._initOutputsToBeEmitted(ts);
                const primaryTsConfig: TTypescript.ParsedCommandLine = outputs.find(o => o.outputToBeEmitted.isPrimary)!.parsedTsconfig;

                return {
                    primaryTsConfig
                };
            });

            this._typescriptTerminal.writeVerboseLine(`Configure: ${configureDurationMs}ms`);
            //#endregion

            if (this._useSolutionBuilder) {
                const solutionHost: TWatchSolutionHost = this._buildWatchSolutionBuilderHost(tool);
                const builder: TTypescript.SolutionBuilder<TTypescript.EmitAndSemanticDiagnosticsBuilderProgram> =
                    ts.createSolutionBuilderWithWatch(solutionHost, [ tsconfigPath || 'src' ], {});

                tool.solutionBuilder = builder as IExtendedSolutionBuilder;

                builder.build();
            } else {
                const compilerHost: TWatchCompilerHost = this._buildWatchCompilerHost(tool, primaryTsConfig);
                tool.watchProgram = ts.createWatchProgram(compilerHost);
            }
        }

        if (pendingOperations.size > 0) {
            rawDiagnostics.length = 0;
            tool.executing = true;
            for (const operation of pendingOperations) {
                pendingOperations.delete(operation);
                operation();
            }
            if (pendingTranspilePromises.size) {
                const emitResults: TTypescript.EmitResult[] = await Promise.all(pendingTranspilePromises.values());
                for (const { diagnostics } of emitResults) {
                    for (const diagnostic of diagnostics) {
                        rawDiagnostics.push(diagnostic);
                    }
                }
            }
            // eslint-disable-next-line require-atomic-updates
            tool.executing = false;
        }
        this._logDiagnostics(ts, rawDiagnostics, this._useSolutionBuilder);
    }

    public async _runBuildAsync(tool: ITypeScriptTool): Promise<void> {
        const { ts, measureSync, pendingTranspilePromises } = tool;

        //#region CONFIGURE
        const {
            duration: configureDurationMs,
            primaryTsConfig,
            compilerHost
        } = measureSync('Configure', () => {

            // eslint-disable-next-line @typescript-eslint/typedef
            const outputs = this._initOutputsToBeEmitted(ts);
            const primaryTsConfig: TTypescript.ParsedCommandLine = outputs.find(o => o.outputToBeEmitted.isPrimary)!.parsedTsconfig;

            const _compilerHost: TTypescript.CompilerHost = this._buildIncrementalCompilerHost(
                tool,
                primaryTsConfig
            );

            return {
                primaryTsConfig,
                compilerHost: _compilerHost
            };
        });


        this._typescriptTerminal.writeVerboseLine(`Configure: ${configureDurationMs}ms`);
        //#endregion

        //#region PROGRAM
        // There will be only one program here; emit will get a bit abused if we produce multiple outputs
        let builderProgram: TTypescript.BuilderProgram | undefined = undefined;
        let innerProgram: TTypescript.Program;

        const isolatedModules: boolean =
            !!this._configuration.useTranspilerWorker && !!primaryTsConfig.options.isolatedModules;
        const mode: 'both' | 'declaration' = isolatedModules ? 'declaration' : 'both';

        let filesToTranspile: Map<string, string> | undefined;

        if (primaryTsConfig.options.incremental) {
            // Use ts.createEmitAndSemanticDiagnositcsBuilderProgram directly because the customizations performed by
            // _getCreateBuilderProgram duplicate those performed in this function for non-incremental build.
            const oldProgram: TTypescript.EmitAndSemanticDiagnosticsBuilderProgram | undefined =
                ts.readBuilderProgram(primaryTsConfig.options, compilerHost);

            builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
                primaryTsConfig.fileNames,
                primaryTsConfig.options,
                compilerHost,
                oldProgram,
                ts.getConfigFileParsingDiagnostics(primaryTsConfig),
                primaryTsConfig.projectReferences
            );

            filesToTranspile = getFilesToTranspileFromBuilderProgram(builderProgram);
            innerProgram = builderProgram.getProgram();
        } else {
            innerProgram = ts.createProgram({
                rootNames: primaryTsConfig.fileNames,
                options: primaryTsConfig.options,
                projectReferences: primaryTsConfig.projectReferences,
                host: compilerHost,
                oldProgram: undefined,
                configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(primaryTsConfig)
            });

            filesToTranspile = getFilesToTranspileFromProgram(innerProgram);
        }

        // Prefer the builder program, since it is what gives us incremental builds
        const genericProgram: TTypescript.BuilderProgram | TTypescript.Program = builderProgram || innerProgram;

        this._logReadPerformance(ts);
        //#endregion

        if (isolatedModules) {
            // Kick the transpilation worker.
            this._queueTranspileInWorker(tool, genericProgram.getCompilerOptions(), filesToTranspile);
        }

        //#region ANALYSIS
        const { duration: diagnosticsDurationMs, diagnostics: preDiagnostics } = measureSync(
            'Analyze',
            () => {
                const rawDiagnostics: TTypescript.Diagnostic[] = [
                    ...genericProgram.getConfigFileParsingDiagnostics(),
                    ...genericProgram.getOptionsDiagnostics(),
                    ...genericProgram.getSyntacticDiagnostics(),
                    ...genericProgram.getGlobalDiagnostics(),
                    ...genericProgram.getSemanticDiagnostics()
                ];
                return { diagnostics: rawDiagnostics };
            }
        );
        this._typescriptTerminal.writeVerboseLine(`Analyze: ${diagnosticsDurationMs}ms`);
        //#endregion

        //#region EMIT
        const { changedFiles } = configureProgramForMultiEmit({
            innerProgram,
            ts,
            outputsToBeEmitted: this._outputsToBeEmitted,
            mode,
            buildFolderPath: this._configuration.buildFolderPath,
            logger: this._typescriptLogger
        });

        const emitResult: TTypescript.EmitResult = genericProgram.emit(
            undefined,
            // The writeFile callback must be provided for the multi-emit redirector
            ts.sys.writeFile,
            undefined,
            undefined,
            undefined
        );

        this._cleanupWorker();
        //#endregion

        this._logEmitPerformance(ts);

        //#region FINAL_ANALYSIS
        // Need to ensure that we include emit diagnostics, since they might not be part of the other sets
        const rawDiagnostics: TTypescript.Diagnostic[] = [ ...preDiagnostics, ...emitResult.diagnostics ];
        //#endregion

        this._configuration.emitChangedFilesCallback(innerProgram, changedFiles);

        if (pendingTranspilePromises.size) {
            const emitResults: TTypescript.EmitResult[] = await Promise.all(pendingTranspilePromises.values());
            for (const { diagnostics } of emitResults) {
                for (const diagnostic of diagnostics) {
                    rawDiagnostics.push(diagnostic);
                }
            }
        }

        this._logDiagnostics(ts, rawDiagnostics);
        // Reset performance counters in case any are used in the callback
        ts.performance.disable();
        ts.performance.enable();
    }

    public async _runSolutionBuildAsync(tool: ITypeScriptTool): Promise<void> {
        this._typescriptTerminal.writeVerboseLine(`Using solution mode`);

        const { ts, measureSync, rawDiagnostics, pendingTranspilePromises } = tool;
        rawDiagnostics.length = 0;

        if (!tool.solutionBuilder) {
            //#region CONFIGURE
            const {
                duration: configureDurationMs,
                solutionBuilderHost
            } = measureSync('Configure', () => {
                this._initOutputsToBeEmitted(ts);
                const _solutionBuilderHost: TSolutionHost = this._buildSolutionBuilderHost(tool);

                return {
                    solutionBuilderHost: _solutionBuilderHost
                };
            });


            const typescriptConfig: ITypescriptConfig = this._configuration.tsconfigs.find(config => config.isPrimary)!;
            const { tsconfigPath } = typescriptConfig;

            // const _tsconfig: TTypescript.ParsedCommandLine = tsconfigPath ? _loadTsconfig({
            //     ts,
            //     tsconfigPath,
            //     tsCacheFilePath: this.__tsCacheFilePath,
            //     overrideOptions: typescriptConfig.tsconfigJson?.compilerOptions,
            // }) : { options: typescriptConfig.tsconfigJson?.compilerOptions || {}, fileNames: [ 'src' ], errors: [] };


            //#region CONFIGURE
            // const { duration: configureDurationMs, solutionBuilderHost } = measureSync('Configure', () => {
            //     this._validateTsconfig(ts, _tsconfig, typescriptConfig.jsExtension);

            //     const _solutionBuilderHost: TSolutionHost = this._buildSolutionBuilderHost(tool);

            //     return {
            //         solutionBuilderHost: _solutionBuilderHost
            //     };
            // });

            this._typescriptTerminal.writeVerboseLine(`Configure: ${configureDurationMs}ms`);
            //#endregion

            if (!tool.solutionBuilder) {
                // https://eslint.org/docs/latest/rules/require-atomic-updates
                tool.solutionBuilder = ts.createSolutionBuilder(
                    solutionBuilderHost,
                    [ tsconfigPath || 'src' ],
                    {}
                ) as IExtendedSolutionBuilder;
            }
        } else {
            // Force reload everything from disk
            for (const project of tool.solutionBuilder.getBuildOrder()) {
                tool.solutionBuilder.invalidateProject(project, 1);
            }
        }

        //#region EMIT
        // Ignoring the exit status because we only care about presence of diagnostics
        tool.solutionBuilder.build();
        this._cleanupWorker();
        //#endregion

        if (pendingTranspilePromises.size) {
            const emitResults: TTypescript.EmitResult[] = await Promise.all(pendingTranspilePromises.values());
            for (const { diagnostics } of emitResults) {
                for (const diagnostic of diagnostics) {
                    rawDiagnostics.push(diagnostic);
                }
            }
        }

        this._logDiagnostics(ts, rawDiagnostics, true);
    }

    private _logDiagnostics(
        ts: ExtendedTypeScript,
        rawDiagnostics: TTypescript.Diagnostic[],
        isSolutionMode?: boolean
    ): void {
        const diagnostics: readonly TTypescript.Diagnostic[] = ts.sortAndDeduplicateDiagnostics(rawDiagnostics);

        if (diagnostics.length > 0) {
            let warningCount: number = 0;
            let hasError: boolean = false;

            this._typescriptTerminal.writeLine(
                `Encountered ${diagnostics.length} TypeScript issue${diagnostics.length > 1 ? 's' : ''}:`
            );
            for (const diagnostic of diagnostics) {
                const diagnosticCategory: TTypescript.DiagnosticCategory = this._getAdjustedDiagnosticCategory(
                    diagnostic,
                    ts
                );

                if (diagnosticCategory === ts.DiagnosticCategory.Warning) {
                    warningCount++;
                } else if (diagnosticCategory === ts.DiagnosticCategory.Error) {
                    hasError = true;
                }

                this._printDiagnosticMessage(ts, diagnostic, diagnosticCategory);
            }

            if (isSolutionMode && warningCount > 0 && !hasError) {
                this._typescriptLogger.emitError(
                    new Error(
                        `TypeScript encountered ${warningCount} warning${warningCount === 1 ? '' : 's'} ` +
                        `and is configured to build project references. As a result, no files were emitted. Please fix the reported warnings to proceed.`
                    )
                );
            }
        }
    }

    private _logEmitPerformance(ts: ExtendedTypeScript): void {
        this._typescriptTerminal.writeVerboseLine(`Bind: ${ts.performance.getDuration('Bind')}ms`);
        this._typescriptTerminal.writeVerboseLine(`Check: ${ts.performance.getDuration('Check')}ms`);
        this._typescriptTerminal.writeVerboseLine(
            `Transform: ${ts.performance.getDuration('transformTime')}ms ` +
            `(${ts.performance.getCount('beforeTransform')} files)`
        );
        this._typescriptTerminal.writeVerboseLine(
            `Print: ${ts.performance.getDuration('printTime')}ms ` +
            `(${ts.performance.getCount('beforePrint')} files) (Includes Transform)`
        );
        this._typescriptTerminal.writeVerboseLine(
            `Emit: ${ts.performance.getDuration('Emit')}ms (Includes Print)`
        );
        this._typescriptTerminal.writeVerboseLine(
            `I/O Write: ${ts.performance.getDuration('I/O Write')}ms (${ts.performance.getCount(
                'beforeIOWrite'
            )} files)`
        );
    }

    private _logReadPerformance(ts: ExtendedTypeScript): void {
        this._typescriptTerminal.writeVerboseLine(
            `I/O Read: ${ts.performance.getDuration('I/O Read')}ms (${ts.performance.getCount(
                'beforeIORead'
            )} files)`
        );
        this._typescriptTerminal.writeVerboseLine(
            `Parse: ${ts.performance.getDuration('Parse')}ms (${ts.performance.getCount('beforeParse')} files)`
        );
        this._typescriptTerminal.writeVerboseLine(
            `Program (includes Read + Parse): ${ts.performance.getDuration('Program')}ms`
        );
    }

    private _printDiagnosticMessage(
        ts: ExtendedTypeScript,
        diagnostic: TTypescript.Diagnostic,
        diagnosticCategory: TTypescript.DiagnosticCategory = this._getAdjustedDiagnosticCategory(diagnostic, ts)
    ): void {
        // Code taken from reference example
        let diagnosticMessage: string;
        let errorObject: Error;
        if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
            const message: string = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            const formattedMessage: string = `(TS${diagnostic.code}) ${message}`;
            errorObject = new FileError(formattedMessage, {
                absolutePath: diagnostic.file.fileName,
                projectFolder: this._configuration.buildFolderPath,
                line: line + 1,
                column: character + 1
            });
            diagnosticMessage = errorObject.toString();
        } else {
            diagnosticMessage = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            errorObject = new Error(diagnosticMessage);
        }

        switch (diagnosticCategory) {
            case ts.DiagnosticCategory.Error: {
                this._typescriptLogger.emitError(errorObject);
                break;
            }

            case ts.DiagnosticCategory.Warning: {
                this._typescriptLogger.emitWarning(errorObject);
                break;
            }

            default: {
                this._typescriptTerminal.writeLine(...diagnosticMessage);
                break;
            }
        }
    }

    private _getAdjustedDiagnosticCategory(
        diagnostic: TTypescript.Diagnostic,
        ts: ExtendedTypeScript
    ): TTypescript.DiagnosticCategory {
        // Workaround for https://github.com/microsoft/TypeScript/issues/40058
        // The compiler reports a hard error for issues such as this:
        //
        //    error TS6133: 'x' is declared but its value is never read.
        //
        // These should properly be treated as warnings, because they are purely cosmetic issues.
        // TODO: Maybe heft should provide a config file for managing DiagnosticCategory mappings.
        if (diagnostic.reportsUnnecessary && diagnostic.category === ts.DiagnosticCategory.Error) {
            return ts.DiagnosticCategory.Warning;
        }

        // These pedantic checks also should not be treated as hard errors
        if (this._suppressedDiagnosticCodes.has(diagnostic.code)) {
            return ts.DiagnosticCategory.Warning;
        }

        return diagnostic.category;
    }

    private _initOutputsToBeEmitted(ts: ExtendedTypeScript): {
        parsedTsconfig: TTypescript.ParsedCommandLine;
        outputToBeEmitted: ICachedOutputsToBeEmitted;
    }[] {

        this._outputsToBeEmitted = [];

        /*   const primartTypescriptConfig: ITypescriptConfig = this._configuration.tsconfigs.find(config => config.isPrimary)!;
  
          const _tsconfig: TTypescript.ParsedCommandLine = primartTypescriptConfig.tsconfigPath ? _loadTsconfig({
              ts,
              tsconfigPath: primartTypescriptConfig.tsconfigPath,
              tsCacheFilePath: this.__tsCacheFilePath,
              overrideOptions: primartTypescriptConfig.tsconfigJson?.compilerOptions,
          }) : { options: primartTypescriptConfig.tsconfigJson?.compilerOptions || {}, fileNames: [ 'src' ], errors: [] };
   */

        // this._typescriptTerminal.writeLine(`
        // tsconfigPath: ${tsconfigPath},
        // tsCacheFilePath: ${this.__tsCacheFilePath},
        // _tsconfig: ${JSON.stringify(_tsconfig, null, 4)}`);

        return this._configuration.tsconfigs.map(tsconfig => {
            const { tsconfigPath } = tsconfig;

            const parsedTsconfig: TTypescript.ParsedCommandLine = /* tsconfigPath ? */ this._loadTsconfig({
                ts,
                tsconfigPath,
                tsCacheFilePath: this.__tsCacheFilePath,
                overrideOptions: tsconfig.tsconfigJson?.compilerOptions,
            }) /* : Promise.resolve({ options: tsconfig.tsconfigJson?.compilerOptions || {}, fileNames: [ 'src' ], errors: [] }) */;

            if (this._validateTsconfig(ts, parsedTsconfig, tsconfig)) {
                return { parsedTsconfig, outputToBeEmitted: this._outputsToBeEmitted.at(-1)! };
            }
        }).filter(Boolean) as {
            parsedTsconfig: TTypescript.ParsedCommandLine;
            outputToBeEmitted: ICachedOutputsToBeEmitted;
        }[];
    }

    private _validateTsconfig(
        ts: ExtendedTypeScript,
        tsconfig: TTypescript.ParsedCommandLine,
        config: ITypescriptConfig
    ): boolean {
        if (
            (tsconfig.options.module && !tsconfig.options.outDir) ||
            (!tsconfig.options.module && tsconfig.options.outDir)
        ) {
            throw new Error(
                'If either the module or the outDir option is provided in the tsconfig compilerOptions, both must be provided'
            );
        }

        // const specifiedKinds: Map<TTypescript.ModuleKind, Map<TTypescript.ScriptTarget, IEmitReason>> = new Map();

        // const addToSpecifiedKinds = (
        //     moduleKind: TTypescript.ModuleKind, target: TTypescript.ScriptTarget, reason: IEmitReason
        // ): void => {
        //     const moduleKindMap: Map<TTypescript.ScriptTarget, IEmitReason> = specifiedKinds.get(moduleKind) || new Map();
        //     moduleKindMap.set(target, reason);

        //     specifiedKinds.set(moduleKind, moduleKindMap);
        // };

        // const specifiedOutDirs: Map<string, IEmitReason> = new Map();
        const outDirs: Map<string, IEmitReason> = new Map();

        if (!tsconfig.options.module) {
            throw new Error(
                'If the module tsconfig compilerOption is not provided, the builder must be provided with the ' +
                'additionalModuleKindsToEmit configuration option. \n' + JSON.stringify(tsconfig)
            );
        }

        // const isConfigPrimary = (moduleKind: TTypescript.ModuleKind, target: TTypescript.ScriptTarget): boolean => {
        //     return tsconfig.options.module === moduleKind && tsconfig.options.target === target;
        // };


        // if (this._configuration.emitCjsExtensionForCommonJS) {
        //     const isPrimary: boolean = isConfigPrimary(ts.ModuleKind.CommonJS, ts.ScriptTarget.ES2015);

        //     const target: TTypescript.ScriptTarget = isPrimary && tsconfig.options.target ?
        //         tsconfig.options.target <= ts.ScriptTarget.ES2015 ? tsconfig.options.target : ts.ScriptTarget.ES2015 :
        //         ts.ScriptTarget.ES2015;

        //     const moduleKind: TTypescript.ModuleKind = ts.ModuleKind.CommonJS;

        //     this._addModuleKindToEmit({
        //         moduleKind,
        //         target,
        //         outFolderPath: tsconfig.options.outDir!,
        //         isPrimary,
        //         jsExtensionOverride: '.cjs'
        //     });

        //     const cjsReason: IModuleKindReason = {
        //         outDir: tsconfig.options.outDir!,
        //         kind: moduleKind,
        //         target,
        //         extension: '.cjs',
        //         reason: 'emitCjsExtensionForCommonJS'
        //     };

        //     addToSpecifiedKinds(moduleKind, target, cjsReason);
        //     specifiedOutDirs.set(`${tsconfig.options.outDir!}:.cjs`, cjsReason);
        // }

        // if (this._configuration.emitMjsExtensionForESModule) {
        //     const isPrimary: boolean = isConfigPrimary(ts.ModuleKind.ESNext, ts.ScriptTarget.ESNext);

        //     const target: TTypescript.ScriptTarget = isPrimary && tsconfig.options.target ?
        //         tsconfig.options.target >= ts.ScriptTarget.ES2015 ? tsconfig.options.target : ts.ScriptTarget.ESNext :
        //         ts.ScriptTarget.ESNext;

        //     const moduleKind: TTypescript.ModuleKind = ts.ModuleKind.ESNext;


        //     this._addModuleKindToEmit({
        //         moduleKind,
        //         target,
        //         outFolderPath: tsconfig.options.outDir!,
        //         isPrimary,
        //         jsExtensionOverride: '.mjs'
        //     });

        //     const mjsReason: IModuleKindReason = {
        //         outDir: tsconfig.options.outDir!,
        //         kind: moduleKind,
        //         target,
        //         extension: '.mjs',
        //         reason: 'emitMjsExtensionForESModule'
        //     };

        //     addToSpecifiedKinds(moduleKind, target, mjsReason);
        //     specifiedOutDirs.set(`${tsconfig.options.outDir!}:.mjs`, mjsReason);
        // }


        // if (!specifiedKinds.get(tsconfig.options.module)?.has(tsconfig.options.target!) && this._configuration.emitTsconfigAsBase) {

        //     const target: TTypescript.ScriptTarget = tsconfig.options.target || ts.ScriptTarget.ES3;
        //     const moduleKind: TTypescript.ModuleKind = tsconfig.options.module;

        //     this._addModuleKindToEmit({
        //         moduleKind,
        //         target,
        //         outFolderPath: tsconfig.options.outDir!,
        //         isPrimary: true,
        //         jsExtensionOverride: undefined
        //     });

        //     const tsConfigReason: IModuleKindReason = {
        //         outDir: tsconfig.options.outDir!,
        //         kind: moduleKind,
        //         target,
        //         extension: '.js',
        //         reason: 'tsconfig.json'
        //     };

        //     addToSpecifiedKinds(moduleKind, target, tsConfigReason);
        //     specifiedOutDirs.set(`${tsconfig.options.outDir!}:.js`, tsConfigReason);
        // }

        // if (this._configuration.emit) {
        //     for (const additionalModuleKindToEmit of this._configuration.emit) {
        //         const moduleKind: TTypescript.ModuleKind = this._parseModuleKind(
        //             ts,
        //             additionalModuleKindToEmit.moduleKind
        //         );

        //         const target: TTypescript.ScriptTarget = this._parseScriptTarget(
        //             ts,
        //             additionalModuleKindToEmit.target
        //         ) || tsconfig.options.target!;

        //         const outDirKey: string = `${additionalModuleKindToEmit.outFolderName}:.js`;

        //         const moduleKindReason: IModuleKindReason = {
        //             kind: moduleKind,
        //             target,
        //             outDir: additionalModuleKindToEmit.outFolderName,
        //             extension: `.${additionalModuleKindToEmit.jsExtension || 'js'}`,
        //             reason: `additionalModuleKindsToEmit`
        //         };

        //         const existingKind: IModuleKindReason | undefined = specifiedKinds.get(moduleKind)?.get(target);
        //         const existingDir: IModuleKindReason | undefined = specifiedOutDirs.get(outDirKey);

        //         if (existingKind) {
        //             throw new Error(
        //                 `Module kind "${additionalModuleKindToEmit.moduleKind}" with target "${additionalModuleKindToEmit.target}" is already ` +
        //                 `emitted at ${existingKind.outDir} with extension '${existingKind.extension}' by option ${existingKind.reason}.`
        //             );
        //         } else if (existingDir) {
        //             throw new Error(
        //                 `Output folder "${additionalModuleKindToEmit.outFolderName}" already contains module kind ${existingDir.kind} ` +
        //                 `with target "${additionalModuleKindToEmit.target}" and with extension '${existingDir.extension}', ` +
        //                 `specified by option ${existingDir.reason}.`
        //             );
        //         } else {
        //             const outFolderKey: string | undefined = this._addModuleKindToEmit({
        //                 moduleKind,
        //                 target,
        //                 outFolderPath: additionalModuleKindToEmit.outFolderName,
        //                 isPrimary: false,
        //                 jsExtensionOverride: moduleKindReason.extension
        //             });

        //             if (outFolderKey) {
        //                 addToSpecifiedKinds(moduleKind, target, moduleKindReason);
        //                 specifiedOutDirs.set(outFolderKey, moduleKindReason);
        //             }
        //         }
        //     }
        // }




        const { outDir = 'dist' } = tsconfig.options;
        const jsExtension: IEmitReason[ 'extension' ] = `.${config.jsExtension || 'js'}`;


        const existingDir: IEmitReason | undefined = outDirs.get(this._outDirKey(outDir, jsExtension));

        if (existingDir) {
            throw new Error(
                `Output folder "${outDir}" has already been set to be emitted for the following reason: "${existingDir.reason}"`
            );
        } else {

            const emitReason: IEmitReason = {
                module: tsconfig.options.module,
                target: tsconfig.options.target,
                outDir,
                extension: jsExtension,
                reason: 'tsconfigPath' // `additionalModuleKindsToEmit`
            };

            const addToEmitArgs: Parameters<TypeScriptBuilder[ '_addToEmit' ]>[ 0 ] = {
                // module: tsconfig.options.module,
                // target: tsconfig.options.target || ts.ScriptTarget.ES2015,
                // outDir,
                typescriptOptions: tsconfig.options,
                isPrimary: config.isPrimary || false,
                jsExtensionOverride: emitReason.extension
            };


            if (this._addToEmit(addToEmitArgs)) {
                outDirs.set(outDir, emitReason);
                return true;
            }
        }

        return false;
    }

    private _outDirKey(outDir: string, jsExtensionOverride: IEmitReason[ 'extension' ]): string {
        return `${outDir}:${jsExtensionOverride}`;

    }
    private _addToEmit(args: {
        // module: TTypescript.ModuleKind,
        // target: TTypescript.ScriptTarget,
        // outDir: string,
        typescriptOptions: TTypescript.CompilerOptions;
        isPrimary: boolean,
        jsExtensionOverride: IEmitReason[ 'extension' ];
    }): string | undefined {

        const { /* module, target,  */typescriptOptions, isPrimary, jsExtensionOverride } = args;
        // const { module, target } = typescriptOptions;
        let { outDir = '' } = typescriptOptions;


        let outFolderName: string;

        if (path.isAbsolute(outDir)) {
            outFolderName = path.relative(this._configuration.buildFolderPath, outDir);
        } else {
            outFolderName = outDir;
            outDir = path.resolve(this._configuration.buildFolderPath, outDir);
        }

        outFolderName = Path.convertToSlashes(outFolderName);
        outFolderName = outFolderName.replace(/\/*$/, '/'); // Ensure the outFolderPath ends with a slash

        for (const toBeEmitted of this._outputsToBeEmitted) {
            let errorText: string | undefined;

            if (toBeEmitted.typescriptResolvedOptions.outDir === outFolderName) {
                if (toBeEmitted.jsExtensionOverride === jsExtensionOverride) {
                    errorText =
                        'Unable to output two different module kinds with the same ' +
                        `module extension (${jsExtensionOverride || '.js'}) to the same ` +
                        `folder ("${outFolderName}").`;
                }
            } else {
                const { outDir: toBeEmittedOutDir = '' } = toBeEmitted.typescriptResolvedOptions;

                let parentFolder: string | undefined;
                let childFolder: string | undefined;

                if (outFolderName.startsWith(toBeEmittedOutDir)) {
                    parentFolder = outFolderName;
                    childFolder = toBeEmittedOutDir;
                } else if (toBeEmittedOutDir.startsWith(outFolderName)) {
                    parentFolder = toBeEmittedOutDir;
                    childFolder = outFolderName;
                }

                if (parentFolder) {
                    errorText =
                        'Unable to output two different module kinds to nested folders ' +
                        `("${parentFolder}" and "${childFolder}").`;
                }
            }

            if (errorText) {
                this._typescriptLogger.emitError(new Error(errorText));
                return undefined;
            }
        }

        this._outputsToBeEmitted.push({
            /* outDir: outFolderName,
            module: module,
            target, */
            typescriptResolvedOptions: {
                ...typescriptOptions,
                outDir: outFolderName,
            },
            jsExtensionOverride,
            isPrimary
        });

        return this._outDirKey(outDir, jsExtensionOverride);
    }

    // private _loadTsconfig(ts: ExtendedTypeScript): TTypescript.ParsedCommandLine {
    //     const parsedConfigFile: ReturnType<typeof ts.readConfigFile> = ts.readConfigFile(
    //         this._configuration.tsconfigPath,
    //         ts.sys.readFile
    //     );

    //     const currentFolder: string = path.dirname(this._configuration.tsconfigPath);
    //     const tsconfig: TTypescript.ParsedCommandLine = ts.parseJsonConfigFileContent(
    //         parsedConfigFile.config,
    //         {
    //             fileExists: ts.sys.fileExists,
    //             readFile: ts.sys.readFile,
    //             readDirectory: ts.sys.readDirectory,
    //             useCaseSensitiveFileNames: true
    //         },
    //         currentFolder,
    //   /*existingOptions:*/ undefined,
    //         this._configuration.tsconfigPath
    //     );

    //     if (tsconfig.options.incremental) {
    //         tsconfig.options.tsBuildInfoFile = this._tsCacheFilePath;
    //     }

    //     return tsconfig;
    // }

    private _getCreateBuilderProgram(
        ts: ExtendedTypeScript
    ): TTypescript.CreateProgram<TTypescript.EmitAndSemanticDiagnosticsBuilderProgram> {
        const {
            _configuration: { emitChangedFilesCallback }
        } = this;

        const createMultiEmitBuilderProgram: TTypescript.CreateProgram<
            TTypescript.EmitAndSemanticDiagnosticsBuilderProgram
        > = (
            fileNames: readonly string[] | undefined,
            compilerOptions: TTypescript.CompilerOptions | undefined,
            host: TTypescript.CompilerHost | undefined,
            oldProgram: TTypescript.EmitAndSemanticDiagnosticsBuilderProgram | undefined,
            configFileParsingDiagnostics: readonly TTypescript.Diagnostic[] | undefined,
            projectReferences: readonly TTypescript.ProjectReference[] | undefined
        ): TTypescript.EmitAndSemanticDiagnosticsBuilderProgram => {
                // Reset performance counters
                ts.performance.disable();
                ts.performance.enable();

                this._typescriptTerminal.writeVerboseLine(`Reading program "${compilerOptions!.configFilePath}"`);

                const newProgram: TTypescript.EmitAndSemanticDiagnosticsBuilderProgram =
                    ts.createEmitAndSemanticDiagnosticsBuilderProgram(
                        fileNames,
                        compilerOptions,
                        host,
                        oldProgram,
                        configFileParsingDiagnostics,
                        projectReferences
                    );

                this._logReadPerformance(ts);

                const isolatedModules: boolean =
                    !!this._configuration.useTranspilerWorker && !!compilerOptions!.isolatedModules;
                const mode: 'both' | 'declaration' = isolatedModules ? 'declaration' : 'both';

                if (isolatedModules) {
                    // Kick the transpilation worker.
                    const filesToTranspile: Map<string, string> = getFilesToTranspileFromBuilderProgram(newProgram);
                    this._queueTranspileInWorker(this._tool!, compilerOptions!, filesToTranspile);
                }

                const { emit: originalEmit } = newProgram;

                const emit: TTypescript.Program[ 'emit' ] = (
                    outerTargetSourceFile?: TTypescript.SourceFile,
                    outerWriteFile?: TTypescript.WriteFileCallback,
                    outerCancellationToken?: TTypescript.CancellationToken,
                    outerEmitOnlyDtsFiles?: boolean,
                    outerCustomTransformers?: TTypescript.CustomTransformers
                ) => {
                    const innerProgram: TTypescript.Program = newProgram.getProgram();

                    const innerCompilerOptions: TTypescript.CompilerOptions = innerProgram.getCompilerOptions();

                    const { changedFiles } = configureProgramForMultiEmit({
                        innerProgram,
                        ts,
                        outputsToBeEmitted: this._outputsToBeEmitted,
                        mode,
                        buildFolderPath: this._configuration.buildFolderPath,
                        logger: this._typescriptLogger
                    }
                    );

                    const result: TTypescript.EmitResult = originalEmit.call(
                        newProgram,
                        outerTargetSourceFile,
                        outerWriteFile,
                        outerCancellationToken,
                        outerEmitOnlyDtsFiles,
                        outerCustomTransformers
                    );

                    (result as IExtendedEmitResult).changedSourceFiles = changedFiles;

                    this._typescriptTerminal.writeVerboseLine(
                        `Emitting program "${innerCompilerOptions!.configFilePath}"`
                    );

                    this._logEmitPerformance(ts);

                    // Reset performance counters
                    ts.performance.disable();
                    ts.performance.enable();

                    emitChangedFilesCallback(innerProgram, changedFiles);

                    return result;
                };

                newProgram.emit = emit;

                return newProgram;
            };

        return createMultiEmitBuilderProgram;
    }

    private _buildSolutionBuilderHost(tool: ITypeScriptTool): TSolutionHost {
        const reportSolutionBuilderStatus: TTypescript.DiagnosticReporter = tool.reportDiagnostic;
        const reportEmitErrorSummary: TTypescript.ReportEmitErrorSummary = (errorCount: number): void => {
            // Do nothing
        };

        const { ts } = tool;

        const solutionBuilderHost: TTypescript.SolutionBuilderHost<TTypescript.EmitAndSemanticDiagnosticsBuilderProgram> =
            ts.createSolutionBuilderHost(
                ts.sys,
                this._getCreateBuilderProgram(ts),
                tool.reportDiagnostic,
                reportSolutionBuilderStatus,
                reportEmitErrorSummary
            );

        solutionBuilderHost.afterProgramEmitAndDiagnostics = (
            program: TTypescript.EmitAndSemanticDiagnosticsBuilderProgram
        ) => {
            // Use the native metric since we aren't overwriting the writer
            this._typescriptTerminal.writeVerboseLine(
                `I/O Write: ${ts.performance.getDuration('I/O Write')}ms (${ts.performance.getCount(
                    'beforeIOWrite'
                )} files)`
            );
        };

        return solutionBuilderHost;
    }

    private _buildIncrementalCompilerHost(
        tool: ITypeScriptTool,
        tsconfig: TTypescript.ParsedCommandLine
    ): TTypescript.CompilerHost {
        const { ts } = tool;

        let compilerHost: TTypescript.CompilerHost | undefined;

        if (tsconfig.options.incremental) {
            compilerHost = ts.createIncrementalCompilerHost(tsconfig.options, ts.sys);
        } else {
            compilerHost = ts.createCompilerHost(tsconfig.options);
        }

        this._changeCompilerHostToUseCache(compilerHost, tool);

        return compilerHost;
    }

    private _buildWatchCompilerHost(
        tool: ITypeScriptTool,
        tsconfig: TTypescript.ParsedCommandLine
    ): TWatchCompilerHost {
        const { ts } = tool;

        const reportWatchStatus: TTypescript.DiagnosticReporter = (diagnostic: TTypescript.Diagnostic): void => {
            this._printDiagnosticMessage(ts, diagnostic);
        };

        const compilerHost: TWatchCompilerHost = ts.createWatchCompilerHost(
            tsconfig.fileNames,
            tsconfig.options,
            ts.sys,
            this._getCreateBuilderProgram(ts),
            tool.reportDiagnostic,
            reportWatchStatus,
            tsconfig.projectReferences,
            tsconfig.watchOptions
        );

        compilerHost.clearTimeout = tool.clearTimeout;
        compilerHost.setTimeout = tool.setTimeout;

        return compilerHost;
    }

    private _changeCompilerHostToUseCache(compilerHost: TTypescript.CompilerHost, tool: ITypeScriptTool): void {
        const { sourceFileCache } = tool;

        const { getSourceFile: innerGetSourceFile } = compilerHost;
        if ((innerGetSourceFile as { cache?: typeof sourceFileCache; }).cache === sourceFileCache) {
            return;
        }

        // Enable source file persistence
        const getSourceFile: typeof innerGetSourceFile & {
            cache?: typeof sourceFileCache;
        } = (
            fileName: string,
            languageVersionOrOptions: TTypescript.ScriptTarget | TTypescript.CreateSourceFileOptions,
            onError?: ((message: string) => void) | undefined,
            shouldCreateNewSourceFile?: boolean | undefined
        ): TTypescript.SourceFile | undefined => {
                if (!shouldCreateNewSourceFile) {
                    const cachedSourceFile: TTypescript.SourceFile | undefined = sourceFileCache.get(fileName);
                    if (cachedSourceFile) {
                        return cachedSourceFile;
                    }
                }

                const result: TTypescript.SourceFile | undefined = innerGetSourceFile(
                    fileName,
                    languageVersionOrOptions,
                    onError,
                    shouldCreateNewSourceFile
                );
                if (result) {
                    sourceFileCache.set(fileName, result);
                } else {
                    sourceFileCache.delete(fileName);
                }
                return result;
            };

        getSourceFile.cache = sourceFileCache;

        compilerHost.getSourceFile = getSourceFile;
    }

    private _buildWatchSolutionBuilderHost(tool: ITypeScriptTool): TWatchSolutionHost {
        const { reportDiagnostic, ts } = tool;

        const host: TWatchSolutionHost = ts.createSolutionBuilderWithWatchHost(
            ts.sys,
            this._getCreateBuilderProgram(ts),
            reportDiagnostic,
            reportDiagnostic,
            reportDiagnostic
        );

        host.clearTimeout = tool.clearTimeout;
        host.setTimeout = tool.setTimeout;

        return host;
    }

    // private _parseModuleKind(ts: ExtendedTypeScript, moduleKindName: ModuleKind): TTypescript.ModuleKind {
    //     switch (moduleKindName.toLowerCase() as Lowercase<ModuleKind>) {
    //         case 'commonjs':
    //             return ts.ModuleKind.CommonJS;

    //         case 'amd':
    //             return ts.ModuleKind.AMD;

    //         case 'umd':
    //             return ts.ModuleKind.UMD;

    //         case 'system':
    //             return ts.ModuleKind.System;

    //         case 'es2015':
    //             return ts.ModuleKind.ES2015;

    //         case 'es2020':
    //             return ts.ModuleKind.ES2020;

    //         case 'es2022':
    //             return ts.ModuleKind.ESNext;

    //         case 'esnext':
    //             return ts.ModuleKind.ESNext;

    //         case 'node16':
    //             return ts.ModuleKind.Node16;

    //         case 'nodenext':
    //             return ts.ModuleKind.NodeNext;

    //         default:
    //             throw new Error(`"${moduleKindName}" is not a valid module kind name.`);
    //     }
    // }

    // private _parseScriptTarget(ts: ExtendedTypeScript, target: IEmit[ 'target' ]): TTypescript.ScriptTarget | undefined {
    //     if (!target)
    //         return undefined;

    //     switch (target.toLowerCase() as Lowercase<Exclude<IEmit[ 'target' ], undefined>>) {
    //         case 'es3':
    //             return ts.ScriptTarget.ES3;

    //         case 'es5':
    //             return ts.ScriptTarget.ES5;

    //         case 'es2015':
    //             return ts.ScriptTarget.ES2015;

    //         case 'es2016':
    //             return ts.ScriptTarget.ES2016;

    //         case 'es2017':
    //             return ts.ScriptTarget.ES2017;

    //         case 'es2018':
    //             return ts.ScriptTarget.ES2018;

    //         case 'es2019':
    //             return ts.ScriptTarget.ES2019;

    //         case 'es2020':
    //             return ts.ScriptTarget.ES2020;

    //         case 'es2021':
    //             return ts.ScriptTarget.ES2021;

    //         case 'es2022':
    //             return ts.ScriptTarget.ESNext;

    //         case 'esnext':
    //             return ts.ScriptTarget.ESNext;

    //         case 'latest':
    //             return ts.ScriptTarget.Latest;

    //         default:
    //             throw new Error(`"${target}" is not a valid target name.`);
    //     }
    // }

    private _queueTranspileInWorker(
        tool: ITypeScriptTool,
        compilerOptions: TTypescript.CompilerOptions,
        filesToTranspile: Map<string, string>
    ): void {
        const { pendingTranspilePromises, pendingTranspileSignals } = tool;
        let maybeWorker: Worker | undefined = tool.worker;
        if (!maybeWorker) {
            const workerData: ITypescriptWorkerData = {
                typeScriptToolPath: this._configuration.typeScriptToolPath
            };
            tool.worker = maybeWorker = new Worker(require.resolve('./TranspilerWorker.js'), {
                workerData: workerData
            });

            maybeWorker.on('message', (response: ITranspilationResponseMessage) => {
                const { requestId: resolvingRequestId, type, result } = response;
                const signal: ITranspileSignal | undefined = pendingTranspileSignals.get(resolvingRequestId);

                if (type === 'error') {
                    const error: Error = Object.assign(new Error(result.message), result);
                    if (signal) {
                        signal.reject(error);
                    } else {
                        this._typescriptTerminal.writeErrorLine(
                            `Unexpected worker rejection for request with id ${resolvingRequestId}: ${error}`
                        );
                    }
                } else if (signal) {
                    signal.resolve(result);
                } else {
                    this._typescriptTerminal.writeErrorLine(
                        `Unexpected worker resolution for request with id ${resolvingRequestId}`
                    );
                }

                pendingTranspileSignals.delete(resolvingRequestId);
                pendingTranspilePromises.delete(resolvingRequestId);
            });

            maybeWorker.once('exit', (exitCode: number) => {
                if (pendingTranspileSignals.size) {
                    const error: Error = new Error(`Worker exited unexpectedly with code ${exitCode}.`);
                    for (const { reject: rejectTranspile } of pendingTranspileSignals.values()) {
                        rejectTranspile(error);
                    }
                    pendingTranspileSignals.clear();
                }
            });

            maybeWorker.once('error', (err: Error) => {
                for (const { reject: rejectTranspile } of pendingTranspileSignals.values()) {
                    rejectTranspile(err);
                }
                pendingTranspileSignals.clear();
            });
        }

        // make linter happy
        const worker: Worker = maybeWorker;

        const requestId: number = ++this._nextRequestId;
        const transpilePromise: Promise<TTypescript.EmitResult> = new Promise(
            (resolve: (result: TTypescript.EmitResult) => void, reject: (err: Error) => void) => {
                pendingTranspileSignals.set(requestId, { resolve, reject });

                this._typescriptTerminal.writeLine(`Asynchronously transpiling ${compilerOptions.configFilePath}`);
                const request: ITranspilationRequestMessage = {
                    compilerOptions,
                    filesToTranspile,
                    outputsToBeEmitted: this._outputsToBeEmitted,
                    requestId
                };

                worker.postMessage(request);
            }
        );

        pendingTranspilePromises.set(requestId, transpilePromise);
    }

    private _cleanupWorker(): void {
        const tool: ITypeScriptTool | undefined = this._tool;
        if (!tool) {
            return;
        }

        const { worker } = tool;
        if (worker) {
            worker.postMessage(false);
            tool.worker = undefined;
        }
    }
}

function getFilesToTranspileFromBuilderProgram(
    builderProgram: TTypescript.BuilderProgram
): Map<string, string> {
    const changedFilesSet: Set<string> = (
        builderProgram as unknown as { getState(): { changedFilesSet: Set<string>; }; }
    ).getState().changedFilesSet;

    const filesToTranspile: Map<string, string> = new Map();

    for (const fileName of changedFilesSet) {
        const sourceFile: TTypescript.SourceFile | undefined = builderProgram.getSourceFile(fileName);
        if (sourceFile && !sourceFile.isDeclarationFile) {
            filesToTranspile.set(sourceFile.fileName, sourceFile.text);
        }
    }
    return filesToTranspile;
}

function getFilesToTranspileFromProgram(program: TTypescript.Program): Map<string, string> {
    const filesToTranspile: Map<string, string> = new Map();
    for (const sourceFile of program.getSourceFiles()) {
        if (!sourceFile.isDeclarationFile) {
            filesToTranspile.set(sourceFile.fileName, sourceFile.text);
        }
    }
    return filesToTranspile;
}
