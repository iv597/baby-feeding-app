import React, { useMemo, useRef, useState } from "react";
import {
    View,
    StyleSheet,
    Platform,
    ScrollView,
    KeyboardAvoidingView,
} from "react-native";
import {
    Button,
    Text,
    SegmentedButtons,
    Modal,
    Portal,
    TextInput,
    Card,
    Avatar,
    Chip,
    IconButton,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { addToStash, insertFeed } from "../db";
import { useAppContext } from "../context/AppContext";
import { FeedEntry, FeedType, BreastSide } from "../types";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LogScreen() {
    const { activeBabyId, syncCloud, syncStatus } = useAppContext();
    const [visible, setVisible] = useState(false);
    const [type, setType] = useState<FeedType>("breastmilk");
    const [date, setDate] = useState<Date>(new Date());
    const [quantityMl, setQuantityMl] = useState<string>("");
    const [durationMin, setDurationMin] = useState<string>("");
    const [side, setSide] = useState<BreastSide>("both");
    const [foodName, setFoodName] = useState("");
    const [foodAmountGrams, setFoodAmountGrams] = useState("");
    const [notes, setNotes] = useState("");
    const [syncing, setSyncing] = useState(false);

    const timerRef = useRef<{ start: number | null; interval: any | null }>({
        start: null,
        interval: null,
    });
    const [timerSec, setTimerSec] = useState(0);

    const showForm = (t: FeedType) => {
        setType(t);
        setVisible(true);
    };

    const resetForm = () => {
        setDate(new Date());
        setQuantityMl("");
        setDurationMin("");
        setSide("both");
        setFoodName("");
        setFoodAmountGrams("");
        setNotes("");
        stopTimer();
    };

    const onSync = async () => {
        try {
            setSyncing(true);
            const { pushed, pulled } = await syncCloud();
            console.log(`Sync complete! Pushed: ${pushed}, Pulled: ${pulled}`);
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            setSyncing(false);
        }
    };

    const startTimer = () => {
        if (timerRef.current.interval) return;
        timerRef.current.start = Date.now();
        timerRef.current.interval = setInterval(() => {
            setTimerSec(
                Math.floor(
                    (Date.now() - (timerRef.current.start || Date.now())) / 1000
                )
            );
        }, 1000);
    };
    const stopTimer = () => {
        if (timerRef.current.interval) {
            clearInterval(timerRef.current.interval);
            timerRef.current.interval = null;
        }
        if (timerRef.current.start) {
            const mins = Math.max(
                1,
                Math.round((Date.now() - timerRef.current.start) / 60000)
            );
            setDurationMin(String(mins));
        }
        timerRef.current.start = null;
        setTimerSec(0);
    };

    const onSave = async () => {
        if (!activeBabyId) return;
        const entry: FeedEntry = {
            babyId: activeBabyId,
            type,
            createdAt: date.getTime(),
            quantityMl: quantityMl ? Number(quantityMl) : null,
            durationMin: durationMin ? Number(durationMin) : null,
            side: type === "breastmilk" ? side : null,
            foodName: type === "solid" ? foodName : null,
            foodAmountGrams:
                type === "solid" && foodAmountGrams
                    ? Number(foodAmountGrams)
                    : null,
            notes: notes || null,
        };
        await insertFeed(entry);
        if (type === "pump" && entry.quantityMl) {
            await addToStash({
                babyId: activeBabyId,
                createdAt: entry.createdAt,
                volumeMl: entry.quantityMl,
                expiresAt: null,
                status: "stored",
                notes: null,
            });
        }
        setVisible(false);
        resetForm();

        // Auto-sync after saving feed entry
        try {
            await syncCloud();
        } catch (error) {
            console.warn("Auto-sync failed after saving feed:", error);
        }
    };

    const applyPreset = (val: number) => setQuantityMl(String(val));

    const typeSpecificFields = useMemo(() => {
        switch (type) {
            case "breastmilk":
                return (
                    <View style={styles.row}>
                        <SegmentedButtons
                            value={side}
                            onValueChange={(v) => setSide(v as BreastSide)}
                            buttons={[
                                { label: "Left", value: "left" },
                                { label: "Right", value: "right" },
                                { label: "Both", value: "both" },
                            ]}
                            style={{ marginBottom: 12 }}
                        />
                        <View
                            style={{
                                flexDirection: "row",
                                marginBottom: 8,
                                justifyContent: "space-between",
                            }}
                        >
                            <Button
                                compact
                                mode="contained"
                                onPress={startTimer}
                            >
                                Start
                            </Button>
                            <Button compact mode="outlined" onPress={stopTimer}>
                                Stop
                            </Button>
                            {timerSec > 0 ? (
                                <Text style={{ alignSelf: "center" }}>
                                    {Math.floor(timerSec / 60)}:
                                    {String(timerSec % 60).padStart(2, "0")}
                                </Text>
                            ) : null}
                        </View>
                        <TextInput
                            label="Duration (min)"
                            value={durationMin}
                            onChangeText={setDurationMin}
                            keyboardType="numeric"
                            style={{ marginBottom: 12 }}
                        />
                    </View>
                );
            case "formula":
            case "water":
            case "pump":
                return (
                    <View>
                        <View
                            style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                marginBottom: 8,
                            }}
                        >
                            {[60, 90, 120, 150, 180].map((n) => (
                                <Chip
                                    key={n}
                                    onPress={() => applyPreset(n)}
                                    style={{ marginRight: 8, marginBottom: 8 }}
                                >
                                    {n} ml
                                </Chip>
                            ))}
                        </View>
                        <TextInput
                            label="Amount (ml)"
                            value={quantityMl}
                            onChangeText={setQuantityMl}
                            keyboardType="numeric"
                            style={{ marginBottom: 12 }}
                        />
                    </View>
                );
            case "solid":
                return (
                    <View>
                        <TextInput
                            label="Food name"
                            value={foodName}
                            onChangeText={setFoodName}
                            style={{ marginBottom: 12 }}
                        />
                        <TextInput
                            label="Amount (g)"
                            value={foodAmountGrams}
                            onChangeText={setFoodAmountGrams}
                            keyboardType="numeric"
                            style={{ marginBottom: 12 }}
                        />
                    </View>
                );
        }
    }, [
        type,
        side,
        durationMin,
        quantityMl,
        foodName,
        foodAmountGrams,
        timerSec,
    ]);

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                }}
            >
                <Text variant="titleLarge">Quick Log</Text>
                <IconButton
                    icon={syncStatus === "syncing" ? "sync" : "sync"}
                    size={24}
                    onPress={onSync}
                    disabled={syncing || syncStatus === "syncing"}
                    iconColor={
                        syncStatus === "error"
                            ? "#F44336"
                            : syncStatus === "syncing"
                            ? "#2196F3"
                            : "#4CAF50"
                    }
                />
            </View>
            <View style={styles.actions}>
                <Card
                    style={styles.card}
                    onPress={() => showForm("breastmilk")}
                >
                    <Card.Title
                        title="Breastmilk"
                        titleVariant="titleSmall"
                        titleStyle={styles.cardTitle}
                        left={(p) => (
                            <Avatar.Icon
                                {...p}
                                size={24}
                                icon="baby-bottle-outline"
                            />
                        )}
                    />
                </Card>
                <Card style={styles.card} onPress={() => showForm("formula")}>
                    <Card.Title
                        title="Formula"
                        titleVariant="titleSmall"
                        titleStyle={styles.cardTitle}
                        left={(p) => (
                            <Avatar.Icon {...p} size={24} icon="cup-water" />
                        )}
                    />
                </Card>
                <Card style={styles.card} onPress={() => showForm("water")}>
                    <Card.Title
                        title="Water"
                        titleVariant="titleSmall"
                        titleStyle={styles.cardTitle}
                        left={(p) => (
                            <Avatar.Icon {...p} size={24} icon="water" />
                        )}
                    />
                </Card>
                <Card style={styles.card} onPress={() => showForm("solid")}>
                    <Card.Title
                        title="Solid food"
                        titleVariant="titleSmall"
                        titleStyle={styles.cardTitle}
                        left={(p) => (
                            <Avatar.Icon {...p} size={24} icon="food-apple" />
                        )}
                    />
                </Card>
                <Card style={styles.card} onPress={() => showForm("pump")}>
                    <Card.Title
                        title="Pump"
                        titleVariant="titleSmall"
                        titleStyle={styles.cardTitle}
                        left={(p) => (
                            <Avatar.Icon {...p} size={24} icon="cup-water" />
                        )}
                    />
                </Card>
            </View>

            <Portal>
                <Modal
                    visible={visible}
                    onDismiss={() => setVisible(false)}
                    contentContainerStyle={styles.modal}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : undefined}
                    >
                        <ScrollView
                            contentContainerStyle={{ paddingBottom: 12 }}
                        >
                            <Text
                                variant="titleLarge"
                                style={{ marginBottom: 8 }}
                            >
                                Add {type}
                            </Text>
                            <View style={{ marginBottom: 12 }}>
                                <DateTimePicker
                                    value={date}
                                    mode="datetime"
                                    onChange={(_, d) => d && setDate(d)}
                                />
                            </View>

                            {typeSpecificFields}

                            <TextInput
                                label="Notes"
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                style={{ marginBottom: 12 }}
                            />
                            <Button mode="contained" onPress={onSave}>
                                Save
                            </Button>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    actions: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    card: { width: "48%", marginBottom: 12 },
    cardTitle: { fontSize: 14 },
    row: { marginBottom: 12 },
    modal: {
        backgroundColor: "white",
        padding: 16,
        margin: 16,
        borderRadius: 16,
        maxHeight: "85%",
    },
});
