import type { Rules } from 'eslint-define-config';
import type { Profile } from './profile';


export const jsRules = (_profile: Profile): Rules => ({
    'import/order': 'off', /* [ 'warn', {
        pathGroups: [
            {
                pattern: '#/**',
                group: 'internal',
                position: 'before'
            },
            {
                pattern: '@/**',
                group: 'internal',
                position: 'before'
            }
        ]
    } ] */
    /* 'upradata/order': [ 'warn', {
        pathGroups: [
            {
                pattern: '#/**',
                group: 'internal',
                position: 'before'
            },
            {
                pattern: '@/**',
                group: 'internal',
                position: 'before'
            }
        ]
    } ], */
    'import/no-unresolved': [ 'error', { ignore: [ '^#' ] } ],
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': 'off',
    // [
    //     'warn',
    //     { devDependencies: [ '**/*.test.js', '**/*.spec.js' ] }
    // ],
    'no-undef-init': 'off',
    'import/no-dynamic-require': 'off',

    'no-lonely-if': 'off',
    'no-nested-ternary': 'off',
    'max-classes-per-file': 'off',
    'no-unused-vars': 'off',
    quotes: [ 'warn', 'single', { avoidEscape: true } ],
    'class-methods-use-this': 'off',
    'no-useless-constructor': 'off',
    'arrow-body-style': 'off',
    'no-param-reassign': [ 'error', { props: false } ],
    'no-use-before-define': 'off',
    'arrow-parens': [ 'off', 'always' ],
    'no-plusplus': 'off',
    'no-continue': 'off',
    'comma-dangle': 'off',
    curly: 'off',
    'eol-last': 'error',
    eqeqeq: [ 'error', 'smart' ],
    'id-blacklist': 'off',
    'id-match': 'off',
    indent: 'off',
    'max-len': [ 'error', { code: 200 } ],
    'no-array-constructor': 'off',
    'no-duplicate-imports': 'error',
    'no-eval': 'error',
    'no-multiple-empty-lines': 'off',
    'no-new-wrappers': 'error',
    'no-trailing-spaces': 'error',
    'no-underscore-dangle': 'off',
    'no-var': 'error',
    'no-shadow': 'off',
    'no-restricted-syntax': 'off',
    'no-console': 'off',
    'consistent-return': 'off',
    'object-shorthand': 'error',
    'one-var': [ 'error', 'never' ],
    'prefer-const': 'error',
    'global-require ': 'off',
    'func-names': 'off',
    'prefer-template': 'error',
    'quote-props': [ 'error', 'as-needed' ],
    radix: 'off',
    semi: 'error',
    'space-before-function-paren': [
        'error',
        { anonymous: 'always', named: 'never', asyncArrow: 'always' }
    ],
    'spaced-comment': [
        'error',
        'always',
        { markers: [ '/' ] }
    ],
    'no-else-return': 'warn',
    'block-spacing': 'error',
    'object-curly-spacing': [ 'error', 'always' ],
    'array-bracket-spacing': [ 'error', 'always' ],
    'lines-between-class-members': 'off',
    'react/jsx-filename-extension': [ 'warn', { allow: 'as-needed', extensions: [ '.jsx', '.tsx' ] } ],

    // there is a bug
    /*
     * [build:lint]    Configuration for rule "promise/param-names" is invalid:
     * [build:lint]    Value [{"resolvePattern":"^_?(resolve)$","rejectPattern":"^_?(reject)$"}] should NOT have more than 0 items.
     * 'promise/param-names': [ 'warn', {
     *  resolvePattern: '^_?(resolve|res)$',
     *  rejectPattern: '^_?(reject|rej)$'
     * } ],
     */
    'promise/param-names': 'warn',
    // '@typescript-eslint/member-delimiter-style': 'off'
    /* '@typescript-eslint/tslint/config': [
        'error',
        {
            rules: {
                'function-name': [
                    true,
                    {
                        'method-regex': '^(\\*?\\[Symbol\\.)?[a-zA-Z$_][\\w\\d$]*\\]?$',
                        'private-method-regex': '^(\\*?\\[Symbol\\.)?[a-zA-Z$_][\\w\\d$]*\\]?$',
                        'protected-method-regex': '^(\\*?\\[Symbol\\.)?[a-zA-Z$_][\\w\\d$]*\\]?$',
                        'static-method-regex': '^(\\*?\\[Symbol\\.)?[a-zA-Z$_][\\w\\d$]*\\]?$',
                        'function-regex': '^[a-zA-Z$_][\\w\\d$]*$'
                    }
                ],
                'no-function-constructor-with-string-args': true,

                'ter-func-call-spacing': true,
                whitespace: [
                    true,
                    'check-branch',
                    'check-decl',
                    'check-operator',
                    'check-preblock',
                    'check-separator'
                ]
            }
        }
    ] */
});
