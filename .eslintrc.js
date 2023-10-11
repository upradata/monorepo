const fs = require('node:fs');
const path = require('node:path');
const { defineConfig } = require('eslint-define-config');
// const { fileURLToPath } = require('node:url');

//  path.dirname(fileURLToPath(import.meta.url))
const dirname = __dirname;

const getNodesModules = (directory, level) => {

    const get = (modules = [], currentDirectory = path.resolve(dirname, directory), currentLevel = 1) => {
        /* const directoryModules = fs.readdirSync(currentDirectory, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .flatMap(dirent => {
                console.log('_______', dirent.path, dirent.name);
                const dir = path.join(dirent.path, dirent.name);

                if (currentLevel === level - 1) {
                    const nodeModule = path.join(dir, 'node_modules');
                    return fs.existsSync(nodeModule) ? [ ...modules, path.join(dir, 'node_modules') ] : modules;
                }

                return get(modules, dir, currentLevel + 1);
            });
 */

        const directoryModules = fs.readdirSync(currentDirectory)
            .filter(file => fs.lstatSync(path.join(currentDirectory, file)).isDirectory())
            .flatMap(file => {
                const dir = path.join(currentDirectory, file);

                if (currentLevel === level - 1) {
                    const nodeModule = path.join(dir, 'node_modules');
                    return fs.existsSync(nodeModule) ? [ ...modules, path.join(dir, 'node_modules') ] : modules;
                }

                return get(modules, dir, currentLevel + 1);
            });


        return directoryModules;
    };

    return get();

};


module.exports = defineConfig({
    root: true,
    extends: [
        './eslint/eslint-config/lib/profile/node-trusted-tool.js'
    ],
    // parserOptions: { tsconfigRootDir: __dirname },
    settings: {
        'import/resolver': {
            typescript: {
                project: '**/tsconfig.json'
            }
        },
        /* 'import/external-module-folders': [
            ...getNodesModules('./libraries', 3),
            ...getNodesModules('./eslint', 2),
            ...getNodesModules('./heft-plugins', 2),
            ...getNodesModules('./rigs', 2)
        ] */
    }
});
