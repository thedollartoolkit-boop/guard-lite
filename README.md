# Guard Lite — local design-rule checker

Browser-only checker that compares pasted CSS or HTML text against a small declared design contract (palette, font families, font sizes, spacing, corner radii) and returns line-level findings.

No server. No build step. No account. Your code never leaves the browser tab.

Live hosted version: https://pixel-perfect-system.netlify.app/guard/

## Why

AI coding agents freely invent colours, fonts, sizes, spacing and radii. This library implements five mechanical checks that catch that drift against the values **you** declared.

## The five checks (stable IDs)

| ID | Catches |
|---|---|
| `PPG-COLOR-001` | Literal colour outside the declared palette |
| `PPG-TYPE-001` | Font family outside the declared type system |
| `PPG-TYPE-002` | Font size outside the declared type scale |
| `PPG-SPACE-001` | Spacing value outside the declared scale |
| `PPG-RADIUS-001` | Corner radius outside the declared set |

Full definitions, skip conditions and false-positive guidance: [docs/checks.md](docs/checks.md) or the live [check library](https://pixel-perfect-system.netlify.app/checks/).

## Use it

**Option A — run locally.** Open any HTML file in a browser and call the checker, or clone this repo and serve `examples/` statically. The hosted version is the reference UI.

**Option B — embed in your own HTML guard page.**

```html
<script src="src/guard.js"></script>
<script>
  // See src/guard.js exports; contract and source text stay client-side.
</script>
```

## Honest limitations

- Text analysis only: does not execute pasted HTML, load websites or inspect computed styles.
- Values expressed through `var()`, `calc()`, `clamp()` and CSS keywords are skipped; verify those at the token layer.
- Not an accessibility audit and not a design-quality judge.

## The system behind it

Guard Lite is the free checker of [Pixel Perfect](https://pixel-perfect-system.netlify.app/) — a design-contract toolkit (DESIGN.md, agent rules, tokens) for AI-built interfaces. Examples in [`examples/`](examples/) are live before/after demos.

## License

MIT — [LICENSE](LICENSE)
