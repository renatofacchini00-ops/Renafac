import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { COLORS } from '../constants/config';
import type { BusVehicle } from '../types';

interface Props {
  vehicle: BusVehicle;
  lineLabel: string;
}

export function BusMarker({ vehicle, lineLabel }: Props) {
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
      <Callout>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>Linha {lineLabel}</Text>
          <Text style={styles.calloutText}>Prefixo: {vehicle.p}</Text>
          <Text style={styles.calloutText}>
            {vehicle.a ? 'Acessível' : 'Não acessível'}
          </Text>
          <Text style={styles.calloutTime}>
            Atualizado: {vehicle.ta}
          </Text>
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    maxWidth: 60,
  },
  callout: {
    padding: 8,
    minWidth: 160,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  calloutTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
