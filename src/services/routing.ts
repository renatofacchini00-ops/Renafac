import { getConfig } from './config-store';
import type { Coordinates, Route, RouteStep } from '../types';

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

export async function getTransitRoutes(
  origin: Coordinates,
  destination: Coordinates
): Promise<Route[]> {
  const { googleMapsKey } = await getConfig();
  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: 'transit',
    transit_mode: 'bus',
    alternatives: 'true',
    language: 'pt-BR',
    key: googleMapsKey,
  });

  const res = await fetch(`${DIRECTIONS_URL}?${params}`);
  const data = await res.json();

  if (data.status !== 'OK') return [];

  return data.routes.map((route: any): Route => {
    const leg = route.legs[0];
    const steps: RouteStep[] = leg.steps.map((step: any): RouteStep => {
      const base: RouteStep = {
        instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
        distance: step.distance.text,
        duration: step.duration.text,
      };
      if (step.travel_mode === 'TRANSIT' && step.transit_details) {
        const t = step.transit_details;
        base.vehicleType = t.line?.vehicle?.type ?? 'BUS';
        base.lineShortName = t.line?.short_name ?? t.line?.name ?? '';
        base.transitLine = t.line?.name ?? '';
        base.departureStop = t.departure_stop?.name ?? '';
        base.arrivalStop = t.arrival_stop?.name ?? '';
        base.numStops = t.num_stops ?? 0;
      }
      return base;
    });

    return {
      duration: leg.duration.text,
      distance: leg.distance.text,
      departureTime: leg.departure_time?.text ?? '',
      arrivalTime: leg.arrival_time?.text ?? '',
      steps,
    };
  });
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const { googleMapsKey } = await getConfig();
  const params = new URLSearchParams({
    address: `${address}, São Paulo, SP`,
    key: googleMapsKey,
    language: 'pt-BR',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`
  );
  const data = await res.json();

  if (data.status !== 'OK') return null;
  const loc = data.results[0]?.geometry?.location;
  if (!loc) return null;
  return { latitude: loc.lat, longitude: loc.lng };
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const { googleMapsKey } = await getConfig();
  const params = new URLSearchParams({
    latlng: `${coords.latitude},${coords.longitude}`,
    key: googleMapsKey,
    language: 'pt-BR',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`
  );
  const data = await res.json();
  return data.results?.[0]?.formatted_address ?? 'Localização atual';
}

export async function testGoogleMapsKey(): Promise<boolean> {
  const { googleMapsKey } = await getConfig();
  if (!googleMapsKey) return false;
  try {
    const params = new URLSearchParams({
      address: 'Avenida Paulista, São Paulo',
      key: googleMapsKey,
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );
    const data = await res.json();
    return data.status === 'OK';
  } catch {
    return false;
  }
}
