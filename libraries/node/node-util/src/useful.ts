import { guidGenerator } from '@upradata/util';
import crypto from 'node:crypto';
import path from 'node:path';


const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
export const isDev = [ 'production', 'prod' ].some(t => t === nodeEnv);

export const guid = guidGenerator(crypto.randomFillSync.bind(crypto));

export const relativePath = (dir: string) => (...paths: string[]) => path.relative(dir, path.join(...paths));
export const relativeCwd = (...paths: string[]) => relativePath(process.cwd())(...paths);
