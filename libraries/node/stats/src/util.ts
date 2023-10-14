import type { SortData, SortType, StatSorter, StatSorters } from './types';

type Comparator = (s1: string, s2: string) => number;

const sort = (comparator: Comparator) => <T extends SortType>(type: T) => (datas: SortData<T>[]): SortData<T>[] => {
    // default sorting is the alphanumeric order of the name field depending of the "type"
    const filedToCompare = type === 'collections' ? 'collectionName' : type === 'stats' ? 'name' : '0';

    return datas.sort((s1, s2) => comparator((s1[ filedToCompare ] as string), s2[ filedToCompare ]));
};



const sortComparators: StatSorters<Comparator> = {
    alphaNumeric: (s1: string, s2: string) => s1.localeCompare(s2),
    antiAlphaNumeric: (s1: string, s2: string) => s1.localeCompare(s2)
};


export const statSorters: StatSorters<<T extends SortType>(type: T) => StatSorter<T>>= {
    alphaNumeric: sort(sortComparators.alphaNumeric),
    antiAlphaNumeric: sort(sortComparators.antiAlphaNumeric)
};
