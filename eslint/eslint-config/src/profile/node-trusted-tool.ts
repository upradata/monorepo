import { buildRules } from '../common';

const rules = buildRules('node-trusted-tool');
export = rules; // ESLint requires module.exports to be used for config files (CommonJS and not ES6 modules)
