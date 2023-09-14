/**
 * This module contains utility functions for working with regular expressions.
 * @packageDocumentation
 */

/**
 * Converts a regular expression object or string to a string representation.
 * @param r - The regular expression object or string to convert.
 * @returns A string representation of the regular expression.
 */
export const regexToString = (r: string | RegExp) => typeof r === 'string' ? r : r.source;

/**
 * Converts a regular expression string or object to a RegExp object.
 * If the input is already a RegExp object, returns the original object.
 * @param r - The regular expression string or object to convert.
 * @param flags - Optional flags to apply to the RegExp object.
 * @returns A RegExp object representing the regular expression.
 */
export const stringToRegex = (r: string | RegExp, flags?: string) => typeof r === 'string' ? new RegExp(r, flags) : r;
/* export const mergeRegexes = (...regexes: (RegExp | string)[]) => new RegExp(regexes.map(r => `(${regexToString(r)})`).join('|'));
export const mergeRegexesWithFlags = (...regexes: (RegExp | string)[]) => new RegExp(
    regexes.slice(0, -1).map(r => `(${regexToString(r)})`).join('|'),
    regexes.slice(-1)[ 0 ] as string
); */

/**
 * Options to customize the behavior of the `mergeRegexes` function.
 * @property flags - Optional flags to apply to the merged regular expression.
 * @property join - Optional string to use to join the regular expressions. Defaults to '|'.
 * @property groupify - Optional boolean to group each regular expression in a capturing group. Defaults to true.
 * @property groupAll - Optional boolean to group all regular expressions in a single capturing group. Defaults to false.
 */
export interface MergeRexesOptions {
    flags?: string;
    join?: string;
    groupify?: boolean;
    groupAll?: boolean;
}


/**
 * Merges an array of regular expressions or strings into a single regular expression.
 * @param regexes - The array of regular expressions or strings to merge.
 * @param options - Optional options to customize the merging behavior.
 * @returns A regular expression that matches any of the input regular expressions.
 */
export const mergeRegexes = (regexes: (RegExp | string)[], options: MergeRexesOptions = {}) => {
    const openGroup = (isEnabled: boolean) => isEnabled ? '(' : '';
    const closeGroup = (isEnabled: boolean) => isEnabled ? ')' : '';

    const { groupify, groupAll, join, flags } = options;

    return new RegExp(
        `${openGroup(groupAll)}${regexes.map(r => `${openGroup(groupify)}${regexToString(r)}${closeGroup(groupify)}`).join(join || '')}${closeGroup(groupAll)}`,
        flags
    );
};


/**
 * A regular expression that matches email addresses.
 */
export const EMAIL_REGEXP = /^[-!#$%&'*+\/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+\/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/**
 * A regular expression that matches email addresses wrapped in angle brackets, with optional leading and trailing whitespace.
 */
export const EMAIL_REGEXP_WITH_BRACKETS = mergeRegexes([ /^\s*((\S+\s+)+)?/, '<', regexToString(EMAIL_REGEXP).slice(1, -1), />$/ ]);
