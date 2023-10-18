import { guidGenerator } from '@upradata/useful';
import crypto from 'node:crypto';
import path from 'node:path';

import type { TypedArray } from '@upradata/types';


const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
export const isDev = [ 'production', 'prod' ].some(t => t === nodeEnv);

export const guid = guidGenerator(crypto.randomFillSync.bind(crypto) as (array: TypedArray) => number);

export const relativePath = (dir: string) => (...paths: string[]) => path.relative(dir, path.join(...paths));
export const relativeCwd = (...paths: string[]) => relativePath(process.cwd())(...paths);
