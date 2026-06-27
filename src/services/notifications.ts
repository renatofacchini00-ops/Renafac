import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusPositions, getArrivalForecast, searchStops, getLinesByStop } from './sptrans';
import type { BusAlert, TimeWindow, Coordinates } from '../types';

export const ALERT_TASK_NAME = 'sp-bus-alert-check';
const ALERTS_KEY = '@sp_bus:alerts';

// Configuração global de como as notificações aparecem
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Verifica se agora está dentro de uma janela de horário
function isWithinTimeWindow(window: TimeWindow): boolean {
  const now = new Date();
  const totalNow = now.getHours() * 60 + now.getMinutes();
  const totalStart = window.startHour * 60 + window.startMinute;
  const totalEnd = window.endHour * 60 + window.endMinute;
  return totalNow >= totalStart && totalNow <= totalEnd;
}

// Verifica se hoje é um dia ativo
function isTodayActive(activeDays: number[]): boolean {
  return activeDays.includes(new Date().getDay());
}

export async function getAlerts(): Promise<BusAlert[]> {
  const raw = await AsyncStorage.getItem(ALERTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveAlert(alert: BusAlert): Promise<void> {
  const alerts = await getAlerts();
  const filtered = alerts.filter((a) => a.id !== alert.id);
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify([alert, ...filtered]));
}

export async function deleteAlert(id: string): Promise<void> {
  const alerts = await getAlerts();
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.filter((a) => a.id !== id)));
}

export async function toggleAlert(id: string): Promise<void> {
  const alerts = await getAlerts();
  const updated = alerts.map((a) =>
    a.id === id ? { ...a, enabled: !a.enabled } : a
  );
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Verifica se algum ônibus está perto do ponto de origem da rota e dentro do limite de minutos
async function checkBusesForAlert(alert: BusAlert): Promise<string[]> {
  const origin = alert.route.origin.coords;
  const maxKm = 1.5; // raio para buscar paradas próximas à origem

  // Busca posições de todos os ônibus
  const allBuses = await getBusPositions();

  const alerts: string[] = [];

  for (const line of allBuses) {
    for (const vehicle of line.vs) {
      const vehicleCoords: Coordinates = { latitude: vehicle.py, longitude: vehicle.px };
      const distKm = haversineKm(origin, vehicleCoords);

      // Ônibus está perto do ponto de origem
      if (distKm <= maxKm) {
        // Estima tempo em minutos com base na distância (velocidade média 20km/h em SP)
        const estimatedMinutes = Math.round((distKm / 20) * 60);

        if (estimatedMinutes <= alert.maxMinutesAway) {
          alerts.push(
            `🚌 Linha ${line.lt} a ~${estimatedMinutes} min do ponto de origem`
          );
        }
      }
    }
  }

  return alerts;
}

export async function runAlertCheck(): Promise<void> {
  try {
    const alerts = await getAlerts();
    const activeAlerts = alerts.filter((a) => a.enabled);

    for (const alert of activeAlerts) {
      if (!isTodayActive(alert.activeDays)) continue;

      const inWindow = alert.timeWindows.some(isWithinTimeWindow);
      if (!inWindow) continue;

      const messages = await checkBusesForAlert(alert);

      for (const msg of messages) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `SP Bus — ${alert.name}`,
            body: msg,
            data: { alertId: alert.id },
            sound: true,
          },
          trigger: null, // dispara imediatamente
        });
      }
    }
  } catch (e) {
    // Silencioso — background tasks não devem crashar
  }
}

// Define a background task
TaskManager.defineTask(ALERT_TASK_NAME, async () => {
  try {
    await runAlertCheck();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundAlertTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(ALERT_TASK_NAME);
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(ALERT_TASK_NAME, {
      minimumInterval: 60,       // no mínimo a cada 60 segundos
      stopOnTerminate: false,    // continua mesmo se fechar o app
      startOnBoot: true,         // inicia quando ligar o celular
    });
  }
}

export async function unregisterBackgroundAlertTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(ALERT_TASK_NAME);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(ALERT_TASK_NAME);
  }
}

export function formatTimeWindow(w: TimeWindow): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(w.startHour)}:${pad(w.startMinute)} – ${pad(w.endHour)}:${pad(w.endMinute)}`;
}

export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [0, 6];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
