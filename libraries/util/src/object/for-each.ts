import { isPlainObject } from '../is';

import type { Arr } from '../types';
import type { KeysRecursive, PrimitiveRecursive } from './recursive.type';


export const forEach = <T extends Arr<any> | object>(o: T, callback: (key: KeysRecursive<T>, v: PrimitiveRecursive<T>) => void | 'stop', isRecursive: boolean = false): void => {
    let stop = false;

    Object.entries(o).forEach(([ k, v ]) => {
        if (stop)
            return;

        if (isPlainObject(v))
            forEach(v, callback as any /* to avoid Type instantiation is excessively deep */, isRecursive);
        else {
            const ret = callback(k as any, v as any);

            if (ret === 'stop')
                stop = true;
        }
    });
};

// forEach(o, (k, v) => { v === 'b1'; });
