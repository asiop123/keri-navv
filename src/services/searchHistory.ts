import { supabase } from '@/integrations/supabase/client';

export interface SearchHistoryEntry {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  searchCount: number;
  createdAt: string;
}

export async function getSearchHistory(limit = 10): Promise<SearchHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .order('search_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      searchCount: row.search_count,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('Failed to fetch search history:', err);
    return [];
  }
}

export async function saveSearchHistory(entry: {
  name: string;
  address: string;
  lat: number;
  lng: number;
}): Promise<void> {
  try {
    // Upsert: increment count if same location exists
    const { data: existing } = await supabase
      .from('search_history')
      .select('id, search_count')
      .eq('user_id', 'default')
      .gte('lat', entry.lat - 0.0001)
      .lte('lat', entry.lat + 0.0001)
      .gte('lng', entry.lng - 0.0001)
      .lte('lng', entry.lng + 0.0001)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('search_history')
        .update({
          search_count: (existing[0] as any).search_count + 1,
          created_at: new Date().toISOString(),
          name: entry.name,
          address: entry.address,
        })
        .eq('id', (existing[0] as any).id);
    } else {
      await supabase.from('search_history').insert({
        name: entry.name,
        address: entry.address,
        lat: entry.lat,
        lng: entry.lng,
      });
    }
  } catch (err) {
    console.error('Failed to save search history:', err);
  }
}
