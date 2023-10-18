import { arrayN } from './useful';

import type { Arr, FunctionN } from '@upradata/types';


export const partialHeadCall = <T extends Arr, U extends Arr, R>(f: FunctionN<[ ...T, ...U ], R>, ...headArgs: T): FunctionN<U, R> => {
    return (...tailArgs: U) => f(...headArgs, ...tailArgs);
};


export const partialTailCall = <T extends Arr, U extends Arr, R>(f: FunctionN<[ ...T, ...U ], R>, ...tailArgs: U): FunctionN<T, R> => {
    return (...headArgs: T) => f(...headArgs, ...tailArgs);
};


export const bind = <T extends Arr<unknown, 'readonly'>, U extends Arr<unknown, 'readonly'>, R>(
    f: FunctionN<[ ...T, ...U ], R>,
    thisArg: unknown,
    ...headArgs: T): FunctionN<U, R> => {
    return partialHeadCall(f.bind(thisArg), ...headArgs);
};

/*
const f = function (a: number, b: string): string {
    return `${a}${b}`;
};


const partialHead = partialHeadCall(f, 1);
partialHead('2');

const partialTail = partialTailCall(f, '2'); // typing not working => MUST open an ISSUE on github
partialTail(1);

const fBound = bind(f, { thisA: 1 });
fBound(1, '2');

const fBound2 = bind(f, { thisA: 1 }, 1);
fBound2('2');
 */



export const repeatChained = <T>(func: (value: T, i?: number) => T, n: number, init: T): T => {
    return arrayN(n).map(_i => func).reduce((lastReturn, f, i) => f(lastReturn, i), init);
};


export type PipelineNext<D, N> = (data: D) => N;

export const pipeline = <D>(data: D) => ({
    pipe: <N>(next: PipelineNext<D, N>) => {
        const ret = next(data);
        return { pipe: pipeline(ret).pipe, value: ret };
    }
});

export const composeLeft = <FN extends (arg: any) => any, V extends Parameters<FN>[ 0 ] = Parameters<FN>[ 0 ], R = ReturnType<FN>>(functions: FN[], value: V): R => {
    return functions.reduce((current: ReturnType<FN>, fn) => fn(current), value);
};

export const compose = <FN extends (arg: any) => any, V extends Parameters<FN>[ 0 ] = Parameters<FN>[ 0 ], R = ReturnType<FN>>(functions: FN[], value: V): R => {
    return composeLeft(functions.reverse(), value);
};

export const composeRight = compose;
