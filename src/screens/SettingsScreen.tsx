import React, { useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { Button, List, Modal, Portal, SegmentedButtons, Text, TextInput, HelperText, Divider, Avatar } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { authService } from '../auth/service';

export default function SettingsScreen() {
  const { babies, activeBabyId, selectBaby, addBaby, themeMode, setTheme } = useAppContext();
  const { user, profile, signOut } = useAuth();
  const [addVisible, setAddVisible] = useState(false);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [joinCode, setJoinCode] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState('');
  const [createHouseholdVisible, setCreateHouseholdVisible] = useState(false);

  const onAdd = async () => {
    await addBaby(name.trim() || 'Baby', birthdate ? birthdate.getTime() : null);
    setName('');
    setBirthdate(undefined);
    setAddVisible(false);
  };

  const onCreateHousehold = async () => {
    try {
      const { inviteCode, error } = await authService.createHousehold(householdName.trim() || 'My Household');
      if (error) throw error;
      setSyncMessage(`Household created! Share this code: ${inviteCode}`);
      setCreateHouseholdVisible(false);
      setHouseholdName('');
    } catch (e: any) {
      setSyncMessage(e.message || 'Failed to create household');
    }
  };

  const onJoinHousehold = async () => {
    try {
      const { householdId, error } = await authService.joinHousehold(joinCode.trim());
      if (error) throw error;
      setSyncMessage('Joined household successfully!');
      setJoinCode('');
    } catch (e: any) {
      setSyncMessage(e.message || 'Failed to join household');
    }
  };

  const onSignOut = async () => {
    await signOut();
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* User Profile Section */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Avatar.Text size={64} label={profile?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'} />
        <Text variant="titleLarge" style={{ marginTop: 8 }}>{profile?.fullName || 'User'}</Text>
        <Text variant="bodyMedium" style={{ opacity: 0.7 }}>{user?.email}</Text>
        <Button mode="outlined" onPress={onSignOut} style={{ marginTop: 8 }}>Sign Out</Button>
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Theme Section */}
      <Text variant="titleLarge" style={{ marginBottom: 8 }}>Theme</Text>
      <SegmentedButtons
        value={themeMode}
        onValueChange={(v) => setTheme(v as any)}
        buttons={[
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Divider style={{ marginVertical: 8 }} />

      {/* Household Management Section */}
      <Text variant="titleLarge" style={{ marginBottom: 8 }}>Household</Text>
      <Button mode="contained" onPress={() => setCreateHouseholdVisible(true)} style={{ marginBottom: 8 }}>
        Create new household
      </Button>
      <TextInput 
        label="Join code" 
        value={joinCode} 
        onChangeText={setJoinCode} 
        style={{ marginBottom: 8 }}
      />
      <Button mode="outlined" onPress={onJoinHousehold}>Join household</Button>
      {syncMessage ? <HelperText type="info" visible>{syncMessage}</HelperText> : null}

      <Divider style={{ marginVertical: 8 }} />

      {/* Babies Section */}
      <Text variant="titleLarge" style={{ marginBottom: 8 }}>Babies</Text>
      <FlatList
        data={babies}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={item.birthdate ? new Date(item.birthdate).toDateString() : undefined}
            right={(props) => (
              <List.Icon {...props} icon={item.id === activeBabyId ? 'check-circle' : 'circle-outline'} />
            )}
            onPress={() => item.id && selectBaby(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
      />

      <Button mode="contained" style={{ marginTop: 16 }} onPress={() => setAddVisible(true)}>Add baby</Button>

      {/* Create Household Modal */}
      <Portal>
        <Modal visible={createHouseholdVisible} onDismiss={() => setCreateHouseholdVisible(false)} contentContainerStyle={{ backgroundColor: 'white', padding: 16, margin: 16, borderRadius: 16 }}>
          <Text variant="titleLarge" style={{ marginBottom: 8 }}>Create Household</Text>
          <TextInput 
            label="Household name" 
            value={householdName} 
            onChangeText={setHouseholdName} 
            style={{ marginBottom: 12 }}
          />
          <Button mode="contained" onPress={onCreateHousehold}>Create</Button>
        </Modal>
      </Portal>

      {/* Add Baby Modal */}
      <Portal>
        <Modal visible={addVisible} onDismiss={() => setAddVisible(false)} contentContainerStyle={{ backgroundColor: 'white', padding: 16, margin: 16, borderRadius: 16 }}>
          <Text variant="titleLarge" style={{ marginBottom: 8 }}>Add Baby</Text>
          <TextInput label="Name" value={name} onChangeText={setName} style={{ marginBottom: 12 }} />
          <DateTimePicker value={birthdate ?? new Date()} onChange={(_, d) => setBirthdate(d ?? birthdate)} />
          <Button mode="contained" style={{ marginTop: 12 }} onPress={onAdd}>Save</Button>
        </Modal>
      </Portal>
    </View>
  );
}