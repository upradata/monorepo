import * as commonTags from 'common-tags';
import { keys, makeObject } from '../object';
import { CommonTagStyle } from './helpers/common-tags.type';
import { recreateString } from './recreate-string';
import { Style, StyleOptions, StyleTransform } from './style';

import type { Prop, ToString } from '../types';
import { isDefined } from '../is';


export const buildStyle = (names: Array<string | number>, options: Record<Prop, StyleOptions>) => {

    for (const k of names) {

        Object.defineProperty(Style.prototype, k, {
            // eslint-disable-next-line object-shorthand
            get: function (this: Style) {
                // this will allow syntax red.bgYellow.underline.$
                const o = { ...options[ k ] };

                if (isDefined(o.transforms))
                    o.transforms = [ this, ...o.transforms ];

                return new Style(o);
            }
        });
    }
};



export type CommonTagsStringTranform = CommonTagStyle<StyleTransform>;
export type DefinedStringTransforms = CommonTagsStringTranform /* & OtherClasses if we went to add other transform builders*/;


export type Styles<AllTransforms> = Style & {
    [ K in keyof AllTransforms ]: Styles<AllTransforms> & Style;
};


export const transformToStyleTemplate = (transform: (arg: any) => string) => (strings: TemplateStringsArray, ...keys: ToString[]) => transform(recreateString(strings, ...keys));


const commonTagsKeys = keys(new CommonTagStyle());
buildStyle(commonTagsKeys, makeObject(commonTagsKeys, k => ({ transforms: [ commonTags[ k ] ] })));
