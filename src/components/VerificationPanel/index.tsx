import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react';
import { useGrammarStore } from '../../store/grammar-store';
import { usePDAStore } from '../../store/pda-store';
import { cyk } from '../../engine/cyk-parser';
import { runBFSToCompletion } from '../../engine/bfs-engine';
import type { TestResult, StressTestResult } from '../../engine/types';

function generateStrings(terminals: string[], maxLen: number): string[] {
  const results: string[] = [''];
  for (let len = 1; len <= maxLen; len++) {
    function gen(current: string): void {
      if (current.length === len) { results.push(current); return; }
      for (const t of terminals) gen(current + t);
    }
    gen('');
  }
  return results;
}

export function VerificationPanel() {
  const { activeGrammar } = useGrammarStore();
  const { pda } = usePDAStore();

  const [testInput, setTestInput] = useState('aabb');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Stress test
  const [stressOpen, setStressOpen] = useState(false);
  const [stressMaxLen, setStressMaxLen] = useState(4);
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null);
  const [stressProgress, setStressProgress] = useState(0);
  const [stressRunning, setStressRunning] = useState(false);

  const runTest = useCallback(async () => {
    if (!activeGrammar || !pda) return;
    setLoading(true);
    setTestResult(null);

    await new Promise(r => setTimeout(r, 10));

    try {
      const cfgResult = cyk(activeGrammar, testInput);
      const pdaResult = runBFSToCompletion(pda, testInput, 2000);

      const cfgAccepts = cfgResult.accepted;
      const pdaAccepts = pdaResult.acceptingPaths.length > 0;

      setTestResult({
        input: testInput,
        cfgAccepts,
        pdaAccepts,
        match: cfgAccepts === pdaAccepts,
        cfgParseTrees: cfgResult.parseTrees.length,
        pdaAcceptingPaths: pdaResult.acceptingPaths.length,
        pdaExplored: pdaResult.totalExplored,
      });
    } catch (err) {
      console.error('Test error:', err);
    }

    setLoading(false);
  }, [activeGrammar, pda, testInput]);

  const runStressTest = useCallback(async () => {
    if (!activeGrammar || !pda) return;
    setStressRunning(true);
    setStressResult(null);
    setStressProgress(0);

    const terminals = [...activeGrammar.terminals];
    const strings = generateStrings(terminals, stressMaxLen);
    const results: TestResult[] = [];
    let agreements = 0;

    for (let i = 0; i < strings.length; i++) {
      const s = strings[i];
      await new Promise(r => setTimeout(r, 0)); // yield to UI

      try {
        const cfgResult = cyk(activeGrammar, s);
        const pdaResult = runBFSToCompletion(pda, s, 1000);
        const cfgAccepts = cfgResult.accepted;
        const pdaAccepts = pdaResult.acceptingPaths.length > 0;
        const match = cfgAccepts === pdaAccepts;
        if (match) agreements++;

        results.push({
          input: s,
          cfgAccepts,
          pdaAccepts,
          match,
          cfgParseTrees: cfgResult.parseTrees.length,
          pdaAcceptingPaths: pdaResult.acceptingPaths.length,
          pdaExplored: pdaResult.totalExplored,
        });
      } catch {
        results.push({
          input: s,
          cfgAccepts: false,
          pdaAccepts: false,
          match: true,
          cfgParseTrees: 0,
          pdaAcceptingPaths: 0,
          pdaExplored: 0,
        });
      }

      setStressProgress(Math.round((i + 1) / strings.length * 100));
    }

    const cfgAcceptCount = results.filter(r => r.cfgAccepts).length;
    const pdaAcceptCount = results.filter(r => r.pdaAccepts).length;

    setStressResult({
      results,
      totalTested: results.length,
      agreements,
      disagreements: results.length - agreements,
      cfgAcceptRate: results.length > 0 ? cfgAcceptCount / results.length : 0,
      pdaAcceptRate: results.length > 0 ? pdaAcceptCount / results.length : 0,
    });

    setStressRunning(false);
    setStressProgress(100);
  }, [activeGrammar, pda, stressMaxLen]);

  return (
    <div className="verification-panel" role="region" aria-label="Verification Panel">
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}>
          Verification
        </span>

        <input
          id="verification-input"
          type="text"
          className="text-input"
          style={{ flex: 1, maxWidth: 200, fontSize: 12 }}
          value={testInput}
          onChange={e => setTestInput(e.target.value)}
          placeholder="Test string..."
          aria-label="Test string input"
          onKeyDown={e => { if (e.key === 'Enter') runTest(); }}
        />

        <button
          id="btn-run-test"
          className="btn btn-primary btn-sm"
          onClick={runTest}
          disabled={!activeGrammar || !pda || loading}
          aria-label="Run equivalence test"
        >
          {loading ? <Loader size={11} className="spinner" /> : <CheckCircle size={11} />}
          Run Test
        </button>

        <button
          className="btn btn-sm"
          onClick={() => setStressOpen(v => !v)}
          disabled={!activeGrammar || !pda}
          aria-label="Open stress test"
        >
          Stress Test
        </button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* CFG result */}
        <div style={{
          flex: 1,
          padding: '10px 16px',
          borderRight: '1px solid var(--border-subtle)',
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            CFG (CYK Algorithm)
          </div>
          {testResult ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {testResult.cfgAccepts
                  ? <CheckCircle size={16} color="var(--color-accept)" />
                  : <XCircle size={16} color="var(--color-reject)" />
                }
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: testResult.cfgAccepts ? 'var(--color-accept)' : 'var(--color-reject)',
                }}>
                  {testResult.cfgAccepts ? 'ACCEPT' : 'REJECT'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Parse trees: <span style={{ color: 'var(--accent)' }}>{testResult.cfgParseTrees}</span>
                {testResult.cfgParseTrees > 1 && (
                  <span style={{ color: '#f5c13e', marginLeft: 8 }}>⚠ Ambiguous</span>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              No test run yet
            </div>
          )}
        </div>

        {/* PDA result */}
        <div style={{ flex: 1, padding: '10px 16px', borderRight: '1px solid var(--border-subtle)', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            PDA (BFS State-Space)
          </div>
          {testResult ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {testResult.pdaAccepts
                  ? <CheckCircle size={16} color="var(--color-accept)" />
                  : <XCircle size={16} color="var(--color-reject)" />
                }
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: testResult.pdaAccepts ? 'var(--color-accept)' : 'var(--color-reject)',
                }}>
                  {testResult.pdaAccepts ? 'ACCEPT' : 'REJECT'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Accepting paths: <span style={{ color: 'var(--accent)' }}>{testResult.pdaAcceptingPaths}</span>
                {' | '}
                Explored: <span style={{ color: 'var(--accent)' }}>{testResult.pdaExplored}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              No test run yet
            </div>
          )}
        </div>

        {/* Equivalence verdict */}
        <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {testResult ? (
            <div className={`equiv-badge equiv-badge-enter ${testResult.match ? 'match' : 'mismatch'} ${testResult.match ? 'verified' : ''}`}>
              {testResult.match ? (
                <>
                  <CheckCircle size={14} />
                  {testResult.cfgAccepts
                    ? `Both ACCEPT "${testResult.input}"`
                    : `Both REJECT "${testResult.input}"`
                  }
                </>
              ) : (
                <>
                  <AlertTriangle size={14} />
                  Models DISAGREE
                </>
              )}
            </div>
          ) : (
            <div className="equiv-badge neutral">
              <CheckCircle size={14} />
              Awaiting test
            </div>
          )}

          {testResult && !testResult.match && (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 200 }}>
              Conversion error — check preprocessing steps.
            </div>
          )}
        </div>
      </div>

      {/* Stress Test section */}
      {stressOpen && (
        <div style={{
          borderTop: '1px solid var(--border-grid)',
          padding: '10px 16px',
          background: 'var(--bg-void)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Stress Test — Max length:
            </span>
            <input
              type="number"
              min={1}
              max={8}
              value={stressMaxLen}
              onChange={e => setStressMaxLen(parseInt(e.target.value))}
              className="text-input"
              style={{ width: 60, fontSize: 12 }}
              aria-label="Maximum string length for stress test"
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={runStressTest}
              disabled={stressRunning || !activeGrammar || !pda}
              aria-label="Run stress test"
            >
              {stressRunning ? <Loader size={11} className="spinner" /> : null}
              Run
            </button>
            {stressRunning && (
              <div style={{ flex: 1 }}>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${stressProgress}%` }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {stressProgress}%
                </div>
              </div>
            )}
          </div>

          {stressResult && (
            <>
              {/* Summary */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                {[
                  { label: 'Tested', value: stressResult.totalTested, color: 'var(--text-primary)' },
                  { label: 'Agreements', value: stressResult.agreements, color: 'var(--color-accept)' },
                  { label: 'Disagreements', value: stressResult.disagreements, color: stressResult.disagreements > 0 ? 'var(--color-reject)' : 'var(--text-tertiary)' },
                  { label: 'CFG Accept Rate', value: `${(stressResult.cfgAcceptRate * 100).toFixed(1)}%`, color: 'var(--color-active)' },
                  { label: 'PDA Accept Rate', value: `${(stressResult.pdaAcceptRate * 100).toFixed(1)}%`, color: 'var(--color-active)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Results table (first 20) */}
              <div style={{ maxHeight: 160, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>String</th>
                      <th>CFG</th>
                      <th>PDA</th>
                      <th>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stressResult.results.slice(0, 30).map((r, i) => (
                      <tr key={i} style={{ background: !r.match ? 'var(--color-reject-dim)' : undefined }}>
                        <td style={{ color: 'var(--text-primary)' }}>{r.input === '' ? 'ε' : r.input}</td>
                        <td style={{ color: r.cfgAccepts ? 'var(--color-accept)' : 'var(--color-reject)' }}>
                          {r.cfgAccepts ? '✓' : '✗'}
                        </td>
                        <td style={{ color: r.pdaAccepts ? 'var(--color-accept)' : 'var(--color-reject)' }}>
                          {r.pdaAccepts ? '✓' : '✗'}
                        </td>
                        <td style={{ color: r.match ? 'var(--color-accept)' : 'var(--color-reject)' }}>
                          {r.match ? '✓' : '✗ DISAGREE'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
