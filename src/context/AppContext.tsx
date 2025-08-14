import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    createBaby,
    getActiveBabyId,
    getThemeMode,
    initializeDatabase,
    listBabies,
    setActiveBabyId,
    setThemeMode,
    getHouseholdId,
    softDeleteBaby,
} from "../db";
import { BabyProfile, ThemeMode, Gender } from "../types";
import { createHousehold, joinHousehold, syncNow } from "../sync/service";
import { AppState } from "react-native";

interface AppContextValue {
    babies: BabyProfile[];
    activeBabyId?: number; // Keep for backward compatibility
    activeBabyIds: number[]; // New: array of active baby IDs
    themeMode: ThemeMode;
    loading: boolean;
    householdId?: string | null;
    syncStatus: "idle" | "syncing" | "error";
    addBaby: (
        name: string,
        birthdate?: number | null,
        gender?: Gender | null
    ) => Promise<void>;
    deleteBaby: (babyId: number) => Promise<void>; // New: soft delete baby
    selectBaby: (babyId: number) => Promise<void>;
    toggleBabySelection: (babyId: number) => Promise<void>; // New: toggle baby selection
    selectMultipleBabies: (babyIds: number[]) => Promise<void>; // New: select multiple babies
    setTheme: (mode: ThemeMode) => Promise<void>;
    createCloudHousehold: () => Promise<string>;
    joinCloudHousehold: (code: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [babies, setBabies] = useState<BabyProfile[]>([]);
    const [activeBabyId, setActive] = useState<number | undefined>(undefined);
    const [activeBabyIds, setActiveBabyIds] = useState<number[]>([]); // New: array of active baby IDs
    const [themeMode, setThemeState] = useState<ThemeMode>("light");
    const [householdId, setHousehold] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">(
        "idle"
    );

    const refreshBabies = useCallback(async () => {
        const list = await listBabies();
        setBabies(list);
        return list;
    }, []);

    useEffect(() => {
        (async () => {
            await initializeDatabase();
            setHousehold(await getHouseholdId());
            const mode = await getThemeMode();
            setThemeState(mode);
            let active = await getActiveBabyId();
            let list = await refreshBabies();
            if (!list.length) {
                const defaultId = await createBaby({
                    name: "Baby",
                    birthdate: null,
                });
                await setActiveBabyId(defaultId);
                list = await refreshBabies();
                active = defaultId;
            }
            if (!active && list.length) {
                await setActiveBabyId(list[0].id!);
                active = list[0].id!;
            }
            setActive(active ?? undefined);
            setActiveBabyIds(active ? [active] : []); // Initialize the array
            setLoading(false);
        })();
    }, [refreshBabies]);

    // Automatic background sync every 10 minutes
    useEffect(() => {
        const autoSyncInterval = setInterval(async () => {
            try {
                console.log("Running automatic background sync...");
                await syncNow();
                console.log("Automatic background sync completed");
                setSyncStatus("idle");
            } catch (error) {
                console.warn("Automatic background sync failed:", error);
                setSyncStatus("error");
            }
        }, 10 * 60 * 1000); // Sync every 10 minutes

        return () => clearInterval(autoSyncInterval);
    }, []);

    // Sync when app becomes active
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === "active") {
                // App became active, sync data
                console.log("App became active, syncing data...");
                syncNow().catch((error) => {
                    console.warn("Sync on app activation failed:", error);
                    setSyncStatus("error");
                });
            }
        };

        const subscription = AppState.addEventListener(
            "change",
            handleAppStateChange
        );
        return () => subscription?.remove();
    }, []);

    const addBaby = useCallback(
        async (
            name: string,
            birthdate?: number | null,
            gender?: Gender | null
        ) => {
            const id = await createBaby({
                name,
                birthdate: birthdate ?? null,
                gender: gender ?? null,
            });
            await refreshBabies();
            await setActiveBabyId(id);
            setActive(id);

            // Add newly created baby to active babies list
            setActiveBabyIds((prev) => {
                if (!prev.includes(id)) {
                    return [...prev, id];
                }
                return prev;
            });

            // Auto-sync after creating a baby
            try {
                setSyncStatus("syncing");
                await syncNow();
                setSyncStatus("idle");
            } catch (error) {
                console.warn("Auto-sync failed after creating baby:", error);
                setSyncStatus("error");
            }
        },
        [refreshBabies, syncNow]
    );

    const deleteBaby = useCallback(
        async (babyId: number) => {
            await softDeleteBaby(babyId);
            const updatedBabies = await refreshBabies();

            // If the deleted baby was the active baby, select another one
            if (activeBabyId === babyId) {
                if (updatedBabies.length > 0) {
                    const newActiveBabyId = updatedBabies[0].id!;
                    await setActiveBabyId(newActiveBabyId);
                    setActive(newActiveBabyId);
                    setActiveBabyIds([newActiveBabyId]);
                } else {
                    setActive(undefined);
                    setActiveBabyIds([]);
                }
            }

            // Remove from active baby IDs if it was there
            setActiveBabyIds((prev) => prev.filter((id) => id !== babyId));

            // Auto-sync after deleting baby
            try {
                setSyncStatus("syncing");
                await syncNow();
                setSyncStatus("idle");
            } catch (error) {
                console.warn("Auto-sync failed after deleting baby:", error);
                setSyncStatus("error");
            }
        },
        [refreshBabies, activeBabyId, syncNow]
    );

    const selectBaby = useCallback(async (babyId: number) => {
        await setActiveBabyId(babyId);
        setActive(babyId);
        setActiveBabyIds([babyId]); // Update the array as well
    }, []);

    const toggleBabySelection = useCallback(
        async (babyId: number) => {
            const newActiveBabyIds = activeBabyIds.includes(babyId)
                ? activeBabyIds.filter((id) => id !== babyId)
                : [...activeBabyIds, babyId];

            setActiveBabyIds(newActiveBabyIds);

            // If only one baby is selected, make it the primary active baby
            if (newActiveBabyIds.length === 1) {
                await setActiveBabyId(newActiveBabyIds[0]);
                setActive(newActiveBabyIds[0]);
            } else if (newActiveBabyIds.length === 0) {
                // If no babies selected, select the first one
                if (babies.length > 0) {
                    const firstBabyId = babies[0].id!;
                    await setActiveBabyId(firstBabyId);
                    setActive(firstBabyId);
                    setActiveBabyIds([firstBabyId]);
                }
            }
        },
        [activeBabyIds, babies]
    );

    const selectMultipleBabies = useCallback(
        async (babyIds: number[]) => {
            setActiveBabyIds(babyIds);

            if (babyIds.length === 0) {
                // If no babies selected, select the first one
                if (babies.length > 0) {
                    const firstBabyId = babies[0].id!;
                    await setActiveBabyId(firstBabyId);
                    setActive(firstBabyId);
                    setActiveBabyIds([firstBabyId]);
                }
                return;
            }

            // Set the first selected baby as the primary active baby
            await setActiveBabyId(babyIds[0]);
            setActive(babyIds[0]);
        },
        [babies]
    );

    const setTheme = useCallback(async (mode: ThemeMode) => {
        await setThemeMode(mode);
        setThemeState(mode);
    }, []);

    const createCloudHousehold = useCallback(async () => {
        const id = await createHousehold();
        setHousehold(id);
        return id;
    }, []);

    const joinCloudHousehold = useCallback(async (code: string) => {
        await joinHousehold(code);
        setHousehold(await getHouseholdId());
    }, []);

    const value = useMemo(
        () => ({
            babies,
            activeBabyId,
            activeBabyIds,
            themeMode,
            loading,
            householdId,
            syncStatus,
            addBaby,
            deleteBaby,
            selectBaby,
            toggleBabySelection,
            selectMultipleBabies,
            setTheme,
            createCloudHousehold,
            joinCloudHousehold,
        }),
        [
            babies,
            activeBabyId,
            activeBabyIds,
            themeMode,
            loading,
            householdId,
            syncStatus,
            addBaby,
            deleteBaby,
            selectBaby,
            toggleBabySelection,
            selectMultipleBabies,
            setTheme,
            createCloudHousehold,
            joinCloudHousehold,
        ]
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useAppContext must be used within AppProvider");
    return ctx;
}
