import type { TableConfig, TableRow, TableRows } from '@upradata/terminal';
import type { KebabCase, ObjectOf } from '@upradata/types';
import type { Stat } from './stat';


export type Statistics<S extends Stat> = ObjectOf<S | Statistics<S>>;


/** //////////////////////////////////////// */


export type StatTable = { headers: string[]; rows: TableRows; };
export type StatTableWithName = StatTable & { name: string; collectionName: string; };

export type OutputStat = Record<string /* stat name */, StatTableWithName>;
export type StatCollection = { collectionName: string; stats: OutputStat; };

export type OutputStats = {
    global: OutputStat;
    collections: Record<string /* collection name */, StatCollection>;
};


/** //////////////////////////////////////// */


export type SortType = 'stats' | 'collections' | 'global-rows';
export type SortData<T extends SortType> = T extends 'stats' ? StatTableWithName : T extends 'collections' ? StatCollection : TableRow;

export type StatSorter<T extends SortType> = (datas: SortData<T>[]) => SortData<T>[];


export type StatSorters<T> = {
    alphaNumeric: T;
    antiAlphaNumeric: T;
};


export type StatSorterTypes = KebabCase<keyof StatSorters<any>>;




/** //////////////////////////////////////// */

export interface StatsToStringOptions {
    rowWidth?: number;
    maxCellWidth?: number;
    columnToShrink?: number;
    tableConfig?: TableConfig;
    sort?: {
        stats?: StatSorterTypes | StatSorter<'stats'>;
        collections?: StatSorterTypes | StatSorter<'collections'>;
        globalRows?: StatSorterTypes | StatSorter<'global-rows'>;
    };
}
