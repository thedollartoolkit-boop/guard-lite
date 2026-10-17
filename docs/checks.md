# Guard rule definitions

Each rule defines: what it reads, what counts as a violation, what is skipped, and the common false positives requiring review.

## PPG-COLOR-001 — Literal colour outside the declared palette

- **Reads:** literal hexadecimal, RGB, RGBA, HSL or HSLA values in supported colour, background, border, outline, fill and stroke declarations.
- **Violation:** the contract contains approved colours and the normalised literal value is absent from that set.
- **Skipped:** values expressed through CSS variables, calculations, gradients without a supported literal, or browser-derived state.
- **Common review:** semantic status colours, third-party widgets, illustrations and temporary campaign surfaces may have approved exceptions not present in a small contract.
- **Repair:** identify the semantic role first. Replace the raw value with the correct named token, then inspect the rendered element in every relevant state.

## PPG-TYPE-001 — Font family outside the declared type system

- **Reads:** the first family in a literal `font-family` declaration.
- **Violation:** the contract lists approved families and the declared primary family is not one of them.
- **Skipped:** variable references, computed inheritance, font loading status, text drawn inside images or canvas elements.
- **Common review:** code blocks, data tables and third-party controls may use a separately approved mono or system family.
- **Repair:** apply the family assigned to the text role. Keep an appropriate fallback stack and verify the intended font actually loads.

## PPG-TYPE-002 — Font size outside the declared type scale

- **Reads:** literal pixel, rem and em values in `font-size` declarations.
- **Violation:** the contract contains approved font sizes and a different literal value is declared.
- **Skipped:** fluid calculations, viewport units, inherited values, browser zoom and the final size after media queries are applied.
- **Common review:** legal notes, data visualisation labels and responsive interpolation may need documented exceptions.
- **Repair:** choose the intended text role before mapping to a scale value. Do not round every number mechanically without checking hierarchy and line length.

## PPG-SPACE-001 — Spacing value outside the declared scale

- **Reads:** literal pixel, rem, em and zero values in margin, padding, gap, row-gap and column-gap declarations.
- **Violation:** the contract contains approved spacing values and one of the declared literal values is absent.
- **Skipped:** percentages, viewport units, calculations, layout results and spacing created by line height or content.
- **Common review:** optical alignment, one-pixel borders and third-party component geometry may need explicit exceptions.
- **Repair:** map the space to its structural role. Replace it with the corresponding token and review the surrounding rhythm at mobile and desktop widths.

## PPG-RADIUS-001 — Corner radius outside the declared set

- **Reads:** literal pixel, rem, em and zero values in supported corner-radius declarations.
- **Violation:** the contract contains approved radii and the declared value is not present.
- **Skipped:** percentages, calculated values, clip paths and the final shape after dimensions are known.
- **Common review:** avatars, circular indicators and media masks often need a role-specific exception.
- **Repair:** use the radius assigned to the component type. Confirm that controls, surfaces and media do not all require the same shape.

## General limits

Guard performs local text analysis. It does not run pasted code, visit websites, inspect computed browser styles or measure accessibility. Values expressed through custom properties and functions belong to the token layer's review.
