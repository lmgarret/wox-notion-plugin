/** Single-value cache with a time-to-live, used to avoid refetching recent pages on every keystroke. */
export class TtlCache<T> {
  #value: T | undefined
  #expiresAt = 0

  constructor(
    private readonly ttlMs: number,
    private readonly clock: () => number = Date.now,
  ) {}

  get(): T | undefined {
    return this.clock() < this.#expiresAt ? this.#value : undefined
  }

  set(value: T): void {
    this.#value = value
    this.#expiresAt = this.clock() + this.ttlMs
  }

  clear(): void {
    this.#value = undefined
    this.#expiresAt = 0
  }
}
