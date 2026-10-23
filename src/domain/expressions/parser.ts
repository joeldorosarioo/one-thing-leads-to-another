import { MATH_FUNCTIONS } from './math-functions';
import type { ExpressionToken } from './tokenizer';

export function parseExpression(tokens: ExpressionToken[], resolve: (name: string) => number): number {
  let tokenIndex = 0;

  const peekValue = () => tokens[tokenIndex] && tokens[tokenIndex].value;

  const consume = (value: string) => {
    if (peekValue() === value) {
      tokenIndex++;
      return true;
    }

    return false;
  };

  const expect = (value: string) => {
    if (!consume(value)) throw new Error(`Expected '${value}' in formula.`);
  };

  const finiteNumber = (number: number) => {
    if (typeof number !== 'number' || !Number.isFinite(number))
      throw new Error('Formula returned a non-finite number.');

    return number;
  };

  function readFunction(name: string): number {
    if (!Object.prototype.hasOwnProperty.call(MATH_FUNCTIONS, name)) throw new Error(`Unsupported function: ${name}`);

    const functionArguments: number[] = [];

    if (!consume(')')) {
      do {
        functionArguments.push(readSum());
      } while (consume(','));

      expect(')');
    }

    return finiteNumber(MATH_FUNCTIONS[name](...functionArguments));
  }

  function readPrimary(): number {
    if (consume('+')) return readPrimary();
    if (consume('-')) return -readPrimary();

    if (consume('(')) {
      const result = readSum();
      expect(')');
      return result;
    }

    const token = tokens[tokenIndex++];

    if (!token) throw new Error('Incomplete formula.');
    if (token.kind === 'number') return Number(token.value);

    if (token.kind === 'id') {
      if (consume('(')) return readFunction(token.value);
      return finiteNumber(resolve(token.value));
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  function readProduct(): number {
    let result = readPrimary();

    while (['*', '/', '%'].includes(peekValue())) {
      const operator = tokens[tokenIndex++].value;
      const rightOperand = readPrimary();

      if (operator === '*') result *= rightOperand;
      else if (operator === '/') result /= rightOperand;
      else result %= rightOperand;

      result = finiteNumber(result);
    }

    return result;
  }

  function readSum(): number {
    let result = readProduct();

    while (['+', '-'].includes(peekValue())) {
      const operator = tokens[tokenIndex++].value;
      const rightOperand = readProduct();
      result = finiteNumber(operator === '+' ? result + rightOperand : result - rightOperand);
    }

    return result;
  }

  if (!tokens.length) throw new Error('Empty formula.');
  const result = readSum();
  if (tokenIndex !== tokens.length) throw new Error(`Unexpected token: ${tokens[tokenIndex].value}`);

  return finiteNumber(result);
}
