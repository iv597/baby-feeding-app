export type FeedType = "breastmilk" | "formula" | "water" | "solid" | "pump";

export type BreastSide = "left" | "right" | "both";

export type ThemeMode = "light" | "dark";

export interface BabyProfile {
    id?: number;
    name: string;
    birthdate?: number | null; // epoch ms
    householdId?: string | null;
}

export interface FeedEntry {
    id?: number;
    babyId: number;
    type: FeedType;
    createdAt: number; // epoch ms
    quantityMl?: number | null; // for formula/water/pump; optional for breastmilk if using duration
    durationMin?: number | null; // for breastmilk
    side?: BreastSide | null; // for breastmilk
    foodName?: string | null; // for solids
    foodAmountGrams?: number | null; // for solids
    notes?: string | null;
}

export interface StashItem {
    id?: number;
    babyId: number;
    createdAt: number; // epoch ms
    volumeMl: number;
    expiresAt?: number | null;
    status: "stored" | "consumed" | "discarded";
    notes?: string | null;
}

export interface DailyTotals {
    dateKey: string; // yyyy-MM-dd
    breastmilkSessions: number;
    breastmilkMinutes: number;
    formulaMl: number;
    waterMl: number;
    pumpedMl?: number;
    solidsCount: number;
    solidsGrams: number;
}

export interface UserSettings {
    activeBabyId?: number | null;
    theme: ThemeMode;
    babyName?: string;
    volumeUnit?: "ml" | "oz";
    weightUnit?: "g" | "oz";
    timeFormat?: "12h" | "24h";
}

export interface ReminderSettings {
    feedReminderEnabled: boolean;
    feedReminderMinutes: number; // minutes after last feed to remind
}
