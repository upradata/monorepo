import { exec, ExecOptions, execSync as execS, ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { promisify } from 'node:util';


const execPromise = promisify(exec);

type LogOutput = {
    stdout?: boolean;
    stderr?: boolean;
};

export type ExecAsyncOptions = { encoding?: 'buffer' | BufferEncoding | null; } & ExecOptions & {
    logOutput?: boolean | LogOutput;
    emitError?: boolean;
};

export const isExecLog = (logOutput: boolean | LogOutput, type: 'stdout' | 'stderr'): boolean => {
    return typeof logOutput === 'boolean' && logOutput || logOutput?.[ type ];
};

export const execAsync = async (command: string, options: ExecAsyncOptions = {}) => {
    const { logOutput = { stdout: true, stderr: false }, emitError = true } = options;

    try {
        const result = await execPromise(command, options);

        if (isExecLog(logOutput, 'stdout') && result.stdout)
            console.log(result.stdout);

        if (isExecLog(logOutput, 'stderr') && result.stderr)
            console.error(result.stderr);

        if (emitError && result.stderr)
            throw new Error(result.stderr);

        return result;
    } catch (e) {
        if (isExecLog(logOutput, 'stderr')) {
            if (e instanceof Error) {
                console.error(e.message);
                console.error(e.stack || 'Failed in execAsync');
            } else {
                console.error(e);
            }
        }

        if (emitError)
            throw e;
    }

};

export const execSync = async (command: string, options?: Partial<ExecSyncOptionsWithStringEncoding> & { logOutput?: boolean; }) => {
    execS(command, { stdio: options?.logOutput ? [ 0, 1, 2 ] : undefined, ...options });
};
