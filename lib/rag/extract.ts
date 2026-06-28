import { extractText, getDocumentProxy } from "unpdf";

// Bytes → plain text. Shared by ingest (disk files) and the cron change-detector
// (fetched URLs) so BOTH hash identical extraction output — a re-exported but
// semantically-identical PDF must hash the same, or the detector cries wolf.
export async function bytesToText(
  bytes: Uint8Array,
  isPdf: boolean,
): Promise<string> {
  if (isPdf) {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  return new TextDecoder().decode(bytes);
}
