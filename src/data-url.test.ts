import { describe, expect, it } from "vitest";
import { dataUrlToArrayBuffer } from "./data-url";

function bytesFromDataUrl(dataUrl: string): number[] {
  return Array.from(new Uint8Array(dataUrlToArrayBuffer(dataUrl)));
}

describe("dataUrlToArrayBuffer", () => {
  it("decodes bundled base64 data URLs", () => {
    expect(bytesFromDataUrl("data:audio/mpeg;base64,AAECA/8=")).toEqual([0, 1, 2, 3, 255]);
  });

  it("decodes percent-encoded data URLs", () => {
    expect(bytesFromDataUrl("data:text/plain,ABC%20%21")).toEqual([65, 66, 67, 32, 33]);
  });

  it("rejects non-data URLs", () => {
    expect(() => dataUrlToArrayBuffer("https://example.com/sample.mp3")).toThrow("Expected data URL.");
  });
});
