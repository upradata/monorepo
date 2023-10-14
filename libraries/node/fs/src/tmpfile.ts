import { guid, SyncAsync } from '@upradata/node-util';
import { stripIndents, TT$ } from '@upradata/util';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';


const createTmpFileName = (mode: keyof SyncAsync, option: TmpFileOption = {}): TT$<string> => {
    const { tmpDirRoot = os.tmpdir(), prefix = '', maxAttempt = 10 } = option;

    const get = (i: number = 0) => {

        const tmpFile = (name: string, exist: boolean) => {
            if (!exist)
                return name;

            if (i > maxAttempt) {
                throw new Error(stripIndents`Could not create a temporary file in ${tmpDirRoot}:
                                 ${maxAttempt} attemps have been tried out and each time the random filename exists`);
            }

            return get(i + 1);
        };

        const id = guid().slice(0, 6);

        const name = path.join(tmpDirRoot, `${prefix}${id}`);
        return mode === 'sync' ? tmpFile(name, fs.existsSync(name)) : fs.exists(name).then(exist => tmpFile(name, exist));
    };

    return get();
};


export interface TmpFileOption {
    tmpDirRoot?: string;
    prefix?: string;
    maxAttempt?: number;
}

export const getTmpFileName = {
    sync: (option?: TmpFileOption) => createTmpFileName('sync', option) as string,
    async: (option?: TmpFileOption) => createTmpFileName('async', option) as Promise<string>
};


export const createTmpDir = {
    sync: (option?: TmpFileOption) => {
        const dirname = getTmpFileName.sync(option);
        fs.ensureDirSync(dirname);

        return dirname;
    },
    async: async (option?: TmpFileOption) => {
        const dirname = await getTmpFileName.async(option);
        await fs.ensureDir(dirname);

        return dirname;
    }
};
