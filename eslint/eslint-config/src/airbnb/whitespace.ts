#!/usr/bin/env node

import { ESLint } from 'eslint';
// eslint-disable-next-line import/no-relative-packages
import baseConfig from '../../node_modules/eslint-config-airbnb-base';
import { rules as whitespaceRules } from './rules';
import { onlyErrorOnRules } from './onlyErrorOnRules';

export const init = async () => {
    const cli = new ESLint({
        useEslintrc: false,
        baseConfig
    });

    const baseRules = (await cli.calculateConfigForFile(require.resolve('../../node_modules/eslint-config-airbnb-base'))).rules;

    return onlyErrorOnRules(whitespaceRules, baseConfig, { baseRules }).then(config => console.log(JSON.stringify(config)));
};

init().finally(() => { });
