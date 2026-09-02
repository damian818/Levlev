/**
 * Safe Financial Math Parser & Evaluator
 * Supports: +, -, *, /, %, parentheses, decimal commas/points, percentage discounts/surcharges
 */

export interface MathEvalResult {
  result: number | null;
  isValid: boolean;
  isExpression: boolean;
  formatted: string;
}

/**
 * Sanitizes and normalizes the input expression
 */
export function normalizeMathExpression(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[xX×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

/**
 * Checks if the string contains math operators
 */
export function isMathExpression(raw: string): boolean {
  if (!raw) return false;
  const normalized = normalizeMathExpression(raw);
  return /[+\-*/%()]/.test(normalized);
}

/**
 * Safely evaluates a math expression without using eval()
 */
export function evaluateMathExpression(raw: string): MathEvalResult {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { result: null, isValid: false, isExpression: false, formatted: '' };
  }

  const str = raw.trim();
  const isExpr = isMathExpression(str);

  // If it's just a plain number
  const simpleNum = parseFloat(str.replace(/,/g, '.'));
  if (!isExpr) {
    if (!isNaN(simpleNum) && isFinite(simpleNum)) {
      return {
        result: simpleNum,
        isValid: true,
        isExpression: false,
        formatted: String(simpleNum),
      };
    }
    return { result: null, isValid: false, isExpression: false, formatted: '' };
  }

  try {
    const tokens = tokenize(str);
    if (!tokens || tokens.length === 0) {
      return { result: null, isValid: false, isExpression: isExpr, formatted: '' };
    }

    const value = parseExpression(tokens);
    if (value === null || isNaN(value) || !isFinite(value)) {
      return { result: null, isValid: false, isExpression: isExpr, formatted: '' };
    }

    // Round to 2 decimal places to avoid floating point precision issues (e.g., 0.1 + 0.2 = 0.3)
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    
    return {
      result: rounded,
      isValid: true,
      isExpression: true,
      formatted: rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2),
    };
  } catch {
    return { result: null, isValid: false, isExpression: isExpr, formatted: '' };
  }
}

// Token Types
type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN' | 'PERCENT';

interface Token {
  type: TokenType;
  value: string | number;
}

function tokenize(raw: string): Token[] | null {
  const norm = normalizeMathExpression(raw);
  const tokens: Token[] = [];
  let i = 0;

  while (i < norm.length) {
    const char = norm[i];

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'OP', value: char });
      i++;
    } else if (char === '%') {
      tokens.push({ type: 'PERCENT', value: '%' });
      i++;
    } else if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
    } else if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
    } else if (char === '.' || (char >= '0' && char <= '9')) {
      let numStr = '';
      while (i < norm.length && (norm[i] === '.' || (norm[i] >= '0' && norm[i] <= '9'))) {
        numStr += norm[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) return null;
      tokens.push({ type: 'NUMBER', value: num });
    } else {
      // Unknown character
      return null;
    }
  }

  return tokens;
}

/**
 * Parser for:
 * Expression := Term (( '+' | '-' ) Term)*
 * Term := Factor (( '*' | '/' ) Factor)*
 * Factor := ('+' | '-')? Primary ('%')?
 * Primary := NUMBER | '(' Expression ')'
 * 
 * Handles percentage contextual math:
 *  - A - B% => A * (1 - B/100)
 *  - A + B% => A * (1 + B/100)
 *  - A * B% => A * (B / 100)
 *  - A / B% => A / (B / 100)
 */
class ExpressionParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  public parse(): number | null {
    if (this.tokens.length === 0) return null;
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      // Not all tokens consumed
      return null;
    }
    return result;
  }

  private parseExpression(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;

    while (this.peek() && this.peek()?.type === 'OP' && (this.peek()?.value === '+' || this.peek()?.value === '-')) {
      const op = this.consume().value;
      const rightToken = this.peek();

      // Check if the next factor has a trailing percentage
      const rightTerm = this.parseTermWithBase(left, op as '+' | '-');
      if (rightTerm === null) return null;

      if (op === '+') {
        left += rightTerm;
      } else {
        left -= rightTerm;
      }
    }

    return left;
  }

  private parseTermWithBase(base: number, op: '+' | '-'): number | null {
    // If next term ends in %, e.g., base - 20% => percentage is base * 0.20
    const startPos = this.pos;
    const factor = this.parseFactor();
    if (factor === null) return null;

    let term = factor.isPercent ? base * (factor.val / 100) : factor.val;

    while (this.peek() && this.peek()?.type === 'OP' && (this.peek()?.value === '*' || this.peek()?.value === '/')) {
      const mulOp = this.consume().value;
      const nextFactor = this.parseFactor();
      if (nextFactor === null) return null;
      const nextVal = nextFactor.isPercent ? (nextFactor.val / 100) : nextFactor.val;
      if (mulOp === '*') {
        term *= nextVal;
      } else {
        if (nextVal === 0) return null;
        term /= nextVal;
      }
    }

    return term;
  }

  private parseTerm(): number | null {
    const factor = this.parseFactor();
    if (factor === null) return null;

    let left = factor.isPercent ? (factor.val / 100) : factor.val;

    while (this.peek() && this.peek()?.type === 'OP' && (this.peek()?.value === '*' || this.peek()?.value === '/')) {
      const op = this.consume().value;
      const nextFactor = this.parseFactor();
      if (nextFactor === null) return null;
      const nextVal = nextFactor.isPercent ? (nextFactor.val / 100) : nextFactor.val;

      if (op === '*') {
        left *= nextVal;
      } else {
        if (nextVal === 0) return null;
        left /= nextVal;
      }
    }

    return left;
  }

  private parseFactor(): { val: number; isPercent: boolean } | null {
    let sign = 1;
    if (this.peek() && this.peek()?.type === 'OP' && (this.peek()?.value === '+' || this.peek()?.value === '-')) {
      const op = this.consume().value;
      if (op === '-') sign = -1;
    }

    const primary = this.parsePrimary();
    if (primary === null) return null;

    let isPercent = false;
    if (this.peek() && this.peek()?.type === 'PERCENT') {
      this.consume();
      isPercent = true;
    }

    return { val: sign * primary, isPercent };
  }

  private parsePrimary(): number | null {
    const token = this.peek();
    if (!token) return null;

    if (token.type === 'NUMBER') {
      this.consume();
      return typeof token.value === 'number' ? token.value : parseFloat(token.value as string);
    }

    if (token.type === 'LPAREN') {
      this.consume(); // (
      const expr = this.parseExpression();
      if (expr === null) return null;
      if (!this.peek() || this.peek()?.type !== 'RPAREN') return null;
      this.consume(); // )
      return expr;
    }

    return null;
  }
}

function parseExpression(tokens: Token[]): number | null {
  const parser = new ExpressionParser(tokens);
  return parser.parse();
}
