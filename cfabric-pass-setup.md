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

## Step 8 — cf-internal contributors registry sync (done, verified live both directions)

Full design and rationale live in [README.md's "Contributors registry sync"](README.md#contributors-registry-sync) — this is the deployment side.

- `migrations/005_contributor_status.sql`, the two `/internal/contributors/*` endpoints, and `.github/workflows/export-contributors.yml` — implemented, tested (119/119 passing, including a live curl smoke test against a throwaway local Postgres before any of this touched production), committed on `fabric-pass`.
- `constructorfabric/cf-internal` got `pass/contributors.yaml` (seeded with `contributors: []` so the export workflow's `git diff` has a tracked baseline from its very first run) and a minimal, credential-free shim workflow (`notify-fabric-pass.yml`) that forwards the file to fabric-pass's sync endpoint on every push.
- Found in passing: `cf-internal` already has an unrelated, much larger `contributors.md` at its root (166 identities, multiple emails/aliases per person, workshop-attendance dates) — a different, pre-existing effort, untouched by this work. `pass/contributors.yaml` is new and doesn't conflict with it.
- **`CF_INTERNAL_PAT`** (fine-grained, scoped to only `cf-internal`, `Contents: Read and write`) — minted by the user via GitHub's web UI (no API exists for creating a fine-grained PAT) and set as a `fabric-pass` repo secret via `gh secret set`, so the raw token never passed through this chat.
- Pushed both repos' pending commits (`fabric-pass` `00c6c41`, `cf-internal` `e3ecd1d`). The `fabric-pass` push rebuilt and redeployed through the existing pipeline — migration 005 applied cleanly on the first try this time, no repeat of Step 7's stale-mount bug.
- **Export direction, verified live:** triggered `export-contributors.yml` manually (`gh workflow run`) rather than waiting for its hourly schedule. It read the real production database — by this point 4 real contributors had already signed in — rendered them as YAML, and pushed to `cf-internal` using `CF_INTERNAL_PAT`. Confirmed via `gh api repos/constructorfabric/cf-internal/contents/pass/contributors.yaml` that the file matched what the export endpoint returned, all four at `status: draft`.
- **One expected, harmless failure along the way:** the shim workflow's very first run (triggered by the initial seed-file push, which landed in `cf-internal` moments before the `fabric-pass` deploy finished) hit `curl: (22) ... 404` — the sync endpoint didn't exist on production yet at that exact instant. A one-time sequencing artifact of this specific rollout, not a recurring issue: the next push (the export's own commit, after deploy had finished) succeeded normally.
- **Import direction, verified live:** edited `pass/contributors.yaml` directly — the same action a real admin would take — setting `vzhuman`'s `status` from `draft` to `confirmed`, committed, and pushed. The shim workflow fired and posted to `/internal/contributors/sync` within seconds. Confirmed directly against production Postgres:
  ```
  github_login | status
  claudedigon  | draft
  frontgeeks   | draft
  lobster40    | draft
  vzhuman      | confirmed
  ```
  Exactly the one row touched — the other three untouched drafts confirm the sync only ever writes `status`, never anything else.

Both directions of the sync are now live and confirmed working through their real triggers (a real scheduled/dispatched export, a real admin-style file edit), not just unit tests.

## Step 9 — full field export, plus `alias_of_github_id`/`is_agent` (done)

`migrations/006_alias_and_agent_fields.sql` adds two more registry-file-owned columns alongside `status`: `alias_of_github_id` (a same-real-person link to another contributor's `github_id`) and `is_agent` (bot/agent flag). The export was also missing several columns entirely — `id`, `telegram_id`, `discord_id`, `github_name`/`github_email`, `discord_name`, `telegram_name`, `created_at`, `updated_at` — it now sends the full row.

- **Bug caught before it reached production:** the migration originally declared `alias_of_github_id text REFERENCES contributors (github_id)`, assuming `github_id` had been converted to `text` the same way `telegram_id` was (migrations/003) — it hadn't; `github_id` is still `bigint` (GitHub's own ids are nowhere near that ceiling). The FK failed at migration time with a type-mismatch error, caught locally against a throwaway Postgres before ever touching the droplet. Fixed by matching the column type.
- Verified live, against real production data before deploying and again after: correct field export, an alias+agent assignment applying correctly, and — deliberately — a self-reference and an unknown-target alias both rejected (`{"updated":0,"skipped":2}`) without corrupting the rows' existing state or crashing the rest of the batch.
- Pushed (`a516eab`), redeployed cleanly (`Applied: 006_alias_and_agent_fields.sql`, `https://pass.cfabric.org/` → `200` throughout), then re-ran the export workflow manually to refresh `cf-internal`'s file with the new fields. Confirmed the refreshed file kept `vzhuman`'s `status: confirmed` from Step 8 intact — the new fields didn't disturb the existing sync state — and now also shows real `telegram_id`/`discord_id` snowflakes for the two contributors who'd linked those providers, previously invisible in the file.

## Not yet done

- Nightly `pg_dump` backup timer — the droplet has no backups yet, only Postgres's own on-disk state
- Actually signing in through all three OAuth providers hasn't been exercised end-to-end by me (only that the page loads and that real contributors have signed in on their own) — worth a deliberate walkthrough
- The registry sync's `status` field has no consumer yet — gating a feature (e.g. contributor search) on `confirmed` is explicitly future work, not started
