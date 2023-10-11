import { assignRecursive, ensureArray, isPlainObject } from '@upradata/util';
import { globSync, GlobOptions } from 'glob';
import path from 'node:path';

// eslint-disable-next-line import/no-relative-packages
import type * as GlobTypes from '../node_modules/glob/dist/cjs/src/glob';

export type GlobFilesOptions = GlobOptions & { noGlob?: boolean; };
export type GlobFile = { pattern: string; options?: GlobFilesOptions; };
export type FilePath = string | GlobFile;
export type FilesWithGlobalOptions = { files: (FilePath | FilePath[]); options?: GlobFilesOptions; };
export type File = FilePath | FilesWithGlobalOptions;


// the last array is there just to be able to have function f(...files:Files)
// Files has to be an array. But if we have { files: File[], options: GlobOptions; }
// it will always be an array of 1 element

export function isGlobFile(file: FilePath): file is GlobFile {
    return isPlainObject(file);
}

export function isFilesWithGlobalOptions(files: File[]): files is FilesWithGlobalOptions[] {
    return files.length === 1 && isPlainObject(files[ 0 ]) && (files[ 0 ] as any).files;
}

export class GlobFiles {

    public globFiles: GlobFile[];

    constructor(public files: File[]) {
        this.globFiles = this.toGlobFiles();
    }

    toGlobFiles(): GlobFile[] {

        const getData = () => {
            if (isFilesWithGlobalOptions(this.files)) {
                const f = this.files[ 0 ].files;

                return { filesList: ensureArray(f) as FilePath[], options: this.files[ 0 ].options };
            }

            return { filesList: this.files as FilePath[], options: {} as GlobFilesOptions };

        };

        const { filesList, options } = getData();

        return filesList.map(file => {
            if (isGlobFile(file))
                return { pattern: file.pattern, options: assignRecursive({}, options, file.options) };

            return { pattern: file, options };
        });
    }

    getFiles(): { files: string[]; missed: { pattern: string; err?: Error; }[]; } {
        const allFiles: string[] = [];
        const noFiles: { pattern: string; err?: any; }[] = [];

        for (const { pattern, options } of this.globFiles) {
            try {
                if (!options?.noGlob) {

                    const filesList = globSync(pattern, options || {}).map((file: GlobTypes.Result<any>) => {
                        const fileString = file.toString();

                        if (fileString.startsWith('/'))
                            return fileString;

                        return path.join(options?.cwd?.toString() || '.', fileString);
                    });

                    if (filesList.length === 0)
                        noFiles.push({ pattern });
                    else
                        allFiles.push(...filesList);

                } else {
                    allFiles.push(pattern);
                }

            } catch (err) {
                noFiles.push({
                    pattern,
                    err: err instanceof Error ? err : err.message ? new Error(err.message) : new Error(err.toString?.() || `glob error`)
                });
            }
        }

        return { files: allFiles, missed: noFiles };
    }

}
