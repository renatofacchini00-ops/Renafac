import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/config';
import type { Route } from '../types';

interface Props {
  route: Route;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

export function RouteCard({ route, index, selected, onSelect }: Props) {
  const transitSteps = route.steps.filter((s) => s.lineShortName);

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.optionLabel}>Opção {index + 1}</Text>
        <Text style={styles.duration}>{route.duration}</Text>
      </View>

      <View style={styles.times}>
        <Text style={styles.timeText}>
          {route.departureTime} → {route.arrivalTime}
        </Text>
        <Text style={styles.distance}>{route.distance}</Text>
      </View>

      <View style={styles.lines}>
        {transitSteps.map((step, i) => (
          <View key={i} style={styles.lineBadge}>
            <Text style={styles.lineBadgeText}>🚌 {step.lineShortName}</Text>
          </View>
        ))}
        {transitSteps.length === 0 && (
          <Text style={styles.walkText}>🚶 Caminhada</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    width: 220,
    borderWidth: 2,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardSelected: {
    borderColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  duration: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  distance: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  lines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lineBadge: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lineBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  walkText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
