import type { NextConfig } from 'next'

const config: NextConfig = {
  // `.dev.ts` route files exist only in development: in a production build
  // the extension isn't in this list, so such a file is not a route module at
  // all — the route is absent from the manifest, not merely compiled down to
  // a stub. Currently carries only /dev-login (IDEA-031).
  pageExtensions: process.env.NODE_ENV === 'development' ? ['ts', 'tsx', 'dev.ts'] : ['ts', 'tsx'],
}

export default config
