import { useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ConversionDashboard } from './components/ConversionDashboard';
import { TheoryPanel } from './components/TheoryPanel';
import { VerificationPanel } from './components/VerificationPanel';
import { PDAInputEditor } from './components/PDAEditor';
import { useUIStore } from './store/ui-store';
import { useGrammarStore } from './store/grammar-store';
import { usePDAStore } from './store/pda-store';
import { cfgToPDA } from './engine/cfg-to-pda';
import { CheckCircle } from 'lucide-react';
import { PRESET_GRAMMARS } from './engine/grammar-parser';
import type { Production } from './engine/types';

// ─── Symbol bar (shared) ──────────────────────────────────────
function SymbolBar({ onInsert }: { onInsert: (s: string) => void }) {
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

// ─── Production card ─────────────────────────────────────────
function ProductionCard({ prod, nonTerminals }: { prod: Production; nonTerminals: Set<string> }) {
  const rhs = prod.rhs.length === 0
    ? [{ sym: 'ε', type: 'epsilon' }]
    : prod.rhs.map(sym => ({ sym, type: nonTerminals.has(sym) ? 'nonterminal' : 'terminal' }));
  return (
    <div className="production-card">
      <span className="lhs">{prod.lhs}</span>
      <span className="arrow"> → </span>
      <span className="rhs">
        {rhs.map((r, i) => (
          <span key={i} className={r.type}>
            {r.sym}{i < rhs.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </div>
  );
}

// ─── CFG Editor (with symbol bar) ────────────────────────────
function CFGEditor() {
  const { rawInput, setRawInput, grammar, parseErrors, loadExample, activeGrammar } = useGrammarStore();
  const { setPDA } = usePDAStore();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const handleConvert = () => {
    if (!activeGrammar) return;
    setPDA(cfgToPDA(activeGrammar));
  };

  const insertSymbol = useCallback((sym: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const next = rawInput.slice(0, s) + sym + rawInput.slice(e);
    setRawInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + sym.length, s + sym.length);
    });
  }, [rawInput, setRawInput]);

  return (
    <div className="panel anim-panel-1" role="region" aria-label="CFG Editor">
      <div className="panel-header">
        <span className="panel-title">
          <div className="dot cfg-dot" style={{ display: 'inline-block', marginRight: 8 }} />
          CFG INPUT
        </span>
        <div style={{ flex: 1 }} />
        <button className="pill-btn" style={{ fontSize: 10, padding: '4px 10px' }}>
          Grammar Rules
        </button>
      </div>

      <div className="panel-body">
        {/* Symbol insert bar */}
        <SymbolBar onInsert={insertSymbol} />

        <textarea
          ref={taRef}
          id="cfg-editor-input"
          className="grammar-textarea"
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          placeholder={'S → aSb | ab\n(use → or ->, | for alternation, ε for epsilon)'}
          spellCheck={false}
          aria-label="Grammar input"
        />

        <div className="text-tertiary text-xs mt-2" style={{ lineHeight: 1.6 }}>
          Use → or -{'>'}  for production, | for alternatives<br/>
          Use ε or empty for epsilon, uppercase for variables
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mt-3 mb-4">
          {PRESET_GRAMMARS.map(ex => (
            <button
              key={ex.id}
              className="btn btn-ghost btn-sm"
              style={{ border: '1px solid var(--border-panel)', borderRadius: 16 }}
              onClick={() => loadExample(ex.rawInput)}
            >
              {ex.name}
            </button>
          ))}
        </div>

        {/* Grammar info + productions */}
        {grammar && parseErrors.length === 0 && (
          <>
            <div className="text-secondary text-xs uppercase tracking-wider font-bold mb-2 mt-4">Grammar Info</div>
            <div className="grammar-meta">
              {[
                ['Variables', grammar.nonTerminals.size],
                ['Terminals', grammar.terminals.size],
                ['Productions', grammar.productions.length],
                ['Type', 'CFG'],
              ].map(([k, v]) => (
                <div key={String(k)} className="grammar-meta-item">
                  <span className="key">{k}</span>
                  <span className="value text-accent">{v}</span>
                </div>
              ))}
            </div>

            <div className="text-secondary text-xs uppercase tracking-wider font-bold mb-2 mt-4">Parsed Productions</div>
            <div className="flex flex-col gap-1">
              {grammar.productions.map(prod => (
                <ProductionCard key={prod.id} prod={prod} nonTerminals={grammar.nonTerminals} />
              ))}
            </div>

            <div className="flex gap-3 mt-5 border-t py-4 justify-center items-center">
              <button
                id="btn-cfg-to-pda"
                className="btn btn-primary btn-lg"
                onClick={handleConvert}
                aria-label="Convert CFG to PDA"
              >
                <span>⚡</span> Convert to PDA
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => useGrammarStore.getState().clearGrammar()}
                style={{ borderRadius: 8, padding: '10px 20px', border: '1px solid var(--border-panel)' }}
              >
                Clear
              </button>
            </div>
          </>
        )}

        {grammar && parseErrors.length === 0 && (
          <div className="flex items-center gap-1 mt-2" style={{ color: 'var(--color-accept)', fontSize: 11 }}>
            <CheckCircle size={11} />
            <span>Grammar parsed successfully</span>
          </div>
        )}
        {parseErrors.length > 0 && (
          <div style={{ color: 'var(--color-reject)', fontSize: 11, marginTop: 8 }}>
            {parseErrors.map((e, i) => <div key={i}>✗ {typeof e === 'string' ? e : (e as { message?: string }).message ?? String(e)}</div>)}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────
export default function App() {
  const { mode, setReducedMotion } = useUIStore();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [setReducedMotion]);

  useEffect(() => { useGrammarStore.getState().parseGrammar(); }, []);

  if (mode === 'theory') {
    return (
      <div className="app-shell">
        <Header />
        <TheoryPanel />
      </div>
    );
  }

  if (mode === 'pda-to-cfg') {
    return (
      <div className="app-shell">
        <Header />
        <div className="main-layout">
          <div className="sidebar-left" style={{ width: 420 }}>
            <PDAInputEditor />
          </div>
          <div className="main-content">
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
              <div style={{ fontSize: 56, opacity: 0.15 }}>⚙</div>
              <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
                Enter PDA transitions on the left and click<br/>
                <strong style={{ color: 'var(--text-secondary)' }}>⚙ Convert to CFG</strong><br/>
                to see the equivalent Context-Free Grammar.
              </div>
              <div style={{ marginTop: 16, padding: '16px 24px', borderRadius: 12, border: '1px solid var(--border-panel)', background: 'var(--bg-panel)', maxWidth: 400, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
                <strong>Triple Construction:</strong><br/>
                For each δ(p, a, A) → (r, B₁…Bₘ):<br/>
                Add [p,A,q] → a [r,B₁,q₁]…[qₘ₋₁,Bₘ,q]<br/>
                for all combinations of states q, q₁…qₘ₋₁
              </div>
            </div>
          </div>
        </div>
        <VerificationPanel />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <div className="main-layout">
        <div className="sidebar-left">
          <CFGEditor />
        </div>
        <div className="main-content">
          <ConversionDashboard />
        </div>
      </div>
      <VerificationPanel />
    </div>
  );
}
