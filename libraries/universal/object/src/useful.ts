import { ifthen, isDefinedProp, isPlainObject } from '@upradata/useful';
import { entries, fromEntries } from './access';

import type { Arr, OmitType, ValueOf } from '@upradata/types';
import type { KeysRecursive, PrimitiveRecursive } from './recursive.type';


export type ObjectFilter<O extends object> = (k: keyof O, v: ValueOf<O>) => boolean;
export const filter = <O extends object>(o: O, filter: ObjectFilter<O>): O => fromEntries(entries(o).filter(([ k, v ]) => filter(k, v)));

// removeUndefined({ a: 1, b: 2, c: undefined as undefined, d: 2 }); => { a: 1, b: 2, d: 2; }
export const removeUndefined = <O extends object>(o: O): OmitType<O, undefined> => filter(o, (_, v) => typeof v !== 'undefined');



// getIfDefined({ a: 1, b: 2 }, 'a', 3); => 1
// getIfDefined({ a: 1, b: 2 }, 'c', 3); => 3
export const getIfDefined = <T extends object, K extends keyof T, DefaultV extends T[ K ] | undefined = undefined>(
    o: T, key: K, defaultValue?: DefaultV
): T[ K ] | DefaultV => {
    return isDefinedProp(o, key) ? o[ key ] : defaultValue as DefaultV;
};



export interface ReduceOptions<R> {
    init: R;
    isRecursive?: boolean;
}

export type ReduceReducer<T extends object, R> = (current: R, key: KeysRecursive<T>, v: PrimitiveRecursive<T>) => R;

export const reduce = <T extends Arr<any> | object, R>(o: T, reducer: ReduceReducer<T, R>, initOrOptions: R | ReduceOptions<R>): R => {
    const { init, isRecursive = false } = isPlainObject(initOrOptions) ? initOrOptions : { init: initOrOptions };

    return Object.entries(o).reduce((current, [ k, v ]) => {

        const value = ifthen({
            if: isRecursive,
            then: isPlainObject(v) ? reduce(v, reducer as any, init) : v,
            else: v
        });

        return reducer(current, k as any, value as any);

    }, init);
};

// reduce({ a: 1, b: { b1: 1, b2: 2, b3: { b11: 1 } }, c: { c1: 2 }, d: 3 } as const, (current, k, v) => current + v, 0) === 10;
