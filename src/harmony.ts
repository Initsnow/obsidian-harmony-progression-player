import { Chord, Note } from "tonal";

export type PitchClass = "C" | "C#" | "Db" | "D" | "D#" | "Eb" | "E" | "F" | "F#" | "Gb" | "G" | "G#" | "Ab" | "A" | "A#" | "Bb" | "B";

export interface HarmonyParseSettings {
  keyRoot: PitchClass;
  octave: number;
}

export interface PlayableChord {
  source: string;
  symbol: string;
  notes: string[];
}

export interface MatchRange {
  from: number;
  to: number;
  text: string;
}

interface DegreeMatch {
  degree: number;
  accidental: "" | "b" | "#";
  suffix: string;
  explicitMinor: boolean;
  explicitMajor: boolean;
}

export const PITCH_CLASSES: PitchClass[] = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B"
];

const MAJOR_SCALE_INTERVALS = ["1P", "2M", "3M", "4P", "5P", "6M", "7M"];
const DEGREE_QUALITIES = ["", "m", "m", "", "", "m", "dim"];
const ROMAN_DEGREES: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7
};

const DEGREE_ROOT_SOURCE = "[b#]?(?:[1-7]|VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)";
const NOTE_ROOT_SOURCE = "[A-G](?:#|b)?";
const QUALITY_SOURCE = "(?:6\\/9|Maj|maj|min|sus|dim|aug|add|alt|dom|no|omit|m|M|h|o|ø|\\+|°|\\^|Δ|\\d|#|b|\\([^)]{1,16}\\))*";
const BASS_SOURCE = `(?:\\/(?:${DEGREE_ROOT_SOURCE}|${NOTE_ROOT_SOURCE}))?`;
const TOKEN_PATTERN = `(?:${DEGREE_ROOT_SOURCE}|${NOTE_ROOT_SOURCE})${QUALITY_SOURCE}${BASS_SOURCE}`;
const JOINER_PATTERN = "(?:\\s*(?:->|-->|=>|⇒|→|-|–|—|>|\\|)\\s*|\\s+)";
const PROGRESSION_REGEX = new RegExp(
  `(?<![A-Za-z0-9_])${TOKEN_PATTERN}(?:${JOINER_PATTERN}${TOKEN_PATTERN}){1,15}(?![A-Za-z0-9_])`,
  "giu"
);

const SEPARATOR_REGEX = /\s*(?:->|-->|=>|⇒|→|-|–|—|>|\|)\s*|\s+/u;
const DEGREE_TOKEN_REGEX = new RegExp(`^${DEGREE_ROOT_SOURCE}${QUALITY_SOURCE}${BASS_SOURCE}$`, "u");

export function findProgressions(text: string, settings: HarmonyParseSettings): MatchRange[] {
  const matches: MatchRange[] = [];
  PROGRESSION_REGEX.lastIndex = 0;

  for (const match of text.matchAll(PROGRESSION_REGEX)) {
    const raw = match[0].trim();
    const leadingSpaces = match[0].match(/^\s+/u)?.[0].length ?? 0;
    const from = (match.index ?? 0) + leadingSpaces;
    const parsed = parseProgression(raw, settings);

    if (parsed.length < 2 || !looksLikeIntendedProgression(raw, parsed)) {
      continue;
    }

    matches.push({
      from,
      to: from + raw.length,
      text: raw
    });
  }

  return matches;
}

export function parseProgression(text: string, settings: HarmonyParseSettings): PlayableChord[] {
  return tokenizeProgression(text)
    .map((token) => parseChordToken(token, settings))
    .filter((chord): chord is PlayableChord => chord !== null);
}

export function parseChordToken(rawToken: string, settings: HarmonyParseSettings): PlayableChord | null {
  const normalized = normalizeChordToken(rawToken);
  if (!normalized) {
    return null;
  }

  const symbol = isDegreeToken(normalized)
    ? resolveDegreeChordSymbol(normalized, settings)
    : normalized;

  if (!symbol) {
    return null;
  }

  const notes = notesForChordSymbol(symbol, settings.octave);
  if (notes.length === 0) {
    return null;
  }

  return {
    source: rawToken,
    symbol,
    notes
  };
}

export function tokenizeProgression(text: string): string[] {
  return text
    .split(SEPARATOR_REGEX)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function notesForChordSymbol(symbol: string, octave: number): string[] {
  const split = splitSlash(symbol);
  const chord = Chord.get(split.chord);
  if (chord.empty || chord.notes.length === 0) {
    return [];
  }

  const voiced = voiceChordNotes(chord.notes, octave);
  if (!split.bass) {
    return voiced;
  }

  const bassPc = Note.pitchClass(split.bass);
  if (!bassPc) {
    return voiced;
  }

  const withoutBass = voiced.filter((note) => Note.pitchClass(note) !== bassPc);
  return [`${bassPc}${Math.max(1, octave - 1)}`, ...withoutBass];
}

function looksLikeIntendedProgression(text: string, parsed: PlayableChord[]): boolean {
  if (/->|-->|=>|⇒|→|-|–|—|>|\|/u.test(text)) {
    return true;
  }

  const tokens = tokenizeProgression(text);
  if (tokens.length !== parsed.length) {
    return false;
  }

  return tokens.some((token) => isDegreeToken(token) || isRichChordToken(token));
}

function resolveDegreeChordSymbol(token: string, settings: HarmonyParseSettings): string | null {
  const split = splitSlash(token);
  const degree = parseDegree(split.chord);
  if (!degree) {
    return null;
  }

  const root = applyDegreeAccidental(
    Note.transpose(settings.keyRoot, MAJOR_SCALE_INTERVALS[degree.degree - 1]),
    degree.accidental
  );
  const suffix = resolveDegreeSuffix(degree);
  const bass = split.bass ? parseDegreeBass(split.bass, settings) : "";

  return `${root}${suffix}${bass ? `/${bass}` : ""}`;
}

function parseDegree(token: string): DegreeMatch | null {
  const accidental = token.match(/^([b#]?)(.*)$/u);
  if (!accidental) {
    return null;
  }

  const accidentalMark = accidental[1] as "" | "b" | "#";
  const body = accidental[2];
  const numeric = body.match(/^([1-7])(.+)?$/u);
  if (numeric) {
    const suffix = numeric[2] ?? "";
    return {
      degree: Number(numeric[1]),
      accidental: accidentalMark,
      suffix,
      explicitMinor: /^m(?!aj)/u.test(suffix),
      explicitMajor: /^M|^maj|\^/u.test(suffix)
    };
  }

  const roman = body.match(/^(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/u);
  if (!roman) {
    return null;
  }

  const numeral = roman[1];
  const suffix = roman[2] ?? "";
  return {
    degree: ROMAN_DEGREES[numeral.toUpperCase()],
    accidental: accidentalMark,
    suffix,
    explicitMinor: numeral === numeral.toLowerCase() || /^m(?!aj)/u.test(suffix),
    explicitMajor: numeral === numeral.toUpperCase() || /^M|^maj|\^/u.test(suffix)
  };
}

function resolveDegreeSuffix(degree: DegreeMatch): string {
  const suffix = normalizeQualitySuffix(degree.suffix);
  if (!suffix) {
    if (degree.explicitMinor) {
      return "m";
    }
    if (degree.explicitMajor) {
      return "";
    }
    return DEGREE_QUALITIES[degree.degree - 1];
  }

  if (/^(?:7|9|11|13|6|add|sus|no|omit)/u.test(suffix)) {
    const baseQuality = degree.explicitMinor
      ? "m"
      : degree.explicitMajor
        ? ""
        : DEGREE_QUALITIES[degree.degree - 1];
    return `${baseQuality}${suffix}`;
  }

  return suffix;
}

function parseDegreeBass(token: string, settings: HarmonyParseSettings): string | null {
  if (!isDegreeToken(token)) {
    return normalizeChordToken(token);
  }

  const degree = parseDegree(token);
  if (!degree) {
    return null;
  }

  return applyDegreeAccidental(
    Note.transpose(settings.keyRoot, MAJOR_SCALE_INTERVALS[degree.degree - 1]),
    degree.accidental
  );
}

function voiceChordNotes(pitchClasses: string[], octave: number): string[] {
  if (pitchClasses.length === 0) {
    return [];
  }

  const first = pitchClasses[0];
  let previousMidi = Note.midi(`${first}${octave}`) ?? 60;

  return pitchClasses.map((pitchClass: string, index: number) => {
    if (index === 0) {
      return `${pitchClass}${octave}`;
    }

    let candidateOctave = octave;
    let candidateMidi = Note.midi(`${pitchClass}${candidateOctave}`) ?? previousMidi;
    while (candidateMidi <= previousMidi) {
      candidateOctave += 1;
      candidateMidi = Note.midi(`${pitchClass}${candidateOctave}`) ?? candidateMidi + 12;
    }

    previousMidi = candidateMidi;
    return `${pitchClass}${candidateOctave}`;
  });
}

function applyDegreeAccidental(root: string, accidental: "" | "b" | "#"): string {
  if (accidental === "#") {
    return Note.transpose(root, "1A");
  }
  if (accidental === "b") {
    return Note.transpose(root, "1d");
  }
  return root;
}

function splitSlash(symbol: string): { chord: string; bass: string | null } {
  const normalized = normalizeSlashAlias(symbol);
  const slashIndex = normalized.indexOf("/");
  if (slashIndex === -1) {
    return { chord: normalized, bass: null };
  }

  return {
    chord: normalized.slice(0, slashIndex),
    bass: normalized.slice(slashIndex + 1)
  };
}

function isDegreeToken(token: string): boolean {
  return DEGREE_TOKEN_REGEX.test(token);
}

function isRichChordToken(token: string): boolean {
  return /(?:maj|min|sus|dim|aug|add|alt|dom|no|omit|m7|M7|7|9|11|13|6|o|ø|\+|°|\^|Δ|\/)/u.test(token);
}

function normalizeChordToken(token: string): string {
  return token
    .trim()
    .replace(/6\/9/gu, "69")
    .replace(/Maj/gu, "maj")
    .replace(/Δ/gu, "maj")
    .replace(/\^/gu, "maj")
    .replace(/−/gu, "m")
    .replace(/°/gu, "dim")
    .replace(/ø7?/gu, "m7b5")
    .replace(/h7?\b/gu, "m7b5")
    .replace(/omit/giu, "no")
    .replace(/(^|[^n])o(?=\d|$)/gu, "$1dim")
    .replace(/\(([^)]{1,16})\)/gu, "$1");
}

function normalizeQualitySuffix(suffix: string): string {
  return suffix
    .replace(/6\/9/gu, "69")
    .replace(/Maj/gu, "maj")
    .replace(/Δ/gu, "maj")
    .replace(/\^/gu, "maj")
    .replace(/−/gu, "m")
    .replace(/^-/u, "m")
    .replace(/°/gu, "dim")
    .replace(/^ø7?/u, "m7b5")
    .replace(/^h7?\b/u, "m7b5")
    .replace(/omit/giu, "no")
    .replace(/^o(?=\d|$)/u, "dim")
    .replace(/\(([^)]{1,16})\)/gu, "$1");
}

function normalizeSlashAlias(symbol: string): string {
  return symbol.replace(/6\/9/u, "69");
}
