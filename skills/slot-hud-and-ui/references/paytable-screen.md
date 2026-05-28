# Paytable Screen

A full-screen overlay listing symbol values, feature rules, and line diagrams. Procedurally drawn,
paged for mobile. The *values* shown come from the engine's paytable data — this screen renders them;
it does not compute or validate them (RTP correctness is `h5g-slot-math`).

## Structure

A paged overlay (swipe or arrow nav):

1. **High-value symbols** — icon + 3/4/5-of-a-kind payouts.
2. **Low-value symbols** — same grid.
3. **Special symbols** — Wild (substitution rule), Scatter (pays anywhere + trigger), Bonus.
4. **Feature rules** — free spins trigger/award, bonus descriptions.
5. **Paylines** — the line diagrams (or "243 ways" / "Megaways" statement).

## Driving it from engine data

Render directly from the same paytable the engine evaluates, so the screen can never drift from the
math:

```javascript
function buildPaytable(engineConfig, theme) {
  const { paytable, paylines, betAmount } = engineConfig;
  const pages = [];
  const symbols = Object.keys(paytable);
  // Split into high/low by top 5-of-a-kind value
  const ranked = symbols.sort((a,b) => (paytable[b][5]??0) - (paytable[a][5]??0));
  pages.push(makeSymbolPage(ranked.slice(0, 4), paytable, theme, 'HIGH'));
  pages.push(makeSymbolPage(ranked.slice(4),    paytable, theme, 'LOW'));
  pages.push(makeLinesPage(paylines, theme));
  return makePager(pages, theme);
}
```

## A symbol payout row

```javascript
function makeSymbolRow(symbolKey, payouts, theme) {
  const row = new Container();
  const icon = makeSymbol(symbolKey, 56);            // from procedural-symbol-design
  row.addChild(icon);

  // "5 → 500   4 → 100   3 → 20"  (values are per current bet, multiply if needed)
  const cols = [5,4,3].filter(n => payouts[n]);
  cols.forEach((n, i) => {
    const t = new Text({ text: `${n}  ${payouts[n].toLocaleString()}`, style: {
      fontFamily:'system-ui', fontSize:16, fontWeight:'800',
      fill:{ fill: makeVerticalGradient(theme.titleGradient ?? ['#fff5d6','#f5c842'], 18) },
    }});
    t.x = 80 + i * 90; t.anchor.set(0, 0.5);
    row.addChild(t);
  });
  return row;
}
```

Show whether values are "× line bet" or absolute, and update them live if the bet selector changes —
players distrust paytables that don't match the current bet.

## Line diagrams

Draw each payline as a small grid with the active path highlighted:

```javascript
function makeLineThumb(line, theme) {   // line = [row per reel]
  const cell = 14, g = new Graphics();
  line.forEach((row, reel) => {
    for (let r = 0; r < 3; r++) {
      const active = r === row;
      g.roundRect(reel*cell, r*cell, cell-2, cell-2, 2)
       .fill({ color: active ? (theme.frameGlow ?? 0xf5c842) : 0x2a2030, alpha: active ? 1 : 0.5 });
    }
  });
  // connect active cells
  g.moveTo(0, line[0]*cell + cell/2);
  line.forEach((row, reel) => g.lineTo(reel*cell + cell/2, row*cell + cell/2));
  g.stroke({ width: 2, color: theme.frameGlow ?? 0xf5c842, alpha: 0.9 });
  return g;
}
```

## Navigation + close

- Arrows `‹ ›` and swipe gestures both change page; page dots show position.
- A clear close button (44pt) top-right; tapping the dimmed backdrop also closes.
- Pause idle animations and music ducking while open; restore on close.

## Mobile rules

- One symbol category per page in portrait — never force a tiny multi-column table.
- Text ≥ 14px; icons ≥ 48px so values are legible at arm's length.
- See `mobile-layout-patterns.md` for safe-area handling of the close button.
