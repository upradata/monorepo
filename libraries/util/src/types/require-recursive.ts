import type { IsRecrusivable, PartialRecursiveOptions } from './is-recursivable';
import { Levels } from './useful';


export type RequiredRecursive<T, Options extends PartialRecursiveOptions = 'none', Level extends number = 5> =
    Level extends 0 ? Required<T> : {
        [ K in keyof T ]-?:
        IsRecrusivable<T[ K ], Options> extends true ?
        RequiredRecursive<T[ K ], Options, Levels[ Level ]> :
        T[ K ]
    };



// type Test = RequiredRecursive<{
//     o: { o1?: { o2: string; o3: number; }; o4: 2; };
//     a?: (pathDest: string) => void | Promise<void>;
//     b: 2;
//     r: RegExp;
//     d: Date;
//     arr?: { a?: number; }[];
//     arr2: [ { el?: 1; }, { el: 2; } ];
// }>;


// type Test =  {
//     o: {
//         o1: {
//             o2: string;
//             o3: number;
//         };
//         o4: 2;
//     };
//     a: (pathDest: string) => void | Promise<void>;
//     b: 2;
//     r: RegExp;
//     d: Date;
//     arr: {
//         a: number;
//     }[];
//     arr2: [{
//         el: 1;
//     }, {
//         el: 2;
//     }];
// }
