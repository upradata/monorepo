/**
 * A Heft plugin for using TypeScript.
 *
 * @packageDocumentation
 */

import type { HeftConfiguration } from '@rushstack/heft';
import { ITerminal } from '@rushstack/node-core-library';
import { SyncHook } from 'tapable';
import type * as TTypescript from 'typescript';

/**
 * @beta
 */
export declare interface IChangedFilesHookOptions {
    program: TTypescript.Program;
    changedFiles?: ReadonlySet<TTypescript.SourceFile>;
}

/**
 * @beta
 */
export declare interface IEmitModuleKind {
    moduleKind: 'commonjs' | 'amd' | 'umd' | 'system' | 'es2015' | 'esnext';
    outFolderName: string;
    jsExtensionOverride?: string;
}

/**
 * @beta
 */
export declare interface IPartialTsconfig {
    compilerOptions?: IPartialTsconfigCompilerOptions;
}

/**
 * @beta
 */
export declare interface IPartialTsconfigCompilerOptions {
    outDir?: string;
}

/**
 * @beta
 */
export declare interface IStaticAssetsCopyConfiguration {
    fileExtensions: string[];
    excludeGlobs: string[];
    includeGlobs: string[];
}

/**
 * @beta
 */
export declare interface ITypeScriptConfigurationJson {
    /**
     * If provided, emit these module kinds in addition to the modules specified in the tsconfig.
     * Note that this option only applies to the main tsconfig.json configuration.
     */
    additionalModuleKindsToEmit?: IEmitModuleKind[] | undefined;
    /**
     * If 'true', emit CommonJS output into the TSConfig outDir with the file extension '.cjs'
     */
    emitCjsExtensionForCommonJS?: boolean | undefined;
    /**
     * If 'true', emit ESModule output into the TSConfig outDir with the file extension '.mjs'
     */
    emitMjsExtensionForESModule?: boolean | undefined;
    /**
     * If true, enable behavior analogous to the "tsc --build" command. Will build projects referenced by the main project in dependency order.
     * Note that this will effectively enable \"noEmitOnError\".
     */
    buildProjectReferences?: boolean;
    /**
     * If true, and the tsconfig has \"isolatedModules\": true, then transpilation will happen in parallel in a worker thread.
     */
    useTranspilerWorker?: boolean;
    project?: string;
    /**
     * Configures additional file types that should be copied into the TypeScript compiler's emit folders, for example
     * so that these files can be resolved by import statements.
     */
    staticAssetsToCopy?: IStaticAssetsCopyConfiguration;
}

/**
 * @beta
 */
export declare interface ITypeScriptPluginAccessor {
    readonly onChangedFilesHook: SyncHook<IChangedFilesHookOptions>;
}

/**
 * @beta
 */
export declare function loadPartialTsconfigFileAsync(heftConfiguration: HeftConfiguration, terminal: ITerminal, typeScriptConfigurationJson: ITypeScriptConfigurationJson | undefined): Promise<IPartialTsconfig | undefined>;

/**
 * @beta
 */
export declare function loadTypeScriptConfigurationFileAsync(heftConfiguration: HeftConfiguration, terminal: ITerminal): Promise<ITypeScriptConfigurationJson | undefined>;

/**
 * The name of the plugin, as specified in heft-plugin.json
 *
 * @public
 */
export declare const TypeScriptPluginName: 'typescript-plugin';

export { };
