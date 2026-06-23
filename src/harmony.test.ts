import { describe, expect, it } from "vitest";
import { findProgressions, notesForChordSymbol, parseChordToken, parseProgression, tokenizeProgression } from "./harmony";

const settings = {
  keyRoot: "C" as const,
  octave: 4
};

describe("harmony parser", () => {
  it("tokenizes hyphen and arrow separated extended progressions", () => {
    expect(tokenizeProgression("Dm9-G13-Cmaj9")).toEqual(["Dm9", "G13", "Cmaj9"]);
    expect(tokenizeProgression("Cmaj9 -> F#ø7 -> B7b9 -> Em9")).toEqual([
      "Cmaj9",
      "F#ø7",
      "B7b9",
      "Em9"
    ]);
  });

  it("parses ninth, eleventh, thirteenth, and altered chords", () => {
    const progression = parseProgression("Dm9-G13-Cmaj9", settings);
    expect(progression.map((chord) => chord.symbol)).toEqual(["Dm9", "G13", "Cmaj9"]);
    expect(progression.map((chord) => chord.notes.length)).toEqual([5, 6, 5]);

    expect(parseChordToken("C11", settings)?.notes.length).toBeGreaterThanOrEqual(5);
    expect(parseChordToken("C13b9", settings)?.symbol).toBe("C13b9");
    expect(parseChordToken("C7alt", settings)?.notes.length).toBeGreaterThanOrEqual(4);
  });

  it("normalizes common jazz spellings before Tonal parsing", () => {
    expect(parseChordToken("C7(b9)", settings)?.symbol).toBe("C7b9");
    expect(parseChordToken("Cmaj7(#11)", settings)?.symbol).toBe("Cmaj7#11");
    expect(parseChordToken("C7omit5", settings)?.symbol).toBe("C7no5");
    expect(parseChordToken("C6/9", settings)?.symbol).toBe("C69");
  });

  it("handles suspended, added-note, half-diminished, and slash chords", () => {
    expect(parseChordToken("C9sus4", settings)?.notes).toEqual(["C4", "F4", "G4", "Bb4", "D5"]);
    expect(parseChordToken("Cadd9", settings)?.notes).toEqual(["C4", "E4", "G4", "D5"]);
    expect(parseChordToken("F#ø7", settings)?.symbol).toBe("F#m7b5");
    expect(notesForChordSymbol("C/E", 4)[0]).toBe("E3");
  });

  it("resolves numeric and roman degree extensions in the configured key", () => {
    expect(parseProgression("V->IV->I", settings).map((chord) => chord.symbol)).toEqual([
      "G",
      "F",
      "C"
    ]);
    expect(parseProgression("1-1-4-1-5-4-1", settings).map((chord) => chord.symbol)).toEqual([
      "C",
      "C",
      "F",
      "C",
      "G",
      "F",
      "C"
    ]);
    expect(parseProgression("2m9-57-1maj9", settings).map((chord) => chord.symbol)).toEqual([
      "Dm9",
      "G7",
      "Cmaj9"
    ]);
    expect(parseProgression("IIm9-V13-Imaj9", settings).map((chord) => chord.symbol)).toEqual([
      "Dm9",
      "G13",
      "Cmaj9"
    ]);
    expect(parseProgression("bVIImaj9-IVmaj9-Imaj9", settings).map((chord) => chord.symbol)).toEqual([
      "Bbmaj9",
      "Fmaj9",
      "Cmaj9"
    ]);
  });

  it("finds extended progressions in prose without matching single chords", () => {
    expect(findProgressions("listen to Dm9-G13-Cmaj9 here", settings).map((match) => match.text)).toEqual([
      "Dm9-G13-Cmaj9"
    ]);
    expect(findProgressions("chorus: V->IV->I", settings).map((match) => match.text)).toEqual([
      "V->IV->I"
    ]);
    expect(findProgressions("riff: 1-1-4-1-5-4-1", settings).map((match) => match.text)).toEqual([
      "1-1-4-1-5-4-1"
    ]);
    expect(findProgressions("这里是V->IV->I", settings).map((match) => match.text)).toEqual([
      "V->IV->I"
    ]);
    expect(findProgressions("这里是1-1-4-1-5-4-1", settings).map((match) => match.text)).toEqual([
      "1-1-4-1-5-4-1"
    ]);
    expect(findProgressions("`V->IV->I`", settings).map((match) => match.text)).toEqual([
      "V->IV->I"
    ]);
    expect(findProgressions("`1-1-4-1-5-4-1`", settings).map((match) => match.text)).toEqual([
      "1-1-4-1-5-4-1"
    ]);
    expect(findProgressions("single Cmaj9 is not a progression", settings)).toEqual([]);
  });
});
