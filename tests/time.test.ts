import { describe, expect, it } from "vitest"
import { relativeTime } from "../src/lib/time.js"

const NOW = new Date("2026-07-20T12:00:00Z")

describe("relativeTime", () => {
  it.each([
    ["2026-07-20T11:59:30Z", "just now"],
    ["2026-07-20T11:55:00Z", "5m ago"],
    ["2026-07-20T09:00:00Z", "3h ago"],
    ["2026-07-18T12:00:00Z", "2d ago"],
    ["2026-07-01T12:00:00Z", "2w ago"],
    ["2026-02-20T12:00:00Z", "5mo ago"],
    ["2024-07-20T12:00:00Z", "2y ago"],
  ])("renders %s as %s", (iso, expected) => {
    expect(relativeTime(iso, NOW)).toBe(expected)
  })

  it("returns an empty string for an invalid timestamp", () => {
    expect(relativeTime("not-a-date", NOW)).toBe("")
  })

  it("clamps future timestamps to just now", () => {
    expect(relativeTime("2026-07-20T13:00:00Z", NOW)).toBe("just now")
  })
})
