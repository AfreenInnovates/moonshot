# Game Design Document — One Heist, Two Realities

> One thief. Thirty minds. A heist where only the crowd sees danger.

---

## Concept Overview

"One Heist, Two Realities" is a real-time asymmetric multiplayer heist game designed for 20–50 players in a physical room. One player controls a thief on a shared screen, while everyone else joins instantly from their phones to become the thief's collective intelligence network.

The core innovation: **spectators are not wasted**. The presence of 20–50 people is the actual game mechanic, not a viewing audience. Every person in the room participates.

---

## The Two Realities

### Reality 1: The Thief's View (Shared Screen)

The thief sees the **physical world** of the building:
- Rooms, corridors, and architectural layout
- Doors (but not whether they're electronically locked)
- Physical objects and furniture
- The heist objective location
- Exits and extraction zones

The thief **cannot** see:
- Camera coverage areas
- Guard vision cones
- Laser grids
- Motion sensor zones
- Electronic lock states
- Hidden passages
- Alarm/detection states

### Reality 2: The Crowd's View (Mobile Phones)

Each spectator sees the **hidden security layer**:
- Camera coverage zones and rotation patterns
- Guard patrol routes and vision cones
- Laser grid positions and activation states
- Motion sensor zones
- Locked/unlocked door states
- Hidden routes and secret passages
- Alarm states and detection levels

---

## The Key Mechanic: Indirect Communication

The thief and crowd **do not** communicate through a conventional chat or UI overlay. Instead, spectators help the thief by **interacting with the world** using limited actions and signals.

### Spectator Actions (MVP)

| Action | Effect | Duration |
|---|---|---|
| **Flash Light** | Briefly illuminate a location in the thief's view | ~1 second |
| **Unlock Door** | Temporarily open an electronically locked door | ~5 seconds |
| **Trigger Distraction** | Create a noise/event to divert a guard | ~3 seconds |
| **Ping Area** | Mark/highlight an area with a subtle indicator | ~2 seconds |
| **Disable Security** | Temporarily disable a camera or sensor | ~4 seconds |
| **Environmental Signal** | Create a visual cue in the environment | ~2 seconds |

### Anti-Spam Mechanics

With 30+ spectators, uncontrolled actions would be chaotic. Constraints:

- **Cooldowns**: Each action has a per-player cooldown timer
- **Influence/Energy**: Each spectator has a limited resource pool that regenerates over time
- **Voting**: Certain high-impact actions (e.g., disabling security) may require multiple spectators to agree

### The Tension

The crowd **knows** what is dangerous, but the thief must **interpret** their actions and react in real time. This creates emergent gameplay:
- Spectators frantically flashing lights to warn the thief
- Multiple spectators trying to unlock a door simultaneously
- Distractions creating opportunities the thief may or may not notice
- The thief learning to read crowd signals over the course of a heist

---

## MVP Map: The Museum

A small museum/bank floor with the following rooms:

```
┌──────────────────────────────────────────────┐
│                  LOBBY                        │
│  [Thief Spawn]                               │
│              ┌──────┐                         │
│              │ Door │                         │
└──────────────┴──────┴────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌────────┐  ┌────────┐  ┌────────────────┐
│Corridor│  │Corridor│  │   Security     │
│   A    │──│   B    │  │   Room         │
│        │  │        │  │                │
└───┬────┘  └───┬────┘  └────────────────┘
    │           │
    ▼           ▼
┌────────────────────┐
│     VAULT ROOM     │
│   [Objective]      │
│                    │
└───────┬────────────┘
        │
        ▼
┌────────────────────┐
│  EXTRACTION ZONE   │
│  [Escape Point]    │
└────────────────────┘
```

### Rooms

| Room | Purpose | Notable Features |
|---|---|---|
| **Lobby** | Thief spawn / entry point | Open area, minimal security |
| **Corridor A** | Main route to vault | Camera coverage, laser grid |
| **Corridor B** | Alternative route | Guard patrol, motion sensors |
| **Security Room** | Houses security controls | Locked door, can be used to disable systems |
| **Vault Room** | Contains the objective | Heavy security — cameras, lasers, locked door |
| **Extraction Zone** | Escape point | Must reach after stealing objective |

---

## Security Systems (MVP)

| System | Behavior | Thief Visibility | Spectator Visibility |
|---|---|---|---|
| **Static Cameras** | Fixed position, fixed cone of vision | Cannot see | Full coverage overlay |
| **Moving Cameras** | Rotate on a pattern | Cannot see | Coverage + rotation pattern |
| **Guard Patrols** | Walk preset routes with vision cones | Can see the guard, not the vision cone | Full route + vision cone |
| **Laser Zones** | Block passages, may toggle on/off | Cannot see | Full grid overlay |
| **Locked Doors** | Require spectator unlock or security room | Sees "locked" indicator | Full lock state + unlock action |
| **Alarm/Detection** | Triggered when thief enters security zone | Alert flash when detected | Detection state + countdown |

---

## Game Loop

```
1. JOIN
   └── Spectators scan QR / open URL → join room instantly
   └── One player claims the thief role (or is assigned)

2. THIEF ENTERS
   └── Thief spawns in the lobby
   └── Shared screen shows the thief's limited physical view

3. CROWD OBSERVES
   └── Spectators see the full security layer on their phones
   └── They see dangers the thief cannot

4. CROWD MANIPULATES
   └── Spectators use limited actions to signal/help
   └── Flash lights, unlock doors, trigger distractions
   └── Constrained by cooldowns and energy

5. THIEF REACTS
   └── Thief interprets crowd signals
   └── Navigates through the building in real time

6. STEAL OBJECTIVE
   └── Thief reaches the vault and collects the target

7. ESCAPE
   └── Thief must reach the extraction zone
   └── Security may be on high alert after theft
   └── WIN if thief escapes, LOSE if detected/caught
```

---

## Game Phases

| Phase | Description |
|---|---|
| **LOBBY** | Players join, thief is selected, countdown |
| **PLAYING** | Active heist in progress |
| **DETECTED** | Thief was spotted — alarm escalation |
| **SUCCESS** | Thief escaped with the objective |
| **FAILURE** | Thief was caught or time ran out |

---

## Future Expansion Ideas (NOT in MVP)

- Multiple maps with different themes (bank, tech lab, mansion)
- Multiple thieves cooperating
- Spectator betrayal mechanic (some spectators secretly work for security)
- Guard AI with varying intelligence levels
- Upgradeable spectator abilities
- Persistent progression across heists
- Replay system showing both realities side-by-side
- Competitive mode: two teams, two thieves, same building
