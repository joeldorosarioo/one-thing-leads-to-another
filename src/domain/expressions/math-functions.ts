export const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sum: (...values: number[]) => values.reduce((total, value) => total + value, 0),

  min: (...values: number[]) => {
    if (!values.length) throw new Error('min() needs an argument.');
    return Math.min(...values);
  },

  max: (...values: number[]) => {
    if (!values.length) throw new Error('max() needs an argument.');
    return Math.max(...values);
  },

  abs: (value: number) => Math.abs(value),
  ceil: (value: number) => Math.ceil(value),
  floor: (value: number) => Math.floor(value),

  round: (value: number, digits = 0) => {
    if (!Number.isInteger(digits) || digits < 0 || digits > 8)
      throw new Error('round() precision must be from 0 to 8.');

    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
};
