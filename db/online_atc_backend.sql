-- =========================================================
-- ONLINE ATC BACKEND PACKAGE
-- Parallel package for Around The Clock rooms, turns, results and sync.
-- Run after:
--   1. online room base SQL
--   2. online_x01_results_backend.sql
--   3. online_shanghai_backend.sql
--
-- Notes:
-- - Keeps X01 and Shanghai online flow intact.
-- - Adds ATC support in parallel.
-- - Expected turn payload for submit_atc_turn:
--   { "throws": [1, 0, 3] }
--   where 0 = miss, 1 = single, 2 = double, 3 = triple.
-- =========================================================

create or replace function public.create_online_room(
    p_game_id text default 'x01',
    p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_room_id uuid;
    v_room_code text;
    v_initial_state jsonb;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if p_game_id not in ('x01', 'shanghai', 'atc') then
        raise exception 'Only x01, shanghai and atc are supported';
    end if;

    v_room_code := public.generate_room_code();

    insert into public.online_rooms (
        room_code,
        host_id,
        game_id,
        status,
        settings
    )
    values (
        v_room_code,
        auth.uid(),
        p_game_id,
        'waiting',
        coalesce(p_settings, '{}'::jsonb)
    )
    returning id into v_room_id;

    insert into public.online_room_players (
        room_id,
        player_id,
        seat,
        ready,
        connected
    )
    values (
        v_room_id,
        auth.uid(),
        1,
        false,
        true
    );

    v_initial_state := jsonb_build_object(
        'gameId', p_game_id,
        'status', 'waiting',
        'settings', coalesce(p_settings, '{}'::jsonb),
        'currentTurnPlayerId', null,
        'players', jsonb_build_object()
    );

    insert into public.online_room_state (
        room_id,
        state,
        version
    )
    values (
        v_room_id,
        v_initial_state,
        1
    );

    insert into public.online_room_events (
        room_id,
        player_id,
        event_type,
        payload
    )
    values (
        v_room_id,
        auth.uid(),
        'room_created',
        jsonb_build_object(
            'room_code', v_room_code,
            'game_id', p_game_id
        )
    );

    return jsonb_build_object(
        'room_id', v_room_id,
        'room_code', v_room_code,
        'status', 'waiting'
    );
end;
$$;

create or replace function public.finish_online_atc_match(
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

    perform public.finalize_online_atc_results(p_room_id, 'finished');

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
        jsonb_build_object('winner_id', p_winner_id, 'gameId', 'atc')
    );
end;
$$;

create or replace function public.submit_atc_turn(
    p_room_id uuid,
    p_turn jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_room public.online_rooms%rowtype;
    v_state_row public.online_room_state%rowtype;
    v_state jsonb;
    v_settings jsonb;
    v_players jsonb;
    v_current_player_id uuid;
    v_other_player_id uuid;
    v_next_player_id uuid;
    v_player_ids uuid[];
    v_current_player_state jsonb;
    v_other_player_state jsonb;
    v_updated_player_state jsonb;
    v_new_state jsonb;
    v_current_finished boolean;
    v_other_finished boolean;
    v_current_final_score int;
    v_other_final_score int;
    v_winner_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if not public.is_room_member(p_room_id, auth.uid()) then
        raise exception 'Not a room member';
    end if;

    select * into v_room
    from public.online_rooms
    where id = p_room_id
    limit 1;

    if v_room.id is null then
        raise exception 'Room not found';
    end if;

    if v_room.game_id <> 'atc' then
        raise exception 'Room is not an ATC room';
    end if;

    if v_room.status <> 'live' then
        raise exception 'Match is not live';
    end if;

    if v_room.active_player_id is distinct from auth.uid() then
        raise exception 'It is not your turn';
    end if;

    select * into v_state_row
    from public.online_room_state
    where room_id = p_room_id
    limit 1;

    if v_state_row.room_id is null then
        raise exception 'Room state not found';
    end if;

    v_state := v_state_row.state;
    v_settings := coalesce(v_state->'settings', '{}'::jsonb);
    v_players := coalesce(v_state->'players', '{}'::jsonb);
    v_current_player_id := auth.uid();

    select array_agg(player_id order by seat)
    into v_player_ids
    from public.online_room_players
    where room_id = p_room_id;

    if array_length(v_player_ids, 1) <> 2 then
        raise exception 'Exactly two players required';
    end if;

    if v_player_ids[1] = v_current_player_id then
        v_other_player_id := v_player_ids[2];
    else
        v_other_player_id := v_player_ids[1];
    end if;

    v_current_player_state := v_players -> (v_current_player_id::text);
    v_other_player_state := v_players -> (v_other_player_id::text);

    if v_current_player_state is null then
        raise exception 'Current player state missing';
    end if;

    if coalesce((v_current_player_state->>'isFinished')::boolean, false) then
        raise exception 'Player already finished';
    end if;

    v_updated_player_state := public.apply_atc_turn(
        v_current_player_state,
        v_settings,
        p_turn
    );

    v_players := jsonb_set(
        v_players,
        array[v_current_player_id::text],
        v_updated_player_state
    );

    v_current_finished := coalesce((v_updated_player_state->>'isFinished')::boolean, false);
    v_other_finished := coalesce((v_other_player_state->>'isFinished')::boolean, false);
    v_new_state := jsonb_set(v_state, '{players}', v_players);

    if v_current_finished and v_other_finished then
        v_current_final_score := greatest(
            0,
            coalesce((v_updated_player_state->>'points')::int, 0)
            - coalesce((v_updated_player_state->>'malusScore')::int, 0)
        );
        v_other_final_score := greatest(
            0,
            coalesce((v_other_player_state->>'points')::int, 0)
            - coalesce((v_other_player_state->>'malusScore')::int, 0)
        );

        if v_current_final_score > v_other_final_score then
            v_winner_id := v_current_player_id;
        elsif v_other_final_score > v_current_final_score then
            v_winner_id := v_other_player_id;
        elsif coalesce((v_updated_player_state->>'currentIndex')::int, 0) > coalesce((v_other_player_state->>'currentIndex')::int, 0) then
            v_winner_id := v_current_player_id;
        elsif coalesce((v_other_player_state->>'currentIndex')::int, 0) > coalesce((v_updated_player_state->>'currentIndex')::int, 0) then
            v_winner_id := v_other_player_id;
        elsif coalesce((v_updated_player_state->'stats'->>'hits')::int, 0) > coalesce((v_other_player_state->'stats'->>'hits')::int, 0) then
            v_winner_id := v_current_player_id;
        elsif coalesce((v_other_player_state->'stats'->>'hits')::int, 0) > coalesce((v_updated_player_state->'stats'->>'hits')::int, 0) then
            v_winner_id := v_other_player_id;
        else
            v_winner_id := v_player_ids[1];
        end if;

        perform public.finish_online_atc_match(
            p_room_id,
            v_winner_id,
            v_new_state
        );

        insert into public.online_room_events (
            room_id,
            player_id,
            event_type,
            payload
        )
        values (
            p_room_id,
            v_current_player_id,
            'turn_submitted',
            jsonb_build_object(
                'throws', coalesce(p_turn->'throws', '[]'::jsonb),
                'finished', true,
                'gameId', 'atc'
            )
        );

        return jsonb_build_object(
            'room_id', p_room_id,
            'status', 'finished',
            'winner_id', v_winner_id
        );
    end if;

    if not v_other_finished then
        v_next_player_id := v_other_player_id;
    else
        v_next_player_id := v_current_player_id;
    end if;

    v_new_state := jsonb_set(
        jsonb_set(v_new_state, '{currentTurnPlayerId}', to_jsonb(v_next_player_id)),
        '{status}',
        '"live"'::jsonb
    );

    update public.online_rooms
    set active_player_id = v_next_player_id
    where id = p_room_id;

    update public.online_room_state
    set state = v_new_state,
        version = version + 1
    where room_id = p_room_id;

    insert into public.online_room_events (
        room_id,
        player_id,
        event_type,
        payload
    )
    values (
        p_room_id,
        v_current_player_id,
        'turn_submitted',
        jsonb_build_object(
            'throws', coalesce(p_turn->'throws', '[]'::jsonb),
            'next_player_id', v_next_player_id,
            'gameId', 'atc'
        )
    );

    return jsonb_build_object(
        'room_id', p_room_id,
        'status', 'live',
        'next_player_id', v_next_player_id
    );
end;
$$;

create or replace function public.sync_my_online_atc_result(
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

    perform public.finalize_online_atc_results(p_room_id, 'finished');

    select * into v_result
    from public.online_room_results
    where room_id = p_room_id
      and player_id = auth.uid()
      and game_id = 'atc'
    limit 1;

    if v_result.id is null then
        raise exception 'Online ATC result not found';
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
        coalesce(v_result.result_stats->>'mode', 'Online ATC'),
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

    select * into v_profile
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
        games_boardcontrol = coalesce(games_boardcontrol, 0) + 1,
        total_wins = case when v_result.won then coalesce(total_wins, 0) + 1 else coalesce(total_wins, 0) end,
        sr_boardcontrol = v_result.sr_value,
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

create or replace function public.join_online_room(
    p_room_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_room public.online_rooms%rowtype;
    v_existing_player_count int;
    v_existing_membership boolean;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    select *
    into v_room
    from public.online_rooms
    where room_code = upper(trim(p_room_code))
    limit 1;

    if v_room.id is null then
        raise exception 'Room not found';
    end if;

    if v_room.game_id not in ('x01', 'shanghai', 'atc') then
        raise exception 'Unsupported room game';
    end if;

    if v_room.status not in ('waiting', 'ready') then
        raise exception 'Room is not joinable';
    end if;

    select exists(
        select 1
        from public.online_room_players
        where room_id = v_room.id
          and player_id = auth.uid()
    ) into v_existing_membership;

    if v_existing_membership then
        update public.online_room_players
        set connected = true
        where room_id = v_room.id
          and player_id = auth.uid();

        return jsonb_build_object(
            'room_id', v_room.id,
            'room_code', v_room.room_code,
            'status', v_room.status,
            'rejoined', true
        );
    end if;

    select count(*)
    into v_existing_player_count
    from public.online_room_players
    where room_id = v_room.id;

    if v_existing_player_count >= 2 then
        raise exception 'Room is full';
    end if;

    insert into public.online_room_players (
        room_id,
        player_id,
        seat,
        ready,
        connected
    )
    values (
        v_room.id,
        auth.uid(),
        2,
        false,
        true
    );

    update public.online_rooms
    set status = 'ready'
    where id = v_room.id
      and status = 'waiting';

    insert into public.online_room_events (
        room_id,
        player_id,
        event_type,
        payload
    )
    values (
        v_room.id,
        auth.uid(),
        'player_joined',
        jsonb_build_object('seat', 2)
    );

    return jsonb_build_object(
        'room_id', v_room.id,
        'room_code', v_room.room_code,
        'status', 'ready',
        'rejoined', false
    );
end;
$$;

create or replace function public.atc_level_config(p_level int)
returns jsonb
language sql
immutable
as $$
    select case coalesce(p_level, 1)
        when 1 then jsonb_build_object('targets', '[1,3,5,7,9,11,13,15,17,19]'::jsonb, 'rounds', 25, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 45, 'hitsPerTarget', 1, 'missPenalty', 1)
        when 2 then jsonb_build_object('targets', '[2,4,6,8,10,12,14,16,18,20]'::jsonb, 'rounds', 25, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 60, 'hitsPerTarget', 1, 'missPenalty', 1)
        when 3 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10]'::jsonb, 'rounds', 25, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 30, 'hitsPerTarget', 1, 'missPenalty', 1)
        when 4 then jsonb_build_object('targets', '[11,12,13,14,15,16,17,18,19,20]'::jsonb, 'rounds', 25, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 85, 'hitsPerTarget', 1, 'missPenalty', 1)
        when 5 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]'::jsonb, 'rounds', 45, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 105, 'hitsPerTarget', 1, 'missPenalty', 10)
        when 6 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]'::jsonb, 'rounds', 40, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 135, 'hitsPerTarget', 1, 'missPenalty', 10)
        when 7 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]'::jsonb, 'rounds', 35, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 170, 'hitsPerTarget', 1, 'missPenalty', 10)
        when 8 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]'::jsonb, 'rounds', 30, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 1, 'regainHerz', 0.5, 'minPoints', 210, 'hitsPerTarget', 1, 'missPenalty', 10)
        when 9 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]'::jsonb, 'rounds', 25, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 250, 'hitsPerTarget', 1, 'missPenalty', 10)
        when 10 then jsonb_build_object('targets', '[10,11,12,13,14,15,16,17,18,19,20]'::jsonb, 'rounds', 25, 'startBlitz', 3, 'regainBlitz', 1, 'startHerz', 2, 'regainHerz', 1, 'minPoints', 270, 'hitsPerTarget', 1, 'missPenalty', 10)
        when 15 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25]'::jsonb, 'rounds', 20, 'startBlitz', 2, 'regainBlitz', 0.5, 'startHerz', 1, 'regainHerz', 0.5, 'minPoints', 395, 'hitsPerTarget', 1, 'missPenalty', 10)
        when 20 then jsonb_build_object('targets', '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25]'::jsonb, 'rounds', 15, 'startBlitz', 1, 'regainBlitz', 0.5, 'startHerz', 1, 'regainHerz', 0, 'minPoints', 520, 'hitsPerTarget', 1, 'missPenalty', 10)
        else jsonb_build_object('targets', '[1,3,5,7,9,11,13,15,17,19]'::jsonb, 'rounds', 25, 'startBlitz', 0, 'regainBlitz', 0, 'startHerz', 0, 'regainHerz', 0, 'minPoints', 45, 'hitsPerTarget', 1, 'missPenalty', 1)
    end;
$$;

create or replace function public.atc_default_player_stats()
returns jsonb
language sql
immutable
as $$
    select jsonb_build_object(
        'misses', 0,
        'hits', 0,
        'totalDarts', 0,
        'singles', 0,
        'doubles', 0,
        'triples', 0,
        'currentStreak', 0,
        'maxStreak', 0,
        'firstDartHits', 0
    );
$$;

create or replace function public.atc_throw_points(
    p_target int,
    p_multiplier int
)
returns int
language sql
immutable
as $$
    select case
        when coalesce(p_multiplier, 0) <= 0 then 0
        when p_target = 25 then case p_multiplier when 1 then 25 when 2 then 50 else 75 end
        else p_target * p_multiplier
    end;
$$;

create or replace function public.apply_atc_turn(
    p_player_state jsonb,
    p_settings jsonb,
    p_turn jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
    v_throws jsonb := coalesce(p_turn->'throws', '[]'::jsonb);
    v_targets jsonb := coalesce(p_settings->'targets', '[]'::jsonb);
    v_hits_per_target int := greatest(1, coalesce((p_settings->>'hitsPerTarget')::int, 1));
    v_miss_penalty int := coalesce((p_settings->>'missPenalty')::int, 10);
    v_start_blitz numeric := coalesce((p_settings->>'startBlitz')::numeric, 0);
    v_regain_blitz numeric := coalesce((p_settings->>'regainBlitz')::numeric, 0);
    v_start_herz numeric := coalesce((p_settings->>'startHerz')::numeric, 0);
    v_regain_herz numeric := coalesce((p_settings->>'regainHerz')::numeric, 0);
    v_round_limit int := coalesce((p_settings->>'rounds')::int, 1);
    v_points int := coalesce((p_player_state->>'points')::int, 0);
    v_malus int := coalesce((p_player_state->>'malusScore')::int, 0);
    v_bolts numeric := coalesce((p_player_state->>'bolts')::numeric, 0);
    v_lives numeric := coalesce((p_player_state->>'lives')::numeric, 0);
    v_round int := coalesce((p_player_state->>'round')::int, 1);
    v_current_index int := coalesce((p_player_state->>'currentIndex')::int, 0);
    v_current_hits_on_target int := coalesce((p_player_state->>'currentHitsOnTarget')::int, 0);
    v_round_start_index int := coalesce((p_player_state->>'roundStartIndex')::int, v_current_index);
    v_round_start_hits int := coalesce((p_player_state->>'roundStartHits')::int, v_current_hits_on_target);
    v_finished boolean := coalesce((p_player_state->>'isFinished')::boolean, false);
    v_burnout boolean := coalesce((p_player_state->>'burnoutInCurrentRound')::boolean, false);
    v_stats jsonb := coalesce(p_player_state->'stats', public.atc_default_player_stats());
    v_round_darts jsonb := '[]'::jsonb;
    v_target int;
    v_throw jsonb;
    v_mult int;
    v_is_first boolean;
begin
    if jsonb_typeof(v_throws) <> 'array' then
        raise exception 'throws must be a json array';
    end if;

    if jsonb_array_length(v_throws) < 1 or jsonb_array_length(v_throws) > 3 then
        raise exception 'turn must contain between 1 and 3 throws';
    end if;

    if v_current_index >= jsonb_array_length(v_targets) then
        v_finished := true;
    end if;

    if v_finished then
        return p_player_state;
    end if;

    for v_throw in
        select value from jsonb_array_elements(v_throws)
    loop
        exit when v_finished;
        exit when jsonb_array_length(v_round_darts) >= 3;

        v_target := (v_targets->>v_current_index)::int;
        v_mult := case
            when jsonb_typeof(v_throw) = 'number' then (v_throw::text)::int
            else coalesce((v_throw->>'mult')::int, 0)
        end;

        if v_mult not in (0, 1, 2, 3) then
            raise exception 'invalid ATC multiplier %', v_mult;
        end if;

        v_is_first := jsonb_array_length(v_round_darts) = 0;
        v_round_darts := v_round_darts || jsonb_build_array(v_mult);
        v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);

        if v_mult > 0 then
            if v_is_first then
                v_stats := jsonb_set(v_stats, '{firstDartHits}', to_jsonb(coalesce((v_stats->>'firstDartHits')::int, 0) + 1), true);
            end if;

            v_stats := jsonb_set(v_stats, '{hits}', to_jsonb(coalesce((v_stats->>'hits')::int, 0) + 1), true);
            v_stats := jsonb_set(v_stats, '{currentStreak}', to_jsonb(coalesce((v_stats->>'currentStreak')::int, 0) + 1), true);
            v_stats := jsonb_set(v_stats, '{maxStreak}', to_jsonb(greatest(coalesce((v_stats->>'maxStreak')::int, 0), coalesce((v_stats->>'currentStreak')::int, 0) + 1)), true);

            if v_mult = 1 then
                v_stats := jsonb_set(v_stats, '{singles}', to_jsonb(coalesce((v_stats->>'singles')::int, 0) + 1), true);
            elsif v_mult = 2 then
                v_stats := jsonb_set(v_stats, '{doubles}', to_jsonb(coalesce((v_stats->>'doubles')::int, 0) + 1), true);
            elsif v_mult = 3 then
                v_stats := jsonb_set(v_stats, '{triples}', to_jsonb(coalesce((v_stats->>'triples')::int, 0) + 1), true);
            end if;

            v_points := v_points + public.atc_throw_points(v_target, v_mult);
            v_current_hits_on_target := v_current_hits_on_target + 1;

            if v_start_blitz > 0 then
                v_bolts := least(3::numeric, v_bolts + v_regain_blitz);
            end if;

            if v_start_herz > 0 then
                v_lives := least(3::numeric, v_lives + v_regain_herz);
            end if;

            if v_current_hits_on_target >= v_hits_per_target then
                v_current_index := v_current_index + 1;
                v_current_hits_on_target := 0;
            end if;

            if v_current_index >= jsonb_array_length(v_targets) then
                v_finished := true;
            end if;
        else
            v_stats := jsonb_set(v_stats, '{misses}', to_jsonb(coalesce((v_stats->>'misses')::int, 0) + 1), true);
            v_stats := jsonb_set(v_stats, '{currentStreak}', '0'::jsonb, true);

            if v_start_blitz > 0 and v_bolts > 0 then
                v_bolts := greatest(0::numeric, v_bolts - 1);
                if v_bolts = 0 and not v_burnout then
                    v_burnout := true;
                    v_malus := v_malus + 10;

                    while jsonb_array_length(v_round_darts) < 3 loop
                        v_round_darts := v_round_darts || jsonb_build_array(0);
                        v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);
                        v_stats := jsonb_set(v_stats, '{misses}', to_jsonb(coalesce((v_stats->>'misses')::int, 0) + 1), true);
                        v_stats := jsonb_set(v_stats, '{currentStreak}', '0'::jsonb, true);
                    end loop;
                end if;
            elsif v_start_herz > 0 then
                if v_lives > 0 then
                    v_lives := greatest(0::numeric, v_lives - 1);
                    v_malus := v_malus + 25;
                    if v_lives = 0 then
                        v_finished := true;
                    end if;
                else
                    v_malus := v_malus + 50;
                end if;
            else
                v_malus := v_malus + v_miss_penalty;
            end if;
        end if;
    end loop;

    while jsonb_array_length(v_round_darts) < 3 and not v_finished loop
        v_round_darts := v_round_darts || jsonb_build_array(0);
        v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);
        v_stats := jsonb_set(v_stats, '{misses}', to_jsonb(coalesce((v_stats->>'misses')::int, 0) + 1), true);
        v_stats := jsonb_set(v_stats, '{currentStreak}', '0'::jsonb, true);

        if v_start_blitz > 0 and v_bolts > 0 then
            v_bolts := greatest(0::numeric, v_bolts - 1);
            if v_bolts = 0 and not v_burnout then
                v_burnout := true;
                v_malus := v_malus + 10;
            end if;
        elsif v_start_herz > 0 then
            if v_lives > 0 then
                v_lives := greatest(0::numeric, v_lives - 1);
                v_malus := v_malus + 25;
                if v_lives = 0 then
                    v_finished := true;
                end if;
            else
                v_malus := v_malus + 50;
            end if;
        else
            v_malus := v_malus + v_miss_penalty;
        end if;
    end loop;

    if not v_finished then
        if v_round >= v_round_limit then
            v_finished := true;
        else
            v_round := v_round + 1;
            if v_burnout then
                v_round := v_round + 1;
            end if;
        end if;

        v_round_darts := '[]'::jsonb;
        v_burnout := false;
        v_round_start_index := v_current_index;
        v_round_start_hits := v_current_hits_on_target;

        if v_round > v_round_limit then
            v_round := v_round_limit;
            v_finished := true;
        end if;
    end if;

    return jsonb_build_object(
        'points', v_points,
        'malusScore', v_malus,
        'bolts', v_bolts,
        'lives', v_lives,
        'round', v_round,
        'maxRounds', v_round_limit,
        'currentIndex', v_current_index,
        'currentHitsOnTarget', v_current_hits_on_target,
        'currentTargetNumber', case when v_current_index < jsonb_array_length(v_targets) then (v_targets->>v_current_index)::int else null end,
        'roundDarts', '[]'::jsonb,
        'lastRoundDarts', v_round_darts,
        'roundStartIndex', v_round_start_index,
        'roundStartHits', v_round_start_hits,
        'isFinished', v_finished,
        'burnoutInCurrentRound', false,
        'stats', v_stats
    );
end;
$$;

create or replace function public.start_online_atc_match(
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
    v_level int;
    v_config jsonb;
    v_live_state jsonb;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    select * into v_room
    from public.online_rooms
    where id = p_room_id
    limit 1;

    if v_room.id is null then
        raise exception 'Room not found';
    end if;

    if v_room.host_id <> auth.uid() then
        raise exception 'Only host can start the match';
    end if;

    if v_room.game_id <> 'atc' then
        raise exception 'Room is not an ATC room';
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
    v_level := greatest(1, least(20, coalesce((v_settings->>'level')::int, 1)));
    v_config := public.atc_level_config(v_level) || jsonb_build_object('level', v_level);

    v_live_state := jsonb_build_object(
        'gameId', 'atc',
        'status', 'live',
        'startedAt', now(),
        'settings', v_config,
        'currentTurnPlayerId', v_player_1,
        'players', jsonb_build_object(
            v_player_1::text, jsonb_build_object(
                'points', 0,
                'malusScore', 0,
                'bolts', coalesce((v_config->>'startBlitz')::numeric, 0),
                'lives', coalesce((v_config->>'startHerz')::numeric, 0),
                'round', 1,
                'maxRounds', coalesce((v_config->>'rounds')::int, 1),
                'currentIndex', 0,
                'currentHitsOnTarget', 0,
                'currentTargetNumber', ((v_config->'targets')->>0)::int,
                'roundDarts', '[]'::jsonb,
                'lastRoundDarts', '[]'::jsonb,
                'roundStartIndex', 0,
                'roundStartHits', 0,
                'isFinished', false,
                'burnoutInCurrentRound', false,
                'stats', public.atc_default_player_stats()
            ),
            v_player_2::text, jsonb_build_object(
                'points', 0,
                'malusScore', 0,
                'bolts', coalesce((v_config->>'startBlitz')::numeric, 0),
                'lives', coalesce((v_config->>'startHerz')::numeric, 0),
                'round', 1,
                'maxRounds', coalesce((v_config->>'rounds')::int, 1),
                'currentIndex', 0,
                'currentHitsOnTarget', 0,
                'currentTargetNumber', ((v_config->'targets')->>0)::int,
                'roundDarts', '[]'::jsonb,
                'lastRoundDarts', '[]'::jsonb,
                'roundStartIndex', 0,
                'roundStartHits', 0,
                'isFinished', false,
                'burnoutInCurrentRound', false,
                'stats', public.atc_default_player_stats()
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
            'gameId', 'atc',
            'level', v_level,
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

create or replace function public.finalize_online_atc_results(
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
    v_targets jsonb;
    v_level int;
    v_min_points int;
    v_mode_label text;
    v_player record;
    v_player_state jsonb;
    v_stats jsonb;
    v_total_darts int;
    v_hits int;
    v_raw_score int;
    v_final_score int;
    v_has_won boolean;
    v_hit_rate numeric;
    v_point_efficiency numeric;
    v_raw_sr numeric;
    v_final_sr int;
    v_base_xp int;
    v_total_xp numeric;
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
    v_targets := coalesce(v_settings->'targets', '[]'::jsonb);
    v_level := greatest(1, least(20, coalesce((v_settings->>'level')::int, 1)));
    v_min_points := coalesce((v_settings->>'minPoints')::int, 0);
    v_mode_label := format('Online ATC Level %s', v_level);

    for v_player in
        select rp.player_id, rp.seat
        from public.online_room_players rp
        where rp.room_id = p_room_id
        order by rp.seat
    loop
        v_player_state := v_state->'players'->(v_player.player_id::text);
        v_stats := coalesce(v_player_state->'stats', public.atc_default_player_stats());
        v_total_darts := coalesce((v_stats->>'totalDarts')::int, 0);
        v_hits := coalesce((v_stats->>'hits')::int, 0);
        v_raw_score := coalesce((v_player_state->>'points')::int, 0) - coalesce((v_player_state->>'malusScore')::int, 0);
        v_final_score := greatest(0, v_raw_score);
        v_has_won := coalesce((v_player_state->>'currentIndex')::int, 0) >= jsonb_array_length(v_targets)
                     and v_final_score >= v_min_points
                     and coalesce((v_player_state->>'round')::int, 1) <= coalesce((v_settings->>'rounds')::int, 1);
        v_hit_rate := case when v_total_darts > 0 then v_hits::numeric / v_total_darts else 0 end;
        v_point_efficiency := least(1, coalesce((v_player_state->>'points')::numeric, 0) / 1000);
        v_raw_sr := (v_hit_rate * 150) + (v_point_efficiency * 30) + (v_level * 2);
        v_final_sr := least(180, floor(v_raw_sr)::int);
        v_base_xp := case when v_has_won then (780 + (v_level * 21)) else 100 end;
        v_total_xp := v_base_xp
            + (coalesce((v_stats->>'maxStreak')::int, 0) * 12)
            + (coalesce((v_stats->>'triples')::int, 0) * 20)
            + (v_hit_rate * 250);

        insert into public.online_room_results (
            room_id, player_id, seat, game_id, won, finished, result_status,
            start_score, final_score, round_reached, darts_thrown, xp_earned,
            sr_value, sr_category, result_stats
        )
        values (
            p_room_id,
            v_player.player_id,
            v_player.seat,
            'atc',
            v_room.winner_id = v_player.player_id,
            coalesce((v_player_state->>'isFinished')::boolean, false),
            p_result_status,
            0,
            v_final_score,
            coalesce((v_player_state->>'round')::int, 1),
            v_total_darts,
            floor(v_total_xp)::int,
            v_final_sr,
            'boardcontrol',
            coalesce(v_stats, '{}'::jsonb)
                || jsonb_build_object(
                    'points', coalesce((v_player_state->>'points')::int, 0),
                    'malus', coalesce((v_player_state->>'malusScore')::int, 0),
                    'finalScore', v_final_score,
                    'mode', v_mode_label,
                    'totalDarts', v_total_darts,
                    'online', true,
                    'onlineRoomId', p_room_id,
                    'level', v_level,
                    'minPoints', v_min_points,
                    'hitsPerTarget', coalesce((v_settings->>'hitsPerTarget')::int, 1),
                    'hitRate', to_char(round(v_hit_rate * 100, 1), 'FM999990.0') || '%',
                    'resultStatus', p_result_status
                )
        )
        on conflict (room_id, player_id)
        do update set
            won = excluded.won,
            finished = excluded.finished,
            result_status = excluded.result_status,
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
