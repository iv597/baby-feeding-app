import React, { useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { Button, List, Modal, Portal, SegmentedButtons, Text, TextInput, HelperText, Divider } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppContext } from '../context/AppContext';

export default function SettingsScreen() {
  const { babies, activeBabyId, selectBaby, addBaby, themeMode, setTheme, householdId, createCloudHousehold, joinCloudHousehold, syncCloud } = useAppContext();
  const [addVisible, setAddVisible] = useState(false);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [joinCode, setJoinCode] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const onAdd = async () => {
    await addBaby(name.trim() || 'Baby', birthdate ? birthdate.getTime() : null);
    setName('');
    setBirthdate(undefined);
    setAddVisible(false);
  };

  const onCreateCloud = async () => {
    try {
      const id = await createCloudHousehold();
      setSyncMessage(`Household created. Share this code with partner: ${id}`);
    } catch (e: any) {
      setSyncMessage(e.message || 'Failed to create household');
    }
  };

  const onJoinCloud = async () => {
    try {
      await joinCloudHousehold(joinCode);
      setSyncMessage('Joined household successfully.');
      setJoinCode('');
    } catch (e: any) {
      setSyncMessage(e.message || 'Failed to join household');
    }
  };

  const onSync = async () => {
    const res = await syncCloud();
    setSyncMessage(`Synced. Pushed ${res.pushed}, pulled ${res.pulled}.`);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
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

      <Text variant="titleLarge" style={{ marginBottom: 8 }}>Cloud sync</Text>
      {householdId ? (
        <>
          <Text>Connected household: {householdId}</Text>
          <Button mode="contained" style={{ marginTop: 8 }} onPress={onSync}>Sync now</Button>
        </>
      ) : (
        <>
          <Button mode="contained" onPress={onCreateCloud}>Create household</Button>
          <View style={{ height: 8 }} />
          <TextInput label="Join code" value={joinCode} onChangeText={setJoinCode} />
          <Button style={{ marginTop: 8 }} mode="outlined" onPress={onJoinCloud}>Join household</Button>
        </>
      )}
      {syncMessage ? <HelperText type="info" visible>{syncMessage}</HelperText> : null}

      <Divider style={{ marginVertical: 8 }} />

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