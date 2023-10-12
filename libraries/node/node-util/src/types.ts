export class SyncAsync<T = any> {
    sync: T = undefined as any;
    async: Promise<T> = undefined as any;
}

export type SyncAsyncMode = keyof SyncAsync;

export type SyncAsyncType<M extends SyncAsyncMode, T, U = undefined> = M extends 'sync' ? T : U extends undefined ? Promise<T> : U;
