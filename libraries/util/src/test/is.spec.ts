import * as is from '../is';

describe('ts-util-is methods', () => {
    it('ensure value is an array', () => {
        expect(is.isArray([])).toEqual(true);
    });

    it('ensure value is a base64 string', () => {
        expect(is.isBase64('AgQGCAoMDhASFA==')).toEqual(true);
    });

    it('ensure value is a boolean', () => {
        expect(is.isBoolean(true)).toEqual(true);
    });

    it('ensure value is a date', () => {
        expect(is.isDate(new Date())).toEqual(true);
    });

    it('ensure value is a valid date', () => {
        expect(is.isDateValid(new Date('invalid'))).toEqual(false);
    });

    it('ensure value is defined', () => {
        expect(is.isDefined(83)).toEqual(true);
    });

    it('ensure value is an error', () => {
        expect(is.isError(new Error())).toEqual(true);
    });

    it('ensure value is a function', () => {
        expect(is.isFunction(() => {
            // empty
        })).toEqual(true);
    });

    it('ensure value is a guid', () => {
        expect(is.isGuid('b8161432-e903-4edc-9429-6eade52e2572')).toEqual(true);
    });

    it('ensure value is infinity', () => {
        expect(is.isInfinity(Infinity)).toEqual(true);
    });

    it('ensure value is null', () => {
        expect(is.isNull(null)).toEqual(true);
    });

    it('ensure value is a number', () => {
        expect(is.isNumber(83)).toEqual(true);
    });

    it('ensure value is an object', () => {
        expect(is.isObject({})).toEqual(true);
    });

    it('ensure value is a plain object', () => {
        expect(is.isPlainObject({})).toEqual(true);
    });

    it('ensure value is not a plain object', () => {
        expect(is.isPlainObject([])).toEqual(false);
    });

    it('ensure value is a regex', () => {
        expect(is.isRegExp(/83/)).toEqual(true);
    });

    it('ensure value is a string', () => {
        expect(is.isString('')).toEqual(true);
    });

    it('ensure value is a symbol', () => {
        expect(is.isSymbol(Symbol(''))).toEqual(true);
    });

    it('ensure value is undefined', () => {
        expect(is.isUndefined(undefined)).toEqual(true);
    });

    it('ensure value is null or undefined', () => {
        expect(is.isNil(null)).toEqual(true);
        expect(is.isNil(undefined)).toEqual(true);
        expect(is.isNil(false)).toEqual(false);
        expect(is.isNil(1)).toEqual(false);
    });

    it('ensure value is an instance of a type', () => {
        const err = new Error();
        expect(is.isInstance(err, Error)).toEqual(true);

        // eslint-disable-next-line no-new-func
        const fn = new Function();
        expect(is.isInstance(fn, Function)).toEqual(true);

        expect(is.isInstance(null, Error)).toEqual(false);
        expect(is.isInstance(false, Error)).toEqual(false);
    });
});
