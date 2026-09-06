# One Heist, Two Realities

An asymmetric multiplayer heist built with **React Three Fiber** + **Rapier**, out of nothing but
boxes, cylinders and cones. One player walks the building blind; everyone else can see the
security layer, but each of them is stuck watching a single room.

```bash
npm run dev
```

## The flow

| Route | What it is |
| --- | --- |
| `/` | What the game is, and how a run goes. |
| `/rooms` | Create a room (2–4 players) or join with a code. |
| `/room/[code]` | Name gate → lobby → the run. Share this link; anyone who opens it joins. |
| `/play` | Solo sandbox: you drive the thief and can look through all three layers. |

A room fills up, a **ten second countdown** runs, then the roles are drawn:

- **one thief**, first person, starting on the street outside the entrance;
- **everyone else a spectator**, each posted to exactly one room — lobby, security or vault — and
  they cannot leave it. Three spectators covers the building; fewer means blind spots.

Rooms fill in a fixed order — lobby, then security, then vault — so the set covered is always the
sensible one; only *who* gets which is random. The exception is a crew of one: a single spectator
would be stuck in one room while the run needs another, so they **roam** with the thief instead
and are always on the command channel.

The draw is deterministic from a seed on the room record, so every client lands on the same result
the moment the clock hits zero — nothing waits on the host's tab being awake.

Every view carries a **2D floorplan in the top right** with a live dot for the thief. Spectators
also see guards in their own room on it; the thief does not get guard positions.

## The run

1. The thief walks in off the street, through the entrance into the lobby.
2. **Security room** (west, blue door): the keycard is in here, and so is the note with the vault
   code. The thief can pick up the keycard but cannot see the note as anything special — a
   spectator posted to that room has to scan it in Discovery mode, which relays `4712`.
   The **alarm panel** in here can be disabled with `E`, blinding every camera.
3. **Vault room** (east, yellow door — needs the keycard): `E` at the keypad. Without the code
   relayed from a spectator, it refuses.
4. The round door opens: take the contents, walk back out to the street.

Cameras sweep, two guards patrol and give chase once the alarm is up, floor traps hurt, and the
health pack and bandages patch you up. None of that is visible to the thief.

## The three layers

| View | Who | What it shows |
| --- | --- | --- |
| Thief | the thief | A normal facility. No labels, no cones, no traps. |
| Spectator ("Watch") | spectators, solo | Their room as a cutaway: camera cones, the guard, the keypad, the keycard. |
| Discovery | spectators, solo | Same room plus pulsing blips over what nobody has found yet. Click to scan. |

Anything a spectator scans stays tagged for everyone in the Watch layer — found things become
shared knowledge. A room a spectator is *not* posted to stays sealed to them.

## Controls

Desktop:

- `WASD` move, `Shift` run, `Space` jump, `E` interact
- Thief: click to look around (pointer lock, falls back to click-drag)
- Spectator: fixed view (scroll to zoom), Watch/Discover to switch layer. A posted spectator's
  room never rotates or pans, so "left" always means the thief's left
- Solo only: `1` / `2` / `3` switch view

Phone (anything with a coarse pointer):

- Thief: stick on the left thumb, drag anywhere to look, `E` and `JUMP` on the right. The jump
  button becomes `EXIT` when they are standing in the extraction vent.
- Spectator: the command deck is the whole bottom of the screen; discovery blips are tap targets.

## The run, end to end

1. Walk in from the street through the entrance.
2. Take the **keycard** from the security room (west door).
3. Use it on the **keypad** by the round door in the vault room (`E`). That opens the vault *and*
   releases the extraction vent.
4. Take the vault contents if you want the score, then **jump into the vent** on the vault room's
   east wall to get out.

A spectator posted to the vault can scan the vent open early, before the thief ever reaches the
keypad. The 4-digit code on the note in the security room is a second way to satisfy the keypad,
not a requirement - a run is always finishable with the keycard alone.

## How the multiplayer works

The thief's client owns the simulation — physics, guards, detection — and publishes a snapshot
12 times a second (transform, guards, camera yaws, alarm, flags, log). Spectators never step the
physics world; they fold each snapshot back into the same runtime the renderers already read, and
send `discover` messages the other way.

Transports sit behind one small interface (`app/game/net/types.ts`):

- **`spacetime` (default)** — rooms and world snapshots use the published SpacetimeDB module.
  This is the deployment transport and works across browsers and devices.
- **`server` (opt-in)** — set `NEXT_PUBLIC_NET_TRANSPORT=server` to use the in-memory
  Next server and SSE stream from `app/lib/roomStore.ts` and `app/api/rooms/*`. Only usable
  against a single long-lived `next dev` process: the rooms live in that process's memory, so
  on a serverless deployment the thief's snapshots and the spectators' streams land in
  different instances and spectator views never update.

## SpacetimeDB

The module in `spacetime/src/index.ts` is written for exactly this flow and typechecks
against `spacetimedb@2.10`:

- tables: `game_room`, `player`, `thief_state`, `discovered_item`, `game_event`
- reducers: `create_room`, `join_room`, `leave_room`, `start_run`, `draw_roles`, `publish_world`,
  `discover_item`, `log_event`, `end_run`
- `draw_roles` uses the same seeded shuffle as the web client, so client-side prediction and the
  server agree on who gets to be the thief.

The browser-side adapter is wired in `app/game/net/spacetimeNet.ts`, with the generated-compatible
client schema in `app/game/net/spacetime.ts`. That file has to mirror the **published** module
exactly — SpacetimeDB addresses tables and reducers by index, so one extra column or reducer
shifts every id after it and the first subscription update fails to decode. Check it against the
live schema before changing it:

```bash
curl https://maincloud.spacetimedb.com/v1/database/one-heist-spacetime/schema?version=9
```

`spacetime/src/index.ts` is currently *ahead* of what is deployed (it adds spectator
disconnect-grace bookkeeping); the client bindings track the deployed module, not this source.

The deployed client uses the module named by `NEXT_PUBLIC_SPACETIME_MODULE_NAME` (default: `one-heist-spacetime`) at
`NEXT_PUBLIC_SPACETIME_HOST` (default: `wss://maincloud.spacetimedb.com`).

Spectator commands use the existing `log_event` reducer with a reserved `command:*` tone, so the
command deck works with the published module without a schema migration. These events are filtered
out of the normal game log and delivered to the thief as live command messages.

## Code layout

```
app/
  page.tsx               landing
  rooms/page.tsx         create / join
  room/[code]/           name gate, lobby, countdown, then the run
  play/page.tsx          solo sandbox
  api/rooms/             room registry + SSE stream
  lib/roomStore.ts       in-memory rooms, join / start / broadcast
```

```
spacetime/               SpacetimeDB module (tables + reducers)
docs/, HACKATHON_SPEC.md the original design notes
  game/
    GameShell.tsx        HUD: role, layer switch, minimap, discovery panel, log
    GameCanvas.tsx       <Canvas> + <Physics> (paused on spectators) + keyboard map
    store.ts             game state, and who is allowed to see which room
    session.ts           rooms, players, countdown, the seeded role draw
    runtime.ts           per-frame world state that must not re-render React
    level.ts             floorplan: rooms, wall runs, doors, markers, patrols, cameras
    net/                 transport interface + SSE server transport
    components/
      Building.tsx       walls cut around openings, floors, ceilings, doors, room fog
      Exterior.tsx       ground, sky, plaza, lamps, skyline, extraction pad
      Rooms.tsx          per-room furniture, the round vault door
      Furniture.tsx      shared props
      Interactables.tsx  keycard, keypad, alarm panel, traps, vent, med kits, loot
      Markers.tsx        neon outlines, labels, clickable discovery blips
      Thief.tsx          local (physics) and remote (streamed) thief
      Guard.tsx          local patrol AI and remote guards
      SecurityCameras.tsx sweeping cameras and cones
      Systems.tsx        line of sight, alarm, damage, room tracking, prompts (host only)
      NetSync.tsx        snapshot publish / apply
      ViewRig.tsx        cameras, controls and per-view lighting
      Minimap.tsx        the 2D floorplan
```

Three rules keep the layers honest:

- **One simulation, many cameras.** Guards, cones, traps and damage behave identically for
  everyone; only what is *drawn* changes.
- **`level.ts` is the single source of truth.** Every marker carries a `room` and a
  `reveal: "spectator" | "discovery"`; `useRoomVisible` is the one place that answers "can this
  client see inside this room".
- **Nothing spectator-only is ever mounted in a thief client** — not the cones, not the labels,
  not the minimap's guard dots.

## Deployment

Production Google sign-in requires these public Vercel variables:

```text
NEXT_PUBLIC_SPACETIME_AUTH_CLIENT_ID=your-spacetimeauth-client-id
NEXT_PUBLIC_SITE_URL=https://your-production-domain
```

Enable Google in the SpacetimeAuth project and allow `https://your-production-domain/` as the
client redirect and post-logout URI. Publish the module with an account that owns or collaborates
on `one-heist-spacetime` before deploying the frontend, because the counter and profile tables are
part of the client schema.
