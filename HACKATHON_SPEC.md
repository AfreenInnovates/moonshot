# HACKATHON_SPEC.md — Midnight Moonshot · Sep 5–6, 2026

> **Single source of truth for the hackathon. Update this document live as you build.**
> Status legend: ✅ IMPLEMENTED · 🟡 PARTIAL · ❌ MISSING · 🔵 PLANNED · ⚠️ NEEDS DECISION

---

## 1. Project Identity

| Field                            | Value                                                                                                                                                                                                                    | Status         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| **Project name**                 | One Heist, Two Realities                                                                                                                                                                                                 | ✅ IMPLEMENTED |
| **One-line pitch**               | "A real-time asymmetric multiplayer heist for 20–50 players where one thief navigates danger while the crowd sees the hidden security layer and manipulates the world from their phones"                                 | ✅ IMPLEMENTED |
| **Target user / ICP**            | Groups of 20–50 people in a physical room — hackathon attendees, party-goers, event participants who want a shared interactive experience                                                                                | ✅ IMPLEMENTED |
| **Core problem**                 | In group settings with 20–50 people, most multiplayer games leave the majority as passive spectators. "Spectators are wasted." This game makes every person in the room an active participant.                           | ✅ IMPLEMENTED |
| **Hackathon track**              | Games & Toys — Party games, persistent worlds, phone-based play                                                                                                                                                          | ✅ IMPLEMENTED |
| **Core multiplayer interaction** | One thief plays on a shared screen while 20–50 spectators join from phones, see hidden security systems, and manipulate the world to help the thief                                                                      | ✅ IMPLEMENTED |
| **Why multiplayer is essential** | The game fundamentally cannot exist without the crowd. The thief has intentionally limited vision — only the distributed crowd can see and react to security threats. The presence of 20–50 people IS the game mechanic. | ✅ IMPLEMENTED |

### Track Options (picked)

- [x] **Games & toys** — Party games, persistent worlds, phone-based play

### Decision Checklist

- [x] Problem statement selected from idea bank (or own idea locked)
- [ ] Mentor approved scope at Checkpoint 1 (15:00)
- [x] Written down what we are **NOT** building

---

## 2. Core Product Loop

> The ONE loop that proves the product works.

```
User enters → Spectator scans QR / opens URL and joins the room instantly
→ User performs action → Thief moves through building; spectators tap actions on phones
→ Shared state changes → SpacetimeDB updates thief position, security states, door locks
→ Other connected users see/react → Thief sees doors open/lights flash; spectators see thief moving into danger
→ Core outcome → Thief steals the objective and escapes, or gets caught
```

**Status:** ✅ DEFINED

### MVP Scope

| Category                              | Items                                                                                                                                                                                                                                                                                                                          | Status     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **Must work for MVP**                 | 1 map (museum), 1 thief with basic movement/interaction, static/moving cameras, guard patrols with vision cones, laser zones, locked doors, alarm/detection state, spectator mobile UI with actions (flash, unlock, distract, ping, disable), cooldowns/energy, instant join via URL, game phases (lobby → playing → win/lose) | 🔵 PLANNED |
| **Intentionally NOT in MVP**          | Multiple maps, multiple thieves, spectator betrayal mechanic, AI guards with dynamic behavior, upgradeable abilities, persistent progression, replay system, competitive mode, login/auth system, settings page, admin panel                                                                                                   | ✅ DEFINED |
| **Can cut without breaking the loop** | Laser zones, security room interaction, environmental signals, voting-based actions, detection meter (can simplify to binary detected/not)                                                                                                                                                                                     | ✅ DEFINED |

### Core Loop Test (run every hour)

- [ ] Open product in two tabs/devices
- [ ] Act in tab 1
- [ ] Tab 2 updates **without refresh** in under 1 second
- [ ] If tab 2 needs a refresh → **stop everything and fix this first**

---

## 3. Architecture

### Architecture Diagram (text)

```
┌─────────────────────────────┐
│        Game Client           │
│   (Vite + React, Shared      │     WebSocket (SpacetimeDB SDK)
│    Screen / Laptop)          │◄────────────────────────────────┐
│                              │                                  │
│   Thief sees:                │                                  │
│   • Physical world           │                                  │
│   • Rooms, doors, objects    │                                  │
│   • Game events              │                                  │
│   Does NOT see:              │                                  │
│   • Security systems         │                                  │
└─────────────────────────────┘                                  │
                                                                  │
                                          ┌──────────────────────┤
                                          │   SpacetimeDB Module  │
                                          │   (TypeScript,        │
                                          │    Maincloud)          │
                                          │                       │
                                          │   Tables:             │
                                          │   • player            │
                                          │   • game_room         │
                                          │   • thief_state       │
                                          │   • security_system   │
                                          │   • spectator_action  │
                                          │   • game_event        │
                                          │                       │
                                          │   Reducers:           │
                                          │   • join_game         │
                                          │   • move_thief        │
                                          │   • interact          │
                                          │   • spectator_action  │
                                          │   • start_game        │
                                          │   • end_game          │
                                          └──────────────────────┤
                                                                  │
┌─────────────────────────────┐                                  │
│     Spectator Client         │     WebSocket (SpacetimeDB SDK) │
│   (Vite + React, Mobile      │◄────────────────────────────────┘
│    Phones × 20–50)           │
│                              │
│   Crowd sees:                │
│   • Security layer           │
│   • Camera coverage          │
│   • Guard vision cones       │
│   • Laser grids              │
│   • Door lock states         │
│   • Thief position           │
│   Crowd can:                 │
│   • Flash lights             │
│   • Unlock doors             │
│   • Trigger distractions     │
│   • Ping areas               │
│   • Disable security         │
└─────────────────────────────┘
```

### Component Responsibilities

| Component              | Owns                                           | Reads                                                   | Writes                                          | Communicates via              |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| **Game Client**        | Thief UI, local input, world rendering         | SpacetimeDB: player, game_room, thief_state, game_event | Reducer calls: move_thief, interact, start_game | SpacetimeDB SDK (WebSocket)   |
| **Spectator Client**   | Security layer UI, action controls             | SpacetimeDB: all tables including security_system       | Reducer calls: join_game, spectator_action      | SpacetimeDB SDK (WebSocket)   |
| **SpacetimeDB Module** | All shared state, all server logic, validation | Table state                                             | Table state (via reducers)                      | Subscriptions push to clients |

### Environment Variables

| Variable                     | Purpose                        | Where           | Status     |
| ---------------------------- | ------------------------------ | --------------- | ---------- |
| `VITE_SPACETIME_MODULE_NAME` | Module identifier on Maincloud | Frontend `.env` | 🔵 PLANNED |
| `VITE_SPACETIME_HOST`        | Maincloud URL                  | Frontend `.env` | 🔵 PLANNED |

**Status:** 🟡 PARTIAL — architecture defined, repo exists, module not yet deployed

---

## 4. SpacetimeDB Core Audit

> **This is the highest-weighted scoring criterion (35 pts).**

### Tables / Shared State

| Table              | Purpose                                           | Written by                               | Subscribed by          | Essential to multiplayer? | Status     |
| ------------------ | ------------------------------------------------- | ---------------------------------------- | ---------------------- | ------------------------- | ---------- |
| `player`           | Track connected players, roles, energy            | `join_game`, `spectator_action` reducers | All clients            | Yes                       | 🔵 PLANNED |
| `game_room`        | Game session state and phase                      | `join_game`, `start_game`, `end_game`    | All clients            | Yes                       | 🔵 PLANNED |
| `thief_state`      | Thief position, detection, inventory              | `move_thief`, `interact` reducers        | All clients            | Yes                       | 🔵 PLANNED |
| `security_system`  | Cameras, guards, lasers, sensors, doors           | `start_game` (init), `spectator_action`  | Spectator clients only | Yes                       | 🔵 PLANNED |
| `spectator_action` | Log of crowd actions                              | `spectator_action` reducer               | Spectator clients      | Yes                       | 🔵 PLANNED |
| `game_event`       | Broadcast events (detections, door opens, alerts) | Various reducers                         | All clients            | Yes                       | 🔵 PLANNED |

### Reducers / Server Logic

| Reducer            | Purpose                         | Inputs                                     | State Changed                                   | Validation                                             | Concurrency Notes                          | Status     |
| ------------------ | ------------------------------- | ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ | ---------- |
| `join_game`        | Add player to room with role    | name, room_id, role                        | `player`, `game_room`                           | Name not empty, room exists, thief not already claimed | Check for duplicate identities             | 🔵 PLANNED |
| `move_thief`       | Update thief position           | x, y                                       | `thief_state`                                   | Caller is the thief, game is playing, valid position   | Single thief, no conflicts                 | 🔵 PLANNED |
| `interact`         | Thief interacts with world      | target_type, target_id                     | `thief_state`, `security_system`, `game_event`  | Is thief, near target, valid interaction type          | Atomic transaction                         | 🔵 PLANNED |
| `spectator_action` | Spectator performs crowd action | action_type, target_x, target_y, target_id | `spectator_action`, `security_system`, `player` | Is spectator, has energy, cooldown passed              | Multiple spectators may act simultaneously | 🔵 PLANNED |
| `start_game`       | Begin the heist                 | room_id                                    | `game_room`, `security_system`                  | Room in lobby, thief assigned, min players             | Single state transition                    | 🔵 PLANNED |
| `end_game`         | End the heist                   | room_id, result                            | `game_room`                                     | Valid end condition (escaped/caught/timeout)           | Single state transition                    | 🔵 PLANNED |

### Real-Time Flow — Spectator Unlocks Door

```
Action: Spectator taps "Unlock Door" targeting door_42
→ Client calls: reducer spectator_action("unlock", target_id=42)
→ SpacetimeDB runs reducer → validates energy/cooldown → mutates security_system[42].active=false, player.energy-=cost
→ Subscription fires → spectator clients see door unlock; game client receives game_event("door_opened")
→ UI updates: Thief sees door open animation. Spectators see door state change. All in <1 second.
```

### Real-Time Flow — Thief Moves

```
Action: Thief presses movement key
→ Client calls: reducer move_thief(new_x, new_y)
→ SpacetimeDB runs reducer → validates position → mutates thief_state.x, thief_state.y → checks security collisions
→ Subscription fires → all clients receive updated thief position
→ UI updates: Game client moves thief sprite. Spectator clients update thief marker on security map.
```

### Real-Time Flow — Thief Detected

```
Action: Thief walks into camera coverage zone
→ Server: move_thief reducer checks thief position against active security_system entries
→ SpacetimeDB mutates: thief_state.detected=true, game_event("detection"), game_room.phase="detected"
→ Subscription fires → all clients receive detection event
→ UI updates: Game client shows alarm. Spectator clients see detection state change.
```

### Anti-Patterns to Watch For

- [x] **No polling** — everything via SpacetimeDB subscriptions
- [x] **No manual refresh required** — UI updates reactively
- [x] **No local-only state for shared data** — if other users need to see it, it's in SpacetimeDB
- [x] **No race conditions** — reducers handle concurrent writes correctly
- [x] **Source of truth is always SpacetimeDB** — frontend state is derived, never authoritative

**Status:** 🔵 PLANNED — tables and reducers designed, not yet implemented

---

## 5. Multiplayer Readiness Checklist

### Scale Tests

| Users         | Status     | How to Test                                        | Expected Result                                         |
| ------------- | ---------- | -------------------------------------------------- | ------------------------------------------------------- |
| **2 users**   | ❌ MISSING | Game client + spectator client on separate devices | Thief moves → spectator sees position update < 1 second |
| **5 users**   | ❌ MISSING | 1 game client + 4 spectator clients                | All spectators see all actions, no conflicts            |
| **10 users**  | ❌ MISSING | 1 game client + 9 spectator clients                | Product remains usable, state consistent                |
| **20+ users** | ❌ MISSING | 1 game client + 20+ spectator clients              | The actual target scale — game should feel alive        |

### Functional Tests

| Test                                           | Status     | How to Test                               | Expected Result                   |
| ---------------------------------------------- | ---------- | ----------------------------------------- | --------------------------------- |
| Thief moves → spectators see without refresh   | ❌ MISSING | Game client + spectator                   | Instant position update           |
| Spectator unlocks door → thief sees door open  | ❌ MISSING | Spectator taps unlock → watch game client | Door opens within 1 second        |
| Multiple spectators act simultaneously         | ❌ MISSING | 3+ spectators perform actions at once     | All actions processed correctly   |
| Spectator cooldowns enforced server-side       | ❌ MISSING | Spam the same action                      | Server rejects rapid re-use       |
| Detection triggers alarm for all clients       | ❌ MISSING | Walk thief into camera zone               | All clients see alarm state       |
| Game phases transition correctly               | ❌ MISSING | Complete full game loop                   | lobby → playing → success/failure |
| Reconnecting users recover correct state       | ❌ MISSING | Disconnect spectator, reconnect           | Full state restored               |
| No critical interaction depends on local state | ❌ MISSING | Code review                               | All shared data in SpacetimeDB    |

---

## 6. Hackathon Qualification Checklist

### THE BUILD

| Requirement                                     | Status         | Notes                                       |
| ----------------------------------------------- | -------------- | ------------------------------------------- |
| Opens and runs on a phone                       | ❌ MISSING     | Spectator client must be mobile-first       |
| Live URL works on another device                | ❌ MISSING     | Deploy both clients                         |
| SpacetimeDB module is live on Maincloud         | ❌ MISSING     | `spacetime publish one-heist-two-realities` |
| Repo created after 14:00 Saturday               | ✅ IMPLEMENTED | Repo created at venue                       |
| Nothing pushed after code freeze (08:30 Sunday) | ❌ MISSING     | Stop all commits by 08:30                   |

### THE SUBMISSION (by 09:00 Sunday)

| Requirement                                      | Status         | Notes                                                           |
| ------------------------------------------------ | -------------- | --------------------------------------------------------------- |
| Demo video completed, under 3 minutes            | ❌ MISSING     | Record 07:00–08:30 Sunday                                       |
| Public launch post contains links to every build | ❌ MISSING     | Post 3 goes out at 21:30 Saturday                               |
| Clear one-liner: who it's for + what it does     | ✅ IMPLEMENTED | "A real-time asymmetric multiplayer heist for 20–50 players..." |

### MARKET READY

| Requirement                                  | Status         | Notes                              |
| -------------------------------------------- | -------------- | ---------------------------------- |
| A stranger gets in within 30 seconds         | ❌ MISSING     | QR code → name → instant join      |
| No unnecessary password/login wall           | ✅ IMPLEMENTED | Name only, no auth                 |
| First-time onboarding exists                 | ❌ MISSING     | Brief instructions on spectator UI |
| Product has seeded/demo content where needed | ❌ MISSING     | Map should always look populated   |
| Email comms live: sign up → email lands      | ❌ MISSING     | Simple email capture               |
| Every important link works                   | ❌ MISSING     | Test all links in incognito        |
| Tested in incognito/fresh-user environment   | ❌ MISSING     | Judge perspective test             |

---

## 7. Judging Rubric Self-Audit

### Parameter 1: Real-Time / Shared State (35 points)

| Field                            | Value                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Current score**                | 1 (foundation only, nothing syncs yet)                                                                                        |
| **Target score**                 | 5 — Product cannot exist without live shared state. 20+ users. Module does real work.                                         |
| **What prevents a higher score** | No running module yet. Need to implement tables, reducers, and connect clients.                                               |
| **Highest-impact next action**   | Implement SpacetimeDB module with core tables and `join_game` + `move_thief` reducers. Connect game client. Test with 2 tabs. |

### Parameter 2: Problem Solving (35 points)

| Field                            | Value                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Current score**                | 1 (design only, no working product)                                                            |
| **Target score**                 | 5 — Judges complete the core loop unaided and say they'd play it again.                        |
| **What prevents a higher score** | Need working game loop: join → move → spectator action → escape                                |
| **Highest-impact next action**   | Build the end-to-end loop: thief moves, spectator sees security, spectator acts, thief reacts. |

### Parameter 3: Market Readiness (30 points)

#### 3a. Positioning (10 pts)

| Field                          | Value                                                          |
| ------------------------------ | -------------------------------------------------------------- |
| **Current score**              | 3 — ICP defined (groups of 20–50 in a room), one-liner written |
| **Target score**               | 5                                                              |
| **Highest-impact next action** | Put the one-liner on the product landing state                 |

#### 3b. First 500 Users Plan (10 pts)

| Field                          | Value                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| **Current score**              | 1                                                                                    |
| **Target score**               | 3+                                                                                   |
| **Highest-impact next action** | Identify one community channel (game jams, hackathon communities, party game groups) |

#### 3c. Traction (10 pts)

| Field                          | Value                                                 |
| ------------------------------ | ----------------------------------------------------- |
| **Current score**              | 1                                                     |
| **Target score**               | 3+                                                    |
| **Highest-impact next action** | Post announcement at kickoff, build in public updates |

---

## 8. Stranger Test

### The Test Script

| Step                | What to observe                 | Expected                                                                  | Actual _(fill during testing)_ |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| 1. First 3 seconds  | What they see                   | Clear landing: "One Heist, Two Realities" with one-liner, QR code to join | _fill_                         |
| 2. Understanding    | What they think this is         | "Oh, one person plays the thief and everyone else helps from their phone" | _fill_                         |
| 3. First action     | What they do first              | Scan QR code / open URL on phone                                          | _fill_                         |
| 4. Entry time       | How long to get in              | Under 15 seconds — scan QR, enter name, join                              | _fill_                         |
| 5. Core loop        | Can they complete it?           | Yes — see security, tap action, see effect on shared screen               | _fill_                         |
| 6. Confusion points | Where they hesitate or get lost | Should be obvious what each action button does                            | _fill_                         |

### Stranger Test Checklist (run repeatedly)

- [ ] Tested with 1 stranger by 17:00 (Checkpoint 2)
- [ ] Tested with 1 stranger by 20:00 (Checkpoint 3)
- [ ] Tested with 5+ strangers by 00:00 (midnight)
- [ ] Fixed top confusion point after each test
- [ ] Tested final version in incognito tab (04:00–05:30)
- [ ] 25 people have used the product before code freeze

---

## 9. Demo Readiness

### Ideal 3-Minute Demo Flow

| Time      | What to show                                                                                                                                                            | Notes                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 0:00–0:20 | **The problem** — "In a room of 30 people, most multiplayer games leave 28 watching. Spectators are wasted."                                                            | Make it visceral            |
| 0:20–0:45 | **Enter the product** — Show the shared screen with the thief. Show QR code. Spectators join from phones.                                                               | Under 15 seconds to join    |
| 0:45–1:30 | **The core loop** — Thief starts moving. Show the thief's limited view.                                                                                                 | Clear, understandable       |
| 1:30–2:15 | **Multiplayer moment** — Cut to spectator phone: they see cameras, guards, lasers. Spectator taps "unlock door" → door opens on the shared screen. Thief walks through. | THIS IS THE MONEY SHOT      |
| 2:15–2:45 | **The "wow" moment** — 10+ spectators all acting at once. Chaos and collaboration. Thief escapes.                                                                       | The thing judges screenshot |
| 2:45–3:00 | **Close** — "One Heist, Two Realities. For any group of 20–50 people who want everyone in the room to play." Link.                                                      | Leave them wanting to try   |

### Demo Dependencies

| Dependency                        | Status     | Fallback                         |
| --------------------------------- | ---------- | -------------------------------- |
| Live URL accessible               | ❌ MISSING | Deploy by 21:30 Saturday         |
| 2+ users logged in simultaneously | ❌ MISSING | Use two phones or phone + laptop |
| Seeded/demo content exists        | ❌ MISSING | Map always has security systems  |
| Internet connection at venue      | ⚠️ Assumed | Screen recording as backup       |

### Pre-Recording Setup (07:00–08:30 Sunday)

- [ ] Two devices ready and connected
- [ ] Demo content seeded
- [ ] Screen recorder running
- [ ] Both users visible in the product
- [ ] Rehearsed the 3-minute flow at least once
- [ ] Video posted publicly after recording

---

## 10. Deployment & Environment Checklist

| Requirement                                    | Status         | Notes                                       |
| ---------------------------------------------- | -------------- | ------------------------------------------- |
| Frontend builds successfully                   | ❌ MISSING     | `pnpm build:all` passes                     |
| Game client deployed to production URL         | ❌ MISSING     | Vercel/Netlify                              |
| Spectator client deployed to production URL    | ❌ MISSING     | Vercel/Netlify (separate deployment)        |
| SpacetimeDB module deployed to Maincloud       | ❌ MISSING     | `spacetime publish one-heist-two-realities` |
| Production frontend connects to correct module | ❌ MISSING     | Correct module name + host in env           |
| No secrets committed to repo                   | 🟡 PARTIAL     | `.gitignore` covers `.env*`                 |
| `.env.example` present                         | ✅ IMPLEMENTED | Documents all required env vars             |
| Fresh clone setup documented                   | ✅ IMPLEMENTED | README has setup instructions               |
| Teammate can run the project from scratch      | ❌ MISSING     | Test with a fresh clone                     |
| Production environment variables configured    | ❌ MISSING     | Set in deployment platform                  |

---

## 11. Technical Debt / Risk Register

| Risk                                    | Severity    | Evidence in Code            | Consequence                       | Recommended Fix                    | Priority |
| --------------------------------------- | ----------- | --------------------------- | --------------------------------- | ---------------------------------- | -------- |
| Fake real-time (polling/manual refresh) | 🔴 Critical | _will check_                | Scores 1 on Parameter 1           | Use SpacetimeDB subscriptions only | P0       |
| Hardcoded local state for shared data   | 🔴 Critical | _will check_                | Other users never see changes     | Move to SpacetimeDB table          | P0       |
| Spectator spam overwhelming game        | 🟡 Medium   | _will check_                | Unplayable chaos                  | Server-enforced cooldowns + energy | P1       |
| No error handling on reducer calls      | 🟡 Medium   | _will check_                | Crashes on bad input              | Add error handling + UI feedback   | P1       |
| Broken loading states                   | 🟡 Medium   | _will check_                | Blank screen on slow connection   | Add connection status UI           | P1       |
| Missing mobile responsiveness           | 🔴 Critical | _will check_                | Spectator client breaks on phones | Spectator client is mobile-first   | P0       |
| No onboarding / empty state             | 🟡 Medium   | _will check_                | Stranger doesn't know what to do  | Add first-time instructions        | P1       |
| Scope too large                         | 🔴 Critical | _monitor_                   | Nothing works end-to-end          | Cut everything except core loop    | P0       |
| No email capture                        | 🟢 Low      | _will add_                  | Loses market readiness qualifier  | Add simple email input             | P2       |
| Secrets committed to repo               | 🔴 Critical | `.gitignore` covers `.env*` | Security issue + DQ risk          | Already mitigated                  | ✅       |

---

## 12. Immediate Priority Board

### 🔴 MUST FIX BEFORE CORE LOOP (14:00–17:00)

- [x] **Pick the problem** — "Spectators are wasted" in group settings
- [x] **Define the core loop** — JOIN → OBSERVE → MANIPULATE → REACT → ESCAPE
- [x] **Design SpacetimeDB tables and reducers** — 6 tables, 6 reducers defined
- [ ] **Repo + module deployed** — repo created, `spacetime publish` to Maincloud
- [ ] **Core loop alive with 2 users** — game client + spectator, action in one updates the other
- [x] **Write down what you're NOT building** — see MVP scope above

### 🟡 MUST FIX BEFORE LAUNCH (17:00–21:30)

- [ ] **Stranger-proof entry** — QR code, name only, under 15 seconds
- [x] **One-liner written** — on the product and ready for launch post
- [ ] **Mobile works** — test spectator client on actual phone
- [ ] **Seeded content** — map always has security systems active
- [ ] **Deploy to production URL** — live URL accessible from any device
- [ ] **Email capture** — even a simple form counts
- [ ] **Post 2 out** — build update during the day
- [ ] **Launch post ready** — Post 3 at 21:30: one-liner, clip, link

### 🟢 NICE TO HAVE (00:00–08:30)

- [ ] Presence indicators (who's online, how many spectators)
- [ ] Polish UI/UX — dark theme, neon accents, heist aesthetic
- [ ] Error messages that sound human
- [ ] Welcome message on entry
- [ ] Loading/connection states
- [ ] 20+ user support verified
- [ ] First 500 users plan articulated for stage question

### ⛔ DO NOT BUILD

- [x] Login/authentication system (name only is enough)
- [x] Settings page
- [x] Admin panel
- [x] Complex permissions/roles beyond thief/spectator
- [x] Landing page separate from the product
- [x] Multiple maps
- [x] AI guards with dynamic behavior
- [x] Spectator betrayal mechanic
- [x] Persistent progression
- [x] Anything that doesn't serve the core loop

---

## Quick Reference: The Timeline

| Time        | What                 | Your Checkpoint                                   |
| ----------- | -------------------- | ------------------------------------------------- |
| 11:00       | Doors open           | Arrive, set up                                    |
| 12:00       | Kickoff              | **Post 1: announcement thread**                   |
| 12:30       | Problem statements   | Pick one                                          |
| 13:00       | Lunch + ideate       | Lock your idea                                    |
| 14:00       | Building begins      | Repo created, `spacetime publish`                 |
| **15:00**   | **Checkpoint 1**     | **Show scope to mentor. They will cut.**          |
| 15:00–17:00 | Build core loop      | Two tabs test every hour                          |
| **17:00**   | **Checkpoint 2**     | **Core loop alive, two people inside it**         |
| 17:00–19:00 | Continue building    | **Post 2: build update**                          |
| 19:00       | Mentor on demand     | Grab the right mentor for your exact problem      |
| 19:00–21:00 | Make it enterable    | Stranger-proof, one-liner, mobile                 |
| **20:00**   | **Checkpoint 3**     | **Mentors head home. Ask everything.**            |
| **21:30**   | **LAUNCH**           | **Product live. Post 3: launch post**             |
| 21:30–00:00 | Get users in         | Get 25 people in, watch them, write down feedback |
| 00:00       | Midnight Moonshot    | All-nighter begins                                |
| 00:30–02:00 | Iterate on insights  | Fix what 25 users broke                           |
| 02:00–04:00 | UI/UX pass           | Make it feel designed                             |
| 04:00–05:30 | Stranger-proof       | Incognito tab test                                |
| 05:30–07:00 | Comms setup          | Welcome message, email capture, all links work    |
| 07:00       | Breakfast            |                                                   |
| **08:00**   | **Final checkpoint** | **Mentors back**                                  |
| **08:30**   | **CODE FREEZE**      | **Hands off. Demo video time.**                   |
| 09:00       | Submissions          | Window closes 09:30 sharp                         |
| 09:30       | Judges evaluate      |                                                   |
| 11:00       | Top 10 demos         |                                                   |

---

## Public Posts Tracker

| Post                 | When            | Platform     | Content                                                                                                  | Link         | Status     |
| -------------------- | --------------- | ------------ | -------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| Post 1: Announcement | 12:00 Sat       | _Twitter/X?_ | "Building 'One Heist, Two Realities' at Midnight Moonshot — a heist where only the crowd sees danger 🎭" | _paste link_ | ❌ MISSING |
| Post 2: Build update | Afternoon       | _same_       | Screenshot of security layer UI on phone + shared screen thief view                                      | _paste link_ | ❌ MISSING |
| Post 3: Launch       | 21:30 Sat       | _same_       | One-liner, clip of 10+ spectators playing, link to join                                                  | _paste link_ | ❌ MISSING |
| Demo video           | 08:00–08:30 Sun | _public_     | Under 3 min, problem → product → multiplayer moment → wow                                                | _paste link_ | ❌ MISSING |

---

## Rules Reminder

- ✅ SpacetimeDB at the core — real-time logic lives in a SpacetimeDB module on Maincloud
- ✅ Fresh code only — repo + module created at the hackathon, timestamps checked
- ✅ Teams of 1–3
- ✅ Public libraries, APIs, datasets are fine within their licenses
- ❌ No proprietary/employer code
- ❌ No commits after code freeze (08:30 Sunday)
- ❌ Breaking fresh-code rule = straight disqualification
