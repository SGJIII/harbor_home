import { describe, expect, it } from "vitest";
import { propertyPhotoSets } from "../src/data/propertyPhotos";

describe("property photos", () => {
  it("provides an attributed gallery for both published properties", () => {
    expect(Object.keys(propertyPhotoSets).sort()).toEqual(["rockaway-house", "second-getaway"]);
    for (const photoSet of Object.values(propertyPhotoSets)) {
      expect(photoSet.photos).toHaveLength(4);
      expect(photoSet.sourceUrl).toMatch(/^https:\/\//);
      expect(photoSet.photos.every((photo) => photo.src.startsWith("/images/properties/") && photo.src.endsWith(".jpg") && photo.alt.length > 10)).toBe(true);
    }
  });

  it("serves local image copies while retaining the original listing sources", () => {
    expect(propertyPhotoSets["rockaway-house"].sourceUrl).toContain("zillow.com");
    expect(propertyPhotoSets["second-getaway"].sourceUrl).toContain("airbnb.com");
    expect(new Set(Object.values(propertyPhotoSets).flatMap((photoSet) => photoSet.photos.map((photo) => photo.src))).size).toBe(8);
  });
});
