// FIX: Configuration for rule "array-callback-return" is invalid:
// Value { "allowImplicit": true, "checkForEach": false, "allowVoid": false; } should NOT have additional properties.

import { execSync } from 'node:child_process';

export = JSON.parse(String(execSync(require.resolve('./whitespace'))));
