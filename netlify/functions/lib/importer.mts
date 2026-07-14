import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";

const maxBytes = 1_500_000;
const maxRedirects = 3;

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export async function assertPublicUrl(input: string): Promise<URL> {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP or HTTPS URLs are supported.");
  if (url.port && !['80', '443'].includes(url.port)) throw new Error("Custom ports are not supported.");
  if (url.hostname === "localhost" || isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error("Private-network URLs are not allowed.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("The listing must resolve only to public addresses.");
  return url;
}

async function readLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("The listing response is too large.");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error("The listing response is too large."); }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

async function fetchPublicPage(input: string): Promise<{ html: string; finalUrl: string }> {
  let url = await assertPublicUrl(input);
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "HarborAndHomeImporter/1.0", Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(8_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === maxRedirects) throw new Error("The listing redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("The listing returned an invalid redirect.");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The listing returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("The URL is not a supported listing page.");
    return { html: await readLimited(response), finalUrl: url.toString() };
  }
  throw new Error("The listing could not be imported.");
}

function firstText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstText(value[0]);
  return "";
}

export async function importListing(input: string) {
  const parsed = new URL(input);
  if (parsed.hostname.endsWith("airbnb.com") && parsed.pathname.startsWith("/l/")) {
    return { sourceUrl: input, sourceType: "airbnb", requiresManualReview: true, warning: "This is a private Airbnb trip link, so listing details must be entered manually.", name: "", description: "", imageUrls: [] as string[] };
  }
  const { html, finalUrl } = await fetchPublicPage(input);
  const $ = load(html);
  const graph: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const value = JSON.parse($(element).text()) as unknown;
      if (Array.isArray(value)) graph.push(...value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")));
      else if (value && typeof value === "object") graph.push(value as Record<string, unknown>);
    } catch { /* Ignore malformed metadata and continue with Open Graph. */ }
  });
  const candidate = graph.find((item) => ["Accommodation", "House", "Apartment", "LodgingBusiness", "Product"].includes(firstText(item['@type']))) ?? graph[0] ?? {};
  const og = (property: string) => $(`meta[property="${property}"]`).attr("content")?.trim() ?? "";
  const name = firstText(candidate.name) || og("og:title") || $("title").text().trim();
  const description = firstText(candidate.description) || og("og:description") || $('meta[name="description"]').attr("content")?.trim() || "";
  const images = [firstText(candidate.image), og("og:image")].filter(Boolean);
  return {
    sourceUrl: finalUrl,
    sourceType: finalUrl.includes("zillow.com") ? "zillow" : finalUrl.includes("airbnb.com") ? "airbnb" : "other",
    requiresManualReview: true,
    warning: "Imported metadata is a starting point. Confirm the address, rooms, capacities, and image rights before publishing.",
    name: name.slice(0, 200),
    description: description.slice(0, 2_000),
    imageUrls: [...new Set(images)].slice(0, 8),
  };
}
