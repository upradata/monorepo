import type { Rules } from 'eslint-define-config';
import type { Profile } from './profile';


export const tsRules = (_profile: Profile): Rules => ({
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/member-delimiter-style': [
        'error',
        {
            multiline: {
                delimiter: 'semi',
                requireLast: true
            },
            singleline: {
                delimiter: 'semi',
                requireLast: true
            }
        }
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-array-constructor': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/quotes': [ 'warn', 'single', { allowTemplateLiterals: true } ],
    '@typescript-eslint/semi': [ 'error', 'always' ],
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-unused-vars': [ 'error', { argsIgnorePattern: '^_' } ],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/parameter-properties': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/typedef': 'off',
    // '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
    quotes: 'off', // to make work `back tick string`
    'no-dupe-class-members': 'off',
    'global-require': 'off',
    'space-before-function-paren': 'off',
    // TypeScript compilation already ensures that named imports exist in the referenced module
    'import/named': 'off',
    '@rushstack/typedef-var': 'off',
    '@rushstack/no-new-null': 'off'
});
