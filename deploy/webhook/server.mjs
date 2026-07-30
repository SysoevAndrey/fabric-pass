import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { execFile } from 'node:child_process'

const SECRET = process.env.DEPLOY_WEBHOOK_SECRET
if (!SECRET) throw new Error('DEPLOY_WEBHOOK_SECRET is not set')

// `timingSafeEqual` throws on a length mismatch rather than returning false,
// so the length check has to come first — that leaks only the secret's
// length, never its content, which is the part that actually matters.
function safeEqual(expected, provided) {
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf)
}

const COMPOSE_ARGS = ['compose', '-f', '/deploy/docker-compose.yml', '--project-directory', '/deploy']

function redeploy() {
  execFile('docker', [...COMPOSE_ARGS, 'pull', 'app'], (pullError, _stdout, pullStderr) => {
    if (pullError) return console.error('pull failed:', pullStderr)
    execFile('docker', [...COMPOSE_ARGS, 'up', '-d', 'app'], (upError, upStdout, upStderr) => {
      if (upError) console.error('up failed:', upStderr)
      else console.log('deployed:', upStdout.trim())
    })
  })
}

const server = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy-hook') {
    res.writeHead(404).end()
    return
  }

  const provided = (req.headers.authorization ?? '').replace(/^Bearer /, '')
  if (!safeEqual(SECRET, provided)) {
    res.writeHead(401).end('unauthorized')
    return
  }

  res.writeHead(202).end('deploying')
  redeploy()
})

server.listen(9000, () => console.log('deploy webhook listening on :9000'))
