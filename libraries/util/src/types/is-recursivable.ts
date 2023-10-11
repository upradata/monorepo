export type PartialRecursiveOptions = 'no-array' | 'none';


export type IsRecrusivable<T, Options extends PartialRecursiveOptions> = never |
    T extends (RegExp | Date | Promise<any>) ? false :
    T extends (...args: unknown[]) => unknown ? false :
    T extends unknown[] ? Options extends 'no-array' ? false : true :
    T extends object ? true :
    false;
