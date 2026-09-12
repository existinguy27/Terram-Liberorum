import { supabase } from './supabase';

export type Player = {
  id: string;
  name: string;
  character_name: string;
  color_hex: string;
  device_token: string | null;
  created_at: string;
};

export type Mail = {
  id: string;
  player_id: string | null;
  title: string;
  sender: string;
  content: string;
  created_at: string;
};

export type Location = {
  id: string;
  name: string;
  continent: string;
  x_percent: number;
  y_percent: number;
  brief_description: string | null;
  full_description: string | null;
  notable_npcs: string | null;
  connected_quests: string | null;
  visible: boolean;
  created_at: string;
};

export type Quest = {
  id: string;
  title: string;
  type: 'main' | 'side' | 'rumor';
  status: 'active' | 'complete' | 'failed';
  description: string | null;
  created_at: string;
};

export type NPC = {
  id: string;
  name: string;
  affiliation: string | null;
  last_known_location: string | null;
  description: string | null;
  status: 'alive' | 'dead' | 'unknown';
  visible: boolean;
  created_at: string;
};

export type Relic = {
  id: string;
  name: string;
  type: 'relic' | 'boss' | 'encounter';
  status: string | null;
  description: string | null;
  visible: boolean;
  created_at: string;
};

export type Lore = {
  id: string;
  title: string;
  category: string | null;
  content: string | null;
  visible: boolean;
  created_at: string;
};

export type Town = {
  id: string;
  name: string;
  region: string | null;
  description: string | null;
  services: string | null;
  notable_npcs: string | null;
  current_rumors: string | null;
  visible: boolean;
  created_at: string;
};

export type ContinentBorder = {
  id: string;
  name: string;
  continent: string;
  coords: [number, number][];
  label_x: number | null;
  label_y: number | null;
  fill_color: string | null;
  stroke_color: string | null;
  fill_opacity: number | null;
  border_type: 'continent' | 'ecozone' | 'path' | 'river';
  created_at: string;
};

// Generic CRUD functions
export async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as T[];
}

export async function insertOne<T>(table: string, row: Partial<T>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data as T;
}

export async function updateOne<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as T;
}

export async function deleteOne(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function toggleVisible(table: string, id: string, visible: boolean): Promise<void> {
  await updateOne(table, id, { visible } as any);
}

// Specific helpers
export async function fetchPlayers(): Promise<Player[]> {
  return fetchAll<Player>('players');
}

export async function fetchPlayerByDeviceToken(deviceToken: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('device_token', deviceToken)
    .single();
  if (error || !data) return null;
  return data as Player;
}

export async function fetchMail(): Promise<Mail[]> {
  return fetchAll<Mail>('mail');
}

export async function fetchLocations(): Promise<Location[]> {
  return fetchAll<Location>('locations');
}

export async function fetchQuests(): Promise<Quest[]> {
  return fetchAll<Quest>('quests');
}

export async function fetchNPCs(): Promise<NPC[]> {
  return fetchAll<NPC>('npcs');
}

export async function fetchRelics(): Promise<Relic[]> {
  return fetchAll<Relic>('relics');
}

export async function fetchLore(): Promise<Lore[]> {
  return fetchAll<Lore>('lore');
}

export async function fetchTowns(): Promise<Town[]> {
  return fetchAll<Town>('towns');
}

export async function fetchContinentBorders(continent: string): Promise<ContinentBorder[]> {
  const { data, error } = await supabase
    .from('continent_borders')
    .select('*')
    .eq('continent', continent)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as ContinentBorder[];
}

export async function updateContinentBorder(id: string, updates: Partial<ContinentBorder>): Promise<ContinentBorder> {
  return updateOne<ContinentBorder>('continent_borders', id, updates);
}

export async function insertContinentBorder(row: Partial<ContinentBorder>): Promise<ContinentBorder> {
  return insertOne<ContinentBorder>('continent_borders', row);
}