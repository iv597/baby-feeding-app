import React, { useMemo, useState, useRef } from "react";
import {
    View,
    ScrollView,
    Animated,
    PanResponder,
    TouchableOpacity,
} from "react-native";
import {
    Button,
    IconButton,
    List,
    Modal,
    Portal,
    SegmentedButtons,
    Text,
    TextInput,
    HelperText,
    Divider,
    Avatar,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { authService } from "../auth/service";
import { Alert } from "react-native";
import { Gender } from "../types";

// Swipeable Baby Item Component
const SwipeableBabyItem = ({
    baby,
    activeBabyIds,
    toggleBabySelection,
    confirmDeleteBaby,
    onEditBaby,
}: any) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const [isSwipeOpen, setIsSwipeOpen] = useState(false);

    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
            return Math.abs(gestureState.dx) > 10;
        },
        onPanResponderGrant: () => {},
        onPanResponderMove: (_, gestureState) => {
            if (gestureState.dx < 0) {
                translateX.setValue(Math.max(gestureState.dx, -80));
            }
        },
        onPanResponderRelease: (_, gestureState) => {
            if (gestureState.dx < -40) {
                // Swipe left enough to show delete button
                Animated.spring(translateX, {
                    toValue: -80,
                    useNativeDriver: true,
                }).start();
                setIsSwipeOpen(true);
            } else {
                // Snap back
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                }).start();
                setIsSwipeOpen(false);
            }
        },
    });

    const closeSwipe = () => {
        Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
        }).start();
        setIsSwipeOpen(false);
    };

    return (
        <View style={{ position: "relative", overflow: "hidden" }}>
            {/* Delete button (hidden behind) */}
            <View
                style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 80,
                    backgroundColor: "#F44336",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <TouchableOpacity
                    style={{
                        width: 80,
                        height: "100%",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                    onPress={() => {
                        closeSwipe();
                        confirmDeleteBaby(baby);
                    }}
                >
                    <IconButton icon="delete" iconColor="#ffffff" size={24} />
                </TouchableOpacity>
            </View>

            {/* Main content */}
            <Animated.View
                style={{
                    transform: [{ translateX }],
                    backgroundColor: "white",
                }}
                {...panResponder.panHandlers}
            >
                <List.Item
                    title={baby.name}
                    description={
                        baby.birthdate
                            ? `Birthdate: ${new Date(
                                  baby.birthdate
                              ).toDateString()}`
                            : "No birthdate set"
                    }
                    left={(props) => (
                        <List.Icon
                            {...props}
                            icon="baby-face-outline"
                            color={
                                baby.gender === "boy"
                                    ? "#2196F3"
                                    : baby.gender === "girl"
                                    ? "#E91E63"
                                    : "#6c757d"
                            }
                        />
                    )}
                    right={(props) => (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                            }}
                        >
                            <IconButton
                                icon="pencil"
                                iconColor="#6c757d"
                                size={20}
                                onPress={() => onEditBaby(baby)}
                            />
                            <IconButton
                                icon={
                                    activeBabyIds.includes(baby.id!)
                                        ? "eye"
                                        : "eye-off"
                                }
                                iconColor={
                                    activeBabyIds.includes(baby.id!)
                                        ? "#2196F3"
                                        : "#6c757d"
                                }
                                size={20}
                                onPress={() =>
                                    baby.id && toggleBabySelection(baby.id)
                                }
                            />
                        </View>
                    )}
                    style={{
                        backgroundColor: activeBabyIds.includes(baby.id!)
                            ? "#f8f9fa"
                            : undefined,
                        borderRadius: 8,
                        marginBottom: 4,
                    }}
                />
            </Animated.View>
        </View>
    );
};

export default function SettingsScreen() {
    const {
        babies,
        activeBabyId,
        activeBabyIds,
        selectBaby,
        toggleBabySelection,
        selectMultipleBabies,
        addBaby,
        deleteBaby,
        refreshBabies,
        syncNow,
        setSyncStatus,
        themeMode,
        setTheme,
    } = useAppContext();
    const { user, profile, signOut } = useAuth();
    const [addVisible, setAddVisible] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [editingBaby, setEditingBaby] = useState<any>(null);
    const [name, setName] = useState("");
    const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
    const [gender, setGender] = useState<Gender | undefined>(undefined);
    const [joinCode, setJoinCode] = useState("");
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [householdName, setHouseholdName] = useState("");
    const [createHouseholdVisible, setCreateHouseholdVisible] = useState(false);
    const [isManageBabiesOpen, setIsManageBabiesOpen] = useState(false);

    const onAdd = async () => {
        await addBaby(
            name.trim() || "Baby",
            birthdate ? birthdate.getTime() : null,
            gender
        );
        setName("");
        setBirthdate(undefined);
        setGender(undefined);
        setAddVisible(false);
    };

    const onEditBaby = (baby: any) => {
        setEditingBaby(baby);
        setName(baby.name || "");
        setBirthdate(baby.birthdate ? new Date(baby.birthdate) : undefined);
        setGender(baby.gender || undefined);
        setEditVisible(true);
    };

    const onSaveEdit = async () => {
        if (!editingBaby) return;

        // Update baby in database
        const { updateBaby } = await import("../db");
        await updateBaby(editingBaby.id, {
            name: name.trim() || "Baby",
            birthdate: birthdate ? birthdate.getTime() : null,
            gender: gender || null,
        });

        // Refresh babies list
        await refreshBabies();

        // Reset form and close modal
        setName("");
        setBirthdate(undefined);
        setGender(undefined);
        setEditingBaby(null);
        setEditVisible(false);

        // Auto-sync after editing
        try {
            setSyncStatus("syncing");
            await syncNow();
            setSyncStatus("idle");
        } catch (error) {
            console.warn("Auto-sync failed after editing baby:", error);
            setSyncStatus("error");
        }
    };

    const onCreateHousehold = async () => {
        try {
            const { inviteCode, error } = await authService.createHousehold(
                householdName.trim() || "My Household"
            );
            if (error) throw error;
            setSyncMessage(`Household created! Share this code: ${inviteCode}`);
            setCreateHouseholdVisible(false);
            setHouseholdName("");
        } catch (e: any) {
            setSyncMessage(e.message || "Failed to create household");
        }
    };

    const onJoinHousehold = async () => {
        try {
            const { error } = await authService.joinHousehold(joinCode.trim());
            if (error) throw error;
            setSyncMessage("Joined household successfully!");
            setJoinCode("");
        } catch (e: any) {
            setSyncMessage(e.message || "Failed to join household");
        }
    };

    const onSignOut = async () => {
        await signOut();
    };

    const confirmDeleteBaby = (baby: any) => {
        Alert.alert(
            "Delete Baby",
            `Are you sure you want to delete ${baby.name}? This will remove all feeding data for this baby.`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteBaby(baby.id!),
                },
            ]
        );
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {/* User Profile Section */}
            <View style={{ alignItems: "center", marginBottom: 24 }}>
                <Avatar.Text
                    size={64}
                    label={
                        profile?.fullName?.charAt(0) ||
                        user?.email?.charAt(0) ||
                        "U"
                    }
                />
                <Text variant="titleLarge" style={{ marginTop: 8 }}>
                    {profile?.fullName || "User"}
                </Text>
                <Text variant="bodyMedium" style={{ opacity: 0.7 }}>
                    {user?.email}
                </Text>
                <Button
                    mode="outlined"
                    onPress={onSignOut}
                    style={{ marginTop: 8 }}
                >
                    Sign Out
                </Button>
            </View>

            <Divider style={{ marginBottom: 16 }} />

            {/* Theme Section */}
            <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                Theme
            </Text>
            <SegmentedButtons
                value={themeMode}
                onValueChange={(v) => setTheme(v as any)}
                buttons={[
                    { label: "Light", value: "light" },
                    { label: "Dark", value: "dark" },
                ]}
                style={{ marginBottom: 16 }}
            />

            <Divider style={{ marginVertical: 8 }} />

            {/* Household Management Section */}
            <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                Household
            </Text>
            <Button
                mode="contained"
                onPress={() => setCreateHouseholdVisible(true)}
                style={{ marginBottom: 8 }}
            >
                Create new household
            </Button>
            <TextInput
                label="Join code"
                value={joinCode}
                onChangeText={setJoinCode}
                style={{ marginBottom: 8 }}
            />
            <Button mode="outlined" onPress={onJoinHousehold}>
                Join household
            </Button>

            {syncMessage ? (
                <HelperText type="info" visible>
                    {syncMessage}
                </HelperText>
            ) : null}

            <Divider style={{ marginVertical: 8 }} />

            {/* Babies Section */}
            <Button
                mode="outlined"
                onPress={() => setIsManageBabiesOpen((prev) => !prev)}
                style={{ marginBottom: 8 }}
            >
                Manage Babies
            </Button>
            <Text
                variant="bodyMedium"
                style={{ marginBottom: 12, opacity: 0.7 }}
            >
                View and manage all babies in your household. Use the eye icon
                to toggle active babies for viewing data.
            </Text>

            {/* Active babies summary when list is closed */}
            {!isManageBabiesOpen && babies.length > 1 && (
                <Text
                    variant="bodySmall"
                    style={{ opacity: 0.7, color: "#6c757d", marginBottom: 12 }}
                >
                    {activeBabyIds.length === 0
                        ? "No babies selected for viewing"
                        : activeBabyIds.length === 1
                        ? `Active: ${
                              babies.find((b) => b.id === activeBabyIds[0])
                                  ?.name
                          }`
                        : `${
                              activeBabyIds.length
                          } babies active: ${activeBabyIds
                              .map(
                                  (id) => babies.find((b) => b.id === id)?.name
                              )
                              .join(", ")}`}
                </Text>
            )}
            {isManageBabiesOpen && (
                <View>
                    {babies.map((item) => (
                        <View key={item.id}>
                            <SwipeableBabyItem
                                baby={item}
                                activeBabyIds={activeBabyIds}
                                toggleBabySelection={toggleBabySelection}
                                confirmDeleteBaby={confirmDeleteBaby}
                                onEditBaby={onEditBaby}
                            />
                            <View
                                style={{ height: 1, backgroundColor: "#eee" }}
                            />
                        </View>
                    ))}

                    {/* Quick selection buttons for multiple babies */}
                    {babies.length > 1 && (
                        <View
                            style={{
                                flexDirection: "row",
                                gap: 8,
                                marginTop: 12,
                            }}
                        >
                            <Button
                                mode="outlined"
                                onPress={() =>
                                    selectMultipleBabies(
                                        babies.map((b) => b.id!)
                                    )
                                }
                                compact
                                style={{ borderColor: "#dee2e6" }}
                                textColor="#6c757d"
                            >
                                View All
                            </Button>
                            <Button
                                mode="outlined"
                                onPress={() => selectMultipleBabies([])}
                                compact
                                style={{ borderColor: "#dee2e6" }}
                                textColor="#6c757d"
                            >
                                Reset view
                            </Button>
                        </View>
                    )}

                    {/* Add baby button - only show when manage babies is open */}
                    <Button
                        mode="contained"
                        style={{ marginTop: 16 }}
                        onPress={() => setAddVisible(true)}
                    >
                        Add baby
                    </Button>
                </View>
            )}

            {/* Create Household Modal */}
            <Portal>
                <Modal
                    visible={createHouseholdVisible}
                    onDismiss={() => setCreateHouseholdVisible(false)}
                    contentContainerStyle={{
                        backgroundColor: "white",
                        padding: 16,
                        margin: 16,
                        borderRadius: 16,
                    }}
                >
                    <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                        Create Household
                    </Text>
                    <TextInput
                        label="Household name"
                        value={householdName}
                        onChangeText={setHouseholdName}
                        style={{ marginBottom: 12 }}
                    />
                    <Button mode="contained" onPress={onCreateHousehold}>
                        Create
                    </Button>
                </Modal>
            </Portal>

            {/* Add Baby Modal */}
            <Portal>
                <Modal
                    visible={addVisible}
                    onDismiss={() => setAddVisible(false)}
                    contentContainerStyle={{
                        backgroundColor: "white",
                        padding: 16,
                        margin: 16,
                        borderRadius: 16,
                    }}
                >
                    <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                        Add Baby
                    </Text>
                    <TextInput
                        label="Name"
                        value={name}
                        onChangeText={setName}
                        style={{ marginBottom: 12 }}
                    />

                    <Text variant="labelMedium" style={{ marginBottom: 8 }}>
                        Gender (optional)
                    </Text>
                    <SegmentedButtons
                        value={gender || ""}
                        onValueChange={(value) => setGender(value as Gender)}
                        buttons={[
                            {
                                label: "Boy",
                                value: "boy",
                                icon: "baby-face-outline",
                            },
                            {
                                label: "Girl",
                                value: "girl",
                                icon: "baby-face-outline",
                            },
                            {
                                label: "Other",
                                value: "other",
                                icon: "baby-face-outline",
                            },
                        ]}
                        style={{ marginBottom: 12 }}
                    />

                    <Text variant="labelMedium" style={{ marginBottom: 8 }}>
                        Birthdate (optional)
                    </Text>
                    <DateTimePicker
                        value={birthdate ?? new Date()}
                        onChange={(_, d) => setBirthdate(d ?? birthdate)}
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

            {/* Edit Baby Modal */}
            <Portal>
                <Modal
                    visible={editVisible}
                    onDismiss={() => {
                        setEditVisible(false);
                        setEditingBaby(null);
                        setName("");
                        setBirthdate(undefined);
                        setGender(undefined);
                    }}
                    contentContainerStyle={{
                        backgroundColor: "white",
                        padding: 16,
                        margin: 16,
                        borderRadius: 16,
                    }}
                >
                    <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                        Edit Baby
                    </Text>
                    <TextInput
                        label="Name"
                        value={name}
                        onChangeText={setName}
                        style={{ marginBottom: 12 }}
                    />

                    <Text variant="labelMedium" style={{ marginBottom: 8 }}>
                        Gender (optional)
                    </Text>
                    <SegmentedButtons
                        value={gender || ""}
                        onValueChange={(value) => setGender(value as Gender)}
                        buttons={[
                            {
                                label: "Boy",
                                value: "boy",
                                icon: "baby-face-outline",
                            },
                            {
                                label: "Girl",
                                value: "girl",
                                icon: "baby-face-outline",
                            },
                            {
                                label: "Other",
                                value: "other",
                                icon: "baby-face-outline",
                            },
                        ]}
                        style={{ marginBottom: 12 }}
                    />

                    <Text variant="labelMedium" style={{ marginBottom: 8 }}>
                        Birthdate (optional)
                    </Text>
                    <DateTimePicker
                        value={birthdate ?? new Date()}
                        onChange={(_, d) => setBirthdate(d ?? birthdate)}
                    />
                    <Button
                        mode="contained"
                        style={{ marginTop: 12 }}
                        onPress={onSaveEdit}
                    >
                        Save Changes
                    </Button>
                </Modal>
            </Portal>
        </ScrollView>
    );
}
