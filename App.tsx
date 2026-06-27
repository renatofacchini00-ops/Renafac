import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

import { MapScreen } from './src/screens/MapScreen';
import { RoutePlannerScreen } from './src/screens/RoutePlannerScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { COLORS } from './src/constants/config';
import { registerBackgroundAlertTask, requestNotificationPermission } from './src/services/notifications';

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    requestNotificationPermission();
    registerBackgroundAlertTask();

    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Futura navegação ao tocar na notificação
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerStyle: { backgroundColor: COLORS.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textSecondary,
            tabBarStyle: {
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            tabBarIcon: ({ focused, color }) => {
              const icons: Record<string, string> = {
                Mapa: '🗺️',
                Rotas: '🔄',
                Favoritos: '⭐',
                Alertas: '🔔',
              };
              return <TabIcon icon={icons[route.name]} color={color} focused={focused} />;
            },
          })}
        >
          <Tab.Screen
            name="Mapa"
            component={MapScreen}
            options={{ title: 'SP Bus — Mapa' }}
          />
          <Tab.Screen
            name="Rotas"
            component={RoutePlannerScreen}
            options={{ title: 'Planejar Rota' }}
          />
          <Tab.Screen
            name="Favoritos"
            component={FavoritesScreen}
            options={{ title: 'Favoritos' }}
          />
          <Tab.Screen
            name="Alertas"
            component={AlertsScreen}
            options={{ title: 'Alertas de Ônibus' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function TabIcon({ icon, color, focused }: { icon: string; color: string; focused: boolean }) {
  const { Text } = require('react-native');
  return (
    <Text style={{ fontSize: focused ? 22 : 19, opacity: focused ? 1 : 0.6 }}>{icon}</Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
