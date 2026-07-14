import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const previewUrl = "https://harborandhome.netlify.app/social-preview.jpg";

describe("social sharing preview", () => {
  it("uses an absolute image URL with complete Open Graph and Twitter metadata", async () => {
    const html = await readFile(resolve("index.html"), "utf8");
    expect(html).toContain(`<meta property="og:image" content="${previewUrl}" />`);
    expect(html).toContain(`<meta property="og:image:width" content="1200" />`);
    expect(html).toContain(`<meta property="og:image:height" content="630" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${previewUrl}" />`);
  });

  it("ships a standard 1200 by 630 JPEG preview", async () => {
    const metadata = await sharp(resolve("public/social-preview.jpg")).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
  });
});
