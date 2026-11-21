/**
 * Cities and regions the live camera directory can show. Each one maps to a public, openly licensed
 * camera feed served through /api/cameras (see functions/api/cameras.js for the sources and terms).
 */
export type Continent = 'Oceania' | 'Europe' | 'Asia' | 'North America';
export interface CameraRegion { id: string; name: string; country: string; continent: Continent; provider: string; lat: number; lon: number; r: number; d?: number }
export const CAMERA_REGIONS: CameraRegion[] = [
  { id: 'christchurch', name: 'Christchurch', country: 'New Zealand', continent: 'Oceania', provider: 'nzta', lat: -43.5321, lon: 172.6362, r: 30 },
  { id: 'auckland', name: 'Auckland', country: 'New Zealand', continent: 'Oceania', provider: 'nzta', lat: -36.8485, lon: 174.7633, r: 35 },
  { id: 'wellington', name: 'Wellington', country: 'New Zealand', continent: 'Oceania', provider: 'nzta', lat: -41.2866, lon: 174.7756, r: 30 },
  { id: 'hamilton', name: 'Hamilton', country: 'New Zealand', continent: 'Oceania', provider: 'nzta', lat: -37.787, lon: 175.2793, r: 40 },
  { id: 'dunedin', name: 'Dunedin', country: 'New Zealand', continent: 'Oceania', provider: 'nzta', lat: -45.8788, lon: 170.5028, r: 40 },
  { id: 'london', name: 'London', country: 'United Kingdom', continent: 'Europe', provider: 'tfl', lat: 51.5074, lon: -0.1278, r: 40 },
  { id: 'helsinki', name: 'Helsinki', country: 'Finland', continent: 'Europe', provider: 'fi', lat: 60.1699, lon: 24.9384, r: 40 },
  { id: 'tampere', name: 'Tampere', country: 'Finland', continent: 'Europe', provider: 'fi', lat: 61.4978, lon: 23.761, r: 45 },
  { id: 'turku', name: 'Turku', country: 'Finland', continent: 'Europe', provider: 'fi', lat: 60.4518, lon: 22.2666, r: 45 },
  { id: 'oulu', name: 'Oulu', country: 'Finland', continent: 'Europe', provider: 'fi', lat: 65.0121, lon: 25.4651, r: 60 },
  { id: 'rovaniemi', name: 'Rovaniemi (Lapland)', country: 'Finland', continent: 'Europe', provider: 'fi', lat: 66.5039, lon: 25.7294, r: 100 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', continent: 'Asia', provider: 'sgp', lat: 1.3521, lon: 103.8198, r: 40 },
  { id: 'vancouver', name: 'Vancouver', country: 'Canada', continent: 'North America', provider: 'bc', lat: 49.2827, lon: -123.1207, r: 45 },
  { id: 'victoria', name: 'Victoria BC', country: 'Canada', continent: 'North America', provider: 'bc', lat: 48.4284, lon: -123.3656, r: 35 },
  { id: 'kelowna', name: 'Kelowna', country: 'Canada', continent: 'North America', provider: 'bc', lat: 49.888, lon: -119.496, r: 60 },
  { id: 'kamloops', name: 'Kamloops', country: 'Canada', continent: 'North America', provider: 'bc', lat: 50.6745, lon: -120.3273, r: 70 },
  { id: 'prince-george', name: 'Prince George', country: 'Canada', continent: 'North America', provider: 'bc', lat: 53.9171, lon: -122.7497, r: 90 },
  { id: 'los-angeles', name: 'Los Angeles', country: 'United States', continent: 'North America', provider: 'caltrans', d: 7, lat: 34.0522, lon: -118.2437, r: 40 },
  { id: 'orange-county', name: 'Orange County CA', country: 'United States', continent: 'North America', provider: 'caltrans', d: 12, lat: 33.8366, lon: -117.9143, r: 30 },
  { id: 'san-diego', name: 'San Diego', country: 'United States', continent: 'North America', provider: 'caltrans', d: 11, lat: 32.7157, lon: -117.1611, r: 40 },
  { id: 'san-bernardino', name: 'San Bernardino / Riverside', country: 'United States', continent: 'North America', provider: 'caltrans', d: 8, lat: 34.1083, lon: -117.2898, r: 50 },
  { id: 'san-francisco', name: 'San Francisco', country: 'United States', continent: 'North America', provider: 'caltrans', d: 4, lat: 37.7749, lon: -122.4194, r: 35 },
  { id: 'san-jose', name: 'San Jose', country: 'United States', continent: 'North America', provider: 'caltrans', d: 4, lat: 37.3382, lon: -121.8863, r: 35 },
  { id: 'sacramento', name: 'Sacramento', country: 'United States', continent: 'North America', provider: 'caltrans', d: 3, lat: 38.5816, lon: -121.4944, r: 40 },
  { id: 'fresno', name: 'Fresno', country: 'United States', continent: 'North America', provider: 'caltrans', d: 6, lat: 36.7378, lon: -119.7871, r: 40 },
];
export const CONTINENTS: Continent[] = ['Oceania', 'Europe', 'Asia', 'North America'];
/** The region closest to a point, so the wall opens on the city you are standing in. */
export function nearestRegion(lat: number, lon: number): CameraRegion {
  const d = (r: CameraRegion) => Math.hypot(r.lat - lat, (r.lon - lon) * Math.cos(lat * Math.PI / 180));
  return [...CAMERA_REGIONS].sort((a, b) => d(a) - d(b))[0];
}
