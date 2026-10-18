# design-contract-checker

Command-line Guard Lite: compare CSS or HTML text against **your** declared design contract and get line-level findings with stable rule IDs. Five checks, zero dependencies, no account.

```bash
npx design-contract-checker --contract design-contract.txt src/styles.css index.html
```

## What it checks

| ID | Catches |
|---|---|
| `PPG-COLOR-001` | Literal colour outside the declared palette |
| `PPG-TYPE-001` | Font family outside the declared type system |
| `PPG-TYPE-002` | Font size outside the declared type scale |
| `PPG-SPACE-001` | Spacing value outside the declared scale |
| `PPG-RADIUS-001` | Corner radius outside the declared set |

## Contract format

One line per category, comma-separated values:

```
colors = #f2eee5, #18231d, #a95038
fonts = Georgia, Arial
font-sizes = 16px, 24px, 48px
spacing = 8px, 16px, 24px, 48px
radii = 0, 2px, 4px
```

## Options

| Flag | Meaning |
|---|---|
| `--contract <file>` | Required. Path to the contract file. |
| `--json` | Machine-readable JSON (stable rule IDs, findings per file, summary). |
| `--help` | Usage. |

## Exit codes

`0` clean / `1` contract violations found / `2` usage error. CI-friendly: violations fail the run.

Agent-friendly: pipe `--json` findings into your coding agent and ask it to repair each `PPG-*` finding.

## Honest limitations

- Text analysis only: does not execute pasted HTML, load websites or inspect computed styles.
- Values through `var()`, `calc()`, `clamp()` and CSS keywords are skipped; verify those at the token layer.
- Not an accessibility audit and not a design-quality judge.

Full check definitions: [docs/checks.md](../docs/checks.md). Browser checker: https://pixel-perfect-system.netlify.app/guard/

## The system behind it

Guard Lite is the free checker of [Pixel Perfect](https://pixel-perfect-system.netlify.app/) — a design-contract toolkit (DESIGN.md, agent rules, tokens) for AI-built interfaces.

## License

MIT
