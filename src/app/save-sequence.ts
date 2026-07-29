/**
 * Tracks issue order for one field's overlapping autosave requests, so a
 * response can be judged stale by when it was *issued* rather than when it
 * *resolves*. Two saves for the same field can resolve out of order — type
 * "Jo" (a slow request goes out), then type on to "John" (a fast request
 * goes out after it and lands first) — so arrival order alone can't tell a
 * current result from a stale one: only issue order can. Kept as a small,
 * framework-free class so the ordering decision is testable without a DOM.
 */
export class SaveSequence {
  private latest = 0

  /** Call when a new save is about to be issued. Returns its sequence number. */
  issue(): number {
    return ++this.latest
  }

  /**
   * True when `seq` is the most recently issued save for this field — i.e.
   * its result is still the one worth showing, no matter when it resolves.
   * A `seq` from an earlier issue is stale once a later one has been issued,
   * even if the earlier one is the one that just resolved.
   */
  isCurrent(seq: number): boolean {
    return seq === this.latest
  }
}
