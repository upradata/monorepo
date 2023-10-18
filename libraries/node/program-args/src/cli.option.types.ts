import { Option } from 'commander';

import type { NonFunctionProperties, TT } from '@upradata/types';


declare module 'commander' {
    interface Option {
        envVar: string;
        _concatValue: <T>(v1: T, v2: T | T[]) => T[];
        // parseArg?: (<T>(value: string, previous: T) => T) | (<T>(value: string, previous: T, aliasOriginOption?: CliOption) => T);
        // <T>(value: string, previous: T) => T;
        negateNoDefault: boolean;
    }
}


export type ICliOption<CliOption = 'default'> = Option & {
    isObject: boolean;
    isValueFromDefault: boolean;
    parser: CommanderParser<any>;

    attributeName(): string;
    addAlias(alias: Alias<CliOption>): ICliOption<CliOption>;
    addAliases(...aliases: Alias<CliOption>[]): ICliOption<CliOption>;
    hasAliases(): boolean;
    aliases: Set<{ option: CliOption extends 'default' ? ICliOption : CliOption; type: AliasType; transform: AliasTransform; }>;
    argParser<T>(fn: (value: string, previous: T) => T): ICliOption<CliOption>;
} & (CliOption extends 'default' ? {} : CliOption);


export type AliasType = 'source' | 'target';
export type AliasMode = 'multi-way' | 'two-way' | AliasType;

export type AliasTransform = ((value: string) => string) | CommanderParser<never, string>;
export type AliasTransforms = {
    [ AliasTo: string ]: AliasTransform;
};


type AliasDetail = {
    mode?: Exclude<AliasMode, 'multi-way'>;
    transform?: AliasTransform;
} | {
    mode: 'multi-way';
    transform?: AliasTransform | AliasTransforms;
};

export type AliasInit<CliOption = 'default'> = CliOptionInit<any, CliOption> & AliasDetail;

export type AliasCliOption<CliOption = 'default'> = { option: ICliOption<CliOption>; } & AliasDetail;

export type Alias<CliOption = 'default'> = AliasInit<CliOption> | AliasCliOption<CliOption>;



export type CliOptionInit<T, CliOption = 'default'> = NonFunctionProperties<Partial<Option>> & {
    flags: string;
    description?: string;
    defaultValue?: T;
    defaultValueDescription?: string;
    envVar?: string;
    parser?: CommanderParser<T>;
    hidden?: boolean;
    choices?: string[] | { values: string[]; parser: CommanderParser<T>; };
    aliases?: Alias<CliOption>[];
    noNegate?: boolean;
    negateNoDefault?: boolean;
};



export type CliParserPrevious<T> = TT<T, 'mutable'>;

// export type CommanderValueParser = <T>(value: string, previous?: TT<T>, aliasOriginOption?: CliOption) => T;
export type CommanderValueParser<T, CliOption = 'default'> = (
    value: string, previous?: CliParserPrevious<T>, aliasOriginOption?: ICliOption<CliOption>
) => T;

// export type CommanderParser = <T>(value: string, previous?: TT<T>, aliasOriginOption?: CliOption) => TT<T>;
export type CommanderParser<T, R = CliParserPrevious<T>, CliOption = 'default'> = (
    value: string, previous?: CliParserPrevious<T>, aliasOriginOption?: ICliOption<CliOption>
) => R;

export type CommanderReducer<T, CliOption = 'default'> = (value: string, previous?: T, aliasOriginOption?: ICliOption<CliOption>) => T;
