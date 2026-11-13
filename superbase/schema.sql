-- Jalankan di Supabase Dashboard > SQL Editor.
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Obrolan baru',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_created_idx on public.chat_sessions(user_id, created_at desc);
create index if not exists chat_messages_session_created_idx on public.chat_messages(session_id, created_at);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "users manage own sessions" on public.chat_sessions;
create policy "users manage own sessions" on public.chat_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users manage own messages" on public.chat_messages;
create policy "users manage own messages" on public.chat_messages
  for all to authenticated
  using (auth.uid() = user_id and exists (
    select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid()
  ))
  with check (auth.uid() = user_id and exists (
    select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid()
  ));
