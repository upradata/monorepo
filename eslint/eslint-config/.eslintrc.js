/// <reference lib="esnext" types="node" />
// @ts-check

// This is a workaround for https://github.com/eslint/eslint/issues/3458

const { defineConfig } = require('eslint-define-config');

module.exports = defineConfig({
    root: true,
    extends: [
        './lib/profile/node-trusted-tool.js'
    ],
    parserOptions: { tsconfigRootDir: __dirname },
});
