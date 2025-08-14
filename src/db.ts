import * as SQLite from "expo-sqlite";
import { BabyProfile, FeedEntry, ThemeMode, StashItem } from "./types";
import { generateId, nowMs } from "./utils";
import { Platform } from "react-native";

// Lazily open the database. Use async DB on web to avoid SharedArrayBuffer requirements.
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
async function getDb(): Promise<SQLite.SQLiteDatabase> {
    if (_dbPromise) return _dbPromise;
    if (Platform.OS === "web") {
        _dbPromise = SQLite.openDatabaseAsync("baby_feed.db");
    } else {
        _dbPromise = Promise.resolve(SQLite.openDatabaseSync("baby_feed.db"));
    }
    return _dbPromise;
}

async function columnExists(table: string, column: string): Promise<boolean> {
    const db = await getDb();
    const info = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${table})`
    );
    return info.some((r) => r.name === column);
}

export async function initializeDatabase(): Promise<void> {
    const db = await getDb();
    await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS babies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      name TEXT NOT NULL,
      birthdate INTEGER,
      gender TEXT,
      householdId TEXT,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS feed_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      babyId INTEGER,
      householdId TEXT,
      type TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      quantityMl REAL,
      durationMin REAL,
      side TEXT,
      foodName TEXT,
      foodAmountGrams REAL,
      notes TEXT,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_feed_entries_createdAt ON feed_entries(createdAt);

    CREATE TABLE IF NOT EXISTS stash_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      babyId INTEGER NOT NULL,
      householdId TEXT,
      createdAt INTEGER NOT NULL,
      volumeMl REAL NOT NULL,
      expiresAt INTEGER,
      status TEXT NOT NULL DEFAULT 'stored',
      notes TEXT,
      updatedAt INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_stash_items_baby ON stash_items(babyId);

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      activeBabyId INTEGER,
      theme TEXT NOT NULL DEFAULT 'light',
      householdId TEXT,
      deviceId TEXT,
      lastSyncAt INTEGER,
      feedReminderEnabled INTEGER NOT NULL DEFAULT 0,
      feedReminderMinutes INTEGER NOT NULL DEFAULT 180
    );
  `);
    // Migrations
    if (!(await columnExists("feed_entries", "babyId"))) {
        await db.execAsync(
            `ALTER TABLE feed_entries ADD COLUMN babyId INTEGER`
        );
    }
    if (!(await columnExists("feed_entries", "uuid"))) {
        await db.execAsync(
            `ALTER TABLE feed_entries ADD COLUMN uuid TEXT UNIQUE`
        );
    }
    if (!(await columnExists("feed_entries", "updatedAt"))) {
        await db.execAsync(
            `ALTER TABLE feed_entries ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0`
        );
    }
    if (!(await columnExists("feed_entries", "deleted"))) {
        await db.execAsync(
            `ALTER TABLE feed_entries ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`
        );
    }
    if (!(await columnExists("babies", "uuid"))) {
        await db.execAsync(`ALTER TABLE babies ADD COLUMN uuid TEXT UNIQUE`);
    }
    if (!(await columnExists("babies", "updatedAt"))) {
        await db.execAsync(
            `ALTER TABLE babies ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0`
        );
    }
    if (!(await columnExists("babies", "deleted"))) {
        await db.execAsync(
            `ALTER TABLE babies ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`
        );
    }
    if (!(await columnExists("babies", "householdId"))) {
        await db.execAsync(`ALTER TABLE babies ADD COLUMN householdId TEXT`);
    }
    if (!(await columnExists("feed_entries", "householdId"))) {
        await db.execAsync(
            `ALTER TABLE feed_entries ADD COLUMN householdId TEXT`
        );
    }
    if (!(await columnExists("stash_items", "householdId"))) {
        await db.execAsync(
            `ALTER TABLE stash_items ADD COLUMN householdId TEXT`
        );
    }
    if (!(await columnExists("app_settings", "householdId"))) {
        await db.execAsync(
            `ALTER TABLE app_settings ADD COLUMN householdId TEXT`
        );
    }
    if (!(await columnExists("app_settings", "deviceId"))) {
        await db.execAsync(`ALTER TABLE app_settings ADD COLUMN deviceId TEXT`);
    }
    if (!(await columnExists("app_settings", "lastSyncAt"))) {
        await db.execAsync(
            `ALTER TABLE app_settings ADD COLUMN lastSyncAt INTEGER`
        );
    }
    if (!(await columnExists("app_settings", "feedReminderEnabled"))) {
        await db.execAsync(
            `ALTER TABLE app_settings ADD COLUMN feedReminderEnabled INTEGER NOT NULL DEFAULT 0`
        );
    }
    if (!(await columnExists("app_settings", "feedReminderMinutes"))) {
        await db.execAsync(
            `ALTER TABLE app_settings ADD COLUMN feedReminderMinutes INTEGER NOT NULL DEFAULT 180`
        );
    }
    if (!(await columnExists("babies", "gender"))) {
        await db.execAsync(`ALTER TABLE babies ADD COLUMN gender TEXT`);
    }
    // Ensure settings row exists
    const row = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM app_settings WHERE id = 1`
    );
    if (!row) {
        await db.runAsync(
            `INSERT INTO app_settings (id, activeBabyId, theme) VALUES (1, NULL, 'light')`
        );
    }
}

// Cloud/settings helpers
export async function getHouseholdId(): Promise<string | null> {
    const db = await getDb();
    const s = await db.getFirstAsync<{ householdId: string | null }>(
        `SELECT householdId FROM app_settings WHERE id = 1`
    );
    return s?.householdId ?? null;
}
export async function setHouseholdId(
    householdId: string | null
): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE app_settings SET householdId = ? WHERE id = 1`, [
        householdId,
    ]);

    // If setting a householdId, update all existing babies, feeds, and stash items that don't have one
    if (householdId) {
        await updateAllBabiesWithHouseholdId(householdId);
        await updateAllFeedsWithHouseholdId(householdId);
        await updateAllStashItemsWithHouseholdId(householdId);
    }
}
export async function getDeviceId(): Promise<string | null> {
    const db = await getDb();
    const s = await db.getFirstAsync<{ deviceId: string | null }>(
        `SELECT deviceId FROM app_settings WHERE id = 1`
    );
    return s?.deviceId ?? null;
}
export async function ensureDeviceId(): Promise<string> {
    const db = await getDb();
    let id = await getDeviceId();
    if (!id) {
        id = generateId("dev_");
        await db.runAsync(`UPDATE app_settings SET deviceId = ? WHERE id = 1`, [
            id,
        ]);
    }
    return id;
}
export async function getLastSyncAt(): Promise<number> {
    const db = await getDb();
    const s = await db.getFirstAsync<{ lastSyncAt: number | null }>(
        `SELECT lastSyncAt FROM app_settings WHERE id = 1`
    );
    return s?.lastSyncAt ?? 0;
}
export async function setLastSyncAt(ts: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE app_settings SET lastSyncAt = ? WHERE id = 1`, [
        ts,
    ]);
}
export async function getActiveBabyId(): Promise<number | null> {
    const db = await getDb();
    const s = await db.getFirstAsync<{ activeBabyId: number | null }>(
        `SELECT activeBabyId FROM app_settings WHERE id = 1`
    );
    return s?.activeBabyId ?? null;
}
export async function setActiveBabyId(babyId: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE app_settings SET activeBabyId = ? WHERE id = 1`, [
        babyId,
    ]);
}
export async function getThemeMode(): Promise<ThemeMode> {
    const db = await getDb();
    const s = await db.getFirstAsync<{ theme: string }>(
        `SELECT theme FROM app_settings WHERE id = 1`
    );
    return (s?.theme as ThemeMode) ?? "light";
}
export async function setThemeMode(theme: ThemeMode): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE app_settings SET theme = ? WHERE id = 1`, [
        theme,
    ]);
}

// Reminder settings
export async function getFeedReminderSettings(): Promise<{
    enabled: boolean;
    minutes: number;
}> {
    const db = await getDb();
    const s = await db.getFirstAsync<{
        feedReminderEnabled: number;
        feedReminderMinutes: number;
    }>(
        `SELECT feedReminderEnabled, feedReminderMinutes FROM app_settings WHERE id = 1`
    );
    return {
        enabled: !!(s?.feedReminderEnabled ?? 0),
        minutes: s?.feedReminderMinutes ?? 180,
    };
}
export async function setFeedReminderEnabled(enabled: boolean): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE app_settings SET feedReminderEnabled = ? WHERE id = 1`,
        [enabled ? 1 : 0]
    );
}
export async function setFeedReminderMinutes(minutes: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE app_settings SET feedReminderMinutes = ? WHERE id = 1`,
        [minutes]
    );
}

// Babies
export async function createBaby(baby: BabyProfile): Promise<number> {
    const db = await getDb();
    const now = nowMs();
    const uuid = generateId("b_");

    // Get or create a household ID
    let householdId = await getHouseholdId();
    if (!householdId) {
        // Create a default household if none exists
        householdId = generateId("hh_");

        // Check if app_settings row exists
        const existingRow = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM app_settings WHERE id = 1`
        );
        if (existingRow) {
            await db.runAsync(
                `UPDATE app_settings SET householdId = ? WHERE id = 1`,
                [householdId]
            );
        } else {
            await db.runAsync(
                `INSERT INTO app_settings (id, activeBabyId, theme, householdId) VALUES (1, NULL, 'light', ?)`,
                [householdId]
            );
        }
    }

    const res = await db.runAsync(
        `INSERT INTO babies (uuid, name, birthdate, gender, householdId, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
            uuid,
            baby.name,
            baby.birthdate ?? null,
            baby.gender ?? null,
            householdId,
            now,
        ]
    );
    return res.lastInsertRowId as number;
}

export async function listBabies(): Promise<BabyProfile[]> {
    const db = await getDb();
    return db.getAllAsync<BabyProfile>(
        `SELECT id, name, birthdate, gender, householdId FROM babies WHERE deleted = 0 ORDER BY id ASC`
    );
}

export async function getBabyUuid(localId: number): Promise<string | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<{ uuid: string | null }>(
        `SELECT uuid FROM babies WHERE id = ?`,
        [localId]
    );
    return r?.uuid ?? null;
}

export async function upsertBabyFromRemote(
    uuid: string,
    name: string,
    birthdate: number | null,
    gender: string | null,
    updatedAt: number,
    deleted: boolean
): Promise<number> {
    const db = await getDb();
    const existing = await db.getFirstAsync<{ id: number; updatedAt: number }>(
        `SELECT id, updatedAt FROM babies WHERE uuid = ?`,
        [uuid]
    );
    if (existing && existing.updatedAt >= updatedAt) return existing.id;

    // Get or create a household ID
    let householdId = await getHouseholdId();
    if (!householdId) {
        // Create a default household if none exists
        householdId = generateId("hh_");

        // Check if app_settings row exists
        const existingRow = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM app_settings WHERE id = 1`
        );
        if (existingRow) {
            await db.runAsync(
                `UPDATE app_settings SET householdId = ? WHERE id = 1`,
                [householdId]
            );
        } else {
            await db.runAsync(
                `INSERT INTO app_settings (id, activeBabyId, theme, householdId) VALUES (1, NULL, 'light', ?)`,
                [householdId]
            );
        }
    }

    if (existing) {
        await db.runAsync(
            `UPDATE babies SET name = ?, birthdate = ?, gender = ?, householdId = ?, updatedAt = ?, deleted = ? WHERE id = ?`,
            [
                name,
                birthdate,
                gender,
                householdId,
                updatedAt,
                deleted ? 1 : 0,
                existing.id,
            ]
        );
        return existing.id;
    } else {
        const res = await db.runAsync(
            `INSERT INTO babies (uuid, name, birthdate, gender, householdId, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                uuid,
                name,
                birthdate,
                gender,
                householdId,
                updatedAt,
                deleted ? 1 : 0,
            ]
        );
        return res.lastInsertRowId as number;
    }
}

export async function getBabyByUuid(
    uuid: string
): Promise<{ id: number; householdId: string | null } | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<{
        id: number;
        householdId: string | null;
    }>(`SELECT id, householdId FROM babies WHERE uuid = ?`, [uuid]);
    return r || null;
}

export async function updateBaby(
    id: number,
    updates: Partial<BabyProfile>
): Promise<void> {
    const db = await getDb();
    const now = nowMs();

    await db.runAsync(
        `UPDATE babies SET name = ?, birthdate = ?, gender = ?, updatedAt = ? WHERE id = ?`,
        [
            updates.name || null,
            updates.birthdate || null,
            updates.gender || null,
            now,
            id,
        ]
    );
}

export async function softDeleteBaby(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE babies SET deleted = 1, updatedAt = ? WHERE id = ?`,
        [nowMs(), id]
    );
}

export async function updateBabyHouseholdId(
    babyId: number,
    householdId: string
): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE babies SET householdId = ?, updatedAt = ? WHERE id = ?`,
        [householdId, nowMs(), babyId]
    );
}

export async function updateAllBabiesWithHouseholdId(
    householdId: string
): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE babies SET householdId = ?, updatedAt = ? WHERE householdId IS NULL`,
        [householdId, nowMs()]
    );
}

export async function updateAllFeedsWithHouseholdId(
    householdId: string
): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE feed_entries SET householdId = ?, updatedAt = ? WHERE householdId IS NULL`,
        [householdId, nowMs()]
    );
}

export async function updateAllStashItemsWithHouseholdId(
    householdId: string
): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE stash_items SET householdId = ?, updatedAt = ? WHERE householdId IS NULL`,
        [householdId, nowMs()]
    );
}

export async function getLocalBabiesChangedSince(since: number): Promise<
    Array<{
        uuid: string;
        name: string;
        birthdate: number | null;
        gender: string | null;
        householdId: string | null;
        updatedAt: number;
        deleted: number;
    }>
> {
    const db = await getDb();
    return db.getAllAsync<any>(
        `SELECT uuid, name, birthdate, gender, householdId, updatedAt, deleted FROM babies WHERE updatedAt > ?`,
        [since]
    );
}

// Feeds
export async function insertFeed(entry: FeedEntry): Promise<number> {
    const db = await getDb();

    // Get or create a household ID
    let householdId = await getHouseholdId();
    if (!householdId) {
        // Create a default household if none exists
        householdId = generateId("hh_");

        // Check if app_settings row exists
        const existingRow = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM app_settings WHERE id = 1`
        );
        if (existingRow) {
            await db.runAsync(
                `UPDATE app_settings SET householdId = ? WHERE id = 1`,
                [householdId]
            );
        } else {
            await db.runAsync(
                `INSERT INTO app_settings (id, activeBabyId, theme, householdId) VALUES (1, NULL, 'light', ?)`,
                [householdId]
            );
        }
    }

    const result = await db.runAsync(
        `INSERT INTO feed_entries (uuid, babyId, householdId, type, createdAt, quantityMl, durationMin, side, foodName, foodAmountGrams, notes, updatedAt, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
            generateId("f_"),
            entry.babyId,
            householdId,
            entry.type,
            entry.createdAt,
            entry.quantityMl ?? null,
            entry.durationMin ?? null,
            entry.side ?? null,
            entry.foodName ?? null,
            entry.foodAmountGrams ?? null,
            entry.notes ?? null,
            nowMs(),
        ]
    );
    return result.lastInsertRowId as number;
}

export async function updateFeed(entry: FeedEntry): Promise<void> {
    const db = await getDb();
    if (!entry.id) throw new Error("updateFeed requires entry.id");
    await db.runAsync(
        `UPDATE feed_entries
     SET babyId = ?, type = ?, createdAt = ?, quantityMl = ?, durationMin = ?, side = ?, foodName = ?, foodAmountGrams = ?, notes = ?, updatedAt = ?
     WHERE id = ?`,
        [
            entry.babyId,
            entry.type,
            entry.createdAt,
            entry.quantityMl ?? null,
            entry.durationMin ?? null,
            entry.side ?? null,
            entry.foodName ?? null,
            entry.foodAmountGrams ?? null,
            entry.notes ?? null,
            nowMs(),
            entry.id,
        ]
    );
}

export async function softDeleteFeed(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE feed_entries SET deleted = 1, updatedAt = ? WHERE id = ?`,
        [nowMs(), id]
    );
}

export async function deleteFeed(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(`DELETE FROM feed_entries WHERE id = ?`, [id]);
}

export async function getFeedsBetween(
    babyId: number,
    startMs: number,
    endMs: number
): Promise<FeedEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<FeedEntry>(
        `SELECT id, babyId, type, createdAt, quantityMl, durationMin, side, foodName, foodAmountGrams, notes
     FROM feed_entries
     WHERE deleted = 0 AND babyId = ? AND createdAt BETWEEN ? AND ?
     ORDER BY createdAt DESC`,
        [babyId, startMs, endMs]
    );
    return rows;
}

export async function getRecentFeeds(
    babyId: number,
    limit: number = 50
): Promise<FeedEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<FeedEntry>(
        `SELECT id, babyId, type, createdAt, quantityMl, durationMin, side, foodName, foodAmountGrams, notes
     FROM feed_entries
     WHERE deleted = 0 AND babyId = ?
     ORDER BY createdAt DESC
     LIMIT ?`,
        [babyId, limit]
    );
    return rows;
}

export async function getFeedUuid(localId: number): Promise<string | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<{ uuid: string | null }>(
        `SELECT uuid FROM feed_entries WHERE id = ?`,
        [localId]
    );
    return r?.uuid ?? null;
}

export async function upsertFeedFromRemote(fields: {
    uuid: string;
    babyUuid: string;
    type: string;
    createdAt: number;
    quantityMl: number | null;
    durationMin: number | null;
    side: string | null;
    foodName: string | null;
    foodAmountGrams: number | null;
    notes: string | null;
    updatedAt: number;
    deleted: boolean;
}): Promise<number> {
    const db = await getDb();

    // Get or create a household ID
    let householdId = await getHouseholdId();
    if (!householdId) {
        // Create a default household if none exists
        householdId = generateId("hh_");

        // Check if app_settings row exists
        const existingRow = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM app_settings WHERE id = 1`
        );
        if (existingRow) {
            await db.runAsync(
                `UPDATE app_settings SET householdId = ? WHERE id = 1`,
                [householdId]
            );
        } else {
            await db.runAsync(
                `INSERT INTO app_settings (id, activeBabyId, theme, householdId) VALUES (1, NULL, 'light', ?)`,
                [householdId]
            );
        }
    }

    // Map babyUuid to local baby id (create stub if missing)
    const baby = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM babies WHERE uuid = ?`,
        [fields.babyUuid]
    );
    let localBabyId = baby?.id;
    if (!localBabyId) {
        const res = await db.runAsync(
            `INSERT INTO babies (uuid, name, birthdate, householdId, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, 0)`,
            [fields.babyUuid, "Baby", null, householdId, nowMs()]
        );
        localBabyId = res.lastInsertRowId as number;
    }

    const existing = await db.getFirstAsync<{ id: number; updatedAt: number }>(
        `SELECT id, updatedAt FROM feed_entries WHERE uuid = ?`,
        [fields.uuid]
    );
    if (existing && existing.updatedAt >= fields.updatedAt) return existing.id;
    if (existing) {
        await db.runAsync(
            `UPDATE feed_entries SET babyId = ?, householdId = ?, type = ?, createdAt = ?, quantityMl = ?, durationMin = ?, side = ?, foodName = ?, foodAmountGrams = ?, notes = ?, updatedAt = ?, deleted = ? WHERE id = ?`,
            [
                localBabyId,
                householdId,
                fields.type,
                fields.createdAt,
                fields.quantityMl,
                fields.durationMin,
                fields.side,
                fields.foodName,
                fields.foodAmountGrams,
                fields.notes,
                fields.updatedAt,
                fields.deleted ? 1 : 0,
                existing.id,
            ]
        );
        return existing.id;
    } else {
        const res = await db.runAsync(
            `INSERT INTO feed_entries (uuid, babyId, householdId, type, createdAt, quantityMl, durationMin, side, foodName, foodAmountGrams, notes, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fields.uuid,
                localBabyId,
                householdId,
                fields.type,
                fields.createdAt,
                fields.quantityMl,
                fields.durationMin,
                fields.side,
                fields.foodName,
                fields.foodAmountGrams,
                fields.notes,
                fields.updatedAt,
                fields.deleted ? 1 : 0,
            ]
        );
        return res.lastInsertRowId as number;
    }
}

export async function getLocalFeedsChangedSince(since: number): Promise<
    Array<{
        uuid: string;
        babyUuid: string;
        type: string;
        createdAt: number;
        quantityMl: number | null;
        durationMin: number | null;
        side: string | null;
        foodName: string | null;
        foodAmountGrams: number | null;
        notes: string | null;
        updatedAt: number;
        deleted: number;
        householdId: string | null;
    }>
> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
        `SELECT f.uuid as uuid, b.uuid as babyUuid, f.type, f.createdAt, f.quantityMl, f.durationMin, f.side, f.foodName, f.foodAmountGrams, f.notes, f.updatedAt, f.deleted, f.householdId
     FROM feed_entries f
     JOIN babies b ON b.id = f.babyId
     WHERE f.updatedAt > ?`,
        [since]
    );
    return rows;
}

// Stash
export async function addToStash(item: Omit<StashItem, "id">): Promise<number> {
    const db = await getDb();

    // Get or create a household ID
    let householdId = await getHouseholdId();
    if (!householdId) {
        // Create a default household if none exists
        householdId = generateId("hh_");

        // Check if app_settings row exists
        const existingRow = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM app_settings WHERE id = 1`
        );
        if (existingRow) {
            await db.runAsync(
                `UPDATE app_settings SET householdId = ? WHERE id = 1`,
                [householdId]
            );
        } else {
            await db.runAsync(
                `INSERT INTO app_settings (id, activeBabyId, theme, householdId) VALUES (1, NULL, 'light', ?)`,
                [householdId]
            );
        }
    }

    const res = await db.runAsync(
        `INSERT INTO stash_items (uuid, babyId, householdId, createdAt, volumeMl, expiresAt, status, notes, updatedAt, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
            generateId("s_"),
            item.babyId,
            householdId,
            item.createdAt,
            item.volumeMl,
            item.expiresAt ?? null,
            item.status,
            item.notes ?? null,
            nowMs(),
        ]
    );
    return res.lastInsertRowId as number;
}

export async function listStash(babyId: number): Promise<StashItem[]> {
    const db = await getDb();
    return db.getAllAsync<StashItem>(
        `SELECT id, babyId, householdId, createdAt, volumeMl, expiresAt, status, notes FROM stash_items WHERE deleted = 0 AND babyId = ? ORDER BY createdAt DESC`,
        [babyId]
    );
}

export async function updateStashStatus(
    id: number,
    status: StashItem["status"]
): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE stash_items SET status = ?, updatedAt = ? WHERE id = ?`,
        [status, nowMs(), id]
    );
}

export async function deleteStash(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(
        `UPDATE stash_items SET deleted = 1, updatedAt = ? WHERE id = ?`,
        [nowMs(), id]
    );
}
