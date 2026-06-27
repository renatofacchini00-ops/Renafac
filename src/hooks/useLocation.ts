import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from '../types';
import { SP_REGION } from '../constants/config';

const SP_CENTER: Coordinates = {
  latitude: SP_REGION.latitude,
  longitude: SP_REGION.longitude,
};

export function useLocation() {
  const [location, setLocation] = useState<Coordinates>(SP_CENTER);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }
      setHasPermission(true);

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      setLoading(false);

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
        (pos) =>
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      );
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  return { location, hasPermission, loading };
}
