import { yellow } from '@upradata/template-string-style';


export const warn = (msg: string) => console.warn(yellow`>> ${msg}`);
