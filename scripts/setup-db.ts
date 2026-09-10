import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sql = `
-- Players table
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  character_name text not null,
  color_hex text not null,
  device_token text unique,
  created_at timestamp default now()
);

-- Insert the four players
insert into players (name, character_name, color_hex) values
  ('Kael', 'Kael', '#ff8c00'),
  ('Hannya', 'Hannya', '#800080'),
  ('Silas', 'Silas', '#c0c0c0'),
  ('Ryuin', 'Ryuin', '#2ecc71')
on conflict (name) do nothing;

-- Mail table
create table if not exists mail (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),
  title text not null,
  sender text not null,
  content text not null,
  created_at timestamp default now()
);

-- Locations table
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  continent text not null default 'Moravia',
  x_percent float not null,
  y_percent float not null,
  brief_description text,
  full_description text,
  notable_npcs text,
  connected_quests text,
  visible boolean default true,
  created_at timestamp default now()
);

-- Quests table
create table if not exists quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text check (type in ('main', 'side', 'rumor')) not null,
  status text check (status in ('active', 'complete', 'failed')) default 'active',
  description text,
  created_at timestamp default now()
);

-- NPCs table
create table if not exists npcs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  affiliation text,
  last_known_location text,
  description text,
  status text check (status in ('alive', 'dead', 'unknown')) default 'unknown',
  visible boolean default true,
  created_at timestamp default now()
);

-- Relics table
create table if not exists relics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('relic', 'boss', 'encounter')) not null,
  status text,
  description text,
  visible boolean default true,
  created_at timestamp default now()
);

-- Lore table
create table if not exists lore (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  content text,
  visible boolean default true,
  created_at timestamp default now()
);

-- Towns table
create table if not exists towns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  description text,
  services text,
  notable_npcs text,
  current_rumors text,
  visible boolean default true,
  created_at timestamp default now()
);
`;

async function setupDatabase() {
  console.log('Setting up database tables...');

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error creating tables:', error);
    // Try alternative approach - run each statement separately
    console.log('Trying alternative approach...');

    const statements = sql.split(';').filter(s => s.trim());

    for (const stmt of statements) {
      if (stmt.trim()) {
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt.trim() + ';' });
        if (stmtError) {
          console.error('Error executing:', stmt.trim().substring(0, 100), stmtError);
        } else {
          console.log('Executed:', stmt.trim().substring(0, 80));
        }
      }
    }
  } else {
    console.log('Database setup complete!');
  }

  // Verify tables exist
  const tables = ['players', 'mail', 'locations', 'quests', 'npcs', 'relics', 'lore', 'towns'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Table ${table} error:`, error.message);
    } else {
      console.log(`Table ${table} verified (${data?.length || 0} rows)`);
    }
  }
}

setupDatabase();