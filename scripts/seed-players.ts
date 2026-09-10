import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!);

const players = [
  { name: 'Kael', character_name: 'Kael', color_hex: '#ff8c00' },
  { name: 'Hannya', character_name: 'Hannya', color_hex: '#800080' },
  { name: 'Silas', character_name: 'Silas', color_hex: '#c0c0c0' },
  { name: 'Ryuin', character_name: 'Ryuin', color_hex: '#2ecc71' },
];

for (const player of players) {
  const { data, error } = await supabase
    .from('players')
    .upsert(player, { onConflict: 'name' })
    .select();

  if (error) {
    console.error(`Error inserting ${player.name}:`, error);
  } else {
    console.log(`Inserted/updated: ${player.name}`, data);
  }
}

console.log('Done seeding players!');