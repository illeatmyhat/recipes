/**
 * Guard / constraint expression language (no `eval`).
 *
 * A small, safe boolean language over the `Params` record, shared by step
 * `when`, `constraint.when`, and (via `collectPositiveHas`) the build-time
 * boundness lint. Grammar (from docs/recipe-model.md):
 *
 *   expr  := or
 *   or    := and ('||' and)*
 *   and   := cmp ('&&' cmp)*
 *   cmp   := unary (('==' | '!=' | '<' | '>' | '<=' | '>=') unary)?
 *   unary := '!' unary | atom
 *   atom  := name | literal | 'has(' name ',' string ')' | 'count(' name ')'
 *          | '(' expr ')'
 *
 * `name` resolves against `Params`: `servings`, a knob value, or a role (its
 * single selected fill id). `has(role, 'x')` tests membership of a selection;
 * `count(role)` is its size, so `count(toppings) > 0` guards a step on "any
 * fill chosen" — the only way to read an optional multi-fill role generally.
 */
import type { Params } from './types';

// ── AST ──────────────────────────────────────────────────────────────────────
export type GuardAst =
  | { type: 'or'; left: GuardAst; right: GuardAst }
  | { type: 'and'; left: GuardAst; right: GuardAst }
  | { type: 'not'; expr: GuardAst }
  | { type: 'cmp'; op: CmpOp; left: GuardAst; right: GuardAst }
  | { type: 'has'; role: string; value: string }
  | { type: 'count'; role: string }
  | { type: 'name'; name: string }
  | { type: 'lit'; value: string | number | boolean };

type CmpOp = '==' | '!=' | '<' | '>' | '<=' | '>=';

// ── tokenizer ────────────────────────────────────────────────────────────────
type Tok =
  | { t: 'id'; v: string }
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'op'; v: string }
  | { t: 'punc'; v: '(' | ')' | ',' };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdPart = (c: string) => /[A-Za-z0-9_]/.test(c);
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '(' || c === ')' || c === ',') {
      toks.push({ t: 'punc', v: c });
      i += 1;
      continue;
    }
    // two-char operators first
    const two = src.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '==' || two === '!=' || two === '<=' || two === '>=') {
      toks.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if (c === '!' || c === '<' || c === '>') {
      toks.push({ t: 'op', v: c });
      i += 1;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== "'") j += 1;
      if (j >= src.length) throw new Error(`guard: unterminated string in "${src}"`);
      toks.push({ t: 'str', v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j] as string)) j += 1;
      toks.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < src.length && isIdPart(src[j] as string)) j += 1;
      toks.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`guard: unexpected character '${c}' in "${src}"`);
  }
  return toks;
}

// ── parser (recursive descent) ───────────────────────────────────────────────
class Parser {
  private pos = 0;
  constructor(private readonly toks: Tok[], private readonly src: string) {}

  parse(): GuardAst {
    const ast = this.parseOr();
    if (this.pos !== this.toks.length) {
      throw new Error(`guard: trailing tokens in "${this.src}"`);
    }
    return ast;
  }

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }

  private eatOp(v: string): boolean {
    const t = this.peek();
    if (t && t.t === 'op' && t.v === v) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private expectPunc(v: '(' | ')' | ','): void {
    const t = this.peek();
    if (!t || t.t !== 'punc' || t.v !== v) {
      throw new Error(`guard: expected '${v}' in "${this.src}"`);
    }
    this.pos += 1;
  }

  private parseOr(): GuardAst {
    let left = this.parseAnd();
    while (this.eatOp('||')) {
      left = { type: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): GuardAst {
    let left = this.parseCmp();
    while (this.eatOp('&&')) {
      left = { type: 'and', left, right: this.parseCmp() };
    }
    return left;
  }

  private parseCmp(): GuardAst {
    const left = this.parseUnary();
    for (const op of ['==', '!=', '<=', '>=', '<', '>'] as const) {
      if (this.eatOp(op)) {
        return { type: 'cmp', op, left, right: this.parseUnary() };
      }
    }
    return left;
  }

  private parseUnary(): GuardAst {
    if (this.eatOp('!')) return { type: 'not', expr: this.parseUnary() };
    return this.parseAtom();
  }

  private parseAtom(): GuardAst {
    const t = this.peek();
    if (!t) throw new Error(`guard: unexpected end of "${this.src}"`);
    if (t.t === 'punc' && t.v === '(') {
      this.pos += 1;
      const inner = this.parseOr();
      this.expectPunc(')');
      return inner;
    }
    if (t.t === 'num') {
      this.pos += 1;
      return { type: 'lit', value: t.v };
    }
    if (t.t === 'str') {
      this.pos += 1;
      return { type: 'lit', value: t.v };
    }
    if (t.t === 'id') {
      this.pos += 1;
      if (t.v === 'true') return { type: 'lit', value: true };
      if (t.v === 'false') return { type: 'lit', value: false };
      if (t.v === 'has') {
        this.expectPunc('(');
        const role = this.peek();
        if (!role || role.t !== 'id') throw new Error(`guard: has() needs a role in "${this.src}"`);
        this.pos += 1;
        this.expectPunc(',');
        const val = this.peek();
        if (!val || val.t !== 'str') throw new Error(`guard: has() needs a 'string' in "${this.src}"`);
        this.pos += 1;
        this.expectPunc(')');
        return { type: 'has', role: role.v, value: val.v };
      }
      if (t.v === 'count') {
        this.expectPunc('(');
        const role = this.peek();
        if (!role || role.t !== 'id') throw new Error(`guard: count() needs a role in "${this.src}"`);
        this.pos += 1;
        this.expectPunc(')');
        return { type: 'count', role: role.v };
      }
      return { type: 'name', name: t.v };
    }
    throw new Error(`guard: unexpected token in "${this.src}"`);
  }
}

const cache = new Map<string, GuardAst>();

/** Parse a guard expression to an AST (cached per source string). */
export function parseGuard(src: string): GuardAst {
  const hit = cache.get(src);
  if (hit) return hit;
  const ast = new Parser(tokenize(src), src).parse();
  cache.set(src, ast);
  return ast;
}

// ── evaluation ───────────────────────────────────────────────────────────────
type Value = string | number | boolean | undefined;

function toBool(v: Value): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return false;
}

function resolveName(name: string, p: Params): Value {
  if (name === 'servings') return p.servings;
  if (name in p.knobs) return p.knobs[name];
  if (name in p.selection) return (p.selection[name] ?? [])[0];
  return undefined;
}

function compare(op: CmpOp, a: Value, b: Value): boolean {
  if (op === '==') return String(a) === String(b);
  if (op === '!=') return String(a) !== String(b);
  const x = Number(a);
  const y = Number(b);
  if (op === '<') return x < y;
  if (op === '>') return x > y;
  if (op === '<=') return x <= y;
  return x >= y;
}

function evalNode(n: GuardAst, p: Params): Value {
  switch (n.type) {
    case 'or':
      return toBool(evalNode(n.left, p)) || toBool(evalNode(n.right, p));
    case 'and':
      return toBool(evalNode(n.left, p)) && toBool(evalNode(n.right, p));
    case 'not':
      return !toBool(evalNode(n.expr, p));
    case 'cmp':
      return compare(n.op, evalNode(n.left, p), evalNode(n.right, p));
    case 'has':
      return (p.selection[n.role] ?? []).includes(n.value);
    case 'count':
      return (p.selection[n.role] ?? []).length;
    case 'name':
      return resolveName(n.name, p);
    case 'lit':
      return n.value;
  }
}

/** Evaluate a guard against a parameter record. Returns a boolean. */
export function evalGuard(src: string, p: Params): boolean {
  return toBool(evalNode(parseGuard(src), p));
}

/**
 * The roles a guard proves *bound* (selection ≥ 1): a positive `has(role, …)`
 * or a `count(role) > 0` / `count(role) >= 1` comparison (either operand
 * order) appearing as a top-level `&&` conjunct, never negated and never
 * under `||`. Used by the build-time boundness lint (a step reading a min:0
 * role must be guarded by one of these). Conservative by design — see
 * docs/recipe-model.md.
 */
export function collectPositiveHas(ast: GuardAst): Set<string> {
  // `count(role) OP literal` (or mirrored) proving selection ≥ 1.
  const MIRROR: Partial<Record<CmpOp, CmpOp>> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
  const countAtLeastOne = (n: GuardAst): string | null => {
    if (n.type !== 'cmp') return null;
    let count: GuardAst = n.left;
    let lit: GuardAst = n.right;
    let op: CmpOp = n.op;
    if (count.type !== 'count') {
      // mirrored form: `0 < count(role)` / `1 <= count(role)`
      [count, lit] = [lit, count];
      op = MIRROR[op] ?? op;
    }
    if (count.type !== 'count' || lit.type !== 'lit' || typeof lit.value !== 'number') return null;
    const bound = (op === '>' && lit.value >= 0) || (op === '>=' && lit.value >= 1);
    return bound ? count.role : null;
  };
  const out = new Set<string>();
  const walkConjuncts = (n: GuardAst): void => {
    if (n.type === 'and') {
      walkConjuncts(n.left);
      walkConjuncts(n.right);
    } else if (n.type === 'has') {
      out.add(n.role);
    } else {
      const role = countAtLeastOne(n);
      if (role !== null) out.add(role);
    }
    // or/not/name/lit and other cmp shapes do not contribute a guarantee
  };
  walkConjuncts(ast);
  return out;
}
