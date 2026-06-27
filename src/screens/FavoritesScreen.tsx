import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  SectionList,
} from 'react-native';
import { useFavorites } from '../hooks/useFavorites';
import { COLORS } from '../constants/config';
import type { FavoriteRoute, FavoriteStop } from '../types';

interface Props {
  onNavigateToRoute?: (route: FavoriteRoute) => void;
}

export function FavoritesScreen({ onNavigateToRoute }: Props) {
  const { routes, stops, deleteRoute, deleteStop } = useFavorites();

  const confirmDeleteRoute = useCallback(
    (id: string) => {
      Alert.alert('Remover favorito', 'Deseja remover esta rota dos favoritos?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => deleteRoute(id) },
      ]);
    },
    [deleteRoute]
  );

  const confirmDeleteStop = useCallback(
    (id: string) => {
      Alert.alert('Remover favorito', 'Deseja remover esta parada dos favoritos?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => deleteStop(id) },
      ]);
    },
    [deleteStop]
  );

  const sections = [
    {
      title: 'Rotas',
      data: routes,
      type: 'route' as const,
    },
    {
      title: 'Paradas',
      data: stops,
      type: 'stop' as const,
    },
  ].filter((s) => s.data.length > 0);

  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>⭐</Text>
        <Text style={styles.emptyTitle}>Nenhum favorito ainda</Text>
        <Text style={styles.emptyText}>
          Salve rotas na aba Rotas ou paradas no mapa para acessá-las aqui.
        </Text>
      </View>
    );
  }

  return (
    <SectionList<FavoriteRoute | FavoriteStop>
      sections={sections as any}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      renderSectionHeader={({ section }: any) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      renderItem={({ item, section }: any) => {
        if (section.type === 'route') {
          const route = item as FavoriteRoute;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onNavigateToRoute?.(route)}
              onLongPress={() => confirmDeleteRoute(route.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>🗺️</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {route.name}
                </Text>
                <Text style={styles.cardSub}>
                  {route.origin.address}
                </Text>
                <Text style={styles.cardSub}>→ {route.destination.address}</Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmDeleteRoute(route.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteBtn}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }

        const stop = item as FavoriteStop;
        return (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>🔵</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {stop.name}
              </Text>
              <Text style={styles.cardSub}>{stop.stop.ed}</Text>
            </View>
            <TouchableOpacity
              onPress={() => confirmDeleteStop(stop.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteBtn}>🗑️</Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardIconText: { fontSize: 20 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardSub: { fontSize: 12, color: COLORS.textSecondary },
  deleteBtn: { fontSize: 18, padding: 4 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
