const UNITS: [label: string, seconds: number][] = [
  ["y", 365 * 24 * 3600],
  ["mo", 30 * 24 * 3600],
  ["w", 7 * 24 * 3600],
  ["d", 24 * 3600],
  ["h", 3600],
  ["m", 60],
]

/** Renders an ISO timestamp as a compact relative time, e.g. "3h ago". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) {
    return ""
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000))
  for (const [label, seconds] of UNITS) {
    if (elapsedSeconds >= seconds) {
      return `${Math.floor(elapsedSeconds / seconds)}${label} ago`
    }
  }
  return "just now"
}
