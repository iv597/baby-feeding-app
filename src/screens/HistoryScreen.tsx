import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    StyleSheet,
    SectionList,
    SectionListData,
    SectionListRenderItemInfo,
    RefreshControl,
    Alert,
} from "react-native";
import { IconButton, List, Text } from "react-native-paper";
import { deleteFeed, getRecentFeeds } from "../db";
import { FeedEntry } from "../types";
import { format, subDays } from "date-fns";
import { useAppContext } from "../context/AppContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

function renderSubtitle(item: FeedEntry): string {
    switch (item.type) {
        case "breastmilk":
            return `${item.side ?? ""} ${
                item.durationMin ? `${item.durationMin} min` : ""
            }`.trim();
        case "formula":
        case "water":
        case "pump":
            return item.quantityMl ? `${item.quantityMl} ml` : "";
        case "solid":
            return `${item.foodName ?? ""} ${
                item.foodAmountGrams ? `${item.foodAmountGrams} g` : ""
            }`.trim();
        default:
            return "";
    }
}

function capitalize(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

type HistorySection = { dateKey: string; title: string; data: FeedEntry[] };

export default function HistoryScreen() {
    const { activeBabyId } = useAppContext();
    const [entries, setEntries] = useState<FeedEntry[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        if (!activeBabyId) return;
        setRefreshing(true);
        try {
            const rows = await getRecentFeeds(activeBabyId, 200);
            setEntries(rows);
        } finally {
            setRefreshing(false);
        }
    }, [activeBabyId]);

    useEffect(() => {
        refresh();
    }, [activeBabyId, refresh]);

    useFocusEffect(
        useCallback(() => {
            // Refresh whenever the screen gains focus
            refresh();
        }, [refresh])
    );

    const sections: HistorySection[] = useMemo(() => {
        const map = new Map<string, FeedEntry[]>();
        for (const item of entries) {
            const ts = item.createdAt ?? Date.now();
            const key = format(ts, "yyyy-MM-dd");
            const list = map.get(key) ?? [];
            list.push(item);
            map.set(key, list);
        }
        const todayKey = format(Date.now(), "yyyy-MM-dd");
        const yesterdayKey = format(subDays(Date.now(), 1), "yyyy-MM-dd");
        const result: HistorySection[] = Array.from(map.entries())
            .map(([key, items]) => {
                const title =
                    key === todayKey
                        ? "Today"
                        : key === yesterdayKey
                        ? "Yesterday"
                        : format(items[0]?.createdAt ?? Date.now(), "PPPP");
                // Sort items in a section descending by time
                items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
                return {
                    dateKey: key,
                    title,
                    data: items,
                };
            })
            // Sort descending by date
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
        return result;
    }, [entries]);

    const handleDelete = async (id?: number) => {
        if (!id) return;
        await deleteFeed(id);
        refresh();

        // Immediately sync the deletion to the database
        try {
            const { syncNow } = await import("../sync/service");
            await syncNow();
            console.log("Feed deletion synced immediately");
        } catch (error) {
            console.warn("Immediate sync failed after deleting feed:", error);
        }
    };

    const requestDelete = (id?: number) => {
        if (!id) return;
        Alert.alert("Delete log", "Are you sure you want to delete?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => handleDelete(id),
            },
        ]);
    };

    const renderItem = ({ item }: SectionListRenderItemInfo<FeedEntry>) => (
        <List.Item
            style={styles.item}
            title={capitalize(item.type)}
            titleStyle={styles.itemTitle}
            description={renderSubtitle(item)}
            descriptionNumberOfLines={1}
            descriptionStyle={styles.itemDesc}
            left={(props) => (
                <List.Icon
                    {...props}
                    style={[props.style, { margin: 0 }]}
                    icon={
                        item.type === "breastmilk"
                            ? "baby-bottle-outline"
                            : item.type === "formula"
                            ? "cup-water"
                            : item.type === "water"
                            ? "water"
                            : "food-apple"
                    }
                />
            )}
            right={(props) => (
                <IconButton
                    {...props}
                    icon="delete"
                    onPress={() => requestDelete(item.id)}
                />
            )}
        />
    );

    const renderSectionHeader = ({
        section,
    }: {
        section: SectionListData<FeedEntry> & HistorySection;
    }) => (
        <View style={styles.sectionHeader}>
            <Text variant="titleMedium">
                {(section as HistorySection).title}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                Recent
            </Text>
            <SectionList
                sections={sections}
                keyExtractor={(item, idx) =>
                    item.id
                        ? String(item.id)
                        : `${item.type}-${item.createdAt}-${idx}`
                }
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                    />
                }
                contentContainerStyle={{ paddingBottom: 16 }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    sectionHeader: {
        backgroundColor: "#00000008",
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 6,
        marginTop: 8,
        marginBottom: 4,
    },
    item: { paddingVertical: 6 },
    itemTitle: { fontSize: 14 },
    itemDesc: { fontSize: 12, opacity: 0.8 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: "#eee" },
});
