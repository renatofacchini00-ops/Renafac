import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { searchStops, getLinesByStop } from '../services/sptrans';
import { saveFavoriteRoute, addRecentRoute } from '../services/storage';
import { COLORS } from '../constants/config';
import type { BusStop, BusLine, FavoriteRoute } from '../types';

// Uma "linha direta" é uma linha (mesmo código/sentido) que serve tanto a
// parada de origem quanto a de destino.
interface DirectLine {
  line: BusLine;
}

export function RoutePlannerScreen() {
  const [originStop, setOriginStop] = useState<BusStop | null>(null);
  const [destStop, setDestStop] = useState<BusStop | null>(null);
  const [lines, setLines] = useState<DirectLine[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFindLines = useCallback(async () => {
    if (!originStop || !destStop) {
      Alert.alert('Escolha as duas paradas', 'Selecione a parada de origem e a de destino.');
      return;
    }
    setLoading(true);
    setLines(null);
    try {
      const [originLines, destLines] = await Promise.all([
        getLinesByStop(originStop.cp),
        getLinesByStop(destStop.cp),
      ]);
      const destCodes = new Set(destLines.map((l) => l.cl));
      const direct = originLines
        .filter((l) => destCodes.has(l.cl))
        .map((line) => ({ line }));
      setLines(direct);

      // guarda no histórico (usa as paradas como pontos)
      const recent: FavoriteRoute = {
        id: `${Date.now()}`,
        name: `${originStop.np} → ${destStop.np}`,
        origin: { address: originStop.np, coords: { latitude: originStop.py, longitude: originStop.px } },
        destination: { address: destStop.np, coords: { latitude: destStop.py, longitude: destStop.px } },
        createdAt: Date.now(),
      };
      await addRecentRoute(recent);
    } catch {
      Alert.alert('Erro', 'Não foi possível buscar as linhas. Tente de novo.');
    } finally {
      setLoading(false);
    }
  }, [originStop, destStop]);

  const handleSaveFavorite = useCallback(async () => {
    if (!originStop || !destStop) return;
    const fav: FavoriteRoute = {
      id: `fav-${Date.now()}`,
      name: `${originStop.np} → ${destStop.np}`,
      origin: { address: originStop.np, coords: { latitude: originStop.py, longitude: originStop.px } },
      destination: { address: destStop.np, coords: { latitude: destStop.py, longitude: destStop.px } },
      createdAt: Date.now(),
    };
    await saveFavoriteRoute(fav);
    Alert.alert('Salvo', 'Rota adicionada aos favoritos!');
  }, [originStop, destStop]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Escolha a parada de onde você sai e a parada aonde quer chegar. O app mostra as
          linhas de ônibus que ligam as duas. 🚌
        </Text>

        <StopPicker
          icon="🟢"
          label="Origem"
          placeholder="Buscar parada de origem..."
          selected={originStop}
          onSelect={(s) => { setOriginStop(s); setLines(null); }}
        />

        <StopPicker
          icon="🔴"
          label="Destino"
          placeholder="Buscar parada de destino..."
          selected={destStop}
          onSelect={(s) => { setDestStop(s); setLines(null); }}
        />

        <TouchableOpacity
          style={[styles.findBtn, loading && styles.findBtnDisabled]}
          onPress={handleFindLines}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.findBtnText}>Encontrar linhas</Text>
          )}
        </TouchableOpacity>

        {lines !== null && (
          <View style={styles.results}>
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionTitle}>
                {lines.length === 0
                  ? 'Nenhuma linha direta'
                  : `${lines.length} linha${lines.length > 1 ? 's' : ''} direta${lines.length > 1 ? 's' : ''}`}
              </Text>
              {lines.length > 0 && (
                <TouchableOpacity onPress={handleSaveFavorite}>
                  <Text style={styles.saveBtn}>★ Salvar</Text>
                </TouchableOpacity>
              )}
            </View>

            {lines.length === 0 ? (
              <Text style={styles.emptyText}>
                Não há uma linha única que ligue essas duas paradas. Você provavelmente precisa
                de baldeação (trocar de ônibus). Tente escolher paradas em avenidas maiores mais
                próximas da origem/destino.
              </Text>
            ) : (
              lines.map(({ line }) => (
                <View key={`${line.cl}`} style={styles.lineCard}>
                  <Text style={styles.lineBadge}>{line.lt}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineDest} numberOfLines={1}>
                      {line.sl === 1 ? line.tp : line.ts}
                    </Text>
                    <Text style={styles.lineSub} numberOfLines={1}>
                      Sentido {line.tp} ↔ {line.ts}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {lines.length > 0 && (
              <Text style={styles.tip}>
                💡 Confira o sentido do ônibus antes de embarcar. Para ver esses ônibus ao vivo,
                use a busca por 🚌 Linha no Mapa.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Sub-componente: busca e seleção de uma parada.
function StopPicker({
  icon,
  label,
  placeholder,
  selected,
  onSelect,
}: {
  icon: string;
  label: string;
  placeholder: string;
  selected: BusStop | null;
  onSelect: (stop: BusStop) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BusStop[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await searchStops(query);
      setResults(r.slice(0, 12));
    } catch {
      Alert.alert('Erro', 'Não foi possível buscar paradas.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  if (selected) {
    return (
      <View style={styles.card}>
        <Text style={styles.pickerLabel}>{icon} {label}</Text>
        <View style={styles.selectedRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName} numberOfLines={1}>{selected.np}</Text>
            <Text style={styles.selectedAddr} numberOfLines={1}>{selected.ed}</Text>
          </View>
          <TouchableOpacity
            onPress={() => { onSelect(null as any); setQuery(''); setResults([]); }}
          >
            <Text style={styles.changeBtn}>Trocar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.pickerLabel}>{icon} {label}</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={searching}>
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Buscar</Text>
          )}
        </TouchableOpacity>
      </View>
      {results.map((s) => (
        <TouchableOpacity
          key={s.cp}
          style={styles.resultRow}
          onPress={() => { onSelect(s); setResults([]); setQuery(''); }}
        >
          <Text style={styles.resultIcon}>🚏</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName} numberOfLines={1}>{s.np}</Text>
            <Text style={styles.resultAddr} numberOfLines={1}>{s.ed}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 14 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    marginBottom: 12,
  },
  pickerLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  resultIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  resultName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  resultAddr: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  selectedAddr: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  changeBtn: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  findBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  findBtnDisabled: { opacity: 0.6 },
  findBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  results: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  saveBtn: { fontSize: 14, color: COLORS.accent, fontWeight: '700' },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  lineBadge: {
    backgroundColor: COLORS.primary,
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    minWidth: 64,
    textAlign: 'center',
  },
  lineDest: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  lineSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  tip: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginTop: 12 },
});
