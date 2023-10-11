import type * as TTypescript from 'typescript';


export type ModuleKind = Exclude<keyof typeof TTypescript.ModuleKind, 'None'>;

/**
 * @beta
 */
export interface ITypescriptConfig {
    // moduleKind?: ModuleKind; // 'commonjs' | 'amd' | 'umd' | 'system' | 'es2015' | 'esnext';
    // target?: keyof typeof TTypescript.ScriptTarget;
    // tsconfigPath?: string;
    // jsExtension?: 'js' | 'cjs' | 'mjs';
    // isPrimary?: boolean;
    // outFolderName: string;
    // jsExtensionOverride?: string;


    tsconfigPath: string;
    jsExtension?: 'js' | 'cjs' | 'mjs';
    isPrimary?: boolean;
    tsconfigJson?: ITsConfigJson;
}


export interface ITsConfigJson {
    compilerOptions?: TTypescript.CompilerOptions;
    // include?: string[];
    // exclude?: string[];
    // references?: TTypescript.ProjectReference[];
    // extends?: string;
    // files?: string[];
    // compileOnSave?: boolean;
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
export interface IRigTypeScriptConfigurationJson {
    /**
     * If provided, emit these module kinds in addition to the modules specified in the tsconfig.
     * Note that this option only applies to the main tsconfig.json configuration.
     */
    tsconfigs: ITypescriptConfig[];
    // 'emit.inheritanceType'?: Exclude<keyof typeof InheritanceType, 'custom'> | undefined;

    /**
     * If 'true', emit CommonJS output into the TSConfig outDir with the file extension '.cjs'
     */
    // emitCjsExtensionForCommonJS?: boolean | undefined;

    /**
     * If 'true', emit ESModule output into the TSConfig outDir with the file extension '.mjs'
     */
    // emitMjsExtensionForESModule?: boolean | undefined;

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
    // tsconfigBase?: string;

    /**
     * Specifies if the the tsconfig.json is used as a base or an entire config for a compilation.
     * To use in conjunction with the "additionalModuleKindsToEmit" option.
     */
    // emitTsconfigAsBase?: boolean;

    /**
     * Configures additional file types that should be copied into the TypeScript compiler's emit folders, for example
     * so that these files can be resolved by import statements.
     */
    staticAssetsToCopy?: IStaticAssetsCopyConfiguration;
}
