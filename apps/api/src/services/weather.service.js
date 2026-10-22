import WeatherCache from '../models/WeatherCache.js';

const FALLBACK = { tempC: 24, humidity: 50, code: 0, bucket: 'mild', source: 'fallback' };

export async function getWeather(lat, lng) {
  if (!lat || !lng) return FALLBACK;
  const key = Math.round(lat) + ',' + Math.round(lng);
  let cached = null;
  try {
    cached = await WeatherCache.findOne({ key });
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) < 30 * 60 * 1000) {
      return { ...cached.data, source: 'cache' };
    }
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,relative_humidity_2m,weather_code');
    if (!res.ok) throw new Error('weather api failed');
    const json = await res.json();
    const cur = json.current || {};
    const data = {
      tempC: cur.temperature_2m ?? 24,
      humidity: cur.relative_humidity_2m ?? 50,
      code: cur.weather_code ?? 0
    };
    await WeatherCache.findOneAndUpdate({ key }, { key, data, fetchedAt: new Date() }, { upsert: true });
    return { ...data, source: 'live' };
  } catch (e) {
    if (cached?.data) return { ...cached.data, source: 'stale-cache' };
    return FALLBACK;
  }
}
