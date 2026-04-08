import { useState, useCallback, useRef } from 'react';
import { usePDAStore } from '../../store/pda-store';
import { transitionDescription } from '../../engine/cfg-to-pda';
import { runBFSToCompletion } from '../../engine/bfs-engine';
import type { Transition } from '../../engine/types';

// ─── 3-State Interactive Draggable Diagram ─────────────────────

interface NodePos { x: number; y: number; }

const DEFAULT_POSITIONS: Record<string, NodePos> = {
  q_start:  { x: 130, y: 120 },
  q_loop:   { x: 330, y: 120 },
  q_accept: { x: 530, y: 120 },
};
const R = 38; // state circle radius

function edgePoint(from: NodePos, to: NodePos, r: number): NodePos {
  const dx = to.x - from.x; const dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: from.x + (dx / d) * r, y: from.y + (dy / d) * r };
}
function midpt(a: NodePos, b: NodePos): NodePos {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function StateDiagram({ transitions }: { transitions: Transition[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, NodePos>>(() => ({ ...DEFAULT_POSITIONS }));
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const hasT = transitions.length > 0;
  const loopT = transitions.filter(t => t.fromState === 'q_loop' && t.toState === 'q_loop');
  const initT  = transitions.find(t => t.fromState === 'q_start');
  const acceptT = transitions.find(t => t.toState === 'q_accept');

  const getSVGPt = useCallback((e: React.PointerEvent): NodePos => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const s = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: s.x, y: s.y };
  }, []);

  const onPointerDown = useCallback((id: string, e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = getSVGPt(e);
    dragging.current = { id, ox: x - positions[id].x, oy: y - positions[id].y };
  }, [positions, getSVGPt]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const { x, y } = getSVGPt(e);
    setPositions(prev => ({
      ...prev,
      [dragging.current!.id]: {
        x: Math.max(R + 2, Math.min(788 - R, x - dragging.current!.ox)),
        y: Math.max(R + 2, Math.min(228 - R, y - dragging.current!.oy)),
      },
    }));
  }, [getSVGPt]);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  const qs = positions.q_start;
  const ql = positions.q_loop;
  const qa = positions.q_accept;

  // Arrow endpoints (on perimeter)
  const sl_from = edgePoint(qs, ql, R + 2);
  const sl_to   = edgePoint(ql, qs, R + 2);
  const la_from = edgePoint(ql, qa, R + 2);
  const la_to   = edgePoint(qa, ql, R + 2);
  const sl_mid  = midpt(sl_from, sl_to);
  const la_mid  = midpt(la_from, la_to);

  // Self-loop on q_loop
  const selfCtrl = { x: ql.x, y: ql.y - R - 34 };
  const sl1 = { x: ql.x - 22, y: ql.y - R + 5 };
  const sl2 = { x: ql.x + 22, y: ql.y - R + 5 };

  // Start indicator arrow
  const startTip  = edgePoint(qs, { x: qs.x - 1, y: qs.y }, R + 2);
  const startFrom = { x: startTip.x - 48, y: startTip.y };

  const nodeStyle = {
    q_start:  { stroke: '#c45c26', fill: '#7a3010', glow: 'rgba(196,92,38,.3)',  f: 'url(#gp)' },
    q_loop:   { stroke: '#2d6a4f', fill: '#1b4332', glow: 'rgba(45,106,79,.3)',  f: 'url(#gc)' },
    q_accept: { stroke: '#276749', fill: '#1b4332', glow: 'rgba(39,103,73,.3)',  f: 'url(#gg)' },
  } as Record<string, { stroke: string; fill: string; glow: string; f: string }>;


  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', userSelect: 'none' }}>
      {/* Toolbar */}
      <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
        <span style={{ fontSize: 10, color: '#475569', fontFamily: 'var(--font-mono)' }}>drag states to reposition</span>
        <button
          onClick={() => setPositions({ ...DEFAULT_POSITIONS })}
          style={{
            fontSize: 10, padding: '3px 10px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)',
            color: '#00e5ff', fontFamily: 'var(--font-mono)',
          }}
        >
          ↺ Reset
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 790 230"
        style={{ width: '100%', height: '100%' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        aria-label="Interactive PDA state diagram — drag states to reposition"
      >
        <defs>
          <filter id="gc"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gp"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gg"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="gh"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0,10 3.5,0 7" fill="#2d6a4f" opacity="0.85"/>
          </marker>
          <marker id="arr-f" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0,10 3.5,0 7" fill="#2d6a4f" opacity="0.55"/>
          </marker>
        </defs>

        {/* ── Start indicator ── */}
        <line x1={startFrom.x} y1={startFrom.y} x2={startTip.x} y2={startTip.y}
          stroke="#00e5ff" strokeWidth="1.5" markerEnd="url(#arr)" opacity="0.5"/>
        <text x={startFrom.x} y={startFrom.y - 5} fontSize="9" fill="#475569" fontFamily="var(--font-mono)">start</text>

        {/* ── q_start → q_loop ── */}
        <line x1={sl_from.x} y1={sl_from.y} x2={sl_to.x} y2={sl_to.y}
          stroke="#2d6a4f" strokeWidth="1.5" markerEnd="url(#arr)" opacity={hasT ? 0.8 : 0.2}/>
        {initT && (
          <text x={sl_mid.x} y={sl_mid.y - 9} textAnchor="middle"
            fontSize="9" fontFamily="var(--font-mono)" fill="#8c7e6e">ε, Z₀/SZ₀</text>
        )}

        {/* ── Self-loop on q_loop ── */}
        {loopT.length > 0 && (
          <g>
            <path d={`M ${sl1.x} ${sl1.y} Q ${selfCtrl.x} ${selfCtrl.y} ${sl2.x} ${sl2.y}`}
              fill="none" stroke="#00e5ff" strokeWidth="1.5" markerEnd="url(#arr-f)" opacity="0.65"/>
            <text x={selfCtrl.x} y={selfCtrl.y - 5} textAnchor="middle"
              fontSize="8" fontFamily="var(--font-mono)" fill="#94a3b8">a, a/ε | ε, A/α</text>
            <text x={selfCtrl.x} y={selfCtrl.y + 7} textAnchor="middle"
              fontSize="8" fontFamily="var(--font-mono)" fill="#64748b">({loopT.length} rules)</text>
          </g>
        )}

        {/* ── q_loop → q_accept ── */}
        <line x1={la_from.x} y1={la_from.y} x2={la_to.x} y2={la_to.y}
          stroke="#2d6a4f" strokeWidth="1.5" markerEnd="url(#arr)" opacity={hasT ? 0.8 : 0.2}/>
        {acceptT && (
          <text x={la_mid.x} y={la_mid.y - 9} textAnchor="middle"
            fontSize="9" fontFamily="var(--font-mono)" fill="#8c7e6e">ε, Z₀/Z₀</text>
        )}

        {/* ── Draggable Nodes ── */}
        {(['q_start', 'q_loop', 'q_accept'] as const).map(id => {
          const p = positions[id];
          const s = nodeStyle[id];
          const hot = hovered === id;
          const isAccept = id === 'q_accept';
          return (
            <g key={id}>
              {hot && <circle cx={p.x} cy={p.y} r={R + 12} fill={s.glow} opacity="0.15" filter="url(#gh)"/>}

              {/* Grab surface — full radius, invisible fill for easy hit testing */}
              <circle
                cx={p.x} cy={p.y} r={R}
                fill="#faf7f2"
                stroke={s.stroke}
                strokeWidth={hot ? 3 : 2}
                filter={hot ? 'url(#gh)' : s.f}
                opacity={hasT ? 1 : 0.4}
                style={{ cursor: 'grab' }}
                onPointerDown={e => onPointerDown(id, e)}
                onPointerEnter={() => setHovered(id)}
                onPointerLeave={() => setHovered(null)}
              />

              {/* Inner ring for q_accept */}
              {isAccept && (
                <circle cx={p.x} cy={p.y} r={R - 6}
                  fill="none" stroke={s.stroke} strokeWidth="1"
                  opacity={hasT ? 0.5 : 0.2} style={{ pointerEvents: 'none' }}/>
              )}

              {/* Node label */}
              <text
                x={p.x} y={p.y + 4} textAnchor="middle"
                fontSize={isAccept ? 10 : 11}
                fontFamily="JetBrains Mono, monospace"
                fill={s.fill}
                style={{ pointerEvents: 'none', fontWeight: 500 }}
              >
                {id}
              </text>

              {/* Drag tooltip on hover */}
              {hot && (
                <text x={p.x} y={p.y + R + 15} textAnchor="middle"
                  fontSize="8" fontFamily="var(--font-mono)" fill="#475569"
                  style={{ pointerEvents: 'none' }}>drag to move</text>
              )}
            </g>
          );
        })}

        {/* ── Info Badges pinned right ── */}
        <g transform="translate(671,18)">
          <rect x="0" y="0"  width="112" height="22" rx="11" fill="#d8f3dc" stroke="#2d6a4f" strokeWidth="1"/>
          <text x="56" y="15" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#2d6a4f">{transitions.length} transitions</text>
          <rect x="0" y="28" width="112" height="22" rx="11" fill="#fde5d4" stroke="#c45c26" strokeWidth="1"/>
          <text x="56" y="43" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#c45c26">3 states</text>
          <rect x="0" y="56" width="112" height="22" rx="11" fill="#d8f3dc" stroke="#276749" strokeWidth="1"/>
          <text x="56" y="71" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#276749">final-state accept</text>
        </g>
      </svg>
    </div>
  );
}

// ─── Conversion Steps ─────────────────────────────────────────

function ConversionSteps({ transitions }: { transitions: Transition[] }) {
  const steps = [
    {
      num: 1,
      title: 'Non-GNF Grammar Detected',
      desc: 'The grammar is NOT in Greibach Normal Form (some productions start with a variable or mix terminals/variables freely). We use the standard 3-state construction that works for ANY CFG.',
      tag: 'General CFG → 3-state NPDA',
      color: '#00e5ff',
    },
    {
      num: 2,
      title: 'Three States Created',
      desc: 'q_start: initialize the stack. q_loop: simulate all possible leftmost derivations non-deterministically. q_accept: input accepted.',
      tag: 'Q = {q_start, q_loop, q_accept}',
      color: '#bf5af2',
    },
    {
      num: 3,
      title: 'Stack Initialization',
      desc: 'ε-move from q_start → q_loop: pop Z₀, push start symbol S on top of Z₀. No input is read. The PDA is now in its main derivation loop.',
      tag: 'δ(q_start, ε, Z₀) = {(q_loop, SZ₀)}',
      color: '#00ff9f',
    },
  ];

  return (
    <div className="neon-card h-full flex flex-col" style={{ overflow: 'hidden' }}>
      <div className="neon-card-header">
        <div className="neon-dot cyan" />
        <h3 className="neon-card-title">CONVERSION STEPS</h3>
        <div className="neon-badge cyan">{transitions.length} steps</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map(step => (
          <div key={step.num} className="step-card">
            <div className="step-num" style={{ background: `${step.color}22`, border: `1px solid ${step.color}66`, color: step.color }}>
              {step.num}
            </div>
            <div style={{ flex: 1 }}>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
              <div className="step-tag" style={{ borderColor: `${step.color}44`, color: step.color }}>
                {step.tag}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Output Transition Table ──────────────────────────────────

function OutputTable({ transitions }: { transitions: Transition[] }) {
  return (
    <div className="neon-card" style={{ flexShrink: 0 }}>
      <div className="neon-card-header">
        <div className="neon-dot cyan" />
        <h3 className="neon-card-title">OUTPUT</h3>
        <div className="neon-badge cyan">{transitions.filter(t => t.fromState === 'q_loop' || t.fromState === 'q_start').length} transitions</div>
        <div className="neon-badge purple">3 states</div>
        <div className="neon-badge green">final-state accept</div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ padding: '0 0 8px 0' }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 16px' }}>
          PDA TRANSITION FUNCTION δ
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="neon-table">
            <thead>
              <tr>
                <th>FROM</th>
                <th>READ</th>
                <th>POP (STACK TOP)</th>
                <th>TO</th>
                <th>PUSH (NEW TOP FIRST)</th>
                <th>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              {transitions.map(t => (
                <tr key={t.id}>
                  <td>
                    <div className={`state-badge ${t.fromState === 'q_start' ? 'purple' : t.fromState === 'q_accept' ? 'green' : 'cyan'}`}>
                      {t.fromState}
                    </div>
                  </td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', color: '#f1f5f9' }}>{t.inputSymbol ?? 'ε'}</span></td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', color: '#00e5ff' }}>{t.stackTop}</span></td>
                  <td>
                    <div className={`state-badge ${t.toState === 'q_accept' ? 'green' : t.toState === 'q_start' ? 'purple' : 'cyan'}`}>
                      {t.toState}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', color: t.stackPush.length === 0 ? '#475569' : '#f1f5f9' }}>
                      {t.stackPush.length === 0 ? 'ε' : t.stackPush.join('')}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8', maxWidth: 300 }}>
                    {t.description ?? transitionDescription(t)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Stack Simulation ─────────────────────────────────────────

function StackSimulation() {
  const { pda } = usePDAStore();
  const [testStr, setTestStr] = useState('');
  const [simResult, setSimResult] = useState<{ accepted: boolean; paths: number; explored: number } | null>(null);
  const [simSteps, setSimSteps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const runSimulation = useCallback(async () => {
    if (!pda) return;
    setRunning(true);
    setSimResult(null);
    await new Promise(r => setTimeout(r, 20));

    const result = runBFSToCompletion(pda, testStr, 3000);
    const accepted = result.acceptingPaths.length > 0;
    const steps: string[] = [];

    if (result.acceptingPaths.length > 0) {
      const path = result.acceptingPaths[0];
      for (const cfg of path) {
        const stackStr = cfg.stack.length > 0 ? cfg.stack.join('') : 'ε';
        const remStr = cfg.remaining || 'ε';
        steps.push(`${cfg.state}: input="${remStr}" stack=[${stackStr}]  ← ${cfg.ruleApplied}`);
      }
    } else {
      steps.push('No accepting path found. Input rejected.');
    }

    setSimResult({ accepted, paths: result.acceptingPaths.length, explored: result.totalExplored });
    setSimSteps(steps);
    setRunning(false);
  }, [pda, testStr]);

  return (
    <div className="neon-card" style={{ flexShrink: 0 }}>
      <div className="neon-card-header">
        <div className="neon-dot purple" />
        <h3 className="neon-card-title">STACK SIMULATION</h3>
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="test string..."
          value={testStr}
          onChange={e => setTestStr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSimulation(); }}
          className="sim-input"
          aria-label="Test string"
        />
        <button
          className="btn-neon-primary"
          onClick={runSimulation}
          disabled={!pda || running}
        >
          {running ? '...' : '▶ Run'}
        </button>
      </div>

      {simResult ? (
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
            padding: '10px 14px', borderRadius: 10,
            background: simResult.accepted ? 'rgba(0,255,159,0.08)' : 'rgba(255,71,87,0.08)',
            border: `1px solid ${simResult.accepted ? '#00ff9f' : '#ff4757'}44`,
          }}>
            <span style={{ fontSize: 20 }}>{simResult.accepted ? '✓' : '✗'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: simResult.accepted ? '#00ff9f' : '#ff4757' }}>
              {simResult.accepted ? `ACCEPTED "${testStr || 'ε'}"` : `REJECTED "${testStr || 'ε'}"`}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              {simResult.explored} configs explored
            </span>
          </div>
          {simSteps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {simSteps.map((s, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', padding: '3px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, borderLeft: '2px solid rgba(0,229,255,0.3)' }}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '16px', fontSize: 12, color: '#475569', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
          Enter a string above and click Run to simulate the PDA step-by-step.
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────

export function ConversionDashboard() {
  const { pda } = usePDAStore();

  if (!pda) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>⚙</div>
        <div style={{ color: '#475569', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
          Enter a CFG and click "Convert to PDA" to see the 3-state NPDA
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-void)' }}>
      {/* Top row: steps + diagram */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 320 }}>
        <ConversionSteps transitions={pda.transitions} />
        <div className="neon-card h-full" style={{ minHeight: 280 }}>
          <div className="neon-card-header">
            <div className="neon-dot cyan" />
            <h3 className="neon-card-title">VISUAL DIAGRAM</h3>
            <div style={{ flex: 1 }} />
            <div className="neon-badge purple">General — 3 States</div>
          </div>
          <div style={{ flex: 1, padding: '8px 12px 12px', minHeight: 0 }}>
            <StateDiagram transitions={pda.transitions} />
          </div>
        </div>
      </div>

      {/* Output Table */}
      <OutputTable transitions={pda.transitions} />

      {/* Stack Simulation */}
      <StackSimulation />
    </div>
  );
}
