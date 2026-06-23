# Harmony Progression Player

Obsidian plugin for detecting harmony progressions in notes and playing them with a bundled sampled piano.

## Examples

- `2-5-3-6`
- `1-1-4-1-5-4-1`
- `V->IV->I`
- `IIm7-V7-Imaj7-VIm7`
- `Dm9-G13-Cmaj9`
- `F#m7b5 -> B7b9 -> Em9`
- `C/E -> Fmaj7/A -> G7/B -> C`
- `C7(b9) -> Fmaj7(#11)`
- `C6/9 -> B7alt -> Em9`

Supports numeric degrees, Roman numerals, chord symbols, extensions, altered chords, sus/add chords, diminished/half-diminished chords, and slash chords. Inline code is supported; fenced code blocks are ignored.

## Settings

- Enabled folders: choose vault folders with autocomplete. Empty means whole vault.
- Key root: resolves numeric and Roman-numeral progressions.
- Instrument: bundled sampled piano, soft synth, or bright synth.

## Development

```bash
npm install
npm test
npm run build
```

Manual install: copy `manifest.json`, `main.js`, and `styles.css` to:

```text
<vault>/.obsidian/plugins/harmony-progression-player/
```

## License

Source code: GPL-3.0-only.

Bundled piano samples: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0. See `THIRD_PARTY_NOTICES.md`.
