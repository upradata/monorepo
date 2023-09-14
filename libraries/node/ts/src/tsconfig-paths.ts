import type { TsConfig } from './tsconfig.json';

import { map } from '@upradata/util';
import { dirname, isAbsolute, join } from 'node:path';
import { register } from 'tsconfig-paths';
import { getTsConfigJson, MergedTsConfigData } from './tsconfig';


export class RegisterOptions {
    baseUrl?: string = undefined;
    mainFields?: string[] = [ 'main' ];
    fromDirectory?: string = undefined;
    tsconfig?: MergedTsConfigData = undefined;
    transform?: (absolutePath: string, tsconfig: TsConfig) => string = s => s;
}

export function registerPaths(options: RegisterOptions) {
    const opts = Object.assign(new RegisterOptions(), options);

    if (!opts.tsconfig) {
        const dir = opts.fromDirectory || '.';
        opts.tsconfig = getTsConfigJson(dir);
    }

    const { tsconfig, transform } = opts;
    const { compilerOptions } = tsconfig.config;

    const paths = compilerOptions.paths as Record<string, string[]>;
    const tsRootDir = dirname(tsconfig.tsConfigFiles.at(-1));

    // transform relative paths to absolute ones.
    // Important if registration is not done in the root project folder


    const transformedPaths = map(paths, (_path, maps) => maps.flatMap(
        p => [ p, ...(isAbsolute(p) ? [] : [ join(tsRootDir, p) ]) ].map(p => transform(p, tsconfig.config))
    ));


    // better to have an absolute path if the cwd is not where tsconfig.json is
    let baseUrl = opts.baseUrl || compilerOptions.baseUrl || tsRootDir;

    if (!isAbsolute(baseUrl))
        baseUrl = join(tsRootDir, baseUrl);

    register({
        baseUrl,
        paths: transformedPaths,
        mainFields: opts.mainFields
    });
}
