import { timingSafeEqual } from 'node:crypto'

/**
 * `Authorization: Bearer <secret>` against a fixed shared secret — the same
 * check the deploy webhook (deploy/webhook/server.mjs) uses, reimplemented
 * here rather than shared: that file ships as a standalone Docker image with
 * no dependency on this app's source tree, so the two never had a common
 * module to share it from.
 */
export function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  const provided = header.replace(/^Bearer /, '')
  const expected = Buffer.from(secret)
  const providedBuf = Buffer.from(provided)
  return expected.length === providedBuf.length && timingSafeEqual(expected, providedBuf)
}
