```typescript
/**
 * Creates a Promise that resolves to the final value in a chain of functions.
 * @param array - The array of values to pass to the functions.
 * @param func - The function to call on each value in the array.
 * @param init - The initial value to pass to the first function in the chain. Defaults to undefined.
 * @returns A Promise that resolves to the final value in the chain.
 * @example
 * const func = (value: number, sum: number, _index: number) => sum + value;
 * chainedArr$([1, 2, 3], func, 0).then(result => console.log(result)); // logs 6 (0 + 1 + 2 + 3 = 6)
 */
export const chainedArr$ = <T, R>(array: T[], func: (arrayValue: T, reducerValue?: R, i?: number) => TT$<R>, init: R = undefined): Promise<R> => {
    return chained$(array.map(v => (r, i) => func(v, r, i)), init);
};


/**
 * Creates a Promise that can be resolved or rejected at a later time.
 * Returns an object with the Promise, and separate resolve and reject functions to control the Promise's outcome.
 * @returns An object with a Promise, and separate resolve and reject functions to control the Promise's outcome.
 * @example
 * const { promise, resolve, reject } = delayedPromise<string>();
 * setTimeout(() => resolve('Hello, world!'), 1000);
 * promise.then(console.log); // logs 'Hello, world!' after 1 second
 */
export const delayedPromise = <T>() => {
    let resolve: (value: T | PromiseLike<T>) => void = undefined;
    let reject: (reason?: any) => void = undefined;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
};
```
