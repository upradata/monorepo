import type Glob from 'glob';

export const mockGlob = (fs: Glob.GlobOptions[ 'fs' ]) => {
    jest.mock('glob', (): typeof Glob => {

        const glob = jest.requireActual('glob') as typeof Glob;

        class GlobMock<Opts extends Glob.GlobOptions> extends glob.Glob<Opts> {
            constructor(...args: ConstructorParameters<typeof glob.Glob<Opts>>) {
                super(args[ 0 ], { ...args[ 1 ], fs });
            }
        };

        glob.globSync = (pattern, options = {}) => {
            return new GlobMock(pattern, options).walkSync() as any;
        };

        (glob as any).glob = async (pattern, options = {}) => {
            return new GlobMock(pattern, options).walk();
        };


        return glob;
        // return { ...glob, Glob: GlobMock };
    });
};

// import path from 'node:path';

// export const mockGlob = (fs: Glob.GlobOptions[ 'fs' ]) => {
//     jest.mock(path.join(path.dirname(require.resolve('glob')), 'glob.js'), () => {

//         const _Glob = jest.requireActual('glob/dist/cjs/glob.js') as (typeof Glob)[ 'Glob' ];

//         class GlobMock<Opts extends Glob.GlobOptions> extends _Glob<Opts> {
//             constructor(...args: ConstructorParameters<typeof _Glob<any>>) {
//                 super(args[ 0 ], { ...args[ 1 ], fs });
//                 console.log('_______________GlobMock constructor__________________');
//                 (this as any).CACA = 1;
//             }
//         };

//         return GlobMock;
//         // return { ...glob, Glob: GlobMock };
//     });
// };
