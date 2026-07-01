import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { COLORS } from '../constants/config';
import type { BusVehicle } from '../types';

interface Props {
  vehicle: BusVehicle;
  lineLabel: string;   // letreiro da linha, ex: "847P-10"
  destination: string; // para onde o ônibus está indo (conforme o sentido)
}

// Transforma "2026-07-01T23:48:51Z" em algo como "há 2 min" ou "às 20:48".
function formatUpdated(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMin = Math.round((Date.now() - t) / 60000);
  if (diffMin <= 0) return 'agora mesmo';
  if (diffMin === 1) return 'há 1 min';
  if (diffMin < 60) return `há ${diffMin} min`;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `às ${hh}:${mm}`;
}

export function BusMarker({ vehicle, lineLabel, destination }: Props) {
  return (
    <Marker
      coordinate={{ latitude: vehicle.py, longitude: vehicle.px }}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.marker}>
        <Text style={styles.icon}>🚌</Text>
        <Text style={styles.label} numberOfLines={1}>
          {lineLabel}
        </Text>
      </View>
      <Callout tooltip>
        <View style={styles.callout}>
          <View style={styles.calloutHeader}>
            <Text style={styles.calloutBadge}>{lineLabel}</Text>
            {vehicle.a && <Text style={styles.accessible}>♿</Text>}
          </View>
          {!!destination && (
            <Text style={styles.calloutDest} numberOfLines={2}>
              Sentido {destination}
            </Text>
          )}
          <View style={styles.calloutRow}>
            <Text style={styles.calloutMeta}>Veículo {vehicle.p}</Text>
            <Text style={styles.calloutMeta}>{formatUpdated(vehicle.ta)}</Text>
          </View>
          <View style={styles.calloutArrow} />
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: {
    backgroundColor: COLORS.bus,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  icon: {
    fontSize: 15,
  },
  label: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 70,
  },
  callout: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    minWidth: 180,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calloutBadge: {
    backgroundColor: COLORS.bus,
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  accessible: { fontSize: 18, marginLeft: 8 },
  calloutDest: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  calloutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calloutMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  calloutArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.card,
  },
});
