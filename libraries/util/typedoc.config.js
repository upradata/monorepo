const fs = require('node:fs');
const path = require('node:path');

const getEntries = (srcDir) => {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    const files = entries
        .filter(file => !file.isDirectory() && file.name.endsWith('.ts') && file.name !== 'index.ts')
        .map(file => path.join(srcDir, file.name));

    console.log(files);

    return files;

    /* const folders = entries
        .filter(folder => folder.isDirectory())
        .map(folder => folder.name); */

    // return { files, folders };
};


/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
    $schema: 'https://typedoc.org/schema.json',
    entryPoints: getEntries('./src'),
    /* [
        './src/index.ts'
    ] */
    entryPointStrategy: 'resolve',
    out: 'documentation',
    includeVersion: true,
    tsconfig: 'tsconfig.doc.json',
    readme: 'README.md',
    emit: 'docs',
    plugin: [ path.join(__dirname, './node_modules/@mxssfd/typedoc-theme') ], /* 'typedoc-theme-hierarchy' */
    // plugin: [ path.join(__dirname, './node_modules/typedoc-theme-hierarchy') ],
    theme: 'my-theme', // 'my-theme', // 'hierarchy', // 'default',
    lightHighlightTheme: 'light-plus',
    darkHighlightTheme: 'dark-plus',
    // 'customCss': './typedoc.css',
    markedOptions: { // https://marked.js.org/
        mangle: false,
        // 'highlight': '<Shiki based highlighter>',
        // 'renderer': 'Renderer that adds links to headers'
    },
    htmlLang: 'en',
    commentStyle: 'jsdoc',
    /* jsDocCompatibility: {
        exampleTag: true,
        defaultTag: true
    }, */
    watch: false,
    logLevel: 'Info',
    skipErrorChecking: false
};
