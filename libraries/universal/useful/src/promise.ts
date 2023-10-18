/**
 * This module provides utility functions for working with Promises.
 * @packageDocumentation
 */

import { arrayN } from './useful';

import type { TT$ } from '@upradata/types';


/**
 * A function that takes a value of type T and an optional index i, and returns a Promise or a value of type T.
 */
export type ChainedFunc<T> = (value: T, i?: number) => TT$<T>;


/**
 * Chains an array of functions that take a value of type T and an optional index i, and returns a Promise that resolves to a value of type T.
 * Each function is called with the result of the previous function in the chain, starting with the initial value.
 *
 * @param functions - An array of functions to chain.
 * @param init - The initial value to pass to the first function in the chain. Defaults to undefined.
 * @returns A Promise that resolves to the final value in the chain.
 *
 * @example
 * ```ts
 * const addOne = (n: number) => n + 1;
 * const double = (n: number) => Promise.resolve(n * 2);
 * const square = (n: number) => n ** 2;
 *
 * const functions = [addOne, double, square];
 *
 * chained$([addOne, double, square], 2).then(result => console.log(result));
 * // logs 36 (2 + 1 = 3, 3 * 2 = 6, 6 ** 2 = 36)
 * ```
 */
export const chained$ = <T>(functions: ChainedFunc<T>[], init: T = undefined as T): Promise<T> => {
    return functions.reduce((current, func, i) => current.then(v => func(v, i)), Promise.resolve(init));
};

/**
 * Alias for the {@link chained$} function.
 */
export const composed$ = chained$;


/**
 * Repeats a function that takes a value of type T and an optional index i, and returns a Promise that resolves to a value of type T.
 * The function is called n times with the result of the previous call in the chain, starting with the initial value.
 *
 * @param func - The function to repeat.
 * @param n - The number of times to repeat the function.
 * @param init - The initial value to pass to the first function in the chain. Defaults to undefined.
 * @returns A Promise that resolves to the final value in the chain.
 *
 * @example
 * ```ts
 * const addOne = (n: number) => Promise.resolve(n + 1);
 *
 * repeatChained$(addOne, 5, 0).then(result => console.log(result));
 * // logs 5 (0 + 1 + 1 + 1 + 1 + 1 = 5)
 * ```
 */
export const repeatChained$ = <T>(func: ChainedFunc<T>, n: number, init: T = undefined as T): Promise<T> => {
    return chained$(arrayN(n).map(_i => func), init);
};


/**
 * Chains an array of functions that take a value of type T, a reducer value of type R, and an optional index i,
 * and returns a Promise that resolves to a value of type R.
 *
 * Each function is called with the current array value, the current reducer value, and the current index, starting with the initial reducer value.
 * @param array - The array of values to pass to the functions.
 * @param func - The function to call on each value in the array.
 * @param init - The initial value to pass to the first function in the chain. Defaults to undefined.
 * @returns A Promise that resolves to the final value in the chain.
 *
 * @example
 * ```ts
 * const func = (value: number, sum: number, _index: number) => sum + value;
 *
 * chainedArr$([1, 2, 3], func, 0).then(result => console.log(result));
 * // logs 6 (0 + 1 + 2 + 3 = 6)
 * ```
 */
export const chainedArr$ = <T, R>(array: T[], func: (arrayValue: T, reducerValue?: R, i?: number) => TT$<R>, init: R = undefined as R): Promise<R> => {
    return chained$(array.map(v => (r, i) => func(v, r, i)), init);
};


/**
 * Creates a Promise that can be resolved or rejected at a later time.
 *
 * Returns an object with the Promise, and separate resolve and reject functions to control the Promise's outcome.
 * @returns An object with a Promise, and separate resolve and reject functions to control the Promise's outcome.
 *
 * @example
 * ```ts
 * const { promise, resolve, reject } = delayedPromise<string>();
 *
 * setTimeout(() => resolve('Hello, world!'), 1000);
 * promise.then(console.log); // logs 'Hello, world!' after 1 second
 * ```
 */
export const delayedPromise = <T>() => {
    let resolve: (value: T | PromiseLike<T>) => void = undefined as any;
    let reject: (reason?: any) => void = undefined as any;

    // eslint-disable-next-line promise/param-names
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
};



/**
 * Optional options to customize the behavior of the `callTimeout` function.
 */
export type CallTimeoutOptions = {
    /** The maximum number of milliseconds to wait for the function to complete.
     * @defaultValue 0.
     */
    ms?: number;
    /** Whether to wait for a Promise returned by the function to resolve before resolving the Promise.
     * @defaultValue true.
     */
    waitPromise?: boolean;
};


/**
 * Calls a function and returns a Promise that resolves to the function's return value.
 * If the function takes longer than a specified time to complete, the Promise will be rejected with a TimeoutError.
 *
 * @param func - The function to call.
 * @param options - Optional options to customize the behavior of the function.
 * @returns A Promise that resolves to the function's return value,
 * or rejects with a TimeoutError if the function takes longer than the specified time to complete.
 *
 * @example
 * ```ts
 * const slowFunc = async () => {
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *   return 'Hello, world!';
 * };
 *
 * // Call slowFunc with a timeout of 1 second
 * callTimeout(slowFunc, { ms: 1000 })
 *   .then(console.log) // logs 'Hello, world!' after 1000ms + 2000ms (slowFunc ended) = 3000ms
 *   .catch(console.error);
 * ```
 */
export const callTimeout = <R, O extends CallTimeoutOptions>(func: () => R, options?: O): Promise<Awaited<R>> => {
    const { ms = 0, waitPromise = true } = options || {};

    return new Promise<R | Promise<R>>((resolve, _reject) => {
        setTimeout(() => {
            const r = func();

            if (r instanceof Promise && waitPromise)
                return r.then(resolve);

            return resolve(r);
        }, ms);
    }) as any;
};


/* export const compose$ = <FN extends (arg: any) => TT$<any>, V extends Parameters<FN>[ 0 ] = Parameters<FN>[ 0 ], R = ReturnType<FN>>(functions: FN[], value: V): Promise<Awaited<R>> => {
    return composeLeft(functions.map(f => async (...args: any[]) => {
        if (args.length === 1 && args[ 0 ] instanceof Promise)
            return f(await args[ 0 ]);

        return f.apply(null, args);
    }), value);
}; */

/* console.time('chrono');

compose$([
    (n: number) => callTimeout(() => { console.timeEnd('chrono'); console.time('chrono'); return n + 1; }, { ms: 100 }),
    (n: number) => callTimeout(() => { console.timeEnd('chrono'); console.time('chrono'); return n + 1; }, { ms: 1000 }),
    (n: number) => callTimeout(() => { console.timeEnd('chrono'); console.time('chrono'); return n + 1; }, { ms: 100 }),
    (n: number) => { console.timeEnd('chrono'); return n + 1; },
], 1).then(n => console.log(n));
 */
