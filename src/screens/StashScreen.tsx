import React, { useEffect, useState } from "react";
import { View, FlatList } from "react-native";
import {
    Button,
    Card,
    List,
    Modal,
    Portal,
    Text,
    TextInput,
} from "react-native-paper";
import { addToStash, listStash, updateStashStatus } from "../db";
import { useAppContext } from "../context/AppContext";

export default function StashScreen() {
    const { activeBabyId } = useAppContext();
    const [data, setData] = useState<any[]>([]);
    const [visible, setVisible] = useState(false);
    const [volume, setVolume] = useState("120");

    const refresh = async () => {
        if (!activeBabyId) return;
        const rows = await listStash(activeBabyId);
        setData(rows);
    };

    useEffect(() => {
        refresh();
    }, [activeBabyId]);

    const onAdd = async () => {
        if (!activeBabyId) return;
        await addToStash({
            babyId: activeBabyId,
            createdAt: Date.now(),
            volumeMl: Number(volume) || 0,
            expiresAt: null,
            status: "stored",
            notes: null,
        });
        setVisible(false);
        setVolume("120");
        refresh();

        // Immediately sync the new stash item to the database
        try {
            const { syncNow } = await import("../sync/service");
            await syncNow();
            console.log("Stash item synced immediately after creation");
        } catch (error) {
            console.warn(
                "Immediate sync failed after creating stash item:",
                error
            );
        }
    };

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Button
                mode="contained"
                onPress={() => setVisible(true)}
                style={{ marginBottom: 12 }}
            >
                Add pumped bag
            </Button>
            <FlatList
                data={data}
                keyExtractor={(i) => String(i.id)}
                renderItem={({ item }) => (
                    <Card style={{ marginBottom: 8 }}>
                        <Card.Title
                            title={`${item.volumeMl} ml`}
                            subtitle={new Date(item.createdAt).toLocaleString()}
                        />
                        <Card.Actions>
                            <Button
                                onPress={async () => {
                                    await updateStashStatus(
                                        item.id,
                                        "consumed"
                                    );
                                    refresh();
                                    // Immediately sync the status change
                                    try {
                                        const { syncNow } = await import(
                                            "../sync/service"
                                        );
                                        await syncNow();
                                        console.log(
                                            "Stash status change synced immediately"
                                        );
                                    } catch (error) {
                                        console.warn(
                                            "Immediate sync failed after status change:",
                                            error
                                        );
                                    }
                                }}
                            >
                                Mark consumed
                            </Button>
                            <Button
                                onPress={async () => {
                                    await updateStashStatus(
                                        item.id,
                                        "discarded"
                                    );
                                    refresh();
                                    // Immediately sync the status change
                                    try {
                                        const { syncNow } = await import(
                                            "../sync/service"
                                        );
                                        await syncNow();
                                        console.log(
                                            "Stash status change synced immediately"
                                        );
                                    } catch (error) {
                                        console.warn(
                                            "Immediate sync failed after status change:",
                                            error
                                        );
                                    }
                                }}
                            >
                                Discard
                            </Button>
                        </Card.Actions>
                    </Card>
                )}
            />

            <Portal>
                <Modal
                    visible={visible}
                    onDismiss={() => setVisible(false)}
                    contentContainerStyle={{
                        backgroundColor: "white",
                        padding: 16,
                        margin: 16,
                        borderRadius: 16,
                    }}
                >
                    <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                        Add pumped bag
                    </Text>
                    <TextInput
                        label="Volume (ml)"
                        value={volume}
                        onChangeText={setVolume}
                        keyboardType="numeric"
                    />
                    <Button
                        mode="contained"
                        style={{ marginTop: 12 }}
                        onPress={onAdd}
                    >
                        Save
                    </Button>
                </Modal>
            </Portal>
        </View>
    );
}
