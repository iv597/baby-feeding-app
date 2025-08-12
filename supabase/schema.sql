-- Enable row level security
alter database postgres set "app.settings" to '{"auth": {"enable_signup": true}}';

-- Enable RLS on all tables
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.babies enable row level security;
alter table public.feed_entries enable row level security;

-- User profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Link users to households with roles
create table if not exists public.user_households (
  user_id uuid references auth.users on delete cascade,
  household_id text references public.households on delete cascade,
  role text check (role in ('owner', 'member')) not null default 'member',
  joined_at timestamp with time zone default now(),
  primary key (user_id, household_id)
);

-- Households (now owned by users)
create table if not exists public.households (
  id text primary key,
  name text not null,
  owner_id uuid references auth.users on delete cascade not null,
  invite_code text unique not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Members linking users to a household (deprecated, use user_households instead)
create table if not exists public.members (
  id text primary key,
  householdId text not null references public.households(id) on delete cascade,
  deviceId text not null,
  created_at timestamp with time zone default now()
);

-- Babies synced across household
create table if not exists public.babies (
  id text primary key,
  householdId text not null references public.households(id) on delete cascade,
  name text not null,
  birthdate bigint,
  updatedAt bigint not null,
  deleted boolean not null default false
);

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

-- Stash items synced across household
create table if not exists public.stash_items (
  id text primary key,
  householdId text not null references public.households(id) on delete cascade,
  babyId text not null,
  createdAt bigint not null,
  volumeMl real not null,
  expiresAt bigint,
  status text not null default 'stored',
  notes text,
  updatedAt bigint not null,
  deleted boolean not null default false
);

-- Indexes
create index if not exists members_household_idx on public.members(householdId);
create index if not exists babies_household_idx on public.babies(householdId);
create index if not exists babies_updated_idx on public.babies(updatedAt);
create index if not exists feeds_household_idx on public.feed_entries(householdId);
create index if not exists feeds_updated_idx on public.feed_entries(updatedAt);
create index if not exists stash_household_idx on public.stash_items(householdId);
create index if not exists stash_updated_idx on public.stash_items(updatedAt);
create index if not exists user_households_user_idx on public.user_households(user_id);
create index if not exists user_households_household_idx on public.user_households(household_id);

-- RLS Policies

-- Profiles: users can only see/edit their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Households: users can only see households they're members of
create policy "Users can view households they belong to" on public.households
  for select using (
    id in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

create policy "Users can create households" on public.households
  for insert with check (auth.uid() = owner_id);

create policy "Owners can update their households" on public.households
  for update using (auth.uid() = owner_id);

-- User-households: users can see their memberships
create policy "Users can view their household memberships" on public.user_households
  for select using (user_id = auth.uid());

create policy "Users can join households" on public.user_households
  for insert with check (user_id = auth.uid());

-- Babies: users can only see babies in their households
create policy "Users can view babies in their households" on public.babies
  for select using (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

create policy "Users can insert babies in their households" on public.babies
  for insert with check (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

create policy "Users can update babies in their households" on public.babies
  for update using (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

-- Feed entries: users can only see feeds in their households
create policy "Users can view feeds in their households" on public.feed_entries
  for select using (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

create policy "Users can insert feeds in their households" on public.feed_entries
  for insert with check (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

create policy "Users can update feeds in their households" on public.feed_entries
  for update using (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

-- Stash items: users can only see stash in their households
create policy "Users can view stash in their households" on public.stash_items
  for select using (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

create policy "Users can insert stash in their households" on public.stash_items
  for insert with check (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

create policy "Users can update stash in their households" on public.stash_items
  for update using (
    householdId in (
      select household_id from public.user_households where user_id = auth.uid()
    )
  );

-- Functions and triggers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to generate invite codes
create or replace function public.generate_invite_code()
returns text as $$
begin
  return 'HH' || substr(md5(random()::text), 1, 8);
end;
$$ language plpgsql;

-- Function to create household with invite code
create or replace function public.create_household(household_name text)
returns text as $$
declare
  new_household_id text;
  new_invite_code text;
begin
  new_household_id := 'hh_' || substr(md5(random()::text), 1, 12);
  new_invite_code := public.generate_invite_code();
  
  insert into public.households (id, name, owner_id, invite_code)
  values (new_household_id, household_name, auth.uid(), new_invite_code);
  
  insert into public.user_households (user_id, household_id, role)
  values (auth.uid(), new_household_id, 'owner');
  
  return new_invite_code;
end;
$$ language plpgsql security definer;

-- Function to join household by invite code
create or replace function public.join_household(invite_code text)
returns text as $$
declare
  household_id text;
begin
  select id into household_id
  from public.households
  where invite_code = join_household.invite_code;
  
  if household_id is null then
    raise exception 'Invalid invite code';
  end if;
  
  insert into public.user_households (user_id, household_id, role)
  values (auth.uid(), household_id, 'member')
  on conflict do nothing;
  
  return household_id;
end;
$$ language plpgsql security definer;