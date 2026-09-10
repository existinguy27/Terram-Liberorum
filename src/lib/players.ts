import { supabase } from './supabase';

export const PLAYERS = [
  { id: 'kael', name: 'Kael', character_name: 'Kael', color: '#ff8c00' },
  { id: 'hannya', name: 'Hannya', character_name: 'Hannya', color: '#800080' },
  { id: 'silas', name: 'Silas', character_name: 'Silas', color: '#c0c0c0' },
  { id: 'ryuin', name: 'Ryuin', character_name: 'Ryuin', color: '#2ecc71' },
] as const;

export type PlayerId = typeof PLAYERS[number]['id'];
export type Player = typeof PLAYERS[number];

export function getPlayerById(id: PlayerId): Player | undefined {
  return PLAYERS.find(p => p.id === id);
}

export function getPlayerColor(playerId: PlayerId): string {
  return getPlayerById(playerId)?.color || '#ffffff';
}

const STORAGE_KEY = 'tl-device-token';
const PLAYER_STORAGE_KEY = 'tl-player-id';

export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setDeviceToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearDeviceToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PLAYER_STORAGE_KEY);
}

export function getRegisteredPlayerId(): PlayerId | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PLAYER_STORAGE_KEY) as PlayerId | null;
}

export function setRegisteredPlayerId(playerId: PlayerId): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLAYER_STORAGE_KEY, playerId);
}

export function isGmOverride(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('gm') === 'true';
}

export function isResetRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('reset') === 'true';
}

export function getPreviewPlayerId(): PlayerId | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const preview = params.get('preview');
  if (preview && PLAYERS.some(p => p.id === preview)) {
    return preview as PlayerId;
  }
  return null;
}

export function generateDeviceToken(): string {
  return crypto.randomUUID();
}

export async function registerDevice(playerId: PlayerId, deviceToken: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ device_token: deviceToken })
    .eq('name', playerId);

  if (error) throw error;
}

export async function getPlayerByDeviceToken(deviceToken: string): Promise<PlayerId | null> {
  const { data, error } = await supabase
    .from('players')
    .select('name')
    .eq('device_token', deviceToken)
    .single();

  if (error || !data) return null;
  return data.name as PlayerId;
}