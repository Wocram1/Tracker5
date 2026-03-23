-- =========================================================
-- ONLINE X01 BACKEND RESULTS PACKAGE
-- Phase: authoritative online result storage + per-player sync
-- Run after the previous online room / x01 SQL packages.
-- =========================================================

create table if not exists public.online_room_results (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.online_rooms(id) on delete cascade,
    player_id uuid not null references public.profiles(id) on delete cascade,
    seat int not null check (seat in (1, 2)),
    game_id text not null default 'x01',
    won boolean not null default false,
    finished boolean not null default false,
    result_status text not null default 'finished'
        check (result_status in ('finished', 'cancelled', 'forfeit')),
    start_score int not null default 501,
    final_score int not null default 0,
    round_reached int not null default 1,
    darts_thrown int not null default 0,
    xp_earned int not null default 0,
    sr_value int not null default 0,
    sr_category text not null default 'scoring',
    result_stats jsonb not null default '{}'::jsonb,
    synced_to_match_history boolean not null default false,
    synced_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (room_id, player_id)
);

create index if not exists idx_online_room_results_room_id on public.online_room_results(room_id);
create index if not exists idx_online_room_results_player_id on public.online_room_results(player_id);
create index if not exists idx_online_room_results_synced on public.online_room_results(synced_to_match_history);

alter table public.online_room_results enable row level security;

drop policy if exists "room members can select online room results" on public.online_room_results;
create policy "room members can select online room results"
on public.online_room_results
for select
using (public.is_room_member(room_id, auth.uid()));

create or replace function public.x01_default_player_stats()
returns jsonb
language sql
immutable
as $$
    select jsonb_build_object(
        'totalPoints', 0,
        'oneEighty', 0,
        'doubles', 0,
        'triples', 0,
        'checkoutAttempts', 0
    );
$$;

create or replace function public.x01_xp_base_for_start_score(p_start_score int)
returns int
language sql
immutable
as $$
    select case
        when p_start_score <= 301 then 350
        when p_start_score <= 501 then 900
        when p_start_score <= 701 then 1300
        when p_start_score <= 1001 then 2000
        else greatest(350, floor(p_start_score * 1.5)::int)
    end;
$$;

create or replace function public.apply_x01_turn(
    p_player_state jsonb,
    p_settings jsonb,
    p_throws jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
    v_score int;
    v_round int;
    v_last_score int := 0;
    v_has_started boolean;
    v_double_in boolean;
    v_double_out boolean;
    v_finished boolean := false;
    v_total_darts int;
    v_stats jsonb;

    v_throw jsonb;
    v_val int;
    v_mult int;
    v_points int;
    v_new_score int;

    v_valid_throws jsonb := '[]'::jsonb;
    v_round_start_score int;
    v_turn_points int := 0;
    v_checkout_range_limit int;
    v_current_checkout_attempts int;
begin
    v_score := coalesce((p_player_state->>'score')::int, 501);
    v_round := coalesce((p_player_state->>'round')::int, 1);
    v_has_started := coalesce((p_player_state->>'hasStartedScoring')::boolean, true);
    v_total_darts := coalesce((p_player_state->>'totalDarts')::int, 0);
    v_stats := coalesce(p_player_state->'stats', public.x01_default_player_stats());

    v_double_in := coalesce((p_settings->>'doubleIn')::boolean, false);
    v_double_out := coalesce((p_settings->>'doubleOut')::boolean, false);
    v_checkout_range_limit := case when v_double_out then 50 else 60 end;
    v_round_start_score := v_score;

    if jsonb_typeof(p_throws) <> 'array' then
        raise exception 'throws must be a json array';
    end if;

    if jsonb_array_length(p_throws) < 1 or jsonb_array_length(p_throws) > 3 then
        raise exception 'turn must contain between 1 and 3 throws';
    end if;

    for v_throw in
        select value from jsonb_array_elements(p_throws)
    loop
        v_val := coalesce((v_throw->>'val')::int, -1);
        v_mult := coalesce((v_throw->>'mult')::int, -1);

        if not public.is_valid_x01_throw(v_val, v_mult) then
            raise exception 'invalid throw: val %, mult %', v_val, v_mult;
        end if;

        if v_score <= v_checkout_range_limit then
            v_current_checkout_attempts := coalesce((v_stats->>'checkoutAttempts')::int, 0) + 1;
            v_stats := jsonb_set(v_stats, '{checkoutAttempts}', to_jsonb(v_current_checkout_attempts), true);
        end if;

        if not v_has_started then
            v_total_darts := v_total_darts + 1;
            if v_mult = 2 then
                v_has_started := true;
            else
                v_valid_throws := v_valid_throws || jsonb_build_array(jsonb_build_object(
                    'val', v_val,
                    'mult', v_mult,
                    'base', v_val,
                    'points', 0,
                    'ignored', true,
                    'scoreBefore', v_score
                ));
                continue;
            end if;
        end if;

        v_points := public.x01_throw_points(v_val, v_mult);
        v_new_score := v_score - v_points;
        v_total_darts := v_total_darts + 1;

        if v_new_score < 0 or (v_double_out and v_new_score = 1) or (v_new_score = 0 and v_double_out and v_mult <> 2) then
            v_score := v_round_start_score;
            v_last_score := 0;
            v_valid_throws := '[]'::jsonb;
            exit;
        end if;

        v_score := v_new_score;
        v_last_score := v_last_score + v_points;
        v_turn_points := v_turn_points + v_points;

        if v_mult = 3 then
            v_stats := jsonb_set(v_stats, '{triples}', to_jsonb(coalesce((v_stats->>'triples')::int, 0) + 1), true);
        end if;

        if v_mult = 2 then
            v_stats := jsonb_set(v_stats, '{doubles}', to_jsonb(coalesce((v_stats->>'doubles')::int, 0) + 1), true);
        end if;

        v_stats := jsonb_set(v_stats, '{totalPoints}', to_jsonb(coalesce((v_stats->>'totalPoints')::int, 0) + v_points), true);

        v_valid_throws := v_valid_throws || jsonb_build_array(jsonb_build_object(
            'val', v_val,
            'mult', v_mult,
            'base', v_val,
            'points', v_points,
            'scoreBefore', v_score + v_points
        ));

        if v_score = 0 then
            v_finished := true;
            exit;
        end if;
    end loop;

    if v_turn_points = 180 then
        v_stats := jsonb_set(v_stats, '{oneEighty}', to_jsonb(coalesce((v_stats->>'oneEighty')::int, 0) + 1), true);
    end if;

    return jsonb_build_object(
        'score', v_score,
        'round', case when v_finished then v_round else v_round + 1 end,
        'currentThrows', '[]'::jsonb,
        'lastScore', v_last_score,
        'hasStartedScoring', v_has_started,
        'finished', v_finished,
        'totalDarts', v_total_darts,
        'stats', v_stats
    );
end;
$$;

create or replace function public.start_online_match(
    p_room_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_room public.online_rooms%rowtype;
    v_player_1 uuid;
    v_player_2 uuid;
    v_settings jsonb;
    v_start_score int;
    v_double_out boolean;
    v_double_in boolean;
    v_live_state jsonb;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    select *
    into v_room
    from public.online_rooms
    where id = p_room_id
    limit 1;

    if v_room.id is null then
        raise exception 'Room not found';
    end if;

    if v_room.host_id <> auth.uid() then
        raise exception 'Only host can start the match';
    end if;

    if v_room.status not in ('ready', 'waiting') then
        raise exception 'Room cannot be started';
    end if;

    select player_id into v_player_1
    from public.online_room_players
    where room_id = p_room_id and seat = 1;

    select player_id into v_player_2
    from public.online_room_players
    where room_id = p_room_id and seat = 2;

    if v_player_1 is null or v_player_2 is null then
        raise exception 'Two players are required';
    end if;

    if exists (
        select 1
        from public.online_room_players
        where room_id = p_room_id
          and ready = false
    ) then
        raise exception 'Both players must be ready';
    end if;

    v_settings := coalesce(v_room.settings, '{}'::jsonb);
    v_start_score := coalesce((v_settings->>'startScore')::int, 501);
    v_double_out := coalesce((v_settings->>'doubleOut')::boolean, false);
    v_double_in := coalesce((v_settings->>'doubleIn')::boolean, false);

    v_live_state := jsonb_build_object(
        'gameId', 'x01',
        'status', 'live',
        'startedAt', now(),
        'settings', jsonb_build_object(
            'startScore', v_start_score,
            'doubleOut', v_double_out,
            'doubleIn', v_double_in
        ),
        'currentTurnPlayerId', v_player_1,
        'players', jsonb_build_object(
            v_player_1::text, jsonb_build_object(
                'score', v_start_score,
                'round', 1,
                'currentThrows', '[]'::jsonb,
                'lastScore', 0,
                'hasStartedScoring', not v_double_in,
                'finished', false,
                'totalDarts', 0,
                'stats', public.x01_default_player_stats()
            ),
            v_player_2::text, jsonb_build_object(
                'score', v_start_score,
                'round', 1,
                'currentThrows', '[]'::jsonb,
                'lastScore', 0,
                'hasStartedScoring', not v_double_in,
                'finished', false,
                'totalDarts', 0,
                'stats', public.x01_default_player_stats()
            )
        )
    );

    update public.online_rooms
    set status = 'live',
        active_player_id = v_player_1,
        winner_id = null
    where id = p_room_id;

    update public.online_room_state
    set state = v_live_state,
        version = version + 1
    where room_id = p_room_id;

    delete from public.online_room_results
    where room_id = p_room_id;

    insert into public.online_room_events (
        room_id,
        player_id,
        event_type,
        payload
    )
    values (
        p_room_id,
        auth.uid(),
        'match_started',
        jsonb_build_object(
            'startScore', v_start_score,
            'doubleOut', v_double_out,
            'doubleIn', v_double_in,
            'firstPlayer', v_player_1
        )
    );

    return jsonb_build_object(
        'room_id', p_room_id,
        'status', 'live',
        'active_player_id', v_player_1
    );
end;
$$;

create or replace function public.finalize_online_x01_results(
    p_room_id uuid,
    p_result_status text default 'finished'
)
returns void
language plpgsql
security definer
as $$
declare
    v_room public.online_rooms%rowtype;
    v_state jsonb;
    v_settings jsonb;
    v_player record;
    v_player_state jsonb;
    v_stats jsonb;
    v_total_darts int;
    v_avg numeric;
    v_xp int;
    v_sr int;
    v_start_score int;
    v_mode_label text;
begin
    select * into v_room
    from public.online_rooms
    where id = p_room_id
    limit 1;

    if v_room.id is null then
        raise exception 'Room not found';
    end if;

    select state into v_state
    from public.online_room_state
    where room_id = p_room_id;

    if v_state is null then
        raise exception 'Room state not found';
    end if;

    v_settings := coalesce(v_state->'settings', '{}'::jsonb);
    v_start_score := coalesce((v_settings->>'startScore')::int, 501);
    v_mode_label := format(
        'Online X01 (%s%s)',
        v_start_score,
        case when coalesce((v_settings->>'doubleOut')::boolean, false) then ', D/O' else ', S/O' end
    );

    for v_player in
        select rp.player_id, rp.seat
        from public.online_room_players rp
        where rp.room_id = p_room_id
        order by rp.seat
    loop
        v_player_state := v_state->'players'->(v_player.player_id::text);
        v_stats := coalesce(v_player_state->'stats', public.x01_default_player_stats());
        v_total_darts := coalesce((v_player_state->>'totalDarts')::int, 0);
        v_avg := case
            when v_total_darts > 0 then round(((coalesce((v_stats->>'totalPoints')::numeric, 0) / v_total_darts) * 3)::numeric, 1)
            else 0
        end;

        v_sr := least(
            180,
            floor(v_avg)::int +
            case when coalesce((v_player_state->>'finished')::boolean, false) and coalesce((v_player_state->>'score')::int, 999999) = 0 then 10 else 0 end
        );

        v_xp := public.x01_xp_base_for_start_score(v_start_score);
        if coalesce((v_player_state->>'finished')::boolean, false) and coalesce((v_player_state->>'score')::int, 999999) = 0 then
            v_xp := v_xp
                + (coalesce((v_stats->>'oneEighty')::int, 0) * 150)
                + (coalesce((v_stats->>'doubles')::int, 0) * 20)
                + greatest(1, (99 - coalesce((v_player_state->>'round')::int, 1)) * 10);
        else
            v_xp := greatest(50, floor(v_xp * 0.25)::int);
        end if;

        insert into public.online_room_results (
            room_id,
            player_id,
            seat,
            game_id,
            won,
            finished,
            result_status,
            start_score,
            final_score,
            round_reached,
            darts_thrown,
            xp_earned,
            sr_value,
            sr_category,
            result_stats
        )
        values (
            p_room_id,
            v_player.player_id,
            v_player.seat,
            'x01',
            v_room.winner_id = v_player.player_id,
            coalesce((v_player_state->>'finished')::boolean, false),
            p_result_status,
            v_start_score,
            coalesce((v_player_state->>'score')::int, v_start_score),
            coalesce((v_player_state->>'round')::int, 1),
            v_total_darts,
            floor(v_xp)::int,
            v_sr,
            'scoring',
            coalesce(v_stats, '{}'::jsonb)
                || jsonb_build_object(
                    'avg', to_char(v_avg, 'FM999990.0'),
                    'lastScore', coalesce((v_player_state->>'lastScore')::int, 0),
                    'mode', v_mode_label,
                    'totalDarts', v_total_darts,
                    'online', true,
                    'onlineRoomId', p_room_id,
                    'resultStatus', p_result_status
                )
        )
        on conflict (room_id, player_id)
        do update set
            won = excluded.won,
            finished = excluded.finished,
            result_status = excluded.result_status,
            start_score = excluded.start_score,
            final_score = excluded.final_score,
            round_reached = excluded.round_reached,
            darts_thrown = excluded.darts_thrown,
            xp_earned = excluded.xp_earned,
            sr_value = excluded.sr_value,
            sr_category = excluded.sr_category,
            result_stats = excluded.result_stats,
            updated_at = now();
    end loop;
end;
$$;

create or replace function public.finish_online_x01_match(
    p_room_id uuid,
    p_winner_id uuid,
    p_state jsonb
)
returns void
language plpgsql
security definer
as $$
begin
    update public.online_rooms
    set
        status = 'finished',
        winner_id = p_winner_id,
        active_player_id = null
    where id = p_room_id;

    update public.online_room_state
    set
        state = jsonb_set(
            jsonb_set(
                jsonb_set(p_state, '{status}', '"finished"'::jsonb),
                '{currentTurnPlayerId}',
                'null'::jsonb
            ),
            '{finishedAt}',
            to_jsonb(now())
        ),
        version = version + 1
    where room_id = p_room_id;

    perform public.finalize_online_x01_results(p_room_id, 'finished');

    insert into public.online_room_events (
        room_id,
        player_id,
        event_type,
        payload
    )
    values (
        p_room_id,
        p_winner_id,
        'match_finished',
        jsonb_build_object('winner_id', p_winner_id)
    );
end;
$$;

create or replace function public.sync_my_online_room_result(
    p_room_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_result public.online_room_results%rowtype;
    v_profile public.profiles%rowtype;
    v_new_xp int;
    v_new_level int;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if not public.is_room_member(p_room_id, auth.uid()) then
        raise exception 'Not a room member';
    end if;

    perform public.finalize_online_x01_results(p_room_id, 'finished');

    select *
    into v_result
    from public.online_room_results
    where room_id = p_room_id
      and player_id = auth.uid()
    limit 1;

    if v_result.id is null then
        raise exception 'Online result not found';
    end if;

    if v_result.synced_to_match_history then
        return jsonb_build_object(
            'already_synced', true,
            'xp', v_result.xp_earned,
            'sr', v_result.sr_value
        );
    end if;

    insert into public.match_history (
        player_id,
        game_mode,
        match_stats,
        xp_earned
    )
    values (
        auth.uid(),
        coalesce(v_result.result_stats->>'mode', 'Online X01'),
        v_result.result_stats
            || jsonb_build_object(
                'sr_earned', v_result.sr_value,
                'sr_category', v_result.sr_category,
                'isTraining', false,
                'loggedDartsThrown', v_result.darts_thrown,
                'onlineResult', true
            ),
        v_result.xp_earned
    );

    select *
    into v_profile
    from public.profiles
    where id = auth.uid()
    limit 1;

    v_new_xp := coalesce(v_profile.xp, 0) + coalesce(v_result.xp_earned, 0);
    v_new_level := public.calculate_new_level(v_new_xp);

    update public.profiles
    set
        xp = v_new_xp,
        level = v_new_level,
        total_darts_thrown = coalesce(total_darts_thrown, 0) + coalesce(v_result.darts_thrown, 0),
        total_games_played = coalesce(total_games_played, 0) + 1,
        games_scoring = coalesce(games_scoring, 0) + 1,
        total_wins = case when v_result.won then coalesce(total_wins, 0) + 1 else coalesce(total_wins, 0) end,
        sr_scoring = v_result.sr_value,
        last_active = now()
    where id = auth.uid();

    update public.online_room_results
    set
        synced_to_match_history = true,
        synced_at = now(),
        updated_at = now()
    where id = v_result.id;

    return jsonb_build_object(
        'already_synced', false,
        'xp', v_result.xp_earned,
        'sr', v_result.sr_value,
        'won', v_result.won,
        'result_stats', v_result.result_stats
    );
end;
$$;
