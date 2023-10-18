// eslint-disable-next-line import/no-relative-packages
import typescriptEslintRecommended from '../node_modules/@typescript-eslint/eslint-plugin/dist/configs/recommended';
import { defineConfig } from 'eslint-define-config';
import { jsRules } from './js-rules';
import { tsRules } from './ts-rules';

// eslint-disable-next-line no-duplicate-imports
import type { Rules } from 'eslint-define-config';
import { Profile } from './profile';


// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('@rushstack/eslint-config/patch/modern-module-resolution');

// I added the alias 'eslint-plugin-import' -> 'npm:eslint-plugin-i@latest' in common/config/rush/pnpm-config.json

const jsExtensions = [ '.js', '.mjs', '.jsx', '.json', '.node' ];
const tsExtensions = [ '.ts', '.mts', '.tsx', '.d.ts' ];

export const buildRules = (profile: Profile) => defineConfig({
    env: {
        // es6: true,
        browser: profile === 'web-app',
        node: profile !== 'web-app'
    },
    extends: [
        // eslint-config- prefix can be omitted
        // The plugins property value can omit the eslint-plugin- prefix of the package name
        'eslint:recommended',
        // 'plugin:import/recommended',
        'plugin:import/typescript',
        'airbnb/hooks',
        // 'airbnb/whitespace',
        require.resolve('./airbnb'),
        'prettier'
    ],
    plugins: [
        'import',
        ...(profile === 'web-app' ? [ 'jsx-a11y' ] : []),
        ...(profile === 'web-app' ? [ 'react' ] : []),
        'prettier'
    ],
    parserOptions: {
        // ecmaVersion: 2015,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
            impliedStrict: true,
            jsx: profile === 'web-app'
        },
        warnOnUnsupportedTypeScriptVersion: true
    },
    ignorePatterns: [ '**/lib*/**', '**/dist*/**', '**/node_modules/**' ],
    rules: jsRules(profile),
    settings: {
        /**
         * https://github.com/import-js/eslint-plugin-import/issues/1810
         * no-unresolved is not aware of exports definition in package.json
         *
         * Someone gave this workaround: eslint-import-resolver-exports
         * This package adds package.json#exports support to eslint-plugin-import using the resolve.exports package.
         */
        'import/resolver': {
            node: { extensions: jsExtensions },
            exports: {
                // Accepts the same options as the `resolve.exports` package
                // See: https://github.com/lukeed/resolve.exports#optionsunsafe

                // All optional, default values are shown

                // Add 'require' field to the conditions
                require: false, // false means 'import'
                // Add 'browser' field to the conditions
                browser: profile === 'web-app', // false mean 'node'
                // List of additional/custom conditions
                conditions: [], // add any other package.json exports conditions
                // Ignore everything except the `conditions` option
                unsafe: false,
            }
        },
        'import/external-module-folders': [ 'node_modules' ],
        'import/internal-regex': '^@upradata/',
        'import/extensions': jsExtensions,
        // 'import/external-module-folders': [ 'node_modules', 'node_modules/@types' ],
        // 'import/resolver': require('path').resolve(__dirname, './js-resolver')
    },
    overrides: [
        {
            extends: [
                // 'plugin:@typescript-eslint/recommended', // done in @rushstack/eslint-config
                `@rushstack/eslint-config/profile/${profile}`,
                '@rushstack/eslint-config/mixins/tsdoc',
            ],
            files: [ '*.ts', '*.tsx', '*.mts' ],
            //  parserOptions: {
            //      project: [ 'tsconfig.json', 'tsconfig.lib.json' ], // Specify it only for TypeScript files
            //      // Override logger function with noop, to avoid unsupported typescript version warnings.
            //      // loggerFn: () => { },
            //  },
            parser: '@typescript-eslint/parser',
            parserOptions: {
                // The 'project' path is resolved relative to parserOptions.tsconfigRootDir.
                // Your local .eslintrc.js must specify that parserOptions.tsconfigRootDir=__dirname.
                project: './tsconfig.json',
            },
            settings: {
                'import/resolver': {
                    node: {
                        extensions: [ ...jsExtensions, ...tsExtensions ]
                    },
                    typescript: {
                        project: [ 'tsconfig.json' ]
                    },
                    /* {
                        project: [ __dirname + '/tsconfig.json' ],
                        alwaysTryTypes: true,
                    } */
                },
                'import/extensions': [ ...jsExtensions, ...tsExtensions ]
            },
            plugins: [
                /* 'import/config/typescript', I prefered to copy/paste it to cherry-pick what I want */
                // '@typescript-eslint'
            ],
            // Workaround for no nested extends possible.
            // see https://github.com/eslint/eslint/issues/8813
            // working solution would be following, if we had nested extends
            // extends: [
            //   'eslint:recommended',
            //   'airbnb-base',
            //   'plugin:@typescript-eslint/recommended',
            //   'prettier/@typescript-eslint',
            //   'prettier',
            // ],
            rules: {
                ...(typescriptEslintRecommended.rules as Rules),
                ...jsRules(profile),
                ...tsRules(profile)
            }
        },
        {
            files: [   // Test files
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/*.spec.ts',
                '**/*.spec.tsx',

                // Facebook convention
                '**/__mocks__/**/*.ts',
                '**/__mocks__/**/*.tsx',
                '**/__tests__/**/*.ts',
                '**/__tests__/**/*.tsx',

                // Microsoft convention
                '**/test/**/*.ts',
                '**/test/**/*.tsx' ],
            env: {
                jest: true,
            },
            rules: {
                'import/no-unresolved': 'off'
            }
        },
    ]
});
