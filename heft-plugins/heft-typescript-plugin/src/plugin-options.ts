import type * as TTypescript from 'typescript';


/**
 * @beta
 */
export interface IEmitModuleKind {
    moduleKind: Exclude<keyof typeof TTypescript.ModuleKind, 'None'>; // 'commonjs' | 'amd' | 'umd' | 'system' | 'es2015' | 'esnext';
    target?: keyof typeof TTypescript.ScriptTarget;
    jsExtension?: 'js' | 'cjs' | 'mjs';
    outFolderName: string;
    jsExtensionOverride?: string;
}

/**
 * @beta
 */
export interface IStaticAssetsCopyConfiguration {
    fileExtensions: string[];
    excludeGlobs: string[];
    includeGlobs: string[];
}

/**
 * @beta
 */
export interface ITypeScriptConfigurationJson {
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

    /**
     * Specifies the tsconfig.json file that will be used for compilation. Equivalent to the "project" argument for the 'tsc' and 'tslint' command line tools.
     *
     * The default value is "./tsconfig.json"
     */
    project?: string;

    /**
     * Specifies if the the tsconfig.json is used as a base or an entire config for a compilation.
     * To use in conjunction with the "additionalModuleKindsToEmit" option.
     */
    useTsconfigAsBase?: boolean;

    /**
     * Configures additional file types that should be copied into the TypeScript compiler's emit folders, for example
     * so that these files can be resolved by import statements.
     */
    staticAssetsToCopy?: IStaticAssetsCopyConfiguration;
}
