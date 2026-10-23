export interface ExpressionToken {
  kind: 'number' | 'id' | 'symbol';
  value: string;
}

export function tokenizeExpression(source: string): ExpressionToken[] {
  if (typeof source !== 'string' || source.length > 1500) throw new Error('Expression is empty or too long.');

  const tokens: ExpressionToken[] = [];
  const tokenPattern = /\s*(?:(\d+(?:\.\d+)?)|([a-z][a-z0-9_]*)|([+\-*/%(),]))/gy;

  let position = 0;

  while (position < source.length) {
    tokenPattern.lastIndex = position;
    const found = tokenPattern.exec(source);

    if (!found) {
      if (!source.slice(position).trim()) break;
      throw new Error(`Unexpected character in formula near: ${source.slice(position, position + 20)}`);
    }

    const [, number, identifier, symbol] = found;
    let kind: ExpressionToken['kind'] = 'symbol';

    if (number) kind = 'number';
    else if (identifier) kind = 'id';

    tokens.push({ kind, value: number || identifier || symbol });
    position = tokenPattern.lastIndex;

    if (tokens.length > 400) throw new Error('Formula exceeds the token limit.');
  }

  return tokens;
}
