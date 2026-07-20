import { describe, expect, it } from "vitest"
import { extractNotionId, normalizeNotionId, toDeepLink } from "../src/lib/links.js"

const HEX = "2af325e68f0c4290a06fbaa4e40b4c5d"
const DASHED = "2af325e6-8f0c-4290-a06f-baa4e40b4c5d"

describe("normalizeNotionId", () => {
  it("adds dashes to a raw hex id", () => {
    expect(normalizeNotionId(HEX)).toBe(DASHED)
  })

  it("keeps an already-dashed id stable", () => {
    expect(normalizeNotionId(DASHED)).toBe(DASHED)
  })

  it("lowercases", () => {
    expect(normalizeNotionId(HEX.toUpperCase())).toBe(DASHED)
  })
})

describe("extractNotionId", () => {
  it("accepts a bare hex id", () => {
    expect(extractNotionId(HEX)).toBe(DASHED)
  })

  it("accepts a dashed id", () => {
    expect(extractNotionId(DASHED)).toBe(DASHED)
  })

  it("extracts the id from a database URL and ignores the view id in the query string", () => {
    const url = `https://www.notion.so/myworkspace/My-Tasks-${HEX}?v=ffffffffffffffffffffffffffffffff`
    expect(extractNotionId(url)).toBe(DASHED)
  })

  it("extracts the last id in the path", () => {
    const url = `https://www.notion.so/${"1".repeat(32)}/child-${HEX}`
    expect(extractNotionId(url)).toBe(DASHED)
  })

  it("returns null for garbage", () => {
    expect(extractNotionId("definitely not an id")).toBeNull()
  })

  it("returns null for empty input", () => {
    expect(extractNotionId("   ")).toBeNull()
  })
})

describe("toDeepLink", () => {
  it("swaps https for the notion protocol", () => {
    expect(toDeepLink(`https://www.notion.so/Page-${HEX}`)).toBe(`notion://www.notion.so/Page-${HEX}`)
  })
})
