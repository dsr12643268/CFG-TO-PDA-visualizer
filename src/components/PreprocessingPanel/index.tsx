import { useGrammarStore } from '../../store/grammar-store';
import { useUIStore } from '../../store/ui-store';
import type { PreprocessingToggles } from '../../store/grammar-store';

const TOGGLE_LABELS: Record<keyof PreprocessingToggles, string> = {
  eliminateLeftRecursion: 'Eliminate Left Recursion',
  eliminateUnitProductions: 'Eliminate Unit Productions',
  eliminateEpsilonProductions: 'Handle ε-Productions',
  convertToCNF: 'Convert to CNF',
};

const TOGGLE_ORDER: (keyof PreprocessingToggles)[] = [
  'eliminateLeftRecursion',
  'eliminateUnitProductions',
  'eliminateEpsilonProductions',
  'convertToCNF',
];

export function PreprocessingPanel() {
  const {
    preprocessingToggles,
    setPreprocessingToggle,
    preprocessLog,
    grammar,
    preprocessedGrammar,
  } = useGrammarStore();
  const { preprocessingPanelOpen } = useUIStore();

  const anyActive = Object.values(preprocessingToggles).some(Boolean);

  return (
    <div
      id="preprocessing-panel"
      className={`preprocessing-panel ${preprocessingPanelOpen ? 'open' : 'closed'}`}
      aria-hidden={!preprocessingPanelOpen}
    >
      <div className="preprocessing-inner">
        {/* Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em', textTransform: 'uppercase', marginRight: 4 }}>
            Preprocessing Steps:
          </span>
          {TOGGLE_ORDER.map(key => (
            <button
              key={key}
              className={`toggle-pill ${preprocessingToggles[key] ? 'active' : ''}`}
              onClick={() => setPreprocessingToggle(key, !preprocessingToggles[key])}
              aria-pressed={preprocessingToggles[key]}
              disabled={!grammar}
            >
              {preprocessingToggles[key] ? '✓ ' : ''}{TOGGLE_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Diff Log */}
        {anyActive && preprocessLog.length > 0 && (
          <div style={{
            maxHeight: 160,
            overflowY: 'auto',
            background: 'var(--bg-void)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-sm)',
            padding: 10,
            scrollbarWidth: 'thin',
          }}>
            {preprocessLog.map((entry, i) => (
              <div key={i} className={`diff-entry ${entry.type}`}>
                {entry.type === 'removed' && '− '}
                {entry.type === 'added' && '+ '}
                {entry.type === 'info' && '· '}
                {entry.type === 'warning' && '⚠ '}
                {entry.message}
              </div>
            ))}
          </div>
        )}

        {anyActive && preprocessedGrammar && (
          <div style={{ fontSize: 10, color: 'var(--color-accept)' }}>
            ✓ Preprocessed grammar has {preprocessedGrammar.productions.length} productions
            ({[...preprocessedGrammar.nonTerminals].length} non-terminals)
          </div>
        )}

        {anyActive && preprocessLog.length === 0 && grammar && (
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            No changes needed — grammar already satisfies selected conditions.
          </div>
        )}
      </div>
    </div>
  );
}
