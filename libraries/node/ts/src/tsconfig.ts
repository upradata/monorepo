import type { TsConfig } from './tsconfig.json';

import { findUpDir } from '@upradata/find-up';
import { assignRecursive, ensureArray } from '@upradata/useful';
import path from 'node:path';
import * as tsconfig from 'tsconfig';


export interface MergedTsConfigData {
    // path: { start: string; end: string; };
    tsConfigFiles: string[];
    config: TsConfig;
}

interface TsConfigData {
    path?: string;
    config: TsConfig;
}


const mergeExtendedTsconfigJson = (tsConfig: TsConfig, tsConfigFiles: string[]): MergedTsConfigData => {

    if (!tsConfig.extends || tsConfig.extends.length === 0) {
        return { tsConfigFiles, config: tsConfig };
    }

    const mergedTsConfigData = ensureArray(tsConfig.extends).reduce<MergedTsConfigData>((data, extend) => {
        const { dir, name } = path.parse(extend);
        const extendedTsconfigJsonFilePath = `${name}.json`;

        const extendedTsConfig = tsconfig.loadSync(dir, extendedTsconfigJsonFilePath);

        if (!extendedTsConfig.path)
            throw new Error(`Cannot find tsconfig file: "${path.join(dir, extendedTsconfigJsonFilePath)}"`);

        const mergedTsconfig = assignRecursive(
            data.config,
            { extends: undefined as TsConfig[ 'extends' ] },
            extendedTsConfig.config as TsConfig
        );

        return mergeExtendedTsconfigJson(mergedTsconfig, [ ...tsConfigFiles, extendedTsConfig.path ]);
    }, { tsConfigFiles, config: tsConfig });


    return mergedTsConfigData;
};


// @deprecated
/*
      const parsedConfigFile: ReturnType<typeof ts.readConfigFile> = ts.readConfigFile(
            tsconfigPath,
            ts.sys.readFile
        );
*/
export function getTsConfigJson(directory: string = process.cwd(), tsconfigFile: string = 'tsconfig.json'): MergedTsConfigData {

    const tsconfigDir = findUpDir.sync(tsconfigFile, { from: directory });

    const tsConfig: TsConfigData = tsconfig.loadSync(tsconfigDir, tsconfigFile);

    if (!tsConfig.path)
        throw new Error(`Cannot find tsconfig file "${path.join(directory, tsconfigFile)}"`);

    return mergeExtendedTsconfigJson(tsConfig.config, [ tsConfig.path ]);
}
