// Dice Expression Parser - Recursive Descent Parser für Würfel-Notation
// Siehe: docs/architecture/constants.md

import type {
  DiceExpression,
  DiceNode,
  KeepDrop,
  Explode,
  Reroll,
  ComparisonOp,
} from '#types/common/counting';

// ============================================================================
// Token Types
// ============================================================================

type TokenType =
  | 'NUMBER'
  | 'D'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'LPAREN'
  | 'RPAREN'
  | 'KEEP_HIGH'
  | 'KEEP_LOW'
  | 'DROP_HIGH'
  | 'DROP_LOW'
  | 'EXPLODE'
  | 'EXPLODE_COMPOUND'
  | 'REROLL'
  | 'REROLL_ONCE'
  | 'GREATER'
  | 'LESS'
  | 'EQUALS'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ============================================================================
// Tokenizer
// ============================================================================

class Tokenizer {
  private pos = 0;
  private readonly input: string;

  constructor(input: string) {
    this.input = input.replace(/\s+/g, ''); // Whitespace entfernen
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const token = this.nextToken();
      if (token) tokens.push(token);
    }

    tokens.push({ type: 'EOF', value: '', position: this.pos });
    return tokens;
  }

  private nextToken(): Token | null {
    const startPos = this.pos;

    // Multi-character tokens first
    if (this.match('!!')) return { type: 'EXPLODE_COMPOUND', value: '!!', position: startPos };
    if (this.match('kh')) return { type: 'KEEP_HIGH', value: 'kh', position: startPos };
    if (this.match('kl')) return { type: 'KEEP_LOW', value: 'kl', position: startPos };
    if (this.match('dh')) return { type: 'DROP_HIGH', value: 'dh', position: startPos };
    if (this.match('dl')) return { type: 'DROP_LOW', value: 'dl', position: startPos };
    if (this.match('ro')) return { type: 'REROLL_ONCE', value: 'ro', position: startPos };

    // Single-character tokens
    const char = this.input[this.pos];

    if (this.isDigit(char)) {
      return this.readNumber(startPos);
    }

    this.pos++;

    switch (char.toLowerCase()) {
      case 'd':
        return { type: 'D', value: 'd', position: startPos };
      case '+':
        return { type: 'PLUS', value: '+', position: startPos };
      case '-':
        return { type: 'MINUS', value: '-', position: startPos };
      case '*':
        return { type: 'STAR', value: '*', position: startPos };
      case '/':
        return { type: 'SLASH', value: '/', position: startPos };
      case '(':
        return { type: 'LPAREN', value: '(', position: startPos };
      case ')':
        return { type: 'RPAREN', value: ')', position: startPos };
      case '!':
        return { type: 'EXPLODE', value: '!', position: startPos };
      case 'r':
        return { type: 'REROLL', value: 'r', position: startPos };
      case '>':
        return { type: 'GREATER', value: '>', position: startPos };
      case '<':
        return { type: 'LESS', value: '<', position: startPos };
      case '=':
        return { type: 'EQUALS', value: '=', position: startPos };
      default:
        throw new Error(`Unexpected character '${char}' at position ${startPos}`);
    }
  }

  private match(str: string): boolean {
    if (this.input.slice(this.pos, this.pos + str.length).toLowerCase() === str) {
      this.pos += str.length;
      return true;
    }
    return false;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private readNumber(startPos: number): Token {
    let value = '';
    while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }
    return { type: 'NUMBER', value, position: startPos };
  }
}

// ============================================================================
// Parser
// ============================================================================

class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(input: string): DiceNode {
    const tokenizer = new Tokenizer(input);
    this.tokens = tokenizer.tokenize();
    this.pos = 0;

    const result = this.parseExpression();

    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token '${this.current().value}' at position ${this.current().position}`);
    }

    return result;
  }

  // Expression = Term (('+' | '-') Term)*
  private parseExpression(): DiceNode {
    let left = this.parseTerm();

    while (this.check('PLUS') || this.check('MINUS')) {
      const op = this.advance().type === 'PLUS' ? '+' : '-';
      const right = this.parseTerm();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  // Term = Factor (('*' | '/') Factor)*
  private parseTerm(): DiceNode {
    let left = this.parseFactor();

    while (this.check('STAR') || this.check('SLASH')) {
      const op = this.advance().type === 'STAR' ? '*' : '/';
      const right = this.parseFactor();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  // Factor = UnaryMinus | Primary
  private parseFactor(): DiceNode {
    // Unäres Minus
    if (this.check('MINUS')) {
      this.advance();
      const expr = this.parseFactor();
      return {
        type: 'binary',
        op: '*',
        left: { type: 'constant', value: -1 },
        right: expr,
      };
    }

    return this.parsePrimary();
  }

  // Primary = '(' Expression ')' | Dice | Number
  private parsePrimary(): DiceNode {
    // Gruppierung
    if (this.check('LPAREN')) {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN', "Expected ')' after expression");
      return { type: 'group', expr };
    }

    // Dice oder Number
    if (this.check('NUMBER')) {
      return this.parseDiceOrNumber();
    }

    // Implizites 1dX (z.B. "d20")
    if (this.check('D')) {
      return this.parseDice(1);
    }

    throw new Error(`Unexpected token '${this.current().value}' at position ${this.current().position}`);
  }

  // DiceOrNumber = Number ('d' Number Modifiers?)?
  private parseDiceOrNumber(): DiceNode {
    const count = parseInt(this.advance().value, 10);

    if (this.check('D')) {
      return this.parseDice(count);
    }

    return { type: 'constant', value: count };
  }

  // Dice = 'd' Number Modifiers?
  private parseDice(count: number): DiceNode {
    this.expect('D', "Expected 'd' in dice notation");

    if (!this.check('NUMBER')) {
      throw new Error('Expected number of sides after d');
    }
    const sides = parseInt(this.advance().value, 10);

    const node: DiceNode = { type: 'dice', count, sides };

    // Parse modifiers in order: reroll, explode, keep/drop
    this.parseModifiers(node as Extract<DiceNode, { type: 'dice' }>);

    return node;
  }

  private parseModifiers(node: Extract<DiceNode, { type: 'dice' }>): void {
    // Reroll (r, ro)
    if (this.check('REROLL') || this.check('REROLL_ONCE')) {
      node.reroll = this.parseReroll();
    }

    // Explode (!, !!)
    if (this.check('EXPLODE') || this.check('EXPLODE_COMPOUND')) {
      node.explode = this.parseExplode(node.sides);
    }

    // Keep/Drop (kh, kl, dh, dl)
    if (this.check('KEEP_HIGH') || this.check('KEEP_LOW') || this.check('DROP_HIGH') || this.check('DROP_LOW')) {
      node.keep = this.parseKeepDrop(node.count);
    }
  }

  private parseReroll(): Reroll {
    const once = this.check('REROLL_ONCE');
    this.advance();

    const condition = this.parseCondition(1); // Default: reroll 1s
    return { once, condition };
  }

  private parseExplode(sides: number): Explode {
    const mode = this.check('EXPLODE_COMPOUND') ? '!!' : '!';
    this.advance();

    // Optional threshold
    let threshold: Explode['threshold'];
    if (this.check('GREATER') || this.check('LESS') || this.check('EQUALS') || this.check('NUMBER')) {
      const condResult = this.parseCondition(sides);
      threshold = { op: condResult.op, value: condResult.value };
    }

    return { mode, threshold };
  }

  private parseKeepDrop(diceCount: number): KeepDrop {
    const token = this.advance();
    const mode = token.value.toLowerCase() as KeepDrop['mode'];

    // Default count: 1 for keep, (count-1) for drop
    let count = mode.startsWith('k') ? 1 : diceCount - 1;

    if (this.check('NUMBER')) {
      count = parseInt(this.advance().value, 10);
    }

    return { mode, count };
  }

  private parseCondition(defaultValue: number): { op: ComparisonOp; value: number } {
    let op: ComparisonOp = '=';

    if (this.check('GREATER')) {
      this.advance();
      op = '>';
    } else if (this.check('LESS')) {
      this.advance();
      op = '<';
    } else if (this.check('EQUALS')) {
      this.advance();
      op = '=';
    }

    let value = defaultValue;
    if (this.check('NUMBER')) {
      value = parseInt(this.advance().value, 10);
    }

    return { op, value };
  }

  // Helper methods
  private current(): Token {
    return this.tokens[this.pos];
  }

  private check(type: TokenType): boolean {
    return !this.isAtEnd() && this.current().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.tokens[this.pos - 1];
  }

  private expect(type: TokenType, message: string): Token {
    if (!this.check(type)) {
      throw new Error(`${message} at position ${this.current().position}`);
    }
    return this.advance();
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }
}

// ============================================================================
// Public API
// ============================================================================

const parser = new Parser();

/**
 * Parst einen Dice-Expression-String in einen AST.
 * @throws Error bei ungültiger Syntax
 */
export function parseDice(expr: string): DiceNode {
  return parser.parse(expr);
}

/**
 * Validiert ob ein String eine gültige Dice-Expression ist.
 */
export function validateDiceExpression(expr: string): expr is DiceExpression {
  try {
    parser.parse(expr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parst und castet zu DiceExpression (wirft bei ungültiger Syntax).
 */
export function asDiceExpression(expr: string): DiceExpression {
  parser.parse(expr); // Throws if invalid
  return expr as DiceExpression;
}
