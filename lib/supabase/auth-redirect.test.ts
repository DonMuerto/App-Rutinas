import { describe, expect, it } from "vitest";

import { safeAuthenticatedDestination } from "./auth-redirect";

describe("safeAuthenticatedDestination", () => {
  it("allows only application private routes", () => {
    expect(safeAuthenticatedDestination("/hoy?date=2026-09-13")).toBe(
      "/hoy?date=2026-09-13",
    );
    expect(
      safeAuthenticatedDestination(
        "/rutinas/22222222-2222-4222-8222-222222222222#block",
      ),
    ).toBe("/rutinas/22222222-2222-4222-8222-222222222222#block");
  });

  it.each([
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/login",
    "javascript:alert(1)",
    "\u0000/hoy",
    null,
  ])("rejects unsafe destination %j", (destination) => {
    expect(safeAuthenticatedDestination(destination)).toBe("/hoy");
  });
});
