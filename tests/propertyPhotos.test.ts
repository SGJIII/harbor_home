import { describe, expect, it } from "vitest";
import { propertyPhotoSets } from "../src/data/propertyPhotos";

describe("listing-hosted property photos", () => {
  it("provides an attributed gallery for both published properties", () => {
    expect(Object.keys(propertyPhotoSets).sort()).toEqual(["rockaway-house", "second-getaway"]);
    for (const photoSet of Object.values(propertyPhotoSets)) {
      expect(photoSet.photos).toHaveLength(4);
      expect(photoSet.sourceUrl).toMatch(/^https:\/\//);
      expect(photoSet.photos.every((photo) => photo.src.startsWith("https://") && photo.alt.length > 10)).toBe(true);
    }
  });

  it("keeps Zillow and Airbnb images on their listing CDNs", () => {
    expect(propertyPhotoSets["rockaway-house"].photos.every((photo) => new URL(photo.src).hostname === "photos.zillowstatic.com")).toBe(true);
    expect(propertyPhotoSets["second-getaway"].photos.every((photo) => new URL(photo.src).hostname === "a0.muscache.com")).toBe(true);
  });
});
