import React, { useMemo, useState } from "react";
import { View, ScrollView } from "react-native";
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
    const [isManageBabiesOpen, setIsManageBabiesOpen] = useState(false);

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
                            <List.Item
                                title={item.name}
                                titleStyle={{
                                    fontWeight:
                                        item.id === activeBabyId
                                            ? "bold"
                                            : "normal",
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
                                        {/* Eye icon to toggle active baby visibility */}
                                        <IconButton
                                            icon={
                                                activeBabyIds.includes(item.id!)
                                                    ? "eye"
                                                    : "eye-off"
                                            }
                                            iconColor={
                                                activeBabyIds.includes(item.id!)
                                                    ? "#2196F3"
                                                    : "#6c757d"
                                            }
                                            size={20}
                                            style={{ marginRight: 4 }}
                                            onPress={() =>
                                                item.id &&
                                                toggleBabySelection(item.id)
                                            }
                                        />
                                        {item.id === activeBabyId && (
                                            <Text
                                                variant="bodySmall"
                                                style={{
                                                    marginRight: 8,
                                                    color: "#2196F3",
                                                }}
                                            >
                                                Primary
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
                                            : activeBabyIds.includes(item.id!)
                                            ? "#f8f9fa"
                                            : undefined,
                                    borderRadius: 8,
                                    marginBottom: 4,
                                }}
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
                                View None
                            </Button>
                        </View>
                    )}
                </View>
            )}

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
