# Chnobli

Students write the quiz questions. Everyone else plays them live, projected
on the board like a game show — visually its own thing (Chalk design
system, slate-blue accent, letter-badge answers), not a Kahoot skin.

## Roles

- **Teacher** (`/teacher`) — create a quiz, show the join code/QR, review
  and approve student-submitted questions, then run the live presentation:
  question → timer → live answer count → reveal → leaderboard → next
  question → final podium.
- **Student** (`/play`) — join by code or QR, pick an avatar + nickname,
  write one question (multiple choice, true/false, short answer, or guess
  the number), then play every question except their own — they sit that
  one out while the rest of the class answers it.

## Language

German is the default everywhere. The teacher's quiz setup screen has a
Deutsch/English toggle; whichever one is selected when the quiz is created
becomes that quiz's language for the teacher's own screen *and* every
student who joins it (there's no separate toggle for students — they
inherit the teacher's choice). All UI text and server-sent messages (errors,
question-type labels, True/False, ordinals like "1." vs "1st") come from
the single dictionary in `public/js/i18n.js`, shared by both the browser and
the server so there's one place to add a string or a third language later.

## Run locally

```bash
npm install
npm start          # http://localhost:3000
```

Open `/teacher` in one tab and `/play` in another (or on your phone, same
Wi-Fi) to try a full round yourself.

## Test

```bash
npm test           # starts the server on a throwaway port and drives a
                    # full 4-student game over real socket.io connections
```

## How it's built

- `server/` — Node + Express + Socket.IO. All game state (rooms, players,
  questions, scores, the live timer) lives in memory and is fully
  server-authoritative; clients are thin renderers of whatever view model
  the server pushes them. No database — a quiz only needs to live as long
  as one class period.
- `public/` — vanilla HTML/CSS/JS (no build step). `teacher.html` /
  `teacher.js` drive the projected console; `play.html` / `student.js`
  drive the phone flow. `css/chalk-tokens.css` + `css/app.css` hold the
  design system.
- See `DEPLOYMENT.md` for putting this on your home server (it's a
  "dynamic" Node app, not the static-file tier — needs `build:` in compose
  and Websockets Support turned on in Nginx Proxy Manager).
