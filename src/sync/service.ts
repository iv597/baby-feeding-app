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
    updateAllStashItemsWithHouseholdId,
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

export async function verifyDatabaseStructure(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) {
        console.error(
            "Cannot verify database structure - Supabase not configured"
        );
        return;
    }

    try {
        console.log("Verifying database structure...");

        // Check feed_entries table structure
        const { data: feedColumns, error: feedError } = await supabase
            .from("feed_entries")
            .select("*")
            .limit(0);

        if (feedError) {
            console.error("Error checking feed_entries table:", feedError);
        } else {
            console.log("feed_entries table accessible");
        }

        // Check babies table structure
        const { data: babyColumns, error: babyError } = await supabase
            .from("babies")
            .select("*")
            .limit(0);

        if (babyError) {
            console.error("Error checking babies table:", babyError);
        } else {
            console.log("babies table accessible");
        }

        // Try to get table info (this might not work with all Supabase setups)
        try {
            const { data: tableInfo, error: tableError } = await supabase.rpc(
                "get_table_info",
                { table_name: "feed_entries" }
            );

            if (tableError) {
                console.log(
                    "Could not get detailed table info (this is normal)"
                );
            } else {
                console.log("Table info:", tableInfo);
            }
        } catch (e) {
            console.log("RPC call not available (this is normal)");
        }
    } catch (error) {
        console.error("Database structure verification failed:", error);
    }
}

export async function syncNow(): Promise<{ pushed: number; pulled: number }> {
    const supabase = getSupabase();
    const householdId = await getHouseholdId();

    console.log("Starting sync with:", {
        hasSupabase: !!supabase,
        householdId,
    });

    if (!supabase || !householdId) {
        console.log("Sync skipped - missing supabase client or householdId");
        return { pushed: 0, pulled: 0 };
    }

    try {
        // Verify database structure first
        await verifyDatabaseStructure();

        // Update all existing babies with householdId if they don't have one
        await updateAllBabiesWithHouseholdId(householdId);

        // Update all existing feed entries with householdId if they don't have one
        await updateAllFeedsWithHouseholdId(householdId);

        // Update all existing stash items with householdId if they don't have one
        await updateAllStashItemsWithHouseholdId(householdId);

        const since = await getLastSyncAt();
        console.log("Last sync was at:", new Date(since).toISOString());

        let pushed = 0;
        let pulled = 0;

        // Push babies
        const localBabies = await getLocalBabiesChangedSince(since);
        console.log("Local babies to sync:", localBabies.length);

        for (const b of localBabies) {
            // Skip babies without householdId (they can't be synced yet)
            if (!b.householdId) {
                console.log("Skipping baby without householdId:", b);
                continue;
            }

            try {
                const { error } = await supabase.from("babies").upsert({
                    id: b.uuid,
                    householdId: b.householdId,
                    name: b.name,
                    birthdate: b.birthdate,
                    updatedAt: b.updatedAt,
                    deleted: !!b.deleted,
                });

                if (error) {
                    console.error("Error upserting baby:", error, b);
                } else {
                    pushed += 1;
                    console.log("Successfully synced baby:", b.name);
                }
            } catch (error) {
                console.error("Exception upserting baby:", error, b);
            }
        }

        // Push feeds
        const localFeeds = await getLocalFeedsChangedSince(since);
        console.log("Local feeds to sync:", localFeeds.length);

        for (const f of localFeeds) {
            // Skip feeds without householdId (they can't be synced yet)
            if (!f.householdId) {
                console.log("Skipping feed without householdId:", f);
                continue;
            }

            try {
                const feedData = {
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
                };

                console.log(
                    "Sending feed data to Supabase:",
                    JSON.stringify(feedData, null, 2)
                );

                const { error } = await supabase
                    .from("feed_entries")
                    .upsert(feedData);

                if (error) {
                    console.error("Error upserting feed:", error, f);
                    console.error("Feed data that failed:", feedData);
                } else {
                    pushed += 1;
                    console.log("Successfully synced feed:", f.type);
                }
            } catch (error) {
                console.error("Exception upserting feed:", error, f);
            }
        }

        // Pull babies
        const { data: remoteBabies, error: pullBabiesError } = await supabase
            .from("babies")
            .select("id,name,birthdate,updatedAt,deleted")
            .eq("householdId", householdId)
            .gt("updatedAt", since);

        if (pullBabiesError) {
            console.error("Error pulling babies:", pullBabiesError);
        } else if (remoteBabies) {
            console.log("Remote babies to pull:", remoteBabies.length);
            for (const b of remoteBabies as any[]) {
                try {
                    await upsertBabyFromRemote(
                        b.id,
                        b.name,
                        b.birthdate,
                        b.updatedAt,
                        b.deleted
                    );
                    pulled += 1;
                    console.log("Successfully pulled baby:", b.name);
                } catch (error) {
                    console.error("Error upserting remote baby:", error, b);
                }
            }
        }

        // Pull feeds
        const { data: remoteFeeds, error: pullFeedsError } = await supabase
            .from("feed_entries")
            .select(
                "id,babyId,type,createdAt,quantityMl,durationMin,side,foodName,foodAmountGrams,notes,updatedAt,deleted"
            )
            .eq("householdId", householdId)
            .gt("updatedAt", since);

        if (pullFeedsError) {
            console.error("Error pulling feeds:", pullFeedsError);
        } else if (remoteFeeds) {
            console.log("Remote feeds to pull:", remoteFeeds.length);
            for (const f of remoteFeeds as any[]) {
                try {
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
                    console.log("Successfully pulled feed:", f.type);
                } catch (error) {
                    console.error("Error upserting remote feed:", error, f);
                }
            }
        }

        await setLastSyncAt(nowMs());
        console.log(
            "Sync completed successfully. Pushed:",
            pushed,
            "Pulled:",
            pulled
        );
        return { pushed, pulled };
    } catch (error) {
        console.error("Sync failed with exception:", error);
        throw error;
    }
}
