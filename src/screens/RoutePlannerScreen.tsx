import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getTransitRoutes, geocodeAddress, reverseGeocode } from '../services/routing';
import { addRecentRoute, saveFavoriteRoute } from '../services/storage';
import { RouteCard } from '../components/RouteCard';
import { useLocation } from '../hooks/useLocation';
import { COLORS } from '../constants/config';
import type { Route, Coordinates, FavoriteRoute } from '../types';

export function RoutePlannerScreen() {
  const { location } = useLocation();
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originCoords, setOriginCoords] = useState<Coordinates | null>(null);
  const [destCoords, setDestCoords] = useState<Coordinates | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [loading, setLoading] = useState(false);

  const useMyLocation = useCallback(async () => {
    setOriginCoords(location);
    const addr = await reverseGeocode(location);
    setOriginText(addr);
  }, [location]);

  const handleSearch = useCallback(async () => {
    if (!originText.trim() || !destText.trim()) {
      Alert.alert('Preencha origem e destino');
      return;
    }
    setLoading(true);
    try {
      let oCoords = originCoords;
      let dCoords = destCoords;

      if (!oCoords) {
        oCoords = await geocodeAddress(originText);
        if (!oCoords) throw new Error('Origem não encontrada');
        setOriginCoords(oCoords);
      }
      if (!dCoords) {
        dCoords = await geocodeAddress(destText);
        if (!dCoords) throw new Error('Destino não encontrado');
        setDestCoords(dCoords);
      }

      const results = await getTransitRoutes(oCoords, dCoords);
      if (results.length === 0) {
        Alert.alert('Nenhuma rota encontrada', 'Tente outros endereços.');
        return;
      }
      setRoutes(results);
      setSelectedRoute(0);

      const recent: FavoriteRoute = {
        id: `${Date.now()}`,
        name: `${originText} → ${destText}`,
        origin: { address: originText, coords: oCoords },
        destination: { address: destText, coords: dCoords },
        createdAt: Date.now(),
      };
      await addRecentRoute(recent);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível buscar rotas. Configure a chave do Google Maps.');
    } finally {
      setLoading(false);
    }
  }, [originText, destText, originCoords, destCoords]);

  const handleSaveFavorite = useCallback(async () => {
    if (!originCoords || !destCoords) return;
    const fav: FavoriteRoute = {
      id: `fav-${Date.now()}`,
      name: `${originText} → ${destText}`,
      origin: { address: originText, coords: originCoords },
      destination: { address: destText, coords: destCoords },
      createdAt: Date.now(),
    };
    await saveFavoriteRoute(fav);
    Alert.alert('Salvo', 'Rota adicionada aos favoritos!');
  }, [originText, destText, originCoords, destCoords]);

  const route = routes[selectedRoute];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Inputs */}
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputIcon}>🟢</Text>
            <TextInput
              style={styles.input}
              placeholder="De onde você vai sair?"
              placeholderTextColor={COLORS.textSecondary}
              value={originText}
              onChangeText={(t) => {
                setOriginText(t);
                setOriginCoords(null);
              }}
              returnKeyType="next"
            />
          </View>
          <TouchableOpacity style={styles.myLocationBtn} onPress={useMyLocation}>
            <Text style={styles.myLocationText}>📍 Usar minha localização</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <View style={styles.inputRow}>
            <Text style={styles.inputIcon}>🔴</Text>
            <TextInput
              style={styles.input}
              placeholder="Para onde você vai?"
              placeholderTextColor={COLORS.textSecondary}
              value={destText}
              onChangeText={(t) => {
                setDestText(t);
                setDestCoords(null);
              }}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
          onPress={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Buscar Rotas</Text>
          )}
        </TouchableOpacity>

        {routes.length > 0 && (
          <>
            <View style={styles.routesHeader}>
              <Text style={styles.sectionTitle}>
                {routes.length} rota{routes.length > 1 ? 's' : ''} encontrada{routes.length > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={handleSaveFavorite}>
                <Text style={styles.saveBtn}>★ Salvar</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={routes}
              keyExtractor={(_, i) => String(i)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.routesList}
              renderItem={({ item, index }) => (
                <RouteCard
                  route={item}
                  index={index}
                  selected={selectedRoute === index}
                  onSelect={() => setSelectedRoute(index)}
                />
              )}
            />

            {route && (
              <View style={styles.stepsCard}>
                <Text style={styles.sectionTitle}>Passo a passo</Text>
                {route.steps.map((step, i) => (
                  <View key={i} style={styles.step}>
                    <View style={styles.stepDot}>
                      <Text style={styles.stepDotText}>
                        {step.lineShortName ? '🚌' : '🚶'}
                      </Text>
                    </View>
                    <View style={styles.stepContent}>
                      {step.lineShortName && (
                        <Text style={styles.stepLine}>Linha {step.lineShortName}</Text>
                      )}
                      <Text style={styles.stepInstruction}>{step.instruction}</Text>
                      {step.departureStop && (
                        <Text style={styles.stepDetail}>
                          {step.departureStop} → {step.arrivalStop}
                          {step.numStops ? ` (${step.numStops} paradas)` : ''}
                        </Text>
                      )}
                      <Text style={styles.stepMeta}>
                        {step.distance} · {step.duration}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 12,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  input: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 8 },
  myLocationBtn: { marginLeft: 30, marginTop: 4, marginBottom: 2 },
  myLocationText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  separator: { height: 1, backgroundColor: COLORS.border, marginVertical: 10, marginLeft: 30 },
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  routesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  saveBtn: { fontSize: 14, color: COLORS.accent, fontWeight: '700' },
  routesList: { paddingRight: 16, marginBottom: 20 },
  stepsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    marginTop: 8,
  },
  step: { flexDirection: 'row', gap: 12, marginTop: 14 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotText: { fontSize: 14 },
  stepContent: { flex: 1 },
  stepLine: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  stepInstruction: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  stepDetail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  stepMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
});
