/**
 * Runs `fn` over `items` with at most `limit` concurrent executions.
 * Rejections from `fn` propagate; use a try/catch inside `fn` to swallow.
 */
export async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    let next = queue.shift()
    while (next !== undefined) {
      await fn(next)
      next = queue.shift()
    }
  })
  await Promise.all(workers)
}
