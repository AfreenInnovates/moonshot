"use client";

/*
 * Generated-module equivalent for the published one-heist-spacetime schema.
 * Keeping this module local lets the browser use the typed SpacetimeDB client
 * without requiring the CLI during a Vercel build.
 *
 * This has to mirror the *published* module exactly. SpacetimeDB addresses
 * tables and reducers by index over the wire, so one extra column or one extra
 * reducer here shifts every id after it and the first subscription update comes
 * back as "Offset is outside the bounds of the DataView". Check any change
 * against the live schema before trusting it:
 *
 *   curl https://maincloud.spacetimedb.com/v1/database/one-heist-spacetime/schema?version=9
 */
import {
  DbConnectionBuilder as __DbConnectionBuilder,
  DbConnectionImpl as __DbConnectionImpl,
  SubscriptionBuilderImpl as __SubscriptionBuilderImpl,
  convertToAccessorMap as __convertToAccessorMap,
  makeQueryBuilder as __makeQueryBuilder,
  procedures as __procedures,
  reducerSchema as __reducerSchema,
  reducers as __reducers,
  schema as __schema,
  t as __t,
  table as __table,
  type DbConnectionConfig as __DbConnectionConfig,
  type ErrorContextInterface as __ErrorContextInterface,
  type EventContextInterface as __EventContextInterface,
  type ReducerEventContextInterface as __ReducerEventContextInterface,
  type RemoteModule as __RemoteModule,
  type QueryBuilder as __QueryBuilder,
  type SubscriptionEventContextInterface as __SubscriptionEventContextInterface,
  type SubscriptionHandleImpl as __SubscriptionHandleImpl,
} from "spacetimedb";

const discoveredItemRow = __t.row({
  id: __t.string().primaryKey(),
  roomCode: __t.string().name("room_code"),
  itemId: __t.string().name("item_id"),
  by: __t.string(),
  at: __t.u64(),
});
const gameEventRow = __t.row({
  id: __t.u64().primaryKey(),
  roomCode: __t.string().name("room_code"),
  tone: __t.string(),
  text: __t.string(),
  at: __t.u64(),
});
const gameRoomRow = __t.row({
  code: __t.string().primaryKey(),
  host: __t.string(),
  maxPlayers: __t.u32().name("max_players"),
  phase: __t.string(),
  startsAt: __t.u64().name("starts_at"),
  seed: __t.u32(),
  result: __t.string(),
  createdAt: __t.u64().name("created_at"),
});
// the published module tracks seats only; the connection bookkeeping in
// spacetime/src/index.ts is newer than what is deployed
const playerRow = __t.row({
  id: __t.string().primaryKey(),
  roomCode: __t.string().name("room_code"),
  identity: __t.string(),
  name: __t.string(),
  role: __t.string(),
  watching: __t.string(),
  joinedAt: __t.u64().name("joined_at"),
});
const thiefStateRow = __t.row({
  roomCode: __t.string().primaryKey(),
  x: __t.f32(),
  y: __t.f32(),
  z: __t.f32(),
  yaw: __t.f32(),
  area: __t.string(),
  hp: __t.f32(),
  alarm: __t.f32(),
  spotted: __t.bool(),
  keycard: __t.bool(),
  codeFound: __t.bool().name("code_found"),
  vaultOpen: __t.bool().name("vault_open"),
  alarmDisabled: __t.bool().name("alarm_disabled"),
  escaped: __t.bool(),
  loot: __t.u32(),
  score: __t.u32(),
  extra: __t.string(),
  updatedAt: __t.u64().name("updated_at"),
});

const createRoomReducer = {
  code: __t.string(),
  maxPlayers: __t.u32(),
  seed: __t.u32(),
  name: __t.string(),
};
const discoverItemReducer = { code: __t.string(), itemId: __t.string().name("item_id") };
const drawRolesReducer = { code: __t.string() };
const endRunReducer = { code: __t.string(), result: __t.string() };
const joinRoomReducer = { code: __t.string(), name: __t.string() };
const leaveRoomReducer = { code: __t.string() };
const logEventReducer = { code: __t.string(), tone: __t.string(), text: __t.string() };
const publishWorldReducer = {
  code: __t.string(),
  x: __t.f32(),
  y: __t.f32(),
  z: __t.f32(),
  yaw: __t.f32(),
  area: __t.string(),
  hp: __t.f32(),
  alarm: __t.f32(),
  spotted: __t.bool(),
  keycard: __t.bool().name("keycard"),
  codeFound: __t.bool().name("code_found"),
  vaultOpen: __t.bool().name("vault_open"),
  alarmDisabled: __t.bool().name("alarm_disabled"),
  escaped: __t.bool(),
  loot: __t.u32(),
  score: __t.u32(),
  extra: __t.string(),
};
const startRunReducer = { code: __t.string() };

const tablesSchema = __schema({
  discoveredItem: __table(
    {
      name: "discovered_item",
      indexes: [{ accessor: "id", name: "discovered_item_id_idx_btree", algorithm: "btree", columns: ["id"] }],
      constraints: [{ name: "discovered_item_id_key", constraint: "unique", columns: ["id"] }],
    },
    discoveredItemRow,
  ),
  gameEvent: __table(
    {
      name: "game_event",
      indexes: [{ accessor: "id", name: "game_event_id_idx_btree", algorithm: "btree", columns: ["id"] }],
      constraints: [{ name: "game_event_id_key", constraint: "unique", columns: ["id"] }],
    },
    gameEventRow,
  ),
  gameRoom: __table(
    {
      name: "game_room",
      indexes: [{ accessor: "code", name: "game_room_code_idx_btree", algorithm: "btree", columns: ["code"] }],
      constraints: [{ name: "game_room_code_key", constraint: "unique", columns: ["code"] }],
    },
    gameRoomRow,
  ),
  player: __table(
    {
      name: "player",
      indexes: [{ accessor: "id", name: "player_id_idx_btree", algorithm: "btree", columns: ["id"] }],
      constraints: [{ name: "player_id_key", constraint: "unique", columns: ["id"] }],
    },
    playerRow,
  ),
  thiefState: __table(
    {
      name: "thief_state",
      indexes: [{ accessor: "roomCode", name: "thief_state_room_code_idx_btree", algorithm: "btree", columns: ["roomCode"] }],
      constraints: [{ name: "thief_state_room_code_key", constraint: "unique", columns: ["roomCode"] }],
    },
    thiefStateRow,
  ),
});

const reducersSchema = __reducers(
  __reducerSchema("create_room", createRoomReducer),
  __reducerSchema("discover_item", discoverItemReducer),
  __reducerSchema("draw_roles", drawRolesReducer),
  __reducerSchema("end_run", endRunReducer),
  __reducerSchema("join_room", joinRoomReducer),
  __reducerSchema("leave_room", leaveRoomReducer),
  __reducerSchema("log_event", logEventReducer),
  __reducerSchema("publish_world", publishWorldReducer),
  __reducerSchema("start_run", startRunReducer),
);
const proceduresSchema = __procedures();

type SchemaWithAliases = Omit<typeof tablesSchema.schemaType, "tables"> & {
  tables: typeof tablesSchema.schemaType.tables & {
    readonly discovered_item: typeof tablesSchema.schemaType.tables.discoveredItem;
    readonly game_event: typeof tablesSchema.schemaType.tables.gameEvent;
    readonly game_room: typeof tablesSchema.schemaType.tables.gameRoom;
    readonly thief_state: typeof tablesSchema.schemaType.tables.thiefState;
  };
};

const remoteModule = {
  versionInfo: { cliVersion: "2.9.0" as const },
  tables: tablesSchema.schemaType.tables as SchemaWithAliases["tables"],
  reducers: reducersSchema.reducersType.reducers,
  ...proceduresSchema,
} satisfies __RemoteModule<SchemaWithAliases, typeof reducersSchema.reducersType, typeof proceduresSchema>;

export type DbView = __DbConnectionImpl<typeof remoteModule>["db"];

type QueryTables = __QueryBuilder<typeof tablesSchema.schemaType>;

const tableAccessorAliases = {
  discovered_item: "discoveredItem",
  game_event: "gameEvent",
  game_room: "gameRoom",
  thief_state: "thiefState",
} as const;

function withAliases<T extends object>(target: T): T {
  const out = Object.create(Object.getPrototypeOf(target)) as T & Record<string, unknown>;
  Object.defineProperties(out, Object.getOwnPropertyDescriptors(target));
  for (const [deprecated, current] of Object.entries(tableAccessorAliases)) {
    Object.defineProperty(out, deprecated, { enumerable: true, configurable: false, get: () => out[current] });
  }
  return out;
}

export const tables = withAliases(__makeQueryBuilder(tablesSchema.schemaType)) as QueryTables;
export const reducers = __convertToAccessorMap(reducersSchema.reducersType.reducers);
export const procedures = __convertToAccessorMap(proceduresSchema.procedures);

export type EventContext = Omit<__EventContextInterface<typeof remoteModule>, "db"> & { db: DbView };
export type ReducerEventContext = Omit<__ReducerEventContextInterface<typeof remoteModule>, "db"> & { db: DbView };
export type SubscriptionEventContext = Omit<__SubscriptionEventContextInterface<typeof remoteModule>, "db"> & { db: DbView };
export type ErrorContext = Omit<__ErrorContextInterface<typeof remoteModule>, "db"> & { db: DbView };
export type SubscriptionHandle = __SubscriptionHandleImpl<typeof remoteModule>;

export class SubscriptionBuilder extends __SubscriptionBuilderImpl<typeof remoteModule> {}
export class DbConnectionBuilder extends __DbConnectionBuilder<DbConnection> {}

export class DbConnection extends __DbConnectionImpl<typeof remoteModule> {
  declare db: DbView;

  constructor(config: __DbConnectionConfig<typeof remoteModule>) {
    super(config);
    this.db = withAliases(this.db) as DbView;
  }

  static builder = (): DbConnectionBuilder =>
    new DbConnectionBuilder(remoteModule, (config: __DbConnectionConfig<typeof remoteModule>) => new DbConnection(config));

  override subscriptionBuilder = (): SubscriptionBuilder => new SubscriptionBuilder(this);
}
