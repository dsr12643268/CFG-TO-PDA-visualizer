// ============================================================
// ANTIGRAVITY — Grammar Parser (Module 1)
// Parses raw CFG strings into Grammar objects
// Pure function, no side effects, fully testable
// ============================================================

import type { Grammar, Production } from './types';

// Counter for unique production IDs
let _prodIdCounter = 0;
function newProdId(): string {
  return `p${++_prodIdCounter}`;
}

export function resetProdIdCounter(): void {
  _prodIdCounter = 0;
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
}

export interface GrammarParseResult {
  grammar: Grammar | null;
  errors: ParseError[];
}

// ─── Tokenizer ───────────────────────────────────────────────

const ARROW_PATTERNS = ['->', '→', '::=', ':='];

function normalizeLine(line: string): string {
  // Normalize various arrow forms
  let result = line.trim();
  for (const arrow of ARROW_PATTERNS) {
    result = result.replace(new RegExp(escapeRegex(arrow), 'g'), '→');
  }
  // Normalize epsilon forms
  result = result.replace(/\bepsilon\b/gi, 'ε');
  result = result.replace(/\beps\b/gi, 'ε');
  result = result.replace(/\bempty\b/gi, 'ε');
  result = result.replace(/\\epsilon/g, 'ε');
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Symbol Classification ────────────────────────────────────

// Non-terminals: uppercase letters optionally followed by digits/primes
// Terminals: lowercase letters, digits (non-uppercase identifiers), or quoted strings
// Special: ε

function isNonTerminal(sym: string): boolean {
  if (sym === 'ε') return false;
  // Two-character+ names like 'id', 'if', 'then' are terminals
  // Single uppercase or uppercase+digits/primes are non-terminals
  return /^[A-Z][A-Z0-9'_]*$/.test(sym);
}


// ─── RHS Tokenizer ────────────────────────────────────────────

/**
 * Tokenize a production RHS string into a list of grammar symbols.
 * 
 * Handles two modes:
 * 1. COMPACT: symbols run together without spaces (aSb → ['a','S','b'])
 *    In compact mode, each character is its own symbol.
 * 2. SPACED: symbols separated by spaces (a S b → ['a','S','b'])
 *    In spaced mode, multi-char lowercase identifiers like 'id', 'if' are valid terminals.
 * 
 * Detection: if the trimmed RHS contains no spaces (excluding ε and quotes),
 * we use compact single-char mode.
 */
function tokenizeRHS(rhs: string, spacedMode: boolean = false): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = rhs.trim();

  while (i < s.length) {
    // Skip whitespace
    if (/\s/.test(s[i])) { i++; continue; }

    // Epsilon
    if (s[i] === 'ε') { tokens.push('ε'); i++; continue; }

    // Quoted string — always a single terminal token
    if (s[i] === '"' || s[i] === "'") {
      const quote = s[i];
      let j = i + 1;
      while (j < s.length && s[j] !== quote) j++;
      tokens.push(s.slice(i + 1, j));
      i = j + 1;
      continue;
    }

    if (!spacedMode) {
      // ─── COMPACT MODE: each char is its own symbol ───────
      // Uppercase: could be multi-char NT like S' or E1
      if (/[A-Z]/.test(s[i])) {
        let j = i + 1;
        while (j < s.length && /[A-Z0-9'_]/.test(s[j])) j++;
        tokens.push(s.slice(i, j));
        i = j;
      } else if (/[a-z]/.test(s[i])) {
        // Single lowercase char = terminal
        tokens.push(s[i]);
        i++;
      } else {
        // Other single chars (operators, parens, etc)
        tokens.push(s[i]);
        i++;
      }
    } else {
      // ─── SPACED MODE: full identifier parsing ────────────
      if (/[A-Z]/.test(s[i])) {
        // Non-terminal identifier (uppercase + digits/primes, stops at space)
        let j = i + 1;
        while (j < s.length && /[A-Z0-9'_]/.test(s[j])) j++;
        tokens.push(s.slice(i, j));
        i = j;
      } else if (/[a-z_]/.test(s[i])) {
        // Lowercase identifier: could be multi-char terminal like 'id', 'if'
        // Stops at uppercase or whitespace
        let j = i + 1;
        while (j < s.length && /[a-z0-9_]/.test(s[j])) j++;
        tokens.push(s.slice(i, j));
        i = j;
      } else {
        // Single char token
        tokens.push(s[i]);
        i++;
      }
    }
  }

  return tokens;
}

// ─── Main Parser ──────────────────────────────────────────────

export function parseGrammar(input: string): GrammarParseResult {
  resetProdIdCounter();
  const errors: ParseError[] = [];
  const productions: Production[] = [];
  const nonTerminals = new Set<string>();
  const terminals = new Set<string>();
  let startSymbol: string | null = null;
  let firstRule = true;

  // Group multi-line productions (A LHS can span multiple lines if not separated by blank line)
  // Support both single-line and multi-line grammars
  const lines = input.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const line = normalizeLine(rawLine);
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Must contain arrow
    if (!line.includes('→')) {
      errors.push({
        line: lineIdx + 1,
        column: 1,
        message: `Missing production arrow (→ or ->): "${rawLine.trim()}"`,
      });
      continue;
    }

    const arrowIdx = line.indexOf('→');
    const lhsStr = line.slice(0, arrowIdx).trim();
    const rhsStr = line.slice(arrowIdx + 1).trim();

    // Validate LHS
    if (!lhsStr) {
      errors.push({ line: lineIdx + 1, column: 1, message: 'Empty left-hand side' });
      continue;
    }

    // LHS can be a single non-terminal
    const lhsTokens = tokenizeRHS(lhsStr);
    if (lhsTokens.length !== 1 || !isNonTerminal(lhsTokens[0])) {
      errors.push({
        line: lineIdx + 1,
        column: 1,
        message: `LHS must be a single non-terminal (uppercase letter), got: "${lhsStr}"`,
      });
      continue;
    }

    const lhs = lhsTokens[0];
    nonTerminals.add(lhs);

    if (firstRule) {
      startSymbol = lhs;
      firstRule = false;
    }

    // Split RHS by '|' for alternation
    const alternatives = splitByPipe(rhsStr);

    // Determine spaced mode for this production line:
    // Strip pipe separators and their surrounding spaces, then check if any
    // remaining space exists — that indicates symbol-level spacing (e.g., "E + T")
    const rhsNoSeps = rhsStr.replace(/\s*\|\s*/g, '|');
    const spacedMode = /\s/.test(rhsNoSeps.replace(/ε/g, ''));

    for (const alt of alternatives) {
      const trimmedAlt = alt.trim();

      // Empty or ε
      if (!trimmedAlt || trimmedAlt === 'ε') {
        productions.push({ lhs, rhs: [], id: newProdId() });
        continue;
      }

      const rhsTokens = tokenizeRHS(trimmedAlt, spacedMode);

      // Filter out bare ε tokens from mixed productions (shouldn't happen, but be safe)
      const cleanTokens = rhsTokens.filter(t => t !== 'ε');
      if (cleanTokens.length === 0) {
        productions.push({ lhs, rhs: [], id: newProdId() });
      } else {
        productions.push({ lhs, rhs: cleanTokens, id: newProdId() });
      }
    }
  }

  if (!startSymbol) {
    errors.push({ line: 0, column: 0, message: 'No valid productions found' });
    return { grammar: null, errors };
  }

  // Discover terminals: symbols in RHS that are not non-terminals
  for (const prod of productions) {
    for (const sym of prod.rhs) {
      if (isNonTerminal(sym)) {
        nonTerminals.add(sym);
      } else {
        terminals.add(sym);
      }
    }
  }

  // Compute nullable set
  const nullableSet = computeNullable(productions);

  return {
    grammar: {
      startSymbol,
      nonTerminals,
      terminals,
      productions,
      nullableSet,
    },
    errors,
  };
}

// ─── Helper: Split by top-level '|' ──────────────────────────

function splitByPipe(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(' || s[i] === '[') depth++;
    else if (s[i] === ')' || s[i] === ']') depth--;
    else if (s[i] === '|' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

// ─── Nullable Set Computation ─────────────────────────────────

export function computeNullable(productions: Production[]): Set<string> {
  const nullable = new Set<string>();

  // Any nonterminal with ε production is immediately nullable
  for (const p of productions) {
    if (p.rhs.length === 0) nullable.add(p.lhs);
  }

  // Fixed-point iteration
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of productions) {
      if (!nullable.has(p.lhs) && p.rhs.every(s => nullable.has(s))) {
        nullable.add(p.lhs);
        changed = true;
      }
    }
  }

  return nullable;
}

// ─── Grammar Formatting ───────────────────────────────────────

export function productionToString(prod: Production): string {
  const rhs = prod.rhs.length === 0 ? 'ε' : prod.rhs.join(' ');
  return `${prod.lhs} → ${rhs}`;
}

export function grammarToString(grammar: Grammar): string {
  // Group productions by LHS
  const grouped = new Map<string, string[]>();
  for (const prod of grammar.productions) {
    if (!grouped.has(prod.lhs)) grouped.set(prod.lhs, []);
    const rhs = prod.rhs.length === 0 ? 'ε' : prod.rhs.join(' ');
    grouped.get(prod.lhs)!.push(rhs);
  }

  const lines: string[] = [];
  // Start symbol first
  if (grouped.has(grammar.startSymbol)) {
    lines.push(`${grammar.startSymbol} → ${grouped.get(grammar.startSymbol)!.join(' | ')}`);
    grouped.delete(grammar.startSymbol);
  }
  for (const [lhs, rhsList] of grouped) {
    lines.push(`${lhs} → ${rhsList.join(' | ')}`);
  }

  return lines.join('\n');
}

// ─── PRESET GRAMMARS ─────────────────────────────────────────

export const PRESET_GRAMMARS = [
  {
    id: 'balanced-brackets',
    name: 'Balanced Brackets',
    description: 'ε-productions and ambiguity demo. L = {matched parentheses}',
    rawInput: 'S → ε | (S) | SS',
    tags: ['epsilon', 'ambiguous'],
  },
  {
    id: 'palindromes',
    name: 'Palindromes {a,b}',
    description: 'Unit productions, symmetric derivation. L = {w : w = wᴿ}',
    rawInput: 'S → ε | a | b | aSa | bSb',
    tags: ['unit-productions', 'palindrome'],
  },
  {
    id: 'anbn',
    name: 'aⁿbⁿ',
    description: 'The canonical CFL. L = {aⁿbⁿ : n ≥ 1}',
    rawInput: 'S → aSb | ab',
    tags: ['canonical', 'simple'],
  },
  {
    id: 'dangling-else',
    name: 'Dangling Else (Ambiguous)',
    description: 'Classic ambiguous grammar. Produces ≥ 2 parse trees and BFS paths.',
    rawInput: 'S → if E then S | if E then S else S | x\nE → e',
    tags: ['ambiguous', 'multiple-parse-trees'],
  },
  {
    id: 'arithmetic',
    name: 'Arithmetic Expressions',
    description: 'Left-recursive grammar. Triggers left-recursion elimination in preprocessor.',
    rawInput: 'E → E + T | T\nT → T * F | F\nF → ( E ) | id',
    tags: ['left-recursive', 'expressions'],
  },
];
