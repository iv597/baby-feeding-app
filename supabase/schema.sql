-- Enable row level security if needed
-- alter database postgres set "app.settings" to '...';

-- Households
create table if not exists public.households (
  id text primary key,
  created_at timestamp with time zone default now()
);

-- Members linking devices to a household
create table if not exists public.members (
  id text primary key,
  householdId text not null references public.households(id) on delete cascade,
  deviceId text not null,
  created_at timestamp with time zone default now()
);
create index if not exists members_household_idx on public.members(householdId);

-- Babies synced across household
create table if not exists public.babies (
  id text primary key,
  householdId text not null references public.households(id) on delete cascade,
  name text not null,
  birthdate bigint,
  updatedAt bigint not null,
  deleted boolean not null default false
);
create index if not exists babies_household_idx on public.babies(householdId);
create index if not exists babies_updated_idx on public.babies(updatedAt);

-- Feed entries synced across household
create table if not exists public.feed_entries (
  id text primary key,
  householdId text not null references public.households(id) on delete cascade,
  babyId text not null references public.babies(id) on delete cascade,
  type text not null,
  createdAt bigint not null,
  quantityMl real,
  durationMin real,
  side text,
  foodName text,
  foodAmountGrams real,
  notes text,
  updatedAt bigint not null,
  deleted boolean not null default false
);
create index if not exists feeds_household_idx on public.feed_entries(householdId);
create index if not exists feeds_updated_idx on public.feed_entries(updatedAt);

-- Optionally add RLS policies here if you add auth; for anon-key usage in demo, keep public readable/writable.