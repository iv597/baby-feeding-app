import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
    if (client) return client;

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    console.log("Supabase config check:", {
        hasUrl: !!url,
        hasKey: !!key,
        url: url ? `${url.substring(0, 20)}...` : "undefined",
    });

    if (!url || !key) {
        console.error(
            "Supabase environment variables not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY"
        );
        return null;
    }

    try {
        client = createClient(url, key, {
            auth: {
                storage: AsyncStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
        console.log("Supabase client created successfully");
        return client;
    } catch (error) {
        console.error("Failed to create Supabase client:", error);
        return null;
    }
}
