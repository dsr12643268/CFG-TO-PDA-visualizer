# CFG ↔ PDA Visualizer

A mathematically rigorous and visually extraordinary web application designed for the study of Context-Free Grammars (CFGs) and Pushdown Automata (PDAs). This tool provides an interactive environment to prove the equivalence of these two formalisms through live simulation and bi-directional conversion.

## 🚀 Key Features

- **CFG to PDA Conversion**: Implements the standard **3-state NPDA construction** (q_start, q_loop, q_accept), providing a pedagogically clear mapping of grammar rules to transitions.
- **PDA to CFG Conversion**: Utilizes the **Triple Construction algorithm** to generate an equivalent grammar from a given PDA.
- **Interactive Draggable Diagram**: A dynamic, SVG-based state diagram where states can be rearranged. All transitions and labels update in real-time.
- **Live Simulation Engine**: A BFS-based state-space explorer that animates the stack operations and input consumption during string verification.
- **Modern "Parchment" UI**: A high-readability, premium light theme designed for academic presentations, featuring Forest Green and Terracotta accents.
- **Quick Symbol Input**: Dedicated buttons for rapid insertion of formal symbols (ε, →, δ, Σ, Γ, Z₀).

## 🛠️ Technical Stack

| Technology | Purpose |
|---|---|
| React 18 | UI Framework |
| TypeScript | Type-safe logic |
| Vite | Build tool & dev server |
| Zustand | State management |
| Vanilla CSS | Custom design system |
| SVG | Interactive state diagrams |

## 📖 Theoretical Implementation

### CFG → PDA (3-State Construction)
The engine converts any CFG into an equivalent NPDA by:
1. **q_start**: Initializing the stack with the grammar's start symbol.
2. **q_loop**: Handling all productions (pushing RHS symbols) and terminal matching (popping matched terminals).
3. **q_accept**: Entering the final state once the stack marker (Z₀) is reached.

### PDA → CFG (Triple Construction)
The converter generates non-terminals of the form `[p, A, q]` representing a path from state `p` to `q` that pops symbol `A`. This construction ensures that every valid string accepted by the PDA can be derived by the resulting grammar.

## 🚦 Getting Started

1. **Clone the Repo**:
   ```bash
   git clone https://github.com/dsr12643268/CFG-TO-PDA-visualizer.git
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Locally**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   ```

## 📂 Project Structure

```
src/
├── engine/           # Core algorithms
│   ├── cfg-to-pda.ts      # CFG → PDA conversion (3-state NPDA)
│   ├── pda-to-cfg.ts      # PDA → CFG conversion (Triple construction)
│   ├── bfs-engine.ts       # BFS state-space simulation
│   ├── grammar-parser.ts   # Grammar input parser
│   ├── preprocessor.ts     # CNF/GNF transformations
│   └── types.ts            # TypeScript type definitions
├── components/       # React UI components
│   ├── Header/             # App header with mode tabs
│   ├── CFGEditor/          # CFG input editor (in App.tsx)
│   ├── PDAEditor/          # PDA input editor (PDA → CFG mode)
│   ├── ConversionDashboard/# Steps, diagram, transition table, simulation
│   ├── VerificationPanel/  # String acceptance testing
│   └── TheoryPanel/        # Formal definitions & theory reference
├── store/            # Zustand state stores
│   ├── grammar-store.ts
│   ├── pda-store.ts
│   └── ui-store.ts
└── styles/
    └── globals.css         # Complete design system
```

## 🎓 Academic Context

This project was developed as part of a **BTech Final Year Project** in Computer Science & Engineering, focusing on **Theory of Computation** and **Compiler Design**.

**Author:** Dushyant Singh Rathore  
**Roll Number:** 2024UCM2598

## 📜 License

MIT License
