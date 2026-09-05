# Technical Architecture — One Heist, Two Realities

---

## Guiding Principle

**SpacetimeDB is the authoritative source of truth.** All shared game state lives in SpacetimeDB tables. All mutations happen through reducers. All clients derive their view from subscriptions. No client is trusted to define game state.

---

## System Overview

```
┌─────────────────────────────┐
│        Game Client           │
│   (Shared Screen / Laptop)   │
│                              │
│   Subscribes to:             │
│   • Thief position           │
│   • Physical world state     │
│   • Door states (visual)     │
│   • Game phase               │
│   • Game events (alerts)     │
│                              │
│   Calls reducers:            │
│   • move_thief               │
│   • interact                 │
│   • start_game               │
└──────────────┬───────────────┘
               │ WebSocket (SpacetimeDB SDK)
               ▼
┌──────────────────────────────┐
│       SpacetimeDB Module      │
│       (Maincloud)             │
│                               │
│   Tables:                     │
│   ├── player                  │
│   ├── game_room               │
│   ├── thief_state             │
│   ├── security_system         │
│   ├── spectator_action        │
│   └── game_event              │
│                               │
│   Reducers:                   │
│   ├── join_game               │
│   ├── move_thief              │
│   ├── interact                │
│   ├── spectator_action        │
│   ├── start_game              │
│   └── end_game                │
└──────────────┬───────────────┘
               │ WebSocket (SpacetimeDB SDK)
               ▼
┌─────────────────────────────┐
│     Spectator Client         │
│   (Mobile Phones × 20–50)    │
│                              │
│   Subscribes to:             │
│   • Security system state    │
│   • Guard positions/routes   │
│   • Camera states            │
│   • Laser states             │
│   • Door lock states         │
│   • Thief position           │
│   • Game phase               │
│   • Spectator cooldowns      │
│                              │
│   Calls reducers:            │
│   • join_game                │
│   • spectator_action         │
└─────────────────────────────┘
```

---

## SpacetimeDB Table Schema

### `player`
Tracks all connected players and their roles.

| Column | Type | Description |
|---|---|---|
| `identity` | Identity (PK) | SpacetimeDB connection identity |
| `name` | string | Player display name |
| `role` | string | `"thief"` or `"spectator"` |
| `room_id` | u32 | Which game room they're in |
| `connected` | bool | Whether currently connected |
| `energy` | u32 | Spectator action energy pool |
| `joined_at` | u64 | Timestamp |

### `game_room`
Represents a game session.

| Column | Type | Description |
|---|---|---|
| `id` | u32 (PK, auto) | Room identifier |
| `phase` | string | `"lobby"`, `"playing"`, `"detected"`, `"success"`, `"failure"` |
| `thief_identity` | Identity | Which player is the thief |
| `created_at` | u64 | Room creation timestamp |
| `started_at` | u64 | Game start timestamp |
| `map_id` | string | Which map is being played |

### `thief_state`
The thief's current state within a game.

| Column | Type | Description |
|---|---|---|
| `room_id` | u32 (PK) | Which game room |
| `x` | f32 | Position X |
| `y` | f32 | Position Y |
| `has_objective` | bool | Whether the thief has the target |
| `detected` | bool | Whether currently detected by security |
| `detection_level` | u32 | 0–100 detection meter |

### `security_system`
All security elements in the map.

| Column | Type | Description |
|---|---|---|
| `id` | u32 (PK, auto) | Unique security element ID |
| `room_id` | u32 | Which game room |
| `kind` | string | `"camera"`, `"guard"`, `"laser"`, `"sensor"`, `"door"` |
| `x` | f32 | Position X |
| `y` | f32 | Position Y |
| `rotation` | f32 | Current rotation/facing |
| `active` | bool | Whether currently active |
| `disabled_until` | u64 | Timestamp when disabled state expires |
| `config` | string | JSON config (patrol route, cone angle, etc.) |

### `spectator_action`
Log of crowd actions and cooldown tracking.

| Column | Type | Description |
|---|---|---|
| `id` | u32 (PK, auto) | Action ID |
| `room_id` | u32 | Which game room |
| `player_identity` | Identity | Who performed it |
| `action_type` | string | `"flash"`, `"unlock"`, `"distract"`, `"ping"`, `"disable"` |
| `target_x` | f32 | Target position X |
| `target_y` | f32 | Target position Y |
| `target_id` | u32 | Target security system ID (if applicable) |
| `performed_at` | u64 | Timestamp |

### `game_event`
Broadcast events that clients render.

| Column | Type | Description |
|---|---|---|
| `id` | u32 (PK, auto) | Event ID |
| `room_id` | u32 | Which game room |
| `kind` | string | `"detection"`, `"alarm"`, `"door_opened"`, `"objective_taken"`, etc. |
| `x` | f32 | Event position X |
| `y` | f32 | Event position Y |
| `data` | string | JSON payload |
| `created_at` | u64 | Timestamp |

---

## Reducer Responsibilities

| Reducer | Called By | Validates | Mutates | Broadcasts To |
|---|---|---|---|---|
| `join_game` | Both clients | Name not empty, room exists | `player`, `game_room` | All clients in room |
| `move_thief` | Game client | Is the thief, game is playing, valid position | `thief_state` | All clients (position update) |
| `interact` | Game client | Is the thief, near target, valid interaction | `thief_state`, `security_system`, `game_event` | All clients |
| `spectator_action` | Spectator client | Is spectator, has energy, cooldown passed, valid target | `spectator_action`, `security_system`, `player` (energy) | All clients |
| `start_game` | Game client | Room in lobby, thief assigned, min players | `game_room`, `security_system` (init) | All clients |
| `end_game` | Server/Game client | Valid end condition | `game_room` | All clients |

---

## Subscription Model

### Game Client Subscribes To:
```sql
SELECT * FROM player WHERE room_id = ?
SELECT * FROM game_room WHERE id = ?
SELECT * FROM thief_state WHERE room_id = ?
SELECT * FROM game_event WHERE room_id = ?
-- Does NOT subscribe to security_system (thief can't see it)
```

### Spectator Client Subscribes To:
```sql
SELECT * FROM player WHERE room_id = ?
SELECT * FROM game_room WHERE id = ?
SELECT * FROM thief_state WHERE room_id = ?
SELECT * FROM security_system WHERE room_id = ?
SELECT * FROM spectator_action WHERE room_id = ?
SELECT * FROM game_event WHERE room_id = ?
```

> **Note:** The thief client intentionally does NOT subscribe to `security_system`. This enforces the asymmetric information mechanic at the data level — the thief literally cannot access security data.

---

## Data Flow: Spectator Action Example

```
1. Spectator taps "Unlock Door" on their phone, targeting a locked door

2. Spectator client calls reducer:
   spectator_action(room_id, "unlock", target_id: door_42)

3. SpacetimeDB reducer runs:
   a. Validate: is caller a spectator? has energy? cooldown passed?
   b. Deduct energy from player
   c. Update security_system[door_42].active = false
   d. Set security_system[door_42].disabled_until = now + 5 seconds
   e. Insert spectator_action log row
   f. Insert game_event (door_opened)

4. Subscriptions fire:
   a. Spectator clients see the door change to "unlocked" state
   b. Game client receives game_event → renders door opening animation
   c. Thief sees the door open but doesn't know why

5. After 5 seconds, a scheduled reducer re-locks the door
```

---

## Anti-Patterns (Enforced)

| Anti-Pattern | Prevention |
|---|---|
| Polling / manual refresh | All updates via SpacetimeDB subscriptions |
| Client as source of truth | All shared state in SpacetimeDB tables |
| Trusting client input | Reducers validate all actions server-side |
| Thief seeing security data | Thief client doesn't subscribe to security tables |
| Race conditions | Reducers are atomic transactions |
| Spectator spam | Server-enforced cooldowns + energy costs |
