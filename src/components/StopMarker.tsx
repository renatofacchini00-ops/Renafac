import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { COLORS } from '../constants/config';
import type { BusStop } from '../types';

interface Props {
  stop: BusStop;
  onPress?: (stop: BusStop) => void;
}

export function StopMarker({ stop, onPress }: Props) {
  return (
    <Marker
      coordinate={{ latitude: stop.py, longitude: stop.px }}
      anchor={{ x: 0.5, y: 0.5 }}
      onCalloutPress={() => onPress?.(stop)}
    >
      <View style={styles.marker}>
        <Text style={styles.icon}>🔵</Text>
      </View>
      <Callout onPress={() => onPress?.(stop)}>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle} numberOfLines={2}>
            {stop.np}
          </Text>
          <Text style={styles.calloutText} numberOfLines={2}>
            {stop.ed}
          </Text>
          <Text style={styles.calloutAction}>Toque para ver linhas</Text>
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
  },
  callout: {
    padding: 8,
    minWidth: 180,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  calloutText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  calloutAction: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
});
