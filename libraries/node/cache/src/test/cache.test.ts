import VinylFile from 'vinyl';
import { mockFs, MockFSData } from './mocks/fs.mock';
import { mockGlob } from './mocks/glob.mock';

import type { CacheMock } from './mocks/cache.mock';


describe('Test suite for cache', () => {
    // @ts-expect-error
    let mockFSData: MockFSData = undefined;
    // @ts-expect-error
    let Cache: typeof CacheMock = undefined;

    beforeAll(() => {
        mockFSData = mockFs();
        mockGlob(mockFSData.fs);
        Cache = (require('./mocks/cache.mock') as typeof import('./mocks/cache.mock')).CacheMock;
    });

    afterAll(() => {
        jest.unmock('fs');
    });

    it('should add files to cache, save it and load it back', () => {
        const { cache, collectionObject } = new Cache({ mockFSData: mockFSData }).populateCache();

        // const allFiles = glob.sync('**/*', { cwd: root }).map(file => path.join(root, file));
        expect(cache.store.storeCollection.toObject()).toEqual(collectionObject);

        cache.save();
        const cacheLoaded = new Cache({ mockFSData: mockFSData }).createCache();
        expect(cacheLoaded.store.storeCollection.toObject()).toEqual(collectionObject);

    });

    it('should return changedFiles', () => {
        mockFSData.clean();
        const { cache, files, collectionNames } = new Cache({ mockFSData: mockFSData }).populateCache();
        const filepaths = files.map(f => f.path);

        // Files already exist in the filesystem and the cache

        // not existing collection
        expect(cache.changedFiles('anyCollection', filepaths)).toEqual(filepaths);
        // only not existing files
        expect(cache.changedFiles(collectionNames[ 0 ], filepaths)).toEqual(filepaths.slice(3));
        // nothing
        expect(cache.changedFiles(collectionNames[ 0 ], filepaths, { onlyExistingFiles: true })).toEqual([]);

        expect(cache.changedFiles()).toEqual([]);

        // we modify only 2,4 and 7 mtime
        const indexes = [ 2, 4, 7 ];

        for (const i of indexes) {
            files[ i ].stat!.mtime.getTime = () => Date.now();
            mockFSData.addOrUpdateFile(files[ i ]);
        }

        expect(cache.changedFiles()).toEqual(indexes.map(i => files[ i ].path));
    });

    it('should use md5 criteria', () => {
        const md5 = require('../store').md5 as (filePath: string, size?: number) => string;

        const cacheMock = new Cache({
            mockFSData: mockFSData,
            cache: { criteria: 'md5' },
            mock: { criteria: (i, file) => md5(file.path) }
        });

        const { cache } = cacheMock.populateCache();

        expect(cacheMock.cache.store.storeCollection.toObject()).toEqual(cacheMock.collectionObject);

        cacheMock.addEntries({
            files: [
                new VinylFile({
                    path: cacheMock.files[ 0 ].dirname,
                    stat: {
                        isDirectory: () => true,
                        mtime: { getTime: () => parseInt(`123465789${100}`) }
                    } as any
                })
            ],
            collectionName: 'test/directory'
        });

        const { files } = cacheMock;

        // we modify only 2,4 and 7 mtime
        const indexes = [ 2, 4, 7 ];

        for (const i of indexes) {
            files[ i ].stat!.mtime.getTime = () => Date.now();
            mockFSData.addOrUpdateFile(files[ i ]);
        }

        // we do not care about mtime => md5 did not change
        expect(cache.changedFiles()).toEqual([]);

        for (const i of indexes) {
            files[ i ].contents = Buffer.from(`New content index ${i}`);
            mockFSData.addOrUpdateFile(files[ i ]);
        }

        expect(cache.changedFiles()).toEqual(indexes.map(i => files[ i ].path));
    });

    it('should use function criteria and isSameComparator function', () => {
        const { cache, files, collectionObject } = new Cache({
            mockFSData: mockFSData,
            cache: { criteria: path => mockFSData.files[ path ].contents!.toString()[ 0 ] },
            mock: { criteria: (i, file) => file.contents!.toString()[ 0 ] }
        }).populateCache();


        expect(cache.store.storeCollection.toObject()).toEqual(collectionObject);

        // we modify only 2,4 and 7 mtime
        const indexes = [ 2, 4, 7 ];

        for (const i of indexes) {
            files[ i ].stat!.mtime.getTime = () => Date.now();
            mockFSData.addOrUpdateFile(files[ i ]);
        }

        // we do not care about mtime => md5 did not change
        expect(cache.changedFiles()).toEqual([]);

        for (const i of indexes) {
            const content = files[ i ].contents!.toString();
            files[ i ].contents = Buffer.from(`A${content.slice(1)}`);
            mockFSData.addOrUpdateFile(files[ i ]);
        }

        expect(cache.changedFiles()).toEqual(indexes.map(i => files[ i ].path));
    });

    it('should delete collections', () => {
        const { cache } = new Cache({ mockFSData: mockFSData }).populateCache();

        cache.deleteCollection('collectionName3.collectionName32');
        cache.deleteCollection('collectionName3.doNotExist');

        expect(cache.store.collectionNames()).toEqual([
            'collectionName1', 'collectionName2', 'collectionName3', 'collectionName3.collectionName31' ]
        );
    });

    it('should delete files', () => {
        const { cache, files } = new Cache({ mockFSData: mockFSData }).populateCache();

        cache.deleteFile('collectionName1', files[ 0 ].path, files[ 2 ].path);
        cache.deleteFile('collectionName3.collectionName32', files[ 7 ].path);

        expect(cache.store.fileNames('collectionName1')).toEqual([ files[ 1 ].path ]);
        expect(cache.store.fileNames('collectionName3.collectionName32')).toEqual([ files[ 8 ].path ]);
    });
});
