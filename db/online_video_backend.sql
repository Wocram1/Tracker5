-- =========================================================
-- ONLINE VIDEO SIGNALING BACKEND
-- Helper RPC for optional WebRTC signaling inside online rooms.
-- Run after:
--   1. online room base SQL
--   2. online_x01_results_backend.sql
--   3. online_shanghai_backend.sql
--   4. online_atc_backend.sql
--   5. online_121_backend.sql
--   6. online_jdc_backend.sql
--
-- Notes:
-- - Reuses public.online_room_events as signaling transport.
-- - Only room members can emit signaling events.
-- - Intended event types:
--   video_ready, video_offer, video_answer, video_ice, video_leave
-- =========================================================

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

    insert into public.online_room_events (
        room_id,
        player_id,
        event_type,
        payload
    )
    values (
        p_room_id,
        auth.uid(),
        'video_signal',
        jsonb_build_object(
            'signalType', p_signal_type,
            'payload', coalesce(p_payload, '{}'::jsonb)
        )
    );
end;
$$;

create or replace function public.list_online_room_video_signals(
    p_room_id uuid,
    p_limit int default 40
)
returns table (
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
    select recent.player_id, recent.payload
    from (
        select e.player_id, e.payload, e.ctid
        from public.online_room_events e
        where e.room_id = p_room_id
          and e.event_type = 'video_signal'
        order by e.ctid desc
        limit greatest(1, least(coalesce(p_limit, 40), 100))
    ) as recent
    order by recent.ctid asc;
end;
$$;
