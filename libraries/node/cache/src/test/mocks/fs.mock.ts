import { assignRecursive } from '@upradata/useful';

import type { Function2, ObjectOf } from '@upradata/types';
import type FS from 'fs-extra';
import type MemoryFS from 'memory-fs';
import type VinylFile from 'vinyl';


export interface MockFSData {
    fs?: typeof FS;
    files: ObjectOf<VinylFile>;
    addOrUpdateFile: (file: VinylFile) => void;
    deleteFile: (filepath: string) => void;
    clean: () => void;
}


export const mockFs = (): MockFSData => {
    const MemoryFs = require('memory-fs') as typeof MemoryFS;
    // variables starting with "mock" will not throw if there are used inside jest.mock even though there are not hoisted
    // https://github.com/kulshekhar/ts-jest/issues/1088
    let mockedFS: typeof FS | undefined = undefined;
    const mockFiles: ObjectOf<VinylFile> = {};

    // will be hoisted in the function "mockFs"
    // 'fs-extra' is using 'graceful-fs' under the hood that is using 'fs'. Here we will use an in-memory filesystem

    // eslint-disable-next-line @rushstack/hoist-jest-mock
    jest.mock('fs', () => {
        const fs = jest.requireActual('fs') as typeof import('fs');

        const makeAsync = (fn: string | Function2<string, any>) => {

            function make(path: string, callback: Function2<Error, any>): void;
            // eslint-disable-next-line no-redeclare
            function make(path: string, option: any, callback: Function2<Error | null, any>): void;
            // eslint-disable-next-line no-redeclare
            function make(path: string, optionOrCb: Function2<Error | null, any> | any, callback?: Function2<Error | null, any>): void {
                let cb = callback;
                let opts = optionOrCb;

                if (!cb) {
                    cb = optionOrCb;
                    opts = undefined;
                }

                try {
                    const result = typeof fn === 'string' ? this[ `${fn}Sync` ](path, opts) : fn.call(this, path, opts);
                    setImmediate(() => cb?.(null, result));
                } catch (e) {
                    setImmediate(() => cb?.(e, null));
                }
            }

            return make;
        };

        const MemoryFsAny = MemoryFs as any;

        if (MemoryFsAny.__instance__)
            return MemoryFsAny.__instance__;

        /* const accessSync = (_path, _mode) => { };
        const access = makeAsync(accessSync);

        MemoryFsAny.prototype.access = access;
        MemoryFsAny.prototype.accessSync = accessSync; */
        MemoryFsAny.prototype.lstat = MemoryFs.prototype.stat;
        MemoryFsAny.prototype.lstatSync = MemoryFs.prototype.statSync;
        // MemoryFsAny.prototype.realpath = () => { };

        const oldStatSync = MemoryFs.prototype.statSync;
        MemoryFs.prototype.statSync = function (path: string) {
            let stats: Partial<ReturnType<MemoryFS[ 'statSync' ]>>;

            try {
                stats = oldStatSync.call(fs, path);
            } catch (e) {
                stats = {};
            }

            const files = mockFiles;
            return assignRecursive(stats, files[ path ]?.stat);
        };

        // MemoryFs does not implement the options parameter
        // fsExtra is calling mkdirSync with { recursive: true } in fsExtra.outputFileSync
        const oldMkdirSync = MemoryFs.prototype.mkdirSync;
        MemoryFs.prototype.mkdirSync = function (this: MemoryFS, path: string, options: FS.MakeDirectoryOptions = {}) {
            if (options.recursive)
                return this.mkdirpSync(path);

            return oldMkdirSync.call(this, path);
        };

        MemoryFs.prototype.mkdir = makeAsync(MemoryFs.prototype.mkdirSync);

        MemoryFsAny.__instance__ = new MemoryFs();
        MemoryFsAny.__instance__.debug = 'MemoryFs';

        /**
         * fs is mocked as MemoryFs, that is a class. The problem is that it is an es6 class and when an instance is created,
         * the method in the prototype are not enumerable.
         *
         * So, when fs-extra is created, it is calling graceful-js that is calling "patch(clone(fs))"
         * and try to copy all 'fs' method, it cannot parse the methods of fs.__proto__
         * (even prototype is not enumerable - no Object.keys or whatever).
         *
         * So I am obliged to recreate it by hand
         */

        const instanceKeys = Object.getOwnPropertyNames(MemoryFsAny.__instance__);

        for (const k of Object.getOwnPropertyNames(MemoryFs.prototype)) {
            if (k !== 'constructor' && !instanceKeys.includes(k))
                MemoryFsAny.__instance__[ k ] = MemoryFs.prototype[ k ];
        }

        for (const k of Object.getOwnPropertyNames(fs)) {
            if (typeof fs[ k ] === 'function' && !MemoryFsAny.__instance__[ k ])
                MemoryFsAny.__instance__[ k ] = fs[ k ];
        }

        // console.log(`_________ MemoryFsAny.__instance __________________`);

        mockedFS = MemoryFsAny.__instance__;
        return MemoryFsAny.__instance__;
    });


    const fsExtra = require('fs-extra') as typeof FS;


    const addOrUpdateFile = (file: VinylFile) => {
        mockFiles[ file.path ] = file;

        if (file.stat?.isDirectory())
            fsExtra.mkdirpSync(file.path);
        else
            fsExtra.outputFileSync(file.path, file.contents?.toString() || '');
    };

    const deleteFile = (filepath: string) => {
        const fs: MemoryFS = (MemoryFs as any).__instance__;

        fs.unlinkSync(filepath);
        delete mockFiles[ filepath ];
    };


    const clean = () => {
        for (const file of Object.values(mockFiles)) {
            if (file.stat?.isDirectory())
                fsExtra.rmdirSync(file.path);
            else
                fsExtra.unlinkSync(file.path);
        }

        for (const k of Object.keys(mockFiles))
            delete mockFiles[ k ];
    };


    return {
        fs: mockedFS,
        files: mockFiles,
        addOrUpdateFile,
        deleteFile,
        clean
    };
};
