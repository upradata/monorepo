import { ifthen, isDefinedProp } from '@upradata/useful';
import { Option } from 'commander';
import { camelcase } from './util';

import type {
    Alias,
    AliasCliOption,
    AliasTransform,
    AliasTransforms,
    AliasType,
    CliOptionInit,
    CommanderParser,
    ICliOption
} from './cli.option.types';
import { parsers } from './parsers';


export const isSimpleChoices = (v: string[] | { values: string[]; parser: CommanderParser<any>; }): v is string[] => Array.isArray(v);



const isAliasCliOption = (v: Alias): v is AliasCliOption => !!(v as AliasCliOption)?.option;


export class CliOption extends Option implements ICliOption<CliOption> {
    private cliAliases: Set<{ option: CliOption; type: AliasType; transform: AliasTransform; }> = new Set();
    public isObject = false;
    public isValueFromDefault = false;
    public parser: CommanderParser<any> = undefined as any; // parseArg synonym


    constructor(flags: string, description?: string);
    constructor(options: CliOptionInit<any, CliOption>);
    constructor(arg1: string | CliOptionInit<any, CliOption>, arg2?: string) {
        const getArgs = () => {
            if (typeof arg1 === 'object') {
                const { flags, description, ...rest } = arg1;
                return { flags, description, rest };
            }

            return { flags: arg1, description: arg2, rest: {} };
        };

        const { flags, description, rest } = getArgs();
        super(flags, description);

        const { noNegate = false, ...options } = rest;

        const getChoices = (): { choices?: string[]; parser?: CommanderParser<any>; } => {
            if (!rest.choices)
                return {};

            if (isSimpleChoices(rest.choices))
                return { choices: rest.choices };

            return { choices: rest.choices.values, parser: parsers.choices(rest.choices.values, rest.choices.parser) };
        };

        const { choices, parser } = getChoices();

        // priority for rest.parser
        Object.assign(this, {
            negateNoDefault: false,
            ...options,
            argChoices: rest.argChoices || choices,
            parser: rest.parser || parser, parseArg: rest.parser || parser
        });

        this.isObject = this.name().split('.').length > 1;
        this.negate = noNegate ? false : this.negate;
    }

    get aliases() {
        return this.cliAliases;
    }

    hasAliases(): boolean {
        return this.aliases.size > 0;
    }

    addAlias(alias: Alias<CliOption>): this {

        const add = (d: Omit<AliasCliOption<CliOption>, 'transform'> & { transform: AliasTransform; }) => {
            const { option, mode, transform = (v: string) => v } = d;

            const addAlias = (d: { alias: AliasType; this: AliasType; }) => {
                option.aliases.add({ option: this, type: d.this, transform: transform.bind(this) });
                this.aliases.add({ option, type: d.alias, transform: transform.bind(option) });
            };


            if (mode === 'source' || mode === 'two-way')
                addAlias({ alias: 'source', this: 'target' });

            if (mode === 'target' || mode === 'two-way')
                addAlias({ alias: 'target', this: 'source' });

        };


        const mode = alias.mode || 'source';

        const getAliasOption = () => {

            if (isAliasCliOption(alias))
                return alias.option;

            const { mode, transform, ...options } = alias;

            // undefined means no parser => raw string will stay as it is
            // not that in cli-command parseOption in addOption, if there is no parser, _concatValue is called if it is a variadic option
            // when an alias parser or a transform is defined, we want to get the original string as a parameter to this functions
            // and not a transformed value being any
            const parser = alias.parser || transform ? undefined : this.parseArg;

            const aliasOption = new CliOption({
                defaultValueDescription: this.defaultValueDescription,
                envVar: this.envVar,
                hidden: this.hidden,
                argChoices: this.argChoices,
                negate: this.negate,
                ...options,
                parser,
                description: this.description,
                // defautValue can be undefined to unset it from this (source)
                defaultValue: mode === 'source' ? undefined : isDefinedProp(options, 'defaultValue') ? options.defaultValue : this.defaultValue,
                // defaultValueDescription: mode === 'source' ? undefined : this.defaultValueDescription,
                // envVar: mode === 'source' ? undefined : this.envVar,
            });

            /* const optionFlags = splitOptionFlags(alias.flags);

            aliasOption.short = optionFlags.shortFlag;
            aliasOption.long = optionFlags.longFlag;
            aliasOption.negate = false;

            if (aliasOption.long) {
                aliasOption.negate = aliasOption.long.startsWith('--no-');
            } */

            return aliasOption;
        };

        const aliasOption = getAliasOption();

        if (mode !== 'multi-way')
            add({ option: aliasOption, mode, transform: alias.transform as AliasTransform });
        else {
            for (const a of this.aliases) {
                const transform = ifthen({
                    if: typeof alias.transform === 'function',
                    then: alias.transform as AliasTransform,
                    else: {
                        callable: () => {
                            const transforms = alias.transform as AliasTransforms;
                            return transforms?.[ a.option.name() ] || transforms?.[ a.option.attributeName() ];
                        }
                    }
                });

                a.option.addAlias({ option: aliasOption, mode: 'two-way', transform });
            }
        }

        return this;
    }

    addAliases(...aliases: Alias<CliOption>[]): this {
        aliases.forEach(alias => this.addAlias(alias));
        return this;
    }

    argParser<T>(fn: (value: string, previous: T) => T): this {
        super.argParser(fn); // set this.parseArg = fn;
        this.parser = this.parseArg!;

        return this;
    }

    attributeName() {
        const name = this.negate ? this.name().replace(/^no-/, '') : this.name();
        return camelcase(name, '-').replaceAll('.', '_');
    }
}



// from node_modules/.pnpm/commander@9.3.0/node_modules/commander/lib/option.js
// new commander version uses package.json exports field and commander/lib/options.js is not exported
// So it is better to rewrite it here instead of doing some hacks!
export const splitOptionFlags = (flags: string) => {
    let shortFlag: string | undefined;
    let longFlag: string | undefined;

    // Use original very loose parsing to maintain backwards compatibility for now,
    // which allowed for example unintended `-sw, --short-word` [sic].

    const flagParts = flags.split(/[ |,]+/);

    if (flagParts.length > 1 && !/^[[<]/.test(flagParts[ 1 ]))
        shortFlag = flagParts.shift();

    longFlag = flagParts.shift();

    // Add support for lone short flag without significantly changing parsing!
    if (!shortFlag && /^-[^-]$/.test(longFlag!)) {
        shortFlag = longFlag;
        longFlag = undefined;
    }
    return { shortFlag, longFlag };
};
