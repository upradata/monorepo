function isNumber(value, options) {
    const { acceptsNaN = false, acceptsInfinity = false } = options || {};

    const isNb = typeof value === 'number';

    if (!isNb)
        return false;

    if (!acceptsNaN && Number.isNaN(value))
        return false;

    if (!acceptsInfinity && isInfinity(value))
        return false;

    return true;
}

function isInfinity(value) {
    return value === Infinity || value === -Infinity;
}

console.log(isNumber(1) === true);
console.log(isNumber('1') === false);
console.log(isNumber(NaN) === false);
console.log(isNumber(NaN, { acceptsNaN: true }) === true);
console.log(isNumber(Infinity) === false);
console.log(isNumber(Infinity, { acceptsInfinity: true }) === true);
