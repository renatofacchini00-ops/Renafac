import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { useLocation } from '../hooks/useLocation';
import { useNearbyBuses } from '../hooks/useNearbyBuses';
import { BusMarker } from '../components/BusMarker';
import { SP_REGION, COLORS, NEARBY_RADIUS_KM } from '../constants/config';
import { searchStops, getLinesByStop } from '../services/sptrans';
import { StopMarker } from '../components/StopMarker';
import type { BusStop, BusLine } from '../types';

export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { location, loading: locLoading } = useLocation();
  const { buses, total, loading: busLoading, error, refresh } = useNearbyBuses(location);

  const [stops, setStops] = useState<BusStop[]>([]);
  const [stopQuery, setStopQuery] = useState('');
  const [searchingStop, setSearchingStop] = useState(false);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [stopLines, setStopLines] = useState<BusLine[]>([]);
  const [showLines, setShowLines] = useState(false);

  const handleCenterOnMe = useCallback(() => {
    mapRef.current?.animateToRegion(
      {
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  }, [location]);

  const handleSearchStop = useCallback(async () => {
    if (!stopQuery.trim()) return;
    setSearchingStop(true);
    try {
      const results = await searchStops(stopQuery);
      setStops(results.slice(0, 20));
    } catch {
      Alert.alert('Erro', 'Não foi possível buscar as paradas.');
    } finally {
      setSearchingStop(false);
    }
  }, [stopQuery]);

  const handleStopPress = useCallback(async (stop: BusStop) => {
    setSelectedStop(stop);
    try {
      const lines = await getLinesByStop(stop.cp);
      setStopLines(lines);
      setShowLines(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível buscar as linhas desta parada.');
    }
  }, []);

  const totalBuses = buses.reduce((acc, b) => acc + b.vs.length, 0);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={SP_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Circle
          center={location}
          radius={NEARBY_RADIUS_KM * 1000}
          strokeColor={COLORS.primary + '44'}
          fillColor={COLORS.primary + '11'}
        />

        {buses.map((line) =>
          line.vs.map((vehicle) => (
            <BusMarker
              key={`${line.cl}-${vehicle.p}`}
              vehicle={vehicle}
              lineLabel={line.lt}
            />
          ))
        )}

        {stops.map((stop) => (
          <StopMarker key={stop.cp} stop={stop} onPress={handleStopPress} />
        ))}
      </MapView>

      {/* Barra de busca de paradas */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Buscar parada..."
          placeholderTextColor={COLORS.textSecondary}
          value={stopQuery}
          onChangeText={setStopQuery}
          onSubmitEditing={handleSearchStop}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={handleSearchStop}
          disabled={searchingStop}
        >
          {searchingStop ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Buscar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={styles.statusBar}>
        {busLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Text style={styles.statusText}>
            {totalBuses} perto · {total} na cidade
          </Text>
        )}
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Botão centralizar */}
      <TouchableOpacity style={styles.locationBtn} onPress={handleCenterOnMe}>
        <Text style={styles.locationBtnText}>📍</Text>
      </TouchableOpacity>

      {/* Painel de linhas da parada */}
      {showLines && selectedStop && (
        <View style={styles.linesPanel}>
          <View style={styles.linesPanelHeader}>
            <Text style={styles.linesPanelTitle} numberOfLines={1}>
              {selectedStop.np}
            </Text>
            <TouchableOpacity onPress={() => setShowLines(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.linesPanelSub}>{selectedStop.ed}</Text>
          {stopLines.length === 0 ? (
            <Text style={styles.noLinesText}>Nenhuma linha encontrada</Text>
          ) : (
            <FlatList
              data={stopLines}
              keyExtractor={(l) => String(l.cl)}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.linePill}>
                  <Text style={styles.linePillText}>{item.lt}</Text>
                  <Text style={styles.linePillSub} numberOfLines={1}>
                    {item.tp}
                  </Text>
                </View>
              )}
              style={styles.linesList}
            />
          )}
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        totalBuses === 0 && total > 0 && !busLoading ? (
          <View style={[styles.errorBanner, styles.infoBanner]}>
            <Text style={styles.errorText}>
              Nenhum ônibus dentro de {NEARBY_RADIUS_KM} km de você agora.
              {' '}Há {total} rodando na cidade — afaste o zoom para vê-los.
            </Text>
          </View>
        ) : null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  searchBar: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statusBar: {
    position: 'absolute',
    top: 114,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    gap: 8,
  },
  statusText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  refreshBtn: { padding: 2 },
  refreshText: { fontSize: 16, color: COLORS.primary },
  locationBtn: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: COLORS.card,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  locationBtnText: { fontSize: 22 },
  linesPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  linesPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linesPanelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: 12,
  },
  linesPanelSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 10 },
  closeBtn: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },
  noLinesText: { fontSize: 13, color: COLORS.textSecondary },
  linesList: { marginTop: 4 },
  linePill: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  linePillText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  linePillSub: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, maxWidth: 90 },
  errorBanner: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: COLORS.accent + 'EE',
    padding: 10,
    borderRadius: 10,
  },
  infoBanner: { backgroundColor: COLORS.primary + 'EE' },
  errorText: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '600' },
});
