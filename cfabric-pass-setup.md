# Fabric Pass — deployment setup

Deployment target: a single DigitalOcean droplet running the app, Postgres, a
reverse proxy, and a deploy webhook, all as Docker Compose services. Images
are built by GitHub Actions and published to GHCR; the droplet pulls and
redeploys on a signed webhook call rather than being built on. See
[README.md](README.md) for the application itself.

This file is the running record of what's been configured and how, so the
setup can be audited or reproduced. Update it as later steps land.

## Infrastructure summary

| Item | Value |
|---|---|
| Domain | `pass.cfabric.org`, proxied through Cloudflare |
| Droplet name | `fabric-pass` |
| Droplet ID | `588639485` |
| Region | `fra1` |
| Plan | Basic, 1 vCPU / 1GB RAM / 25GB SSD (**$6/mo** — downsized from the originally planned $12/mo 2GB plan; see [Swap](#swap) for how that's offset) |
| OS | Ubuntu 24.04.4 LTS |
| Public IP | `46.101.123.136` |
| SSH key | `~/.ssh/id_ed25519` (`xiboliaren@gmail.com`), reused from an existing key rather than generated fresh |

**Note for the upcoming Caddy/TLS step:** `pass.cfabric.org` resolves to Cloudflare's edge IPs (proxied), not `46.101.123.136` directly. Caddy's automatic HTTPS will need Cloudflare's SSL/TLS mode set to **Full (strict)** — plain **Flexible** mode terminates TLS at Cloudflare and speaks plain HTTP to the origin, which will loop or fail against Caddy's own auto-HTTPS.

## Steps 1–3 — done manually (by the user, via the DO/Cloudflare consoles)

1. Created the droplet in the DigitalOcean console: `fabric-pass`, Ubuntu 24.04, Basic $6/mo (1 vCPU/1GB/25GB), region `fra1`, with the existing `id_ed25519` SSH key attached at creation.
2. Pointed `pass.cfabric.org` at the droplet's IP via Cloudflare DNS (proxied).
3. Verified SSH reachability from the laptop (as `root`, before the hardening below).

I don't have DigitalOcean or Cloudflare account access in this environment (no `doctl`/API token configured), so these three stay manual — everything below this point was run by me over SSH once step 3 confirmed connectivity.

## Step 4 — server base setup (done, automated)

### Swap

The droplet has 961MB of physical RAM — tight for Postgres + Next.js + Caddy + the webhook receiver running concurrently, especially during a container recreation. Added a 2GB swap file as an OOM safety net, and lowered `vm.swappiness` so the kernel prefers RAM and only spills to swap under real pressure:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo "/swapfile none swap sw 0 0" >> /etc/fstab
sysctl -w vm.swappiness=10
echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
```

### Docker

Installed from Docker's official apt repo (not the older Ubuntu-packaged `docker.io`), giving the Compose v2 plugin:

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Result: Docker `29.6.2`, Compose `v5.3.1`.

### `deploy` user

Root login is disabled (below), so all access and all container operations go through this account:

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo,docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
```

- Same SSH key as `root` had (`id_ed25519`) — no new key needed.
- `docker` group membership means Compose commands don't need `sudo` at all.
- `NOPASSWD` sudo is granted anyway, since this is a single-admin personal server and `deploy` has no password to prompt for in the first place.

### Firewall (`ufw`)

Default deny on incoming; only SSH and the two web ports are reachable from the internet. Postgres is never exposed — it's only reachable inside the Compose network:

```bash
apt-get install -y ufw fail2ban
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### `fail2ban`

Installed and enabled with its default `sshd` jail, to blunt SSH brute-force attempts against the now-internet-facing `deploy` account:

```bash
systemctl enable --now fail2ban
```

### SSH hardening

`PasswordAuthentication` was already `no` (DigitalOcean's cloud-init default — key-only from the start). Changed one more setting, only after confirming `deploy` login worked end-to-end (key auth, passwordless `sudo`, `docker ps`) in a separate connection:

```bash
sed -i "s/^PermitRootLogin yes/PermitRootLogin no/" /etc/ssh/sshd_config
systemctl restart ssh
```

Verified afterward: `ssh root@46.101.123.136` now fails with `Permission denied (publickey)`; `ssh deploy@46.101.123.136` still works with full `sudo` and `docker` access.

## Local machine configuration

`~/.ssh/config` on the laptop now has:

```
Host fabric-pass
  HostName 46.101.123.136
  User deploy
  IdentityFile ~/.ssh/id_ed25519
```

`ssh fabric-pass` connects directly as `deploy`. (A separate, pre-existing `Host droplet` entry points at an unrelated droplet, hostname `be-app` — left untouched, not part of this project.)

## Step 5 — repo-side deployment files (done)

Added to the repo, under [deploy/](deploy/):

- **[deploy/docker-compose.yml](deploy/docker-compose.yml)** — four services: `postgres` (18-alpine, tuned per the low-memory settings agreed earlier — `shared_buffers=128MB`, `max_connections=20`, etc.), `app` (pulled from `ghcr.io/constructorfabric/fabric-pass:latest`, `DATABASE_URL` built from `POSTGRES_PASSWORD`), `caddy` (2-alpine, only container publishing host ports — 80/443), `webhook` (custom-built, see below).
  - Postgres 18's image changed its expected layout: the volume mounts at `/var/lib/postgresql` (the parent), not `.../data` — mounting at `.../data` makes the image refuse to start, treating it as leftover data from an older layout.
  - Postgres is deliberately never given a `ports:` entry — it's reachable only over the compose network. Worth remembering if it's ever exposed for debugging: Docker's own iptables rules can bypass `ufw`, so `ufw` alone wouldn't protect it the way it protects the host's other services.
- **[deploy/Caddyfile](deploy/Caddyfile)** — routes `/deploy-hook*` to the webhook service, everything else to `app`, using `handle` blocks (not multiple bare `reverse_proxy` directives) so the routing is unambiguous.
- **[deploy/webhook/](deploy/webhook)** — a small custom Node HTTP server (no framework), not a third-party webhook tool, so its logic is fully readable in one file:
  - Checks `Authorization: Bearer <secret>` with `crypto.timingSafeEqual`, rejects with 401 otherwise.
  - On success, shells out `docker compose pull app && docker compose up -d app` against the *host's* Docker daemon, via the mounted `/var/run/docker.sock` (the classic "Docker-outside-of-Docker" pattern).
  - Built on `alpine:3.20` with the `docker-cli`/`docker-cli-compose` apk packages (not the upstream `docker:*-cli` image) so the `compose` subcommand's availability doesn't depend on unstated bundling behavior between image tags.
  - **This container has host-root-equivalent power** via the socket mount — anyone who can produce a valid `Authorization` header can run arbitrary containers on the droplet. `DEPLOY_WEBHOOK_SECRET` is the entire access boundary.
  - File is `server.mjs`, not `server.js` — Alpine's Node defaults new `.js` files to CommonJS, and the server uses `import` syntax.
  - Runs `docker compose` with `--project-directory /deploy`, which auto-loads `/deploy/.env` (mounted read-only) — this is what keeps `COMPOSE_PROJECT_NAME=fabric-pass` consistent between the webhook's nested compose invocation and the droplet's own `/opt/fabric-pass`, so they operate on the *same* project instead of the webhook accidentally spinning up a second stack.
- **[.github/workflows/deploy.yml](.github/workflows/deploy.yml)** — on push to `main` (or manual dispatch): builds the root [Dockerfile](Dockerfile), pushes `latest` + the commit SHA to GHCR using the workflow's own `GITHUB_TOKEN` (no extra registry credential needed), then calls `https://pass.cfabric.org/deploy-hook` with the shared secret.

## Step 5 — droplet-side deployment (done, partially)

- Generated `POSTGRES_PASSWORD` (`openssl rand -hex 24` — hex, so it's safe inside the `DATABASE_URL` connection string with no escaping needed), `SESSION_PASSWORD` (`openssl rand -base64 32`), and `DEPLOY_WEBHOOK_SECRET` (`openssl rand -hex 32`). None of these were echoed to chat.
- `deploy/` was copied to `/opt/fabric-pass` on the droplet (`rsync`, not a git clone — these files change rarely, so a fresh sync is enough; no git access needed on the droplet at all).
- Wrote the real `/opt/fabric-pass/.env` (`chmod 600`, owned by `deploy`) with `COMPOSE_PROJECT_NAME`, `POSTGRES_PASSWORD`, `DEPLOY_WEBHOOK_SECRET` (matching the GitHub Actions secret of the same name, set via `gh secret set`), `APP_URL`, `SESSION_PASSWORD`. **`GITHUB_CLIENT_ID`/`SECRET`, `DISCORD_CLIENT_ID`/`SECRET`, `TELEGRAM_CLIENT_ID`/`SECRET` are still blank** — pending the OAuth registrations below.
- Brought up `postgres`, `webhook`, and `caddy` only (`docker compose up -d --build --no-deps postgres webhook caddy` — the `--no-deps` matters, since `caddy`'s `depends_on: [app, webhook]` would otherwise pull `app`'s image too, which doesn't exist in GHCR yet and would fail the whole command). `app` stays down until the OAuth values exist — `env.ts` fails fast on any missing/empty variable, so starting it now would just crash-loop.
- Verified live, through the real Cloudflare-proxied `https://pass.cfabric.org`:
  - Caddy already obtained a valid Let's Encrypt certificate and is serving HTTPS (confirms Cloudflare's SSL/TLS mode is already compatible — see the note under [Infrastructure summary](#infrastructure-summary)).
  - `POST /deploy-hook` with a wrong secret → `401`.
  - `POST /deploy-hook` with the correct secret → `202`, and the webhook's own logs show it correctly attempted `docker compose pull app` (which fails only because no image has been pushed to GHCR yet — expected at this point).

## Step 6 — OAuth registrations and first live deploy (done)

- Created a **new, dedicated GitHub OAuth App** (`Fabric Pass`) under the `constructorfabric` org, rather than reusing the org's existing app — GitHub OAuth Apps support exactly one callback URL each, and the existing app is used elsewhere.
- Created a dedicated **Discord application** and a dedicated **Telegram bot** (via BotFather's Web Login settings), each with its callback pointed at `https://pass.cfabric.org/auth/<provider>/callback`.
- All six credential values were written into `/opt/fabric-pass/.env` by the user directly over SSH (a `read -p`/`read -sp` one-liner), so the values never passed through this chat.
- Pushed the branch to `main` — the Actions workflow ran successfully, built and published `ghcr.io/constructorfabric/fabric-pass:latest` and `:<sha>`, and called the deploy webhook automatically.
- The GHCR package defaulted to **private**; there's no REST/CLI endpoint that can change a container package's visibility (a long-standing GitHub API gap) — `gh api -X PATCH .../packages/container/fabric-pass` 404s. Flipped to public manually via **Package → Settings → Danger Zone → Change visibility** in the GitHub UI. `gh auth refresh -s read:packages -s write:packages` was used separately to let `gh api` at least *read* package metadata for verification.
- **Bug hit, and "fixed" — misdiagnosed at the time:** the first `up -d app` produced a container with empty `DISCORD_CLIENT_SECRET`/`TELEGRAM_CLIENT_ID`/`TELEGRAM_CLIENT_SECRET`, 500ing on every request, even though `.env` on disk was already correct. `docker compose up -d --force-recreate app` fixed the symptom. At the time this was written off as a timing race between the user's manual fill-in and the webhook's auto-trigger. **That explanation was wrong — see Step 7, which hit the same bug again with no `.env` edits anywhere near the trigger, and found the real cause.**
- Verified live: `https://pass.cfabric.org/` → `200`, serving the real sign-in page; `docker compose logs app` shows all three migrations already applied and `next start` ready.

## Step 7 — the real bug behind Step 6's outage, found and fixed

A later push (name/email capture from providers, trust-copy rewrite, field styling) went through the same pipeline — build, publish, webhook — and produced the *exact same symptom*: `app` 500ing, `GITHUB_CLIENT_SECRET`/`DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`/`TELEGRAM_CLIENT_ID`/`TELEGRAM_CLIENT_SECRET` all empty in the new container, despite `/opt/fabric-pass/.env` on disk being fully correct at the time. No one had touched `.env` anywhere near this deploy, which ruled out Step 6's "timing race" explanation outright.

**Root cause:** `docker-compose.yml` bind-mounted `.env` and `docker-compose.yml` into the `webhook` container as individual *files* (`./.env:/deploy/.env:ro`). A single-file bind mount pins the container to the specific inode that existed at mount time. `sed -i` — used for the original OAuth-credential fill-in back in Step 6 — doesn't edit a file's content in place; like most editors and like `rsync`, it writes a new file and renames it over the old path. The rename swaps the directory entry to a new inode, but the webhook container's mount kept referencing the old one — so from inside that container, `/deploy/.env` had been silently frozen at whatever it looked like the moment the webhook container was created, no matter how many times the real file changed afterward. `docker inspect fabric-pass-webhook-1 --format '{{range .Config.Env}}...'` showed the webhook's own process env was clean (no shadowing there); `docker exec fabric-pass-webhook-1 cat /deploy/.env` was the check that actually caught it — it showed the stale, credential-blank version side by side with a simultaneously-correct `cat /opt/fabric-pass/.env` on the host.

This explains why Step 6's `--force-recreate app` **appeared** to fix things: running that directly on the host reads `.env` fresh from the host filesystem, sidestepping the webhook container's stale mount entirely — it never touched the actual defect, which stayed dormant in the still-running `webhook` container until the next image pull triggered a fresh, silently-broken `app` container from the exact same stale source.

**Fix:** mount the whole `/opt/fabric-pass` directory read-only (`.:/deploy:ro`) into both `webhook` and `caddy`, instead of mounting `.env`/`docker-compose.yml`/`Caddyfile` individually. A directory mount doesn't pin inodes the way a file mount does — a rename-replace inside a mounted directory is reflected immediately. Caddy's command now points explicitly at `/deploy/Caddyfile` (`caddy run --config /deploy/Caddyfile --adapter caddyfile`) since it no longer sits at the image's default `/etc/caddy/Caddyfile`.

Verified: recreated both `webhook` and `caddy` (`docker compose up -d --force-recreate caddy webhook`), confirmed `docker exec fabric-pass-webhook-1 cat /deploy/.env` now matches the host exactly, then triggered a *real* webhook call end-to-end — the resulting `app` container came up with every credential correctly populated, no manual host-side intervention this time. `https://pass.cfabric.org/` → `200` throughout.

## Current state

All four services (`postgres`, `app`, `caddy`, `webhook`) are up and healthy, and the redeploy path that broke twice is now verified working through its actual trigger (a real webhook call), not just a manual workaround. The full pipeline — push to `main` → GitHub Actions builds & publishes to GHCR → webhook pulls & redeploys `app` — is live. The site is reachable at `https://pass.cfabric.org`.

## Not yet done

- Nightly `pg_dump` backup timer — the droplet has no backups yet, only Postgres's own on-disk state
- Actually signing in through all three providers hasn't been exercised yet (only that the page loads) — worth a real end-to-end sign-in test
