import type { ToString } from '@upradata/types';

export const recreateString = (strings: TemplateStringsArray, ...keys: ToString[]) => {
    const parameters = [ ...keys, '' ];

    let res = '';

    for (let i = 0; i < strings.length; ++i) {
        res += strings[ i ] + parameters[ i ];
    }

    return res;
};
