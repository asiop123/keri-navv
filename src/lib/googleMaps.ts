import { supabase } from '@/integrations/supabase/client';

let cachedKey: string | null = null;
let pending: Promise<string> | null = null;

/**
 * Hämtar Google Maps API-nyckeln säkert från edge function.
 * Cacheas i minnet — inloggad användare krävs.
 */
export async function getGoogleMapsKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  if (pending) return pending;

  pending = (async () => {
    const { data, error } = await supabase.functions.invoke('google-maps-key');
    if (error || !data?.key) {
      pending = null;
      throw new Error(error?.message || 'Kunde inte hämta Google Maps-nyckel');
    }
    cachedKey = data.key as string;
    return cachedKey;
  })();

  return pending;
}

/**
 * Bygger en URL till Street View Static API.
 */
export async function getStreetViewUrl(
  lat: number,
  lng: number,
  size = '800x400',
): Promise<string> {
  const key = await getGoogleMapsKey();
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&key=${key}`;
}

/**
 * Laddar Google Maps JS SDK en gång (med Places-bibliotek).
 */
let loaderPromise: Promise<void> | null = null;
export async function loadGoogleMapsScript(libraries = 'places'): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).google?.maps) return;
  if (loaderPromise) return loaderPromise;

  loaderPromise = (async () => {
    const key = await getGoogleMapsKey();
    const existing = document.querySelector('script[data-google-maps-loader]');
    if (existing) {
      await new Promise<void>((res) => {
        if ((window as any).google?.maps) return res();
        existing.addEventListener('load', () => res(), { once: true });
      });
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=${libraries}&language=sv&region=SE`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = 'true';
      script.onload = () => resolve();
      script.onerror = () => {
        loaderPromise = null;
        reject(new Error('Kunde inte ladda Google Maps'));
      };
      document.head.appendChild(script);
    });
  })();

  return loaderPromise;
}
