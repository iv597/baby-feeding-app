import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { IconButton, List, Text } from 'react-native-paper';
import { deleteFeed, getRecentFeeds } from '../db';
import { FeedEntry } from '../types';
import { format } from 'date-fns';
import { useAppContext } from '../context/AppContext';

function renderSubtitle(item: FeedEntry): string {
  switch (item.type) {
    case 'breastmilk':
      return `${item.side ?? ''} ${item.durationMin ? `${item.durationMin} min` : ''}`.trim();
    case 'formula':
    case 'water':
    case 'pump':
      return item.quantityMl ? `${item.quantityMl} ml` : '';
    case 'solid':
      return `${item.foodName ?? ''} ${item.foodAmountGrams ? `${item.foodAmountGrams} g` : ''}`.trim();
    default:
      return '';
  }
}

export default function HistoryScreen() {
  const { activeBabyId } = useAppContext();
  const [data, setData] = useState<FeedEntry[]>([]);

  const refresh = async () => {
    if (!activeBabyId) return;
    const rows = await getRecentFeeds(activeBabyId, 100);
    setData(rows);
  };

  useEffect(() => {
    refresh();
  }, [activeBabyId]);

  const handleDelete = async (id?: number) => {
    if (!id) return;
    await deleteFeed(id);
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={{ marginBottom: 8 }}>Recent</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <List.Item
            title={item.type}
            description={`${renderSubtitle(item)}  ·  ${format(item.createdAt, 'PP p')}`}
            left={(props) => <List.Icon {...props} icon={
              item.type === 'breastmilk' ? 'baby-bottle-outline' :
              item.type === 'formula' ? 'cup-water' :
              item.type === 'water' ? 'water' : 'food-apple'} />}
            right={(props) => (
              <IconButton icon="delete" onPress={() => handleDelete(item.id)} />
            )}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});