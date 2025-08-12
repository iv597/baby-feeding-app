import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createBaby, getActiveBabyId, getThemeMode, initializeDatabase, listBabies, setActiveBabyId, setThemeMode, getHouseholdId } from '../db';
import { BabyProfile, ThemeMode } from '../types';
import { createHousehold, joinHousehold, syncNow } from '../sync/service';

interface AppContextValue {
  babies: BabyProfile[];
  activeBabyId?: number;
  themeMode: ThemeMode;
  loading: boolean;
  householdId?: string | null;
  addBaby: (name: string, birthdate?: number | null) => Promise<void>;
  selectBaby: (babyId: number) => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
  createCloudHousehold: () => Promise<string>;
  joinCloudHousehold: (code: string) => Promise<void>;
  syncCloud: () => Promise<{ pushed: number; pulled: number }>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [babies, setBabies] = useState<BabyProfile[]>([]);
  const [activeBabyId, setActive] = useState<number | undefined>(undefined);
  const [themeMode, setThemeState] = useState<ThemeMode>('light');
  const [householdId, setHousehold] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        const defaultId = await createBaby({ name: 'Baby', birthdate: null });
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

  const addBaby = useCallback(async (name: string, birthdate?: number | null) => {
    const id = await createBaby({ name, birthdate: birthdate ?? null });
    await refreshBabies();
    await setActiveBabyId(id);
    setActive(id);
  }, [refreshBabies]);

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
    await joinHousehold(code.trim());
    setHousehold(code.trim());
  }, []);

  const syncCloud = useCallback(async () => {
    const res = await syncNow();
    return res;
  }, []);

  const value = useMemo<AppContextValue>(() => ({ babies, activeBabyId, themeMode, loading, householdId, addBaby, selectBaby, setTheme, createCloudHousehold, joinCloudHousehold, syncCloud }), [babies, activeBabyId, themeMode, loading, householdId, addBaby, selectBaby, setTheme, createCloudHousehold, joinCloudHousehold, syncCloud]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}