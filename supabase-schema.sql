-- Players table
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
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