export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex === -1) {
    throw new Error("Expected data URL.");
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const encodedData = dataUrl.slice(commaIndex + 1);
  const isBase64 = metadata
    .split(";")
    .some((part) => part.toLowerCase() === "base64");
  const binary = isBase64 ? atob(encodedData) : decodeURIComponent(encodedData);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return buffer;
}
