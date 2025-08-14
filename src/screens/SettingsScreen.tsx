import React, { useMemo, useState } from "react";
import { View, FlatList, ScrollView } from "react-native";
import {
    Button,
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

export default function SettingsScreen() {
    const {
        babies,
        activeBabyId,
        activeBabyIds,
        selectBaby,
        toggleBabySelection,
        selectMultipleBabies,
        addBaby,
        themeMode,
        setTheme,
    } = useAppContext();
    const { user, profile, signOut } = useAuth();
    const [addVisible, setAddVisible] = useState(false);
    const [name, setName] = useState("");
    const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
    const [joinCode, setJoinCode] = useState("");
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [householdName, setHouseholdName] = useState("");
    const [createHouseholdVisible, setCreateHouseholdVisible] = useState(false);

    const onAdd = async () => {
        await addBaby(
            name.trim() || "Baby",
            birthdate ? birthdate.getTime() : null
        );
        setName("");
        setBirthdate(undefined);
        setAddVisible(false);
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

            {/* Active Babies Switcher - only show if multiple babies */}
            {babies.length > 1 && (
                <View style={{ marginBottom: 24 }}>
                    <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                        Active Babies
                    </Text>
                    <Text
                        variant="bodyMedium"
                        style={{ marginBottom: 12, opacity: 0.7 }}
                    >
                        Select one or more babies to view combined data
                    </Text>

                    {/* Multi-select checkboxes for babies */}
                    <View style={{ marginBottom: 12 }}>
                        {babies.map((baby) => (
                            <View
                                key={baby.id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    backgroundColor: activeBabyIds.includes(
                                        baby.id!
                                    )
                                        ? "#f8f9fa"
                                        : "transparent",
                                    borderRadius: 8,
                                    marginBottom: 4,
                                    borderWidth: activeBabyIds.includes(
                                        baby.id!
                                    )
                                        ? 1
                                        : 0,
                                    borderColor: "#e9ecef",
                                }}
                            >
                                <Button
                                    mode="outlined"
                                    onPress={() =>
                                        toggleBabySelection(baby.id!)
                                    }
                                    style={{
                                        flex: 1,
                                        justifyContent: "flex-start",
                                        borderColor: activeBabyIds.includes(
                                            baby.id!
                                        )
                                            ? "#6c757d"
                                            : "#dee2e6",
                                        backgroundColor: activeBabyIds.includes(
                                            baby.id!
                                        )
                                            ? "#ffffff"
                                            : "transparent",
                                    }}
                                    textColor={
                                        activeBabyIds.includes(baby.id!)
                                            ? "#495057"
                                            : "#6c757d"
                                    }
                                    contentStyle={{
                                        justifyContent: "flex-start",
                                    }}
                                >
                                    {baby.name}
                                </Button>
                                {activeBabyIds.includes(baby.id!) && (
                                    <Text
                                        variant="bodySmall"
                                        style={{
                                            marginLeft: 8,
                                            color: "#6c757d",
                                            fontWeight: "500",
                                        }}
                                    >
                                        ✓
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>

                    <Text
                        variant="bodySmall"
                        style={{ opacity: 0.7, color: "#6c757d" }}
                    >
                        {activeBabyIds.length === 0
                            ? "No babies selected"
                            : activeBabyIds.length === 1
                            ? `Active: ${
                                  babies.find((b) => b.id === activeBabyIds[0])
                                      ?.name
                              }`
                            : `${
                                  activeBabyIds.length
                              } babies selected: ${activeBabyIds
                                  .map(
                                      (id) =>
                                          babies.find((b) => b.id === id)?.name
                                  )
                                  .join(", ")}`}
                    </Text>

                    {/* Quick selection buttons */}
                    <View
                        style={{ flexDirection: "row", gap: 8, marginTop: 8 }}
                    >
                        <Button
                            mode="outlined"
                            onPress={() =>
                                selectMultipleBabies(babies.map((b) => b.id!))
                            }
                            compact
                            style={{ borderColor: "#dee2e6" }}
                            textColor="#6c757d"
                        >
                            Select All
                        </Button>
                        <Button
                            mode="outlined"
                            onPress={() => selectMultipleBabies([])}
                            compact
                            style={{ borderColor: "#dee2e6" }}
                            textColor="#6c757d"
                        >
                            Clear All
                        </Button>
                    </View>
                </View>
            )}

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
            <Text variant="titleLarge" style={{ marginBottom: 8 }}>
                Manage Babies
            </Text>
            <Text
                variant="bodyMedium"
                style={{ marginBottom: 12, opacity: 0.7 }}
            >
                View and manage all babies in your household
            </Text>
            <FlatList
                data={babies}
                keyExtractor={(b) => String(b.id)}
                renderItem={({ item }) => (
                    <List.Item
                        title={item.name}
                        titleStyle={{
                            fontWeight:
                                item.id === activeBabyId ? "bold" : "normal",
                        }}
                        description={
                            item.birthdate
                                ? `Birthdate: ${new Date(
                                      item.birthdate
                                  ).toDateString()}`
                                : "No birthdate set"
                        }
                        left={(props) => (
                            <List.Icon
                                {...props}
                                icon="baby-face-outline"
                                color={
                                    item.id === activeBabyId
                                        ? "#2196F3"
                                        : undefined
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
                                {item.id === activeBabyId && (
                                    <Text
                                        variant="bodySmall"
                                        style={{
                                            marginRight: 8,
                                            color: "#2196F3",
                                        }}
                                    >
                                        Active
                                    </Text>
                                )}
                                <List.Icon
                                    {...props}
                                    icon={
                                        item.id === activeBabyId
                                            ? "check-circle"
                                            : "circle-outline"
                                    }
                                    color={
                                        item.id === activeBabyId
                                            ? "#2196F3"
                                            : undefined
                                    }
                                />
                            </View>
                        )}
                        onPress={() => item.id && selectBaby(item.id)}
                        style={{
                            backgroundColor:
                                item.id === activeBabyId
                                    ? "#f0f8ff"
                                    : undefined,
                            borderRadius: 8,
                            marginBottom: 4,
                        }}
                    />
                )}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
            />

            <Button
                mode="contained"
                style={{ marginTop: 16 }}
                onPress={() => setAddVisible(true)}
            >
                Add baby
            </Button>

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
        </ScrollView>
    );
}
