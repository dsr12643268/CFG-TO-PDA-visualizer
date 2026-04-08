import { useState, useRef, useCallback } from 'react';
import { pdaToCFG } from '../../engine/pda-to-cfg';
import type { Grammar } from '../../engine/types';

// ─── Symbol Insert Buttons ────────────────────────────────────
function SymbolBar({ onInsert }: { onInsert: (sym: string) => void }) {
  const symbols = ['ε', '→', '|', 'δ', 'Σ', 'Γ', 'Z₀'];
  return (
    <div className="symbol-bar">
      {symbols.map(s => (
        <button key={s} className="symbol-btn" onClick={() => onInsert(s)} title={`Insert ${s}`}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── CFG Result Display ───────────────────────────────────────
function CFGResult({ grammar }: { grammar: Grammar }) {
  return (
    <div className="cfg-result-panel">
      <div className="result-section">
        <div className="result-label">Start Symbol</div>
        <div className="result-chip accent">{grammar.startSymbol}</div>
      </div>
      <div className="result-section">
        <div className="result-label">Non-Terminals ({grammar.nonTerminals.size})</div>
        <div className="result-tags">
          {[...grammar.nonTerminals].slice(0, 12).map(nt => (
            <span key={nt} className="result-chip purple">{nt}</span>
          ))}
          {grammar.nonTerminals.size > 12 && (
            <span className="result-chip muted">+{grammar.nonTerminals.size - 12} more</span>
          )}
        </div>
      </div>
      <div className="result-section">
        <div className="result-label">Terminals ({grammar.terminals.size})</div>
        <div className="result-tags">
          {[...grammar.terminals].map(t => (
            <span key={t} className="result-chip green">{t}</span>
          ))}
          {grammar.terminals.size === 0 && <span className="result-chip muted">ε (empty language)</span>}
        </div>
      </div>
      <div className="result-section">
        <div className="result-label">Productions ({grammar.productions.length})</div>
        <div className="pda-cfg-productions">
          {grammar.productions.map(p => (
            <div key={p.id} className="pda-cfg-prod-row">
              <span className="prod-lhs">{p.lhs}</span>
              <span className="prod-arrow"> → </span>
              <span className="prod-rhs">{p.rhs.length === 0 ? 'ε' : p.rhs.join(' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PDA Input Format Helper ──────────────────────────────────
const PLACEHOLDER = `# PDA → CFG Converter
# Enter PDA transitions, one per line.
# Format: δ(fromState, inputSymbol, stackTop) = (toState, stackPush)
# Use ε for epsilon (empty). Use Z₀ as stack bottom marker.
#
# Example (accepts aⁿbⁿ):
δ(q_start, ε, Z₀) = (q_loop, SZ₀)
δ(q_loop, ε, S) = (q_loop, aSb)
δ(q_loop, ε, S) = (q_loop, ab)
δ(q_loop, a, a) = (q_loop, ε)
δ(q_loop, b, b) = (q_loop, ε)
δ(q_loop, ε, Z₀) = (q_accept, Z₀)
# 
# States: (auto-detected from transitions)
# Start state: first state encountered
# Start stack symbol: Z₀ (auto-detected)
# Accept states: q_accept`;

// Parse a single transition line like: δ(q_start, ε, Z₀) = (q_loop, SZ₀)
function parseTransitionLine(line: string, id: string) {
  // Strip comments and trim
  const clean = line.replace(/#.*$/, '').trim();
  if (!clean || !clean.startsWith('δ')) return null;

  // Match δ(from, input, stackTop) = (to, push)
  const m = clean.match(
    /δ\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\s*\)\s*=\s*\(\s*([^,)]+),\s*([^)]*)\s*\)/
  );
  if (!m) return null;

  const [, fromState, inp, stackTop, toState, pushStr] = m.map(s => s.trim());
  const inputSymbol = (inp === 'ε' || inp === '') ? null : inp;
  const stackPush = (pushStr === 'ε' || pushStr === '') ? [] : pushStr.split('').filter(Boolean);

  return {
    id,
    fromState, inputSymbol, stackTop, toState, stackPush,
    ruleType: 'manual' as const,
    label: clean,
  };
}

function parsePDAText(text: string) {
  const lines = text.split('\n');
  const transitions: ReturnType<typeof parseTransitionLine>[] = [];
  const errors: string[] = [];

  lines.forEach((line, i) => {
    const clean = line.replace(/#.*$/, '').trim();
    if (!clean) return;
    const t = parseTransitionLine(clean, `pt_${i}`);
    if (t) {
      transitions.push(t);
    } else {
      errors.push(`Line ${i + 1}: Cannot parse "${clean}"`);
    }
  });

  return { transitions: transitions.filter(Boolean) as NonNullable<ReturnType<typeof parseTransitionLine>>[], errors };
}

// ─── Main PDA → CFG Editor ────────────────────────────────────
export function PDAInputEditor() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Grammar | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [startState, setStartState] = useState('q_start');
  const [startStack, setStartStack] = useState('Z₀');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertSymbol = useCallback((sym: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = text.slice(0, start) + sym + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + sym.length, start + sym.length);
    });
  }, [text]);

  const handleConvert = useCallback(() => {
    setErrors([]);
    setResult(null);
    if (!text.trim()) {
      setErrors(['Please enter PDA transitions.']);
      return;
    }

    const { transitions, errors: pErr } = parsePDAText(text);
    setParseErrors(pErr);

    if (transitions.length === 0) {
      setErrors(['No valid transitions found. Check the format above.']);
      return;
    }

    // Build minimal PDA from parsed transitions
    const states = new Set<string>();
    const inputAlphabet = new Set<string>();
    const stackAlphabet = new Set<string>();
    for (const t of transitions) {
      states.add(t.fromState);
      states.add(t.toState);
      if (t.inputSymbol) inputAlphabet.add(t.inputSymbol);
      stackAlphabet.add(t.stackTop);
      t.stackPush.forEach(s => stackAlphabet.add(s));
    }

    // Detect accept states (states with no outgoing transitions, OR named q_accept)
    const acceptStates = new Set<string>();
    for (const s of states) {
      if (s.toLowerCase().includes('accept') || s === 'qf' || s === 'q_f') {
        acceptStates.add(s);
      }
    }

    const pda = {
      states,
      inputAlphabet,
      stackAlphabet,
      transitions,
      startState: startState || transitions[0].fromState,
      startStackSymbol: startStack || 'Z₀',
      acceptByEmptyStack: false,
      acceptStates,
    };

    try {
      const cfg = pdaToCFG(pda);
      setResult(cfg);
      setErrors([]);
    } catch (e: unknown) {
      setErrors([`Conversion error: ${e instanceof Error ? e.message : String(e)}`]);
    }
  }, [text, startState, startStack]);

  const loadExample = () => {
    setText(
      'δ(q_start, ε, Z₀) = (q_loop, SZ₀)\n' +
      'δ(q_loop, ε, S) = (q_loop, aSb)\n' +
      'δ(q_loop, ε, S) = (q_loop, ab)\n' +
      'δ(q_loop, a, a) = (q_loop, ε)\n' +
      'δ(q_loop, b, b) = (q_loop, ε)\n' +
      'δ(q_loop, ε, Z₀) = (q_accept, Z₀)'
    );
    setStartState('q_start');
    setStartStack('Z₀');
    setResult(null);
    setErrors([]);
    setParseErrors([]);
  };

  return (
    <div className="pda-input-editor">
      {/* Header */}
      <div className="pda-editor-header">
        <div className="pda-editor-title">
          <div className="dot pda-dot" />
          PDA INPUT
        </div>
        <button className="btn-example" onClick={loadExample}>Load Example</button>
      </div>

      {/* Symbol bar */}
      <div className="pda-editor-body">
        <SymbolBar onInsert={insertSymbol} />

        {/* Config row */}
        <div className="pda-config-row">
          <div className="pda-config-field">
            <label className="pda-field-label">Start State</label>
            <input
              className="pda-field-input"
              value={startState}
              onChange={e => setStartState(e.target.value)}
              placeholder="q_start"
            />
          </div>
          <div className="pda-config-field">
            <label className="pda-field-label">Start Stack Symbol</label>
            <input
              className="pda-field-input"
              value={startStack}
              onChange={e => setStartStack(e.target.value)}
              placeholder="Z₀"
            />
          </div>
        </div>

        {/* Transitions textarea */}
        <textarea
          ref={textareaRef}
          className="pda-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          rows={10}
        />

        {/* Format hint */}
        <div className="pda-format-hint">
          Format: <code>δ(fromState, input, stackTop) = (toState, stackPush)</code> — use <code>ε</code> for epsilon
        </div>

        {/* Parse warnings */}
        {parseErrors.length > 0 && (
          <div className="pda-parse-warnings">
            {parseErrors.map((e, i) => <div key={i} className="parse-warn-row">⚠ {e}</div>)}
          </div>
        )}

        {/* Error display */}
        {errors.length > 0 && (
          <div className="pda-errors">
            {errors.map((e, i) => <div key={i} className="error-row">✗ {e}</div>)}
          </div>
        )}

        {/* Convert button */}
        <div className="pda-actions">
          <button
            className="btn-convert"
            onClick={handleConvert}
            disabled={!text.trim()}
          >
            ⚙ Convert to CFG
          </button>
          <button
            className="btn-clear-pda"
            onClick={() => { setText(''); setResult(null); setErrors([]); setParseErrors([]); }}
          >
            Clear
          </button>
        </div>

        {/* Success indicator */}
        {result && (
          <div className="pda-success">
            ✓ Converted — {result.productions.length} productions generated
          </div>
        )}
      </div>

      {/* CFG Result */}
      {result && <CFGResult grammar={result} />}
    </div>
  );
}
