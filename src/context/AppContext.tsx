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
} from "../db";
import { BabyProfile, ThemeMode } from "../types";
import { createHousehold, joinHousehold, syncNow } from "../sync/service";
import { AppState } from "react-native";

interface AppContextValue {
    babies: BabyProfile[];
    activeBabyId?: number;
    themeMode: ThemeMode;
    loading: boolean;
    householdId?: string | null;
    syncStatus: "idle" | "syncing" | "error";
    addBaby: (name: string, birthdate?: number | null) => Promise<void>;
    selectBaby: (babyId: number) => Promise<void>;
    setTheme: (mode: ThemeMode) => Promise<void>;
    createCloudHousehold: () => Promise<string>;
    joinCloudHousehold: (code: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [babies, setBabies] = useState<BabyProfile[]>([]);
    const [activeBabyId, setActive] = useState<number | undefined>(undefined);
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
            setLoading(false);
        })();
    }, [refreshBabies]);

    // Automatic background sync every 5 minutes
    useEffect(() => {
        const autoSyncInterval = setInterval(async () => {
            try {
                console.log("Running automatic background sync...");
                await syncNow();
                console.log("Automatic background sync completed");
            } catch (error) {
                console.warn("Automatic background sync failed:", error);
                setSyncStatus("error");
            }
        }, 5 * 60 * 1000); // Sync every 5 minutes

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
        async (name: string, birthdate?: number | null) => {
            const id = await createBaby({ name, birthdate: birthdate ?? null });
            await refreshBabies();
            await setActiveBabyId(id);
            setActive(id);

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

    const selectBaby = useCallback(async (babyId: number) => {
        await setActiveBabyId(babyId);
        setActive(babyId);
    }, []);

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
            themeMode,
            loading,
            householdId,
            syncStatus,
            addBaby,
            selectBaby,
            setTheme,
            createCloudHousehold,
            joinCloudHousehold,
        }),
        [
            babies,
            activeBabyId,
            themeMode,
            loading,
            householdId,
            syncStatus,
            addBaby,
            selectBaby,
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
