import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { getFeedsBetween } from '../db';
import { DailyTotals, FeedEntry } from '../types';
import { startOfDay, subDays, endOfDay, format } from 'date-fns';
import { useAppContext } from '../context/AppContext';

function computeDailyTotals(entries: FeedEntry[]): DailyTotals[] {
  const map = new Map<string, DailyTotals>();
  for (const e of entries) {
    const key = format(e.createdAt, 'yyyy-MM-dd');
    let agg = map.get(key);
    if (!agg) {
      agg = {
        dateKey: key,
        breastmilkSessions: 0,
        breastmilkMinutes: 0,
        formulaMl: 0,
        waterMl: 0,
        solidsCount: 0,
        solidsGrams: 0,
      };
      map.set(key, agg);
    }
    if (e.type === 'breastmilk') {
      agg.breastmilkSessions += 1;
      agg.breastmilkMinutes += e.durationMin ?? 0;
    } else if (e.type === 'formula') {
      agg.formulaMl += e.quantityMl ?? 0;
    } else if (e.type === 'water') {
      agg.waterMl += e.quantityMl ?? 0;
    } else if (e.type === 'solid') {
      agg.solidsCount += 1;
      agg.solidsGrams += e.foodAmountGrams ?? 0;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export default function StatsScreen() {
  const { activeBabyId } = useAppContext();
  const [totals, setTotals] = useState<DailyTotals[]>([]);

  const refresh = async () => {
    if (!activeBabyId) return;
    const end = endOfDay(new Date()).getTime();
    const start = startOfDay(subDays(new Date(), 6)).getTime();
    const rows = await getFeedsBetween(activeBabyId, start, end);
    setTotals(computeDailyTotals(rows));
  };

  useEffect(() => {
    refresh();
  }, [activeBabyId]);

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={{ marginBottom: 8 }}>Last 7 days</Text>
      {totals.map((t) => (
        <Card key={t.dateKey} style={{ marginBottom: 8 }}>
          <Card.Title title={format(new Date(t.dateKey), 'PPPP')} />
          <Card.Content>
            <Text>Breastmilk: {t.breastmilkSessions} sessions, {t.breastmilkMinutes} min</Text>
            <Text>Formula: {t.formulaMl} ml</Text>
            <Text>Water: {t.waterMl} ml</Text>
            <Text>Solids: {t.solidsCount} items, {t.solidsGrams} g</Text>
          </Card.Content>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});