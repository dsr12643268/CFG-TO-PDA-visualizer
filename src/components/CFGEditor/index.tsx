import { CheckCircle } from 'lucide-react';
import { useGrammarStore } from '../../store/grammar-store';
import { usePDAStore } from '../../store/pda-store';
import { cfgToPDA } from '../../engine/cfg-to-pda';
import { PRESET_GRAMMARS } from '../../engine/grammar-parser';
import type { Production } from '../../engine/types';

function ProductionCard({ prod, nonTerminals }: { prod: Production; nonTerminals: Set<string> }) {
  const rhs = prod.rhs.length === 0
    ? [{ sym: 'ε', type: 'epsilon' }]
    : prod.rhs.map(sym => ({
        sym,
        type: nonTerminals.has(sym) ? 'nonterminal' : 'terminal',
      }));

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

export function CFGEditor() {
  const {
    rawInput, setRawInput, grammar, parseErrors, loadExample,
    activeGrammar,
  } = useGrammarStore();
  const { setPDA } = usePDAStore();

  const handleConvert = () => {
    if (!activeGrammar) return;
    const pda = cfgToPDA(activeGrammar);
    setPDA(pda);
  };

  return (
    <div className="panel anim-panel-1" role="region" aria-label="CFG Editor">
      {/* Panel Header */}
      <div className="panel-header">
        <span className="panel-title">
          <div className="dot cfg-dot" style={{ display: 'inline-block', marginRight: 8 }}></div>
          CFG INPUT
        </span>
        <div style={{ flex: 1 }} />
        <button className="pill-btn neon-cyan" style={{ fontSize: 10, padding: '4px 10px', border: '1px solid var(--accent)' }}>
          Grammar Rules
        </button>
      </div>

      {/* Textarea */}
      <div className="panel-body">
        <textarea
          id="cfg-editor-input"
          className="grammar-textarea"
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          placeholder={'S → aSb | ab\n(use → or ->, | for alternation, ε for epsilon)'}
          spellCheck={false}
          aria-label="Grammar input"
          aria-describedby={parseErrors.length > 0 ? 'cfg-errors' : undefined}
        />

        <div className="text-tertiary text-xs mt-2" style={{ lineHeight: 1.6 }}>
          Use → or -{'>'} for production, | for alternatives<br/>
          Use ε or empty for epsilon (empty string)<br/>
          Variables: uppercase letters (S, A, B...)<br/>
          Terminals: lowercase letters (a, b, c...)
        </div>

        {/* Preset Chips */}
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

        {/* Grammar Metadata */}
        {grammar && parseErrors.length === 0 && (
          <>
            <div className="text-secondary text-xs uppercase tracking-wider font-bold mb-2 mt-4">Grammar Info</div>
            <div className="grammar-meta">
              <div className="grammar-meta-item">
                <span className="key">Variables</span>
                <span className="value text-accent">{grammar.nonTerminals.size}</span>
              </div>
              <div className="grammar-meta-item">
                <span className="key">Terminals</span>
                <span className="value text-accent">{grammar.terminals.size}</span>
              </div>
              <div className="grammar-meta-item">
                <span className="key">Productions</span>
                <span className="value text-accent">{grammar.productions.length}</span>
              </div>
              <div className="grammar-meta-item">
                <span className="key">Type</span>
                <span className="value text-primary font-bold">CFG</span>
              </div>
            </div>

            <div className="text-secondary text-xs uppercase tracking-wider font-bold mb-2 mt-4">Parsed Productions</div>
            {/* Production Cards */}
            <div className="flex flex-col gap-1">
              {grammar.productions.map(prod => (
                <ProductionCard
                  key={prod.id}
                  prod={prod}
                  nonTerminals={grammar.nonTerminals}
                />
              ))}
            </div>

            {/* Convert button */}
            <div className="flex gap-3 mt-5 border-t py-4 justify-center items-center">
              <button
                id="btn-cfg-to-pda"
                className="btn btn-primary btn-lg"
                style={{ borderRadius: 8, boxShadow: '0 4px 15px rgba(6,182,212,0.3)', background: 'linear-gradient(90deg, var(--accent) 0%, #3b82f6 100%)', color: '#fff' }}
                onClick={handleConvert}
                aria-label="Convert CFG to PDA"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="text-lg">⚡</span> Convert to PDA
                </div>
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => useGrammarStore.getState().clearGrammar()}
                aria-label="Clear grammar"
                style={{ borderRadius: 8, padding: '10px 20px', border: '1px solid var(--border-panel)' }}
              >
                Clear
              </button>
              <button
                className="btn btn-ghost"
                style={{ borderRadius: 8, padding: '10px 20px', border: '1px solid var(--color-accept)', color: 'var(--color-accept)' }}
              >
                ✓ Validate
              </button>
            </div>
          </>
        )}

        {/* Valid indicator */}
        {grammar && parseErrors.length === 0 && (
          <div className="flex items-center gap-1 mt-2" style={{ color: 'var(--color-accept)', fontSize: 11 }}>
            <CheckCircle size={11} />
            <span>Grammar parsed successfully</span>
          </div>
        )}
      </div>
    </div>
  );
}
