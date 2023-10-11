// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { ConfigurationFile, IConfigurationFileOptions, InheritanceType, PathResolutionMethod } from '@rushstack/heft-config-file';
import { FileSystem, type ITerminal, Path } from '@rushstack/node-core-library';
import * as path from 'path';
import { SyncHook } from 'tapable';
import { ITypeScriptBuilderConfiguration, TypeScriptBuilder } from './TypeScriptBuilder';

import type {
    HeftConfiguration,
    ICopyOperation,
    IHeftTaskFileOperations,
    IHeftTaskPlugin,
    IHeftTaskRunHookOptions,
    IHeftTaskRunIncrementalHookOptions,
    IHeftTaskSession
} from '@rushstack/heft';
import type * as TTypescript from 'typescript';
import type { IRigTypeScriptConfigurationJson } from './plugin-options';


/**
 * The name of the plugin, as specified in heft-plugin.json
 *
 * @public
 */
export const PLUGIN_NAME: 'typescript-plugin' = 'typescript-plugin';

/**
 * @beta
 */
export interface IPartialTsconfigCompilerOptions {
    outDir?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [ key: string ]: any;
}

/**
 * @beta
 */
export interface IPartialTsconfig {
    compilerOptions?: IPartialTsconfigCompilerOptions;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [ key: string ]: any;
}

/**
 * @beta
 */
export interface IChangedFilesHookOptions {
    program: TTypescript.Program;
    changedFiles?: ReadonlySet<TTypescript.SourceFile>;
}

/**
 * @beta
 */
export interface ITypeScriptPluginAccessor {
    readonly onChangedFilesHook: SyncHook<IChangedFilesHookOptions>;
}

let _typeScriptConfigurationFileLoader: ConfigurationFile<IRigTypeScriptConfigurationJson> | undefined;
const _typeScriptConfigurationFilePromiseCache: Map<
    string,
    Promise<IRigTypeScriptConfigurationJson>
> = new Map();

/**
 * @beta
 */
export async function loadRigTypeScriptConfigurationFileAsync(
    heftConfiguration: HeftConfiguration,
    terminal: ITerminal
): Promise<IRigTypeScriptConfigurationJson> {
    const buildFolderPath: string = heftConfiguration.buildFolderPath;

    // Check the cache first
    {
        const typescriptConfigurationFilePromise: Promise<IRigTypeScriptConfigurationJson> | undefined =
            _typeScriptConfigurationFilePromiseCache.get(buildFolderPath);

        if (typescriptConfigurationFilePromise)
            return typescriptConfigurationFilePromise;
    }

    // Ensure that the file loader has been initialized.
    if (!_typeScriptConfigurationFileLoader) {
        const schemaPath: string = `${__dirname}/schemas/typescript.schema.json`;

        const options: IConfigurationFileOptions<IRigTypeScriptConfigurationJson> = {
            projectRelativeFilePath: 'config/typescript.json',
            jsonSchemaPath: schemaPath,
            propertyInheritance: {
                staticAssetsToCopy: {
                    // When merging objects, arrays will be automatically appended
                    inheritanceType: InheritanceType.merge
                }
            }
        };

        _typeScriptConfigurationFileLoader = new ConfigurationFile<IRigTypeScriptConfigurationJson>(options);
    }

    const rigTypescriptConfigurationFilePromise: Promise<IRigTypeScriptConfigurationJson> =
        _typeScriptConfigurationFileLoader.tryLoadConfigurationFileForProjectAsync(
            terminal,
            buildFolderPath,
            heftConfiguration.rigConfig
        ).then(config => {
            if (config)
                return config;

            throw new Error(
                `No typescript configuration file found in the project folder "${buildFolderPath}"` +
                `(rig config: ${heftConfiguration.rigConfig}).)`);
        });

    _typeScriptConfigurationFilePromiseCache.set(buildFolderPath, rigTypescriptConfigurationFilePromise);


    return rigTypescriptConfigurationFilePromise;
}


let _partialTsconfigFileLoader: ConfigurationFile<IPartialTsconfig> | undefined;
const _partialTsconfigFilePromiseCache: Map<string, Promise<IPartialTsconfig>> = new Map();

function getTsconfigFilePath(
    folder: string,
    project: string = './tsconfig.json'
): string {
    return Path.convertToSlashes(
        // Use path.resolve because the path can start with `./` or `../`
        path.resolve(folder, project)
    );
}


const resolveTsconfigFilePath = async (
    heftConfiguration: HeftConfiguration,
    tsconfigPath: string,
    terminal: ITerminal,
): Promise<string | undefined> => {

    let tsconfigFilePath: string = getTsconfigFilePath(heftConfiguration.buildFolderPath, tsconfigPath);
    terminal.writeVerboseLine(`Looking for tsconfig "${tsconfigFilePath}"`);

    if (await FileSystem.existsAsync(tsconfigFilePath))
        return tsconfigFilePath;

    terminal.writeVerboseLine(`Not found`);

    const rigConfigFolder: string = path.join(await heftConfiguration.rigConfig.getResolvedProfileFolderAsync(), 'config');
    tsconfigFilePath = getTsconfigFilePath(rigConfigFolder, tsconfigPath);

    terminal.writeVerboseLine(`Looking for tsconfig "${tsconfigFilePath}"`);

    if (await FileSystem.existsAsync(tsconfigFilePath)) {
        return tsconfigFilePath;
    }

    terminal.writeVerboseLine(`Not found`);
};


/**
 * @beta
 */
export async function loadPartialTsconfigJsonFileAsync(
    heftConfiguration: HeftConfiguration,
    terminal: ITerminal,
    typeScriptConfigurationJson: IRigTypeScriptConfigurationJson | undefined
): Promise<IPartialTsconfig[]> {
    const { buildFolderPath } = heftConfiguration;

    const tsConfigs: IPartialTsconfig[] = await Promise.all(
        typeScriptConfigurationJson?.tsconfigs.map(async tsconfig => {

            if (!tsconfig.tsconfigPath) {
                return Promise.resolve(tsconfig.tsconfigJson || {});
            }

            const cacheKey: string = `${buildFolderPath}#${tsconfig.tsconfigPath}`;

            // Check the cache first
            {
                const partialTsconfigFilePromise: Promise<IPartialTsconfig> | undefined =
                    _partialTsconfigFilePromiseCache.get(cacheKey);

                if (partialTsconfigFilePromise)
                    return partialTsconfigFilePromise!;
            }

            // We don't want to load the tsconfig.json file through the rig, but we do want to take
            // advantage of the extends functionality that ConfigurationFile provides. So we'll
            // check to see if the file exists and exit early if not.
            // terminal.writeLine('______________');
            // terminal.writeLine(JSON.stringify(heftConfiguration.rigConfig));
            // terminal.writeLine('______________');

            const tsconfigFilePath: string | undefined = await resolveTsconfigFilePath(
                heftConfiguration,
                tsconfig.tsconfigPath,
                terminal
            );

            if (!tsconfigFilePath) {
                return Promise.reject(
                    `No tsconfig file "${tsconfig.tsconfigPath}" found!"`
                );
            }

            // Ensure that the file loader has been initialized.
            if (!_partialTsconfigFileLoader) {
                const schemaPath: string = `${__dirname}/schemas/anything.schema.json`;

                _partialTsconfigFileLoader = new ConfigurationFile<IPartialTsconfig>({
                    projectRelativeFilePath: tsconfigFilePath,
                    jsonSchemaPath: schemaPath,
                    propertyInheritance: {
                        compilerOptions: {
                            inheritanceType: InheritanceType.merge
                        }
                    },
                    jsonPathMetadata: {
                        '$.compilerOptions.outDir': {
                            pathResolutionMethod: PathResolutionMethod.resolvePathRelativeToConfigurationFile
                        }
                    }
                });
            }

            const partialTsconfigFilePromise: Promise<IPartialTsconfig> =
                _partialTsconfigFileLoader.loadConfigurationFileForProjectAsync(
                    terminal,
                    buildFolderPath,
                    heftConfiguration.rigConfig
                ).then(config => ({ ...config, ...tsconfig.tsconfigJson }));

            _partialTsconfigFilePromiseCache.set(cacheKey, partialTsconfigFilePromise!);

            return partialTsconfigFilePromise;
        }) || []
    );

    return tsConfigs;
}
// export async function loadPartialTsconfigJsonFileAsync(
//     heftConfiguration: HeftConfiguration,
//     terminal: ITerminal,
//     typeScriptConfigurationJson: IRigTypeScriptConfigurationJson | undefined
// ): Promise<IPartialTsconfig[]> {
//     const { buildFolderPath } = heftConfiguration;

//     const tsConfigs: IPartialTsconfig[] = await Promise.all(
//         typeScriptConfigurationJson?.tsconfigs.map(async tsconfig => {

//             if (!tsconfig.tsconfigPath) {
//                 return Promise.resolve({
//                     ...tsconfig,
//                     tsconfigJson: tsconfig.tsconfigJson || {}
//                 });
//             }

//             const cacheKey: string = `${buildFolderPath}#${tsconfig.tsconfigPath}`;

//             // Check the cache first
//             {
//                 const partialTsconfigFilePromise: Promise<IPartialTsconfig> | undefined =
//                     _partialTsconfigFilePromiseCache.get(cacheKey);

//                 if (partialTsconfigFilePromise)
//                     return partialTsconfigFilePromise!;
//             }

//             // We don't want to load the tsconfig.json file through the rig, but we do want to take
//             // advantage of the extends functionality that ConfigurationFile provides. So we'll
//             // check to see if the file exists and exit early if not.
//             // terminal.writeLine('______________');
//             // terminal.writeLine(JSON.stringify(heftConfiguration.rigConfig));
//             // terminal.writeLine('______________');

//             const _getTsconfigFilePath = async (): Promise<string | undefined> => {
//                 let tsconfigFilePath: string = getTsconfigFilePath(buildFolderPath, tsconfig.tsconfigPath);
//                 terminal.writeVerboseLine(`Looking for tsconfig "${tsconfigFilePath}"`);

//                 if (await FileSystem.existsAsync(tsconfigFilePath))
//                     return tsconfigFilePath;

//                 terminal.writeVerboseLine(`Not found`);

//                 const rigConfigFolder: string = path.join(await heftConfiguration.rigConfig.getResolvedProfileFolderAsync(), 'config');
//                 tsconfigFilePath = getTsconfigFilePath(rigConfigFolder, tsconfig.tsconfigPath);

//                 terminal.writeVerboseLine(`Looking for tsconfig "${tsconfigFilePath}"`);

//                 if (await FileSystem.existsAsync(tsconfigFilePath)) {
//                     return tsconfigFilePath;
//                 }

//                 terminal.writeVerboseLine(`Not found`);
//             };

//             const tsconfigFilePath: string | undefined = await _getTsconfigFilePath();

//             if (!tsconfigFilePath) {
//                 return Promise.reject(
//                     `No tsconfig file "${tsconfig.tsconfigPath}" found!"`
//                 );
//             }

//             // Ensure that the file loader has been initialized.
//             if (!_partialTsconfigFileLoader) {
//                 const schemaPath: string = `${__dirname}/schemas/anything.schema.json`;

//                 _partialTsconfigFileLoader = new ConfigurationFile<IPartialTsconfig>({
//                     projectRelativeFilePath: tsconfigFilePath,
//                     jsonSchemaPath: schemaPath,
//                     propertyInheritance: {
//                         compilerOptions: {
//                             inheritanceType: InheritanceType.merge
//                         }
//                     },
//                     jsonPathMetadata: {
//                         '$.compilerOptions.outDir': {
//                             pathResolutionMethod: PathResolutionMethod.resolvePathRelativeToConfigurationFile
//                         }
//                     }
//                 });
//             }

//             const partialTsconfigFilePromise: Promise<IPartialTsconfig> =
//                 _partialTsconfigFileLoader.loadConfigurationFileForProjectAsync(
//                     terminal,
//                     buildFolderPath,
//                     heftConfiguration.rigConfig
//                 ).then(config => ({
//                     ...tsconfig,
//                     tsconfigJson: { ...config, ...tsconfig.tsconfigJson }
//                 }));

//             _partialTsconfigFilePromiseCache.set(cacheKey, partialTsconfigFilePromise!);

//             return partialTsconfigFilePromise;
//         }) || []
//     );

//     return tsConfigs;
// }



export default class TypeScriptPlugin implements IHeftTaskPlugin {
    public accessor: ITypeScriptPluginAccessor = {
        onChangedFilesHook: new SyncHook<IChangedFilesHookOptions>([ 'changedFilesHookOptions' ])
    };

    public apply(taskSession: IHeftTaskSession, heftConfiguration: HeftConfiguration): void {
        taskSession.hooks.registerFileOperations.tapPromise(
            PLUGIN_NAME,
            async (fileOperations: IHeftTaskFileOperations): Promise<IHeftTaskFileOperations> => {
                // TODO: We should consider maybe only doing one copy of static assets and pointing
                // all source files to this set of static assets. This would allow us to avoid
                // having to copy the static assets multiple times, increasing build times and
                // package size.
                for (const copyOperation of await this._getStaticAssetCopyOperations(
                    taskSession,
                    heftConfiguration
                )) {
                    fileOperations.copyOperations.add(copyOperation);
                }

                return fileOperations;
            }
        );

        taskSession.hooks.run.tapPromise(PLUGIN_NAME, async (runOptions: IHeftTaskRunHookOptions) => {
            const builder: TypeScriptBuilder | false = await this._getTypeScriptBuilderAsync(
                taskSession,
                heftConfiguration
            );

            if (builder) {
                await builder.invokeAsync();
            }
        });

        let incrementalBuilder: TypeScriptBuilder | undefined | false;
        taskSession.hooks.runIncremental.tapPromise(
            PLUGIN_NAME,
            async (runIncrementalOptions: IHeftTaskRunIncrementalHookOptions) => {
                if (incrementalBuilder === undefined) {
                    // eslint-disable-next-line require-atomic-updates
                    incrementalBuilder = await this._getTypeScriptBuilderAsync(taskSession, heftConfiguration);
                }

                if (incrementalBuilder) {
                    await incrementalBuilder.invokeAsync(runIncrementalOptions.requestRun);
                }
            }
        );
    }

    private async _tryLoadRigTypeScriptConfigurationFileAsync(
        taskSession: IHeftTaskSession,
        heftConfiguration: HeftConfiguration
    ): Promise<
        | { error: Error; config: undefined; }
        | { error: undefined; config: IRigTypeScriptConfigurationJson; }> {

        return loadRigTypeScriptConfigurationFileAsync(heftConfiguration, taskSession.logger.terminal)
            .then(config => ({ error: undefined, config }))
            .catch((error: Error) => ({ error, config: undefined }));
    };

    private async _tryLoadTypeScriptJsonAsync(
        taskSession: IHeftTaskSession,
        heftConfiguration: HeftConfiguration,
        typeScriptConfiguration: IRigTypeScriptConfigurationJson
    ): Promise<
        | { error: Error; config: undefined; }
        | { error: undefined; config: IPartialTsconfig[]; }> {

        return loadPartialTsconfigJsonFileAsync(heftConfiguration, taskSession.logger.terminal, typeScriptConfiguration)
            .then(config => ({ error: undefined, config }))
            .catch((error: Error) => ({ error, config: undefined }));
    };

    private async _getStaticAssetCopyOperations(
        taskSession: IHeftTaskSession,
        heftConfiguration: HeftConfiguration
    ): Promise<ICopyOperation[]> {

        // eslint-disable-next-line @typescript-eslint/typedef
        const { error, config: rigTypeScriptConfiguration } = await this._tryLoadRigTypeScriptConfigurationFileAsync(
            taskSession,
            heftConfiguration
        );

        if (error)
            return [];

        // We only care about the copy if static assets were specified.
        const copyOperations: ICopyOperation[] = [];
        if (
            rigTypeScriptConfiguration?.staticAssetsToCopy?.fileExtensions?.length ||
            rigTypeScriptConfiguration?.staticAssetsToCopy?.includeGlobs?.length ||
            rigTypeScriptConfiguration?.staticAssetsToCopy?.excludeGlobs?.length
        ) {

            // Add the output folder and all additional module kind output folders as destinations
            const tsconfigOutDirs: (string | undefined)[] = await this._getTsconfigOutDirsAsync(
                taskSession,
                heftConfiguration,
                rigTypeScriptConfiguration
            );

            ;
            copyOperations.push({
                ...rigTypeScriptConfiguration?.staticAssetsToCopy,

                // For now - these may need to be revised later
                sourcePath: path.resolve(heftConfiguration.buildFolderPath, 'src'),
                destinationFolders: tsconfigOutDirs.filter(tsconfigOutDir => !!tsconfigOutDir) as string[],
                flatten: false,
                hardlink: false
            });
        };

        return copyOperations;
    }


    private async _getTypeScriptBuilderAsync(
        taskSession: IHeftTaskSession,
        heftConfiguration: HeftConfiguration
    ): Promise<TypeScriptBuilder | false> {
        const terminal: ITerminal = taskSession.logger.terminal;

        const {
            error: typeScriptConfigurationError,
            config: rigTypeScriptConfiguration
        } = await this._tryLoadRigTypeScriptConfigurationFileAsync(
            taskSession,
            heftConfiguration
        );

        if (typeScriptConfigurationError) {
            terminal.writeLine(typeScriptConfigurationError.message);
            terminal.writeLine(`Skipping ${PLUGIN_NAME}.`);
            return false;
        }

        const hasPrimaryDefined: boolean = !!rigTypeScriptConfiguration.tsconfigs.find(config => config.isPrimary);

        // set default isPrimary tsconfig as first one if not defined explicitly
        if (!hasPrimaryDefined)
            rigTypeScriptConfiguration.tsconfigs[ 0 ].isPrimary = true;


        // const { error: typeScriptConfigurationJsonError, config: tsConfigs } = await this._tryLoadTypeScriptJsonAsync(
        //     taskSession,
        //     heftConfiguration,
        //     rigTypeScriptConfiguration
        // );

        // if (typeScriptConfigurationJsonError) {
        //     terminal.writeLine(typeScriptConfigurationJsonError.message);
        //     terminal.writeLine(`Skipping ${PLUGIN_NAME}.`);
        //     return false;
        // }


        const typeScriptToolPath: string = await heftConfiguration.rigPackageResolver.resolvePackageAsync(
            'typescript',
            terminal
        );

        // Build out the configuration
        const typeScriptBuilderConfiguration: ITypeScriptBuilderConfiguration = {
            rigConfig: heftConfiguration.rigConfig,
            buildFolderPath: heftConfiguration.buildFolderPath,
            // Build metadata is just another build output, but we put it in the temp folder because it will
            // usually be discarded when published.
            buildMetadataFolderPath: taskSession.tempFolderPath,
            typeScriptToolPath: typeScriptToolPath,

            buildProjectReferences: undefined,
            useTranspilerWorker: undefined,
            // tsconfigBase: undefined,
            // emit: [],
            tsconfigs: await Promise.all(rigTypeScriptConfiguration.tsconfigs.map(async config => ({
                ...config,
                //TODO:  emit an Error and not || config.tsconfigPath
                tsconfigPath: (await resolveTsconfigFilePath(heftConfiguration, config.tsconfigPath, terminal)) || config.tsconfigPath
            }))),


            // emitTsconfigAsBase: typeScriptConfigurationJson?.emitTsconfigAsBase,

            // buildProjectReferences: typeScriptConfigurationJson?.buildProjectReferences,
            // useTranspilerWorker: typeScriptConfigurationJson?.useTranspilerWorker,

            // tsconfigPath: getTsconfigFilePath(heftConfiguration, typeScriptConfigurationJson),
            // emit: typeScriptConfigurationJson?.emit,

            // emitCjsExtensionForCommonJS: !!typeScriptConfigurationJson?.emitCjsExtensionForCommonJS,
            // emitMjsExtensionForESModule: !!typeScriptConfigurationJson?.emitMjsExtensionForESModule,
            scopedLogger: taskSession.logger,
            emitChangedFilesCallback: (
                program: TTypescript.Program,
                changedFiles?: Set<TTypescript.SourceFile>
            ) => {
                // Provide the typescript program dependent plugins
                if (this.accessor.onChangedFilesHook.isUsed()) {
                    this.accessor.onChangedFilesHook.call({ program, changedFiles });
                }
            }
        };

        // Run the builder
        const typeScriptBuilder: TypeScriptBuilder = new TypeScriptBuilder(typeScriptBuilderConfiguration);
        return typeScriptBuilder;
    }

    private async _getTsconfigOutDirsAsync(
        taskSession: IHeftTaskSession,
        heftConfiguration: HeftConfiguration,
        typeScriptConfiguration: IRigTypeScriptConfigurationJson
    ): Promise<(string | undefined)[]> {

        const { error, config: partialTsconfigFiles } = await this._tryLoadTypeScriptJsonAsync(
            taskSession,
            heftConfiguration,
            typeScriptConfiguration
        );

        if (error)
            return [];

        return partialTsconfigFiles.map(config => config.tsconfigJson.compilerOptions?.outDir);
    }
}
