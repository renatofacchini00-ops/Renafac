import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import {
  getAlerts,
  saveAlert,
  deleteAlert,
  toggleAlert,
  requestNotificationPermission,
  registerBackgroundAlertTask,
  formatTimeWindow,
  DAY_NAMES,
  WEEKDAYS,
  WEEKEND,
  ALL_DAYS,
} from '../services/notifications';
import { getFavoriteRoutes } from '../services/storage';
import { COLORS } from '../constants/config';
import type { BusAlert, FavoriteRoute, TimeWindow } from '../types';

export function AlertsScreen() {
  const [alerts, setAlerts] = useState<BusAlert[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [alertName, setAlertName] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<FavoriteRoute | null>(null);
  const [startHour, setStartHour] = useState('7');
  const [startMin, setStartMin] = useState('25');
  const [endHour, setEndHour] = useState('8');
  const [endMin, setEndMin] = useState('0');
  const [maxMinutes, setMaxMinutes] = useState('10');
  const [activeDays, setActiveDays] = useState<number[]>(WEEKDAYS);

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([getAlerts(), getFavoriteRoutes()]);
    setAlerts(a);
    setFavoriteRoutes(r);
  }, []);

  useEffect(() => {
    load();
    requestNotificationPermission();
    registerBackgroundAlertTask();
  }, [load]);

  const handleToggle = useCallback(
    async (id: string) => {
      await toggleAlert(id);
      await load();
    },
    [load]
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Remover alerta', 'Deseja excluir este alerta?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteAlert(id);
            await load();
          },
        },
      ]);
    },
    [load]
  );

  const toggleDay = useCallback((day: number) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!alertName.trim()) {
      Alert.alert('Preencha o nome do alerta');
      return;
    }
    if (!selectedRoute) {
      Alert.alert('Selecione uma rota favorita');
      return;
    }
    if (activeDays.length === 0) {
      Alert.alert('Selecione ao menos um dia');
      return;
    }

    const timeWindow: TimeWindow = {
      startHour: parseInt(startHour, 10) || 7,
      startMinute: parseInt(startMin, 10) || 25,
      endHour: parseInt(endHour, 10) || 8,
      endMinute: parseInt(endMin, 10) || 0,
    };

    const alert: BusAlert = {
      id: `alert-${Date.now()}`,
      name: alertName.trim(),
      route: selectedRoute,
      timeWindows: [timeWindow],
      maxMinutesAway: parseInt(maxMinutes, 10) || 10,
      activeDays,
      enabled: true,
      createdAt: Date.now(),
    };

    await saveAlert(alert);
    setShowForm(false);
    resetForm();
    await load();
  }, [alertName, selectedRoute, startHour, startMin, endHour, endMin, maxMinutes, activeDays, load]);

  const resetForm = () => {
    setAlertName('');
    setSelectedRoute(null);
    setStartHour('7');
    setStartMin('25');
    setEndHour('8');
    setEndMin('0');
    setMaxMinutes('10');
    setActiveDays(WEEKDAYS);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Nenhum alerta configurado</Text>
            <Text style={styles.emptyText}>
              Crie um alerta para ser notificado quando um ônibus estiver próximo
              à sua rota em horários específicos.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardRoute} numberOfLines={1}>
                  {item.route.name}
                </Text>
              </View>
              <Switch
                value={item.enabled}
                onValueChange={() => handleToggle(item.id)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.cardDetails}>
              {item.timeWindows.map((w, i) => (
                <View key={i} style={styles.detailRow}>
                  <Text style={styles.detailIcon}>🕐</Text>
                  <Text style={styles.detailText}>{formatTimeWindow(w)}</Text>
                </View>
              ))}
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>🚌</Text>
                <Text style={styles.detailText}>
                  Avisar quando ônibus estiver a menos de {item.maxMinutesAway} min
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailText}>
                  {item.activeDays.map((d) => DAY_NAMES[d]).join(', ')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id)}
            >
              <Text style={styles.deleteBtnText}>Excluir alerta</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)}>
        <Text style={styles.fabText}>+ Novo Alerta</Text>
      </TouchableOpacity>

      {/* Modal de criação */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Alerta</Text>
            <TouchableOpacity
              onPress={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nome do alerta</Text>
          <TextInput
            style={styles.input}
            placeholder='Ex: Casa → Trabalho manhã'
            placeholderTextColor={COLORS.textSecondary}
            value={alertName}
            onChangeText={setAlertName}
          />

          <Text style={styles.label}>Rota a monitorar</Text>
          {favoriteRoutes.length === 0 ? (
            <Text style={styles.noRoutes}>
              Salve uma rota nos favoritos primeiro (aba Rotas → ★ Salvar)
            </Text>
          ) : (
            favoriteRoutes.map((route) => (
              <TouchableOpacity
                key={route.id}
                style={[
                  styles.routeOption,
                  selectedRoute?.id === route.id && styles.routeOptionSelected,
                ]}
                onPress={() => setSelectedRoute(route)}
              >
                <Text
                  style={[
                    styles.routeOptionText,
                    selectedRoute?.id === route.id && styles.routeOptionTextSelected,
                  ]}
                  numberOfLines={2}
                >
                  {route.name}
                </Text>
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.label}>Janela de horário</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeGroup}>
              <Text style={styles.timeLabel}>De</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={styles.timeInput}
                  value={startHour}
                  onChangeText={setStartHour}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="07"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.timeSep}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={startMin}
                  onChangeText={setStartMin}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="25"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <Text style={styles.timeArrow}>→</Text>

            <View style={styles.timeGroup}>
              <Text style={styles.timeLabel}>Até</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={styles.timeInput}
                  value={endHour}
                  onChangeText={setEndHour}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="08"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.timeSep}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={endMin}
                  onChangeText={setEndMin}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>
          </View>

          <Text style={styles.label}>Notificar quando ônibus estiver a menos de X minutos</Text>
          <View style={styles.minutesRow}>
            {[5, 10, 15, 20].map((min) => (
              <TouchableOpacity
                key={min}
                style={[
                  styles.minuteChip,
                  maxMinutes === String(min) && styles.minuteChipSelected,
                ]}
                onPress={() => setMaxMinutes(String(min))}
              >
                <Text
                  style={[
                    styles.minuteChipText,
                    maxMinutes === String(min) && styles.minuteChipTextSelected,
                  ]}
                >
                  {min} min
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.minutesCustom}
              value={maxMinutes}
              onChangeText={setMaxMinutes}
              keyboardType="numeric"
              maxLength={2}
              placeholder="Outro"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <Text style={styles.label}>Dias da semana</Text>
          <View style={styles.daysRow}>
            {[
              { label: 'Dias úteis', days: WEEKDAYS },
              { label: 'Final de semana', days: WEEKEND },
              { label: 'Todos os dias', days: ALL_DAYS },
            ].map(({ label, days }) => (
              <TouchableOpacity
                key={label}
                style={styles.dayPreset}
                onPress={() => setActiveDays(days)}
              >
                <Text style={styles.dayPresetText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {DAY_NAMES.map((name, day) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayChip, activeDays.includes(day) && styles.dayChipSelected]}
                onPress={() => toggleDay(day)}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    activeDays.includes(day) && styles.dayChipTextSelected,
                  ]}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Salvar Alerta</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardRoute: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardDetails: { gap: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { fontSize: 14, width: 20 },
  detailText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  deleteBtn: { marginTop: 12, alignSelf: 'flex-end' },
  deleteBtnText: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    left: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalContent: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  closeBtn: { fontSize: 22, color: COLORS.textSecondary, padding: 4 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noRoutes: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },
  routeOption: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  routeOptionSelected: { borderColor: COLORS.primary },
  routeOptionText: { fontSize: 14, color: COLORS.text },
  routeOptionTextSelected: { color: COLORS.primary, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeGroup: { flex: 1 },
  timeLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: 52,
    textAlign: 'center',
  },
  timeSep: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  timeArrow: { fontSize: 18, color: COLORS.textSecondary },
  minutesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  minuteChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  minuteChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '18' },
  minuteChipText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  minuteChipTextSelected: { color: COLORS.primary },
  minutesCustom: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    fontSize: 14,
    color: COLORS.text,
    width: 80,
    textAlign: 'center',
  },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  dayPreset: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary + '18',
    borderRadius: 20,
  },
  dayPresetText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', gap: 6 },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  dayChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  dayChipText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  dayChipTextSelected: { color: '#fff' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
