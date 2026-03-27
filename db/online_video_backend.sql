-- =========================================================
-- ONLINE VIDEO SIGNALING BACKEND
-- Dedicated signaling transport for optional WebRTC inside online rooms.
-- Run after:
--   1. online room base SQL
--   2. online_x01_results_backend.sql
--   3. online_shanghai_backend.sql
--   4. online_atc_backend.sql
--   5. online_121_backend.sql
--   6. online_jdc_backend.sql
--
-- Notes:
-- - Uses a dedicated public.online_room_video_signals table.
-- - Only room members can emit or read signaling events.
-- - Intended signal types:
--   video_ready, video_offer, video_answer, video_ice, video_leave
-- =========================================================

create table if not exists public.online_room_video_signals (
    id bigint generated always as identity primary key,
    room_id uuid not null references public.online_rooms(id) on delete cascade,
    player_id uuid not null references public.profiles(id) on delete cascade,
    session_id text null,
    signal_type text not null check (
        signal_type in ('video_ready', 'video_offer', 'video_answer', 'video_ice', 'video_leave')
    ),
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_online_room_video_signals_room_id_id
    on public.online_room_video_signals(room_id, id);

create index if not exists idx_online_room_video_signals_room_id_player_id_id
    on public.online_room_video_signals(room_id, player_id, id);

alter table public.online_room_video_signals enable row level security;

drop policy if exists "room members can select online room video signals" on public.online_room_video_signals;
create policy "room members can select online room video signals"
on public.online_room_video_signals
for select
using (public.is_room_member(room_id, auth.uid()));

do $$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'online_room_video_signals'
    ) then
        execute 'alter publication supabase_realtime add table public.online_room_video_signals';
    end if;
exception
    when insufficient_privilege then
        raise notice 'Could not alter publication supabase_realtime automatically. Add public.online_room_video_signals manually in Supabase Realtime if needed.';
    when undefined_object then
        raise notice 'Publication supabase_realtime not found. Add public.online_room_video_signals manually in Supabase Realtime if needed.';
end;
$$;

create or replace function public.emit_online_room_signal(
    p_room_id uuid,
    p_signal_type text,
    p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if not public.is_room_member(p_room_id, auth.uid()) then
        raise exception 'Not a room member';
    end if;

    if coalesce(trim(p_signal_type), '') not in (
        'video_ready',
        'video_offer',
        'video_answer',
        'video_ice',
        'video_leave'
    ) then
        raise exception 'Unsupported signal type';
    end if;

    insert into public.online_room_video_signals (
        room_id,
        player_id,
        session_id,
        signal_type,
        payload
    )
    values (
        p_room_id,
        auth.uid(),
        nullif(trim(coalesce(p_payload->>'sessionId', '')), ''),
        p_signal_type,
        coalesce(p_payload, '{}'::jsonb)
    );
end;
$$;

create or replace function public.list_online_room_video_signals(
    p_room_id uuid,
    p_after_signal_id bigint default 0,
    p_limit int default 40
)
returns table (
    signal_id bigint,
    player_id uuid,
    signal_data jsonb
)
language plpgsql
security definer
as $$
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if not public.is_room_member(p_room_id, auth.uid()) then
        raise exception 'Not a room member';
    end if;

    return query
    select
        s.id as signal_id,
        s.player_id,
        jsonb_build_object(
            'signalType', s.signal_type,
            'payload', s.payload
        ) as signal_data
    from public.online_room_video_signals s
    where s.room_id = p_room_id
      and s.id > greatest(coalesce(p_after_signal_id, 0), 0)
    order by s.id asc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;
