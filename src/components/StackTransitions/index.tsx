import { useSimulationStore } from '../../store/simulation-store';
import { useGrammarStore } from '../../store/grammar-store';

export function StackTransitions() {
  const { cursor, transitionHistory } = useSimulationStore();
  const { grammar } = useGrammarStore();

  const nonTerminals = grammar?.nonTerminals ?? new Set<string>();
  const stack = cursor.stack_contents;

  return (
    <div className="sim-panel anim-panel-4" role="region" aria-label="Stack Transitions">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-title-accent">STACK</span> TRANSITIONS
        </span>
      </div>

      {/* Current transition */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-void)',
        borderBottom: '1px solid var(--border-subtle)',
        minHeight: 48,
      }}>
        {cursor.last_rule_applied ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mono)', lineHeight: 1.6 }}>
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
              Current Rule
            </div>
            <div style={{ color: 'var(--accent)' }}>
              {cursor.last_rule_applied}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            No transition applied yet
          </div>
        )}
      </div>

      {/* Stack visualization */}
      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, overflowY: 'auto' }}>
        {/* Remaining input indicator */}
        {cursor.remaining_input !== undefined && (
          <div style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 8,
            textAlign: 'center',
          }}>
            Remaining: <span style={{ color: 'var(--text-primary)' }}>
              {cursor.remaining_input || 'ε (empty)'}
            </span>
          </div>
        )}

        {/* TOP label */}
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
          ← TOP
        </div>

        {/* Stack slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 80, alignItems: 'center' }}>
          {stack.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>
              (empty)
            </div>
          ) : (
            <>
              {stack.map((sym, idx) => {
                const isTop = idx === 0;
                const isBottom = sym === '$';
                const isNT = nonTerminals.has(sym);

                return (
                  <div
                    key={`${sym}-${idx}`}
                    className={`stack-slot stack-slot-enter ${
                      isTop ? 'top' :
                      isBottom ? 'bottom-marker' :
                      isNT ? 'nonterminal' : 'terminal'
                    }`}
                    style={{ '--stagger-delay': `${idx * 30}ms` } as React.CSSProperties}
                    title={isNT ? 'Non-terminal' : isBottom ? 'Bottom-of-stack marker' : 'Terminal'}
                  >
                    {sym}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* BOTTOM label */}
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>
          $ BOTTOM
        </div>
      </div>

      {/* Transition history */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        flex: '0 0 auto',
        maxHeight: 140,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
      }}>
        <div style={{ fontSize: 9, color: 'var(--text-secondary)', padding: '4px 12px', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
          History
        </div>
        {transitionHistory.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            No transitions yet
          </div>
        ) : (
          transitionHistory.map((entry, i) => (
            <div key={i} style={{
              padding: '4px 12px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              borderBottom: '1px solid var(--border-subtle)',
              color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              <span style={{ color: 'var(--text-tertiary)', marginRight: 4 }}>#{entry.step}</span>
              <span style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {entry.rule}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
