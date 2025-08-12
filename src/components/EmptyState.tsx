import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export default function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <Text variant="titleMedium" style={{ marginBottom: 6 }}>{title}</Text>
      {subtitle ? <Text style={{ opacity: 0.7 }}>{subtitle}</Text> : null}
    </View>
  );
}