const cache = new Map<string, string>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address;
    if (!addr) return data.display_name || null;

    const parts = [
      addr.road || addr.neighbourhood || addr.suburb,
      addr.city || addr.town || addr.village || addr.county,
      addr.state,
    ].filter(Boolean);

    const place = parts.length > 0 ? parts.join(", ") : data.display_name;
    if (place) cache.set(key, place);
    return place || null;
  } catch {
    return null;
  }
}
