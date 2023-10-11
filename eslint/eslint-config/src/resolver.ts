// FROM https://github.com/import-js/eslint-plugin-import/issues/1810

const fs = require('graceful-fs');
const path = require('path');
const { builtinModules } = require('module');
const enhancedResolve = require('enhanced-resolve');
const CachedInputFileSystem = require('enhanced-resolve/lib/CachedInputFileSystem');

const builtins = new Set(builtinModules);

const nodeFileSystem = new CachedInputFileSystem(fs, 4000);
const defaultResolver = enhancedResolve.create.sync(opts(undefined));

function resolve(source, file, config) {
    if (builtins.has(source)) {
        return { found: true, path: null };
    }

    try {
        const resolver = config && Object.keys(config).length > 0 ? enhancedResolve.create.sync(opts(config)) : defaultResolver;
        const result = resolver(path.dirname(file), source);

        return { found: true, path: result };
    } catch (e) {
        return { found: false };
    }
}

function opts(config) {
    return {
        fileSystem: nodeFileSystem,
        conditionNames: [ 'node' ],
        extensions: [ '.js', '.mjs', '.jsx', '.json', '.node', '.ts', '.mts', '.tsx' ],
        preferRelative: true,
        ...config
    };
}

export = {
    interfaceVersion: 2,
    resolve,
};
