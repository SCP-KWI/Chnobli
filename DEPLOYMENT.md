# Deploying Chnobli

Chnobli is a **dynamic** app (a small Node.js server, not just static
files) because the teacher's board and every student's phone stay in sync
over a live WebSocket connection. Everything else follows your usual
Portainer / Nginx Proxy Manager setup, with two differences from the static
tier:

- `docker-compose.yml` uses `build: .` instead of a prebuilt `nginx:alpine`
  image, since there's a real server to run.
- The Nginx Proxy Manager proxy host **must have "Websockets Support"
  enabled**, or students' answers and the live scoreboard won't update.

## 1. Get the files onto the server

This app has several files (`server/`, `public/`, `Dockerfile`, …), so
rather than `curl`-ing them one by one, clone or pull your `Chnobli` GitHub
repo once this `chnobli/` app folder is committed there, e.g.:

```bash
mkdir -p /opt/phisch_apps
cd /opt/phisch_apps
git clone https://github.com/SCP-KWI/Chnobli.git chnobli-repo   # first time
cp -r chnobli-repo/chnobli ./chnobli   # the app subfolder, same name
```

(Or `scp -r` the `chnobli/` folder straight from your machine if you'd
rather not go through git. Either way, avoid dragging files in through a
browser — same reasoning as always, it silently mangles line endings/perms.)

## 2. Build & run

```bash
cd /opt/phisch_apps/chnobli
docker compose up -d --build
docker compose logs -f chnobli   # should print "Chnobli server listening on :3000"
```

No host port is published — like your other apps, Nginx Proxy Manager
reaches it over the internal `nginxproxymanager_default` network by
container name (`chnobli:3000`).

## 3. DNS

In Hostpoint, add:

```
chnobli.schaffner.xyz  CNAME  schaffnerxyz.duckdns.org
```

Wait ~5 minutes, then confirm with `nslookup chnobli.schaffner.xyz`.

(Using a different subdomain? Just edit the `route` in `app.json` and the
CNAME to match — nothing else in the app hardcodes the domain.)

## 4. Nginx Proxy Manager

1. **Create the proxy host without SSL first** (your known NPM gotcha —
   requesting the cert at the same time as saving can silently fail to
   write the `.conf` file):
   - Domain: `chnobli.schaffner.xyz`
   - Forward hostname/IP: `chnobli`
   - Forward port: `3000`
   - Scheme: `http`
2. **Turn on "Websockets Support"** in the same Details tab — this is the
   one setting that's easy to forget and the whole point of this app is a
   live connection, so without it the teacher's board and phones will load
   but never update.
3. Confirm the `.conf` file appeared under
   `/home/pip/docker/npm/data/nginx/proxy_host/`.
4. Edit the proxy host again and add the Let's Encrypt SSL certificate.

## 5. Dashboard

Add to `/opt/phisch_apps/dashboard/apps.json` (this is exactly `app.json`
from the chnobli folder):

```json
{
  "name": "Chnobli",
  "description": "Students write the quiz questions; the class plays them live, Kahoot-style.",
  "icon": "🧠",
  "route": "https://chnobli.schaffner.xyz",
  "tags": ["KWI"],
  "tier": "dynamic"
}
```

Then:

```bash
cd /opt/phisch_apps/dashboard && docker compose restart
```

## 6. Test it for real

In an incognito window: open `https://chnobli.schaffner.xyz/teacher` on a
laptop (this is what you'd project), and `https://chnobli.schaffner.xyz/play`
on your phone (or scan the QR code shown in the lobby). Create a quiz, join
as a student, write and submit a question, approve it, start the quiz, and
answer it from your phone — you should see the score update on both screens
within a second.

## Notes on how it behaves

- **State is in memory, on purpose.** A quiz only needs to live for one
  class period, like a Kahoot session — there's no database. Restarting the
  container ends any quizzes in progress. If you ever want quizzes to
  survive a restart or want a reusable question bank across classes, that's
  a deliberate follow-up feature, not a bug.
- **One process serves the whole school.** Multiple teachers can run
  separate quizzes at the same time (each gets its own 4-digit code); there's
  no artificial limit on concurrent rooms, only on the machine's resources.
- **Question timer length** defaults to 20 seconds per question and can be
  tuned via the `QUESTION_DURATION_MS` environment variable in
  `docker-compose.yml`.
- **Checklist recap**, matching your usual per-app checklist:
  - [ ] `/opt/phisch_apps/chnobli/` created with all files
  - [ ] `docker compose up -d --build`
  - [ ] CNAME added, DNS propagated
  - [ ] NPM proxy host created (no SSL) → `.conf` confirmed → SSL added →
        **Websockets Support enabled**
  - [ ] `dashboard/apps.json` updated + dashboard restarted
  - [ ] Tested end-to-end in incognito (teacher screen + a phone)
