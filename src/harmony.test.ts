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
    expect(tokenizeProgression("IIm7 IΔ7 ♭VIIΔ7 V")).toEqual([
      "IIm7",
      "IΔ7",
      "♭VIIΔ7",
      "V"
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
    expect(parseChordToken("C7(♭9)", settings)?.symbol).toBe("C7b9");
    expect(parseChordToken("Cmaj7(♯11)", settings)?.symbol).toBe("Cmaj7#11");
    expect(parseChordToken("C(♯5)", settings)?.notes).toEqual(["C4", "E4", "G#4"]);
    expect(parseChordToken("C7(♯5)", settings)?.notes).toEqual(["C4", "E4", "G#4", "Bb4"]);
    expect(parseChordToken("C(♭5)", settings)?.notes).toEqual(["C4", "E4", "Gb4"]);
    expect(parseChordToken("Bm7(♭5)", settings)?.symbol).toBe("Bm7b5");
    expect(parseChordToken("Bmin7(♭5)", settings)?.symbol).toBe("Bm7b5");
    expect(parseChordToken("Bdim7", settings)?.notes).toEqual(["B4", "D5", "F5", "Ab5"]);
    expect(parseChordToken("B°7", settings)?.symbol).toBe("Bdim7");
    expect(parseChordToken("Bo7", settings)?.symbol).toBe("Bdim7");
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
    expect(parseProgression("IIm7 IΔ7 ♭VIIΔ7 V", settings).map((chord) => chord.symbol)).toEqual([
      "Dm7",
      "Cmaj7",
      "Bbmaj7",
      "G"
    ]);
    expect(parseProgression("IVΔ7 IVmΔ7 IIIm7 VIm7", settings).map((chord) => chord.symbol)).toEqual([
      "Fmaj7",
      "FmMaj7",
      "Em7",
      "Am7"
    ]);
    expect(parseProgression("IV6 V6", settings).map((chord) => chord.symbol)).toEqual([
      "F6",
      "G6"
    ]);
    expect(parseProgression("bVII/I V/I", settings).map((chord) => chord.symbol)).toEqual([
      "Bb/C",
      "G/C"
    ]);
    expect(parseProgression("I I(♯5) I(♭5) I", settings).map((chord) => chord.notes)).toEqual([
      ["C4", "E4", "G4"],
      ["C4", "E4", "G#4"],
      ["C4", "E4", "Gb4"],
      ["C4", "E4", "G4"]
    ]);
    expect(parseProgression("I(♯5) V7(♯5) I", settings).map((chord) => chord.symbol)).toEqual([
      "Caug",
      "G7#5",
      "C"
    ]);
    expect(parseProgression("VIIm(♭5) III7 VIm", settings).map((chord) => chord.symbol)).toEqual([
      "Bdim",
      "E7",
      "Am"
    ]);
    expect(parseProgression("VIIm7(♭5) VIImin7(♭5)", settings).map((chord) => chord.symbol)).toEqual([
      "Bm7b5",
      "Bm7b5"
    ]);
    expect(parseProgression("VIIdim7 VII°7 VIIo7", settings).map((chord) => chord.symbol)).toEqual([
      "Bdim7",
      "Bdim7",
      "Bdim7"
    ]);
    expect(parseProgression("#IVø7 bVII7 ♯IVø7 ♭VII7", settings).map((chord) => chord.symbol)).toEqual([
      "F#m7b5",
      "Bb7",
      "F#m7b5",
      "Bb7"
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
    expect(findProgressions("桥段: IIm7 IΔ7 ♭VIIΔ7 V", settings).map((match) => match.text)).toEqual([
      "IIm7 IΔ7 ♭VIIΔ7 V"
    ]);
    expect(findProgressions("桥段: IVΔ7 IVmΔ7 IIIm7 VIm7", settings).map((match) => match.text)).toEqual([
      "IVΔ7 IVmΔ7 IIIm7 VIm7"
    ]);
    expect(findProgressions("桥段: IV6 V6 bVII/I V/I", settings).map((match) => match.text)).toEqual([
      "IV6 V6 bVII/I V/I"
    ]);
    expect(findProgressions("桥段: I I(♯5) I(♭5) I", settings).map((match) => match.text)).toEqual([
      "I I(♯5) I(♭5) I"
    ]);
    expect(findProgressions("桥段: I(♯5) V7(♯5) I", settings).map((match) => match.text)).toEqual([
      "I(♯5) V7(♯5) I"
    ]);
    expect(findProgressions("桥段: VIIm(♭5) III7 VIm", settings).map((match) => match.text)).toEqual([
      "VIIm(♭5) III7 VIm"
    ]);
    expect(findProgressions("桥段: VIIm7(♭5) III7 VIm", settings).map((match) => match.text)).toEqual([
      "VIIm7(♭5) III7 VIm"
    ]);
    expect(findProgressions("桥段: VIIdim7 VII°7 VIIo7", settings).map((match) => match.text)).toEqual([
      "VIIdim7 VII°7 VIIo7"
    ]);
    expect(findProgressions("turnaround: #IVø7 bVII7 ♯IVø7 ♭VII7", settings).map((match) => match.text)).toEqual([
      "#IVø7 bVII7 ♯IVø7 ♭VII7"
    ]);
    expect(findProgressions("single Cmaj9 is not a progression", settings)).toEqual([]);
  });
});
