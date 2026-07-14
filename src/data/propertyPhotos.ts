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
        src: "https://photos.zillowstatic.com/fp/7698f0175e29640a6d77b3784c157948-cc_ft_960.jpg",
        alt: "Front exterior of the Rockaway House",
      },
      {
        src: "https://photos.zillowstatic.com/fp/edb929a1f1a628ed12a41a40b5e79a11-cc_ft_576.jpg",
        alt: "Bright living and dining room at the Rockaway House",
      },
      {
        src: "https://photos.zillowstatic.com/fp/ba68e5d4ef1ae5f358784d0942eb3dee-cc_ft_576.jpg",
        alt: "White kitchen and breakfast table at the Rockaway House",
      },
      {
        src: "https://photos.zillowstatic.com/fp/c0dbdc93b149913d8cbb9e53b3a7e551-cc_ft_576.jpg",
        alt: "Dining area and fireplace at the Rockaway House",
      },
    ],
  },
  "second-getaway": {
    sourceName: "Airbnb",
    sourceUrl: "https://www.airbnb.com/rooms/54020123",
    photos: [
      {
        src: "https://a0.muscache.com/im/pictures/miso/Hosting-54020123/original/3758ad54-4e44-4e6e-9920-52e691193dc1.jpeg?im_w=960",
        alt: "Infinity pool and lounge chairs at Luna in Playa Pelada",
      },
      {
        src: "https://a0.muscache.com/im/pictures/miso/Hosting-54020123/original/89ba6fb5-b752-49d0-beac-731d875620b4.jpeg?im_w=960",
        alt: "Open kitchen and living room at Luna",
      },
      {
        src: "https://a0.muscache.com/im/pictures/miso/Hosting-54020123/original/c7d23202-d676-4a6d-8170-52104636bd1f.jpeg?im_w=960",
        alt: "Queen bed and sitting area in the Luna loft",
      },
      {
        src: "https://a0.muscache.com/im/pictures/miso/Hosting-54020123/original/253b1bb0-b4d5-41d5-82b4-f9b1e87e1c38.jpeg?im_w=960",
        alt: "Lower-level king bedroom at Luna",
      },
    ],
  },
};
