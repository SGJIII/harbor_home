import { describe, expect, it } from "vitest";
import { demoState } from "../src/data/demo";

describe("Rockaway room configuration", () => {
  const property = demoState.properties.find((item) => item.id === "rockaway");
  const rooms = demoState.rooms.filter((room) => room.propertyId === "rockaway");

  it("keeps the downstairs office out of the booking inventory", () => {
    expect(property?.roomIds).toEqual(["adu", "second-spare", "living-couch"]);
    expect(rooms.some((room) => room.id === "downstairs")).toBe(false);
  });

  it("uses the upstairs queen as the ADU's only fallback", () => {
    const adu = rooms.find((room) => room.id === "adu");
    const upstairs = rooms.find((room) => room.id === "second-spare");
    expect(adu?.fallbackIds).toEqual(["second-spare"]);
    expect(upstairs?.name).toBe("Upstairs queen room");
    expect(upstairs?.bed).toBe("Queen bed");
  });

  it("does not advertise an ADU pullout couch or guest count", () => {
    const adu = rooms.find((room) => room.id === "adu");
    expect(`${adu?.description} ${adu?.bed} ${adu?.amenities.join(" ")}`.toLowerCase()).not.toContain("pullout");
    expect(adu?.amenities.join(" ").toLowerCase()).not.toContain("sleeps");
  });
});
