-- Disable RLS on all tables for GM dashboard access
alter table players disable row level security;
alter table mail disable row level security;
alter table locations disable row level security;
alter table quests disable row level security;
alter table npcs disable row level security;
alter table relics disable row level security;
alter table lore disable row level security;
alter table towns disable row level security;