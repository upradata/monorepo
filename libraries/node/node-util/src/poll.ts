import { TT$ } from '@upradata/util';

export interface PollOptions {
    duration: number;
    timeStep?: number;
}

export const poll = <S, E>(handler: () => TT$<{ stop: boolean; error?: E; success?: S; }>, options: PollOptions) => {
    const { duration, timeStep = 100 } = options;
    let totalWait = 0;


    // Strangely, we need to wait before the OS writes the file on the disk.
    // We wait a maximum 2s
    return new Promise<S>((res, rej) => {
        const id = setInterval(async () => {
            const { error, success, stop } = await handler();

            if (stop) {
                res(success);
                clearInterval(id);
            } else if (totalWait > duration) {
                rej(error);
                clearInterval(id);
            }

            totalWait += timeStep;
        }, timeStep);
    });
};
