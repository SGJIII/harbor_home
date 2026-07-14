import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "../netlify/functions/lib/importer.mts";

describe("property importer SSRF guard", () => {
  it.each(["127.0.0.1", "10.2.3.4", "172.16.0.1", "172.31.255.255", "192.168.1.4", "169.254.1.2", "::1", "fd00::1", "fe80::1"])("rejects private address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});
