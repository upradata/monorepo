/* export type PartialRecursive<T> = PartialRec<T>;

type isArray<T> = T extends (infer U)[] ? true : false;

type PartialRec<T> = {
    [ K in keyof T ]?: isArray<T[ K ]> extends true ? T[ K ] : PartialRecursive<T[ K ]>;
}; */

import type { IsRecrusivable, PartialRecursiveOptions } from './is-recursivable';
import type { Levels } from './useful';

// https://stackoverflow.com/questions/41980195/recursive-partialt-in-typescript-2-1
// more compact than mine
/* export type PartialRecursive<T> = {
    [ K in keyof T ]?:
    T[ K ] extends (infer U)[] ? T[ K ] :
    T[ K ] extends object ? PartialRecursiveWithArray<T[ K ]> :
    T[ K ];
};

export type PartialRecursiveWithArray<T> = {
    [ K in keyof T ]?:
    T[ K ] extends (infer U)[] ? PartialRecursiveWithArray<U>[] :
    T[ K ] extends object ? PartialRecursiveWithArray<T[ K ]> :
    T[ K ];
};*/


export type PartialRecursive<T, Options extends PartialRecursiveOptions = 'none', Level extends number = 5> =
    Level extends 0 ? Partial<T> : {
        [ K in keyof T ]?: IsRecrusivable<T[ K ], Options> extends true ?
        PartialRecursive<T[ K ], Options, Levels[ Level ]> :
        T[ K ]
    };



// type Test = PartialRecursive<{
//     o: { o1: { o2: string; o3: number; }; o4: 2; };
//     a: (pathDest: string) => void | Promise<void>; b: 2; r: RegExp; d: Date;
//     arr: { a: number; }[];
//     arr2: [ { el: 1; }, { el: 2; } ];
// }>;


// type Test = {
//     o?: PartialRecursive<{
//         o1: {
//             o2: string;
//             o3: number;
//         };
//         o4: 2;
//     }, "none">;
//     a?: (pathDest: string) => void | Promise<void>;
//     b?: 2;
//     r?: RegExp;
//     d?: Date;
//     arr?: PartialRecursive<{
//         a: number;
//     }, "none">[];
//     arr2?: [ PartialRecursive<{
//         el: 1;
//     }, "none">?, PartialRecursive<...>?];
// }
