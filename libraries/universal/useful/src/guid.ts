
/*
import { random } from './random';

 IT IS WORKING. BUT WITH TOOLS LIKE ROLLUP/WEBPACK, IT IS A NIGHTMARE BECAUSE THEY CAN TRY TO INCLUDE NODEJS CRYPTO IN BROWER ENVIRONMENT (WEBPACK I FOUND THE SOLUTION TO
NO TO, BUT ROLLUP NO).

I PREFER TO SEPARATE THEM
*/


import type { TypedArray } from '@upradata/types';

export const guidGenerator = (random: (array: TypedArray) => number) => {
    // eslint-disable-next-line prefer-template
    return () => ('' + 1e7 + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: string) =>
        // eslint-disable-next-line no-bitwise
        (+c ^ random(new Uint8Array(1))[ 0 ] & 15 >> +c / 4).toString(16)
    );
};
