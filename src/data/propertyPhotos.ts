export interface PropertyPhoto {
  src: string;
  alt: string;
}

export interface PropertyPhotoSet {
  sourceName: "Zillow" | "Airbnb";
  sourceUrl: string;
  photos: PropertyPhoto[];
}

export const propertyPhotoSets: Record<string, PropertyPhotoSet> = {
  "rockaway-house": {
    sourceName: "Zillow",
    sourceUrl: "https://www.zillow.com/homedetails/6319-Ocean-Ave-S-Far-Rockaway-NY-11692/122027290_zpid/",
    photos: [
      {
        src: "/images/properties/rockaway/exterior.jpg",
        alt: "Front exterior of the Rockaway House",
      },
      {
        src: "/images/properties/rockaway/living-dining.jpg",
        alt: "Bright living and dining room at the Rockaway House",
      },
      {
        src: "/images/properties/rockaway/kitchen.jpg",
        alt: "White kitchen and breakfast table at the Rockaway House",
      },
      {
        src: "/images/properties/rockaway/dining-fireplace.jpg",
        alt: "Dining area and fireplace at the Rockaway House",
      },
    ],
  },
  "second-getaway": {
    sourceName: "Airbnb",
    sourceUrl: "https://www.airbnb.com/rooms/54020123",
    photos: [
      {
        src: "/images/properties/luna/pool.jpg",
        alt: "Infinity pool and lounge chairs at Luna in Playa Pelada",
      },
      {
        src: "/images/properties/luna/living-kitchen.jpg",
        alt: "Open kitchen and living room at Luna",
      },
      {
        src: "/images/properties/luna/queen-loft.jpg",
        alt: "Queen bed and sitting area in the Luna loft",
      },
      {
        src: "/images/properties/luna/lower-king.jpg",
        alt: "Lower-level king bedroom at Luna",
      },
    ],
  },
};
