import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import MapView, { PROVIDER_GOOGLE, Circle, Polyline, Marker } from 'react-native-maps';
import { useLocation } from '../hooks/useLocation';
import { useNearbyBuses } from '../hooks/useNearbyBuses';
import { useLineTracking } from '../hooks/useLineTracking';
import { BusMarker } from '../components/BusMarker';
import { SP_REGION, COLORS, NEARBY_RADIUS_KM } from '../constants/config';
import { searchStops, getLinesByStop, searchLines } from '../services/sptrans';
import { StopMarker } from '../components/StopMarker';
import type { BusStop, BusLine } from '../types';

type SearchMode = 'stop' | 'line';

export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { location } = useLocation();
  const { buses, total, loading: busLoading, error, refresh } = useNearbyBuses(location);

  const [mode, setMode] = useState<SearchMode>('stop');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // busca de paradas
  const [stops, setStops] = useState<BusStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [stopLines, setStopLines] = useState<BusLine[]>([]);
  const [showLines, setShowLines] = useState(false);

  // busca de linhas
  const [lineResults, setLineResults] = useState<BusLine[]>([]);
  const [showLineResults, setShowLineResults] = useState(false);
  const [trackedLine, setTrackedLine] = useState<BusLine | null>(null);

  const { vehicles, stops: lineStops } = useLineTracking(trackedLine?.cl ?? null);

  const handleCenterOnMe = useCallback(() => {
    mapRef.current?.animateToRegion(
      { ...location, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600
    );
  }, [location]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      if (mode === 'stop') {
        const results = await searchStops(query);
        setStops(results.slice(0, 20));
      } else {
        const results = await searchLines(query);
        setLineResults(results);
        setShowLineResults(true);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível fazer a busca.');
    } finally {
      setSearching(false);
    }
  }, [query, mode]);

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

  const handleTrackLine = useCallback((line: BusLine) => {
    setTrackedLine(line);
    setShowLineResults(false);
    setStops([]); // limpa paradas soltas pra não poluir
  }, []);

  const handleStopTracking = useCallback(() => {
    setTrackedLine(null);
  }, []);

  // Enquadra o mapa no trajeto/ônibus da linha quando eles chegam
  useEffect(() => {
    const coords = [
      ...lineStops.map((s) => ({ latitude: s.py, longitude: s.px })),
      ...vehicles.map((v) => ({ latitude: v.py, longitude: v.px })),
    ];
    if (trackedLine && coords.length > 1) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
        animated: true,
      });
    }
  }, [trackedLine, lineStops.length, vehicles.length]);

  const totalBuses = buses.reduce((acc, b) => acc + b.vs.length, 0);
  const lineDestination = trackedLine
    ? trackedLine.sl === 1 ? trackedLine.tp : trackedLine.ts
    : '';

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
        {/* MODO NORMAL: raio + ônibus por perto */}
        {!trackedLine && (
          <>
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
                  lineLabel={line.c}
                  destination={line.sl === 1 ? line.lt0 : line.lt1}
                />
              ))
            )}
            {stops.map((stop) => (
              <StopMarker key={stop.cp} stop={stop} onPress={handleStopPress} />
            ))}
          </>
        )}

        {/* MODO LINHA: trajeto + paradas + ônibus da linha */}
        {trackedLine && (
          <>
            {lineStops.length > 1 && (
              <Polyline
                coordinates={lineStops.map((s) => ({ latitude: s.py, longitude: s.px }))}
                strokeColor={COLORS.primary}
                strokeWidth={4}
              />
            )}
            {lineStops.map((s) => (
              <Marker
                key={`ls-${s.cp}`}
                coordinate={{ latitude: s.py, longitude: s.px }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.stopDot} />
              </Marker>
            ))}
            {vehicles.map((v) => (
              <BusMarker
                key={`lv-${v.p}`}
                vehicle={v}
                lineLabel={trackedLine.lt}
                destination={lineDestination}
              />
            ))}
          </>
        )}
      </MapView>

      {/* Barra de busca com alternância Parada / Linha */}
      <View style={styles.searchWrap}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'stop' && styles.modeBtnActive]}
            onPress={() => setMode('stop')}
          >
            <Text style={[styles.modeText, mode === 'stop' && styles.modeTextActive]}>
              🚏 Parada
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'line' && styles.modeBtnActive]}
            onPress={() => setMode('line')}
          >
            <Text style={[styles.modeText, mode === 'line' && styles.modeTextActive]}>
              🚌 Linha
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            placeholder={mode === 'stop' ? 'Buscar parada...' : 'Buscar linha (ex: 847P)'}
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchBtnText}>Buscar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Status (só no modo normal) */}
      {!trackedLine && (
        <View style={styles.statusBar}>
          {busLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>{totalBuses} ônibus por perto</Text>
            </>
          )}
          <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>↻</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cabeçalho da linha rastreada */}
      {trackedLine && (
        <View style={styles.lineHeader}>
          <View style={styles.liveDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lineHeaderTitle}>Linha {trackedLine.lt}</Text>
            <Text style={styles.lineHeaderSub} numberOfLines={1}>
              → {lineDestination} · {vehicles.length} ônibus ao vivo
            </Text>
          </View>
          <TouchableOpacity onPress={handleStopTracking} style={styles.lineCloseBtn}>
            <Text style={styles.lineCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Botão centralizar */}
      <TouchableOpacity style={styles.locationBtn} onPress={handleCenterOnMe}>
        <Text style={styles.locationBtnText}>📍</Text>
      </TouchableOpacity>

      {/* Resultados da busca por linha */}
      {showLineResults && (
        <View style={styles.linesPanel}>
          <View style={styles.linesPanelHeader}>
            <Text style={styles.linesPanelTitle}>Linhas encontradas</Text>
            <TouchableOpacity onPress={() => setShowLineResults(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          {lineResults.length === 0 ? (
            <Text style={styles.noLinesText}>Nenhuma linha encontrada</Text>
          ) : (
            <FlatList
              data={lineResults}
              keyExtractor={(l) => `${l.cl}-${l.sl}`}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.lineRow} onPress={() => handleTrackLine(item)}>
                  <Text style={styles.lineRowBadge}>{item.lt}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineRowTitle} numberOfLines={1}>
                      {item.sl === 1 ? item.tp : item.ts}
                    </Text>
                    <Text style={styles.lineRowSub} numberOfLines={1}>
                      {item.sl === 1 ? item.ts : item.tp}
                    </Text>
                  </View>
                  <Text style={styles.lineRowGo}>Ver ›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

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
                <TouchableOpacity
                  style={styles.linePill}
                  onPress={() => {
                    setShowLines(false);
                    setMode('line');
                    handleTrackLine(item);
                  }}
                >
                  <Text style={styles.linePillText}>{item.lt}</Text>
                  <Text style={styles.linePillSub} numberOfLines={1}>
                    {item.tp}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.linesList}
            />
          )}
        </View>
      )}

      {!trackedLine && error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        !trackedLine && totalBuses === 0 && total > 0 && !busLoading ? (
          <View style={[styles.errorBanner, styles.infoBanner]}>
            <Text style={styles.errorText}>
              Nenhum ônibus dentro de {NEARBY_RADIUS_KM} km de você agora.
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
  searchWrap: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
    alignSelf: 'flex-start',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  modeTextActive: { color: '#fff' },
  searchBar: {
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
    top: 158,
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
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  refreshBtn: { padding: 2 },
  refreshText: { fontSize: 16, color: COLORS.primary },
  lineHeader: {
    position: 'absolute',
    top: 152,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  lineHeaderTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  lineHeaderSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  lineCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineCloseText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '700' },
  stopDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
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
  linesPanelTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 12 },
  linesPanelSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 10 },
  closeBtn: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },
  noLinesText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8 },
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
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  lineRowBadge: {
    backgroundColor: COLORS.primary,
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    minWidth: 64,
    textAlign: 'center',
  },
  lineRowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  lineRowSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  lineRowGo: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
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
