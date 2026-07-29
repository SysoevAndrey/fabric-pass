/**
 * Serializes one field's autosave writes so they resolve in the order they
 * were typed, never overlapped in flight. Type "Jo" (a slow request goes
 * out), then type on to "John" (a request for the newer value would
 * otherwise go out immediately and could land first, leaving the database
 * holding "Jo") — only one save is ever in flight for a field at a time. A
 * newer value that arrives while one is in flight waits as the pending
 * value, superseding whatever was pending before, and is sent the instant
 * the in-flight one settles. The database always ends up holding the last
 * value typed, never an earlier one arriving out of order. Kept as a small,
 * framework-free class so the ordering decision is testable without a DOM
 * or a network mock.
 */
export class SaveQueue {
  private confirmed: string
  private inFlight = false
  private pending: string | undefined

  constructor(initialValue: string) {
    this.confirmed = initialValue
  }

  /** The last value known to have actually persisted. */
  get confirmedValue(): string {
    return this.confirmed
  }

  /**
   * Call when a value is ready to be saved (debounce fired, blur, or an
   * explicit commit). Returns `true` when the caller should send it now.
   * Returns `false` either because `value` already matches the persisted
   * value (nothing to do), or because another save for this field is still
   * in flight — in the latter case `value` becomes the one sent once that
   * save settles, superseding whatever was pending before it.
   */
  request(value: string): boolean {
    if (this.inFlight) {
      this.pending = value
      return false
    }
    if (value === this.confirmed) return false
    this.inFlight = true
    return true
  }

  /**
   * Call when the in-flight save for `value` settles. `ok` says whether it
   * actually persisted, which is what a later `request` call compares
   * against. Returns the next value to send when a newer one arrived while
   * this one was in flight and still differs from what's now confirmed —
   * the caller must send it immediately, before treating this save as done,
   * to keep serializing. Returns `undefined` once there's nothing left to
   * chase, which is the only point at which the caller may treat the field
   * as settled.
   */
  settle(value: string, ok: boolean): string | undefined {
    this.inFlight = false
    if (ok) this.confirmed = value
    const next = this.pending
    this.pending = undefined
    if (next === undefined || next === this.confirmed) return undefined
    this.inFlight = true
    return next
  }
}
