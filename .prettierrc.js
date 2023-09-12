// Documentation for this file: https://prettier.io/en/configuration.html
/** 
 * @type {import('./common/autoinstallers/rush-prettier/node_modules/prettier').Config}
 */
module.exports = {
    // We use a larger print width because Prettier's word-wrapping seems to be tuned
    // for plain JavaScript without type annotations
    printWidth: 120,

    // Use .gitattributes to manage newlines
    endOfLine: 'auto',

    // Use single quotes instead of double quotes
    singleQuote: true,

    // For ES5, trailing commas cannot be used in function parameters; it is counterintuitive
    // to use them for arrays only
    trailingComma: 'none',
    arrowParens: 'avoid',
    quoteProps: 'as-needed',
    semi: true,
    tabWidth: 4,
    useTabs: false,
    bracketSpacing: true
};
