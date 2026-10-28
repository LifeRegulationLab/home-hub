/** Sunrise and sunset for a day and place, NOAA's method, good to a minute or two. Pure. */
export function sunTimes(date: Date, lat: number, lon: number): { sunrise: Date; sunset: Date } | null {
  const rad = Math.PI / 180;
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfYear = Math.floor((start.getTime() - Date.UTC(date.getFullYear(), 0, 0)) / 86_400_000);
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (12 - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null;
  const ha = Math.acos(cosHa) / rad;
  const sunriseMin = 720 - 4 * (lon + ha) - eqTime;
  const sunsetMin = 720 - 4 * (lon - ha) - eqTime;
  return { sunrise: new Date(start.getTime() + sunriseMin * 60_000), sunset: new Date(start.getTime() + sunsetMin * 60_000) };
}
