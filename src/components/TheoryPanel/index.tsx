

export function TheoryPanel() {
  return (
    <div className="theory-panel">
      
      <div className="theory-grid">
        {/* CFG Card */}
        <div className="theory-card">
          <div className="theory-card-header">
            <div className="dot cfg-dot"></div>
            <h3>CONTEXT-FREE GRAMMARS</h3>
          </div>
          <p className="theory-text">
            A CFG is a 4-tuple G = (V, Σ, R, S) where V is a set of variables, Σ is the terminal alphabet, R is a set of production rules, and S is the start variable.
          </p>
          
          <div className="theory-block">
            <div className="theory-icon blue">A</div>
            <div className="theory-content">
              <h4>Head → Body</h4>
              <p>Each rule has a single variable (head) that can be replaced by a string of variables and terminals (body).<br/><span className="math">A → α where A ∈ V, α ∈ (V ∪ Σ)*</span></p>
            </div>
          </div>
          
          <div className="theory-block">
            <div className="theory-icon blue">ε</div>
            <div className="theory-content">
              <h4>Epsilon Rules</h4>
              <p>Variables can derive the empty string, written as A → ε. This allows generation of finite strings.</p>
            </div>
          </div>

          <div className="theory-block">
            <div className="theory-icon blue">L</div>
            <div className="theory-content">
              <h4>Language Generated</h4>
              <p className="math">L(G) = &#123;w ∈ Σ* | S ⇒* w&#125;, the set of all terminal strings derivable from S.</p>
            </div>
          </div>
        </div>

        {/* PDA Card */}
        <div className="theory-card">
          <div className="theory-card-header">
            <div className="dot pda-dot"></div>
            <h3>PUSHDOWN AUTOMATA</h3>
          </div>
          <p className="theory-text">
            A PDA is a 7-tuple P = (Q, Σ, Γ, δ, q₀, Z₀, F) where Q is states, Σ input alphabet, Γ stack alphabet, δ transition function, q₀ start state, Z₀ initial stack symbol, F accept states.
          </p>
          
          <div className="theory-block">
            <div className="theory-icon purple">δ</div>
            <div className="theory-content">
              <h4>δ: Q × Σ_ε × Γ → P(Q × Γ*)</h4>
              <p>Takes current state, input symbol (or ε), and top of stack; returns set of (new state, stack push) pairs.</p>
            </div>
          </div>
          
          <div className="theory-block">
            <div className="theory-icon purple">Z</div>
            <div className="theory-content">
              <h4>Stack Operations</h4>
              <p>Pop by reading stack top. Push by writing symbols. Replace by reading top and writing new symbols.</p>
            </div>
          </div>

          <div className="theory-block">
            <div className="theory-icon purple">F</div>
            <div className="theory-content">
              <h4>Acceptance</h4>
              <p>Accept by final state: reach F with any stack. Or accept by empty stack: empty the stack on any state.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Equivalence Theorem */}
      <div className="theory-card full-width">
        <div className="theory-card-header">
          <div className="dot equiv-dot"></div>
          <h3>EQUIVALENCE THEOREM</h3>
        </div>
        <p className="theory-text strong">
          Theorem: A language is context-free if and only if some pushdown automaton recognizes it. This means CFGs and PDAs are equivalent in expressive power.
        </p>

        <div className="theorem-columns">
          <div className="theorem-col">
            <h4 className="col-title">CFG → PDA CONSTRUCTION</h4>
            <div className="step-block">
              <div className="step-num">1</div>
              <div>
                <h5>Create 3 states</h5>
                <p>q_start, q_loop, q_accept. Initialize stack with S and Z₀.</p>
              </div>
            </div>
            <div className="step-block">
              <div className="step-num">2</div>
              <div>
                <h5>For each rule A → w</h5>
                <p>Add ε-transition from q_loop to q_loop: pop A, push w onto stack.</p>
              </div>
            </div>
            <div className="step-block">
              <div className="step-num">3</div>
              <div>
                <h5>For each terminal a</h5>
                <p>Add transition reading a from input, popping a from stack (match).</p>
              </div>
            </div>
            <div className="step-block">
              <div className="step-num">4</div>
              <div>
                <h5>Accept when stack empty</h5>
                <p>Pop bottom marker and move to q_accept.</p>
              </div>
            </div>
          </div>

          <div className="theorem-col">
            <h4 className="col-title">PDA → CFG CONSTRUCTION</h4>
            <div className="step-block">
              <div className="step-num">1</div>
              <div>
                <h5>Normalize PDA</h5>
                <p>Convert to single accept state, ensure stack empty on accept. Modify transitions accordingly.</p>
              </div>
            </div>
            <div className="step-block">
              <div className="step-num">2</div>
              <div>
                <h5>Create variables A[p,q]</h5>
                <p>For each pair of states p, q: variable represents strings that take PDA from p (stack empty) to q (stack empty).</p>
              </div>
            </div>
            <div className="step-block">
              <div className="step-num">3</div>
              <div>
                <h5>Add production rules</h5>
                <p>A[p,p] → ε for all states p. For push/pop transitions, add A[p,q] → a A[r,s] b rules.</p>
              </div>
            </div>
            <div className="step-block">
              <div className="step-num">4</div>
              <div>
                <h5>Chain rules for pops</h5>
                <p>For empty stack pops linking states, add A[p,q] → A[p,r] A[r,q] rules bridging intermediate states.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
