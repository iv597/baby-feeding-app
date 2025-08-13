import { getSupabase } from "./supabase";
import {
    ensureDeviceId,
    getHouseholdId,
    setHouseholdId,
    getLastSyncAt,
    setLastSyncAt,
    getLocalBabiesChangedSince,
    getLocalFeedsChangedSince,
    upsertBabyFromRemote,
    upsertFeedFromRemote,
    updateBabyHouseholdId,
    getBabyByUuid,
    updateAllBabiesWithHouseholdId,
    updateAllFeedsWithHouseholdId,
} from "../db";
import { generateId, nowMs } from "../utils";

export async function isCloudConfigured(): Promise<boolean> {
    return !!getSupabase();
}

export async function getOrCreateDevice(): Promise<string> {
    return ensureDeviceId();
}

export async function getCurrentHousehold(): Promise<string | null> {
    return getHouseholdId();
}

export async function createHousehold(): Promise<string> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase not configured");
    const householdId = generateId("hh_");
    const deviceId = await ensureDeviceId();
    await supabase.from("households").insert({ id: householdId });
    await supabase
        .from("members")
        .insert({ id: generateId("mem_"), householdId, deviceId });
    await setHouseholdId(householdId);
    return householdId;
}

export async function joinHousehold(householdId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase not configured");
    const deviceId = await ensureDeviceId();
    const { data: hh, error } = await supabase
        .from("households")
        .select("id")
        .eq("id", householdId)
        .maybeSingle();
    if (error || !hh) throw new Error("Household not found");
    await supabase
        .from("members")
        .insert({ id: generateId("mem_"), householdId, deviceId });
    await setHouseholdId(householdId);
}

export async function syncNow(): Promise<{ pushed: number; pulled: number }> {
    const supabase = getSupabase();
    const householdId = await getHouseholdId();
    if (!supabase || !householdId) return { pushed: 0, pulled: 0 };

    // Update all existing babies with householdId if they don't have one
    await updateAllBabiesWithHouseholdId(householdId);

    // Update all existing feed entries with householdId if they don't have one
    await updateAllFeedsWithHouseholdId(householdId);

    const since = await getLastSyncAt();
    let pushed = 0;
    let pulled = 0;

    // Push babies
    const localBabies = await getLocalBabiesChangedSince(since);
    for (const b of localBabies) {
        // Skip babies without householdId (they can't be synced yet)
        if (!b.householdId) continue;

        await supabase.from("babies").upsert({
            id: b.uuid,
            householdId: b.householdId,
            name: b.name,
            birthdate: b.birthdate,
            updatedAt: b.updatedAt,
            deleted: !!b.deleted,
        });
        pushed += 1;
    }

    // Push feeds
    const localFeeds = await getLocalFeedsChangedSince(since);
    for (const f of localFeeds) {
        // Skip feeds without householdId (they can't be synced yet)
        if (!f.householdId) continue;

        await supabase.from("feed_entries").upsert({
            id: f.uuid,
            householdId: f.householdId,
            babyId: f.babyUuid,
            type: f.type,
            createdAt: f.createdAt,
            quantityMl: f.quantityMl,
            durationMin: f.durationMin,
            side: f.side,
            foodName: f.foodName,
            foodAmountGrams: f.foodAmountGrams,
            notes: f.notes,
            updatedAt: f.updatedAt,
            deleted: !!f.deleted,
        });
        pushed += 1;
    }

    // Pull babies
    const { data: remoteBabies } = await supabase
        .from("babies")
        .select("id,name,birthdate,updatedAt,deleted")
        .eq("householdId", householdId)
        .gt("updatedAt", since);

    if (remoteBabies) {
        for (const b of remoteBabies as any[]) {
            await upsertBabyFromRemote(
                b.id,
                b.name,
                b.birthdate,
                b.updatedAt,
                b.deleted
            );
            pulled += 1;
        }
    }

    // Pull feeds
    const { data: remoteFeeds } = await supabase
        .from("feed_entries")
        .select(
            "id,babyId,type,createdAt,quantityMl,durationMin,side,foodName,foodAmountGrams,notes,updatedAt,deleted"
        )
        .eq("householdId", householdId)
        .gt("updatedAt", since);

    if (remoteFeeds) {
        for (const f of remoteFeeds as any[]) {
            await upsertFeedFromRemote({
                uuid: f.id,
                babyUuid: f.babyId,
                type: f.type,
                createdAt: f.createdAt,
                quantityMl: f.quantityMl,
                durationMin: f.durationMin,
                side: f.side,
                foodName: f.foodName,
                foodAmountGrams: f.foodAmountGrams,
                notes: f.notes,
                updatedAt: f.updatedAt,
                deleted: f.deleted,
            });
            pulled += 1;
        }
    }

    await setLastSyncAt(nowMs());
    return { pushed, pulled };
}
