export class SyncAsync<T = any> {
    sync: T = undefined;
    async: Promise<T> = undefined;
}

export type SyncAsyncMode = keyof SyncAsync;

export type SyncAsyncType<M extends SyncAsyncMode, T, U = undefined> = M extends 'sync' ? T : U extends undefined ? Promise<T> : U;
