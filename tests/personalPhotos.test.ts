import { describe, expect, it } from "vitest";
import { personalPhotos } from "../src/data/personalPhotos";

describe("personal landing-page photos", () => {
  it("uses a restrained, local three-photo set", () => {
    const photos = Object.values(personalPhotos);
    expect(photos).toHaveLength(3);
    expect(new Set(photos.map((photo) => photo.src)).size).toBe(3);
    expect(photos.every((photo) => photo.src.startsWith("/images/personal/") && photo.src.endsWith(".webp"))).toBe(true);
    expect(photos.every((photo) => photo.alt.length > 15)).toBe(true);
  });
});
