-- =========================================================
-- ONLINE 121 BACKEND PACKAGE
-- Parallel package for 121 Challenge rooms, turns, results and sync.
-- Run after:
--   1. online room base SQL
--   2. online_x01_results_backend.sql
--   3. online_shanghai_backend.sql
--   4. online_atc_backend.sql
--
-- Notes:
-- - Keeps X01, Shanghai and ATC online flow intact.
-- - Adds 121 support in parallel.
-- - Expected turn payload for submit_121_turn:
--   {
--     "throws": [
--       { "val": 20, "mult": 3 },
--       { "val": 1, "mult": 1 }
--     ]
--   }
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

    if p_game_id not in ('x01', 'shanghai', 'atc', 'game121') then
        raise exception 'Only x01, shanghai, atc and game121 are supported';
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

    if v_room.game_id not in ('x01', 'shanghai', 'atc', 'game121') then
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

create or replace function public.game121_level_config(p_level int)
returns jsonb
language sql
immutable
as $$
    select case coalesce(p_level, 1)
        when 1 then jsonb_build_object('start', 61, 'rounds', 3, 'check', 'single', 'totalTargets', 3, 'minPoints', 5, 'resetToStart', false, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
        when 2 then jsonb_build_object('start', 65, 'rounds', 3, 'check', 'single', 'totalTargets', 4, 'minPoints', 9, 'resetToStart', false, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
        when 4 then jsonb_build_object('start', 75, 'rounds', 2, 'check', 'single', 'totalTargets', 6, 'minPoints', 35, 'resetToStart', true, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
        when 5 then jsonb_build_object('start', 80, 'rounds', 2, 'check', 'single', 'totalTargets', 7, 'minPoints', 45, 'resetToStart', true, 'malus', 2, 'switchTarget', 100, 'minTargetToReach', 0)
        when 9 then jsonb_build_object('start', 81, 'rounds', 3, 'check', 'single-double', 'totalTargets', 6, 'minPoints', 35, 'resetToStart', true, 'malus', 5, 'switchTarget', 82, 'minTargetToReach', 0)
        when 10 then jsonb_build_object('start', 121, 'rounds', 9, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 20 then jsonb_build_object('start', 121, 'rounds', 2, 'check', 'double', 'totalTargets', 10, 'minPoints', 60, 'resetToStart', true, 'malus', 10, 'switchTarget', 100, 'minTargetToReach', 125)
        when 3 then jsonb_build_object('start', 76, 'rounds', 3, 'check', 'single', 'totalTargets', 5, 'minPoints', 5, 'resetToStart', false, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
        when 6 then jsonb_build_object('start', 91, 'rounds', 2, 'check', 'single', 'totalTargets', 6, 'minPoints', 5, 'resetToStart', false, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
        when 7 then jsonb_build_object('start', 96, 'rounds', 2, 'check', 'single', 'totalTargets', 6, 'minPoints', 5, 'resetToStart', false, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
        when 8 then jsonb_build_object('start', 101, 'rounds', 2, 'check', 'single', 'totalTargets', 6, 'minPoints', 5, 'resetToStart', false, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
        when 11 then jsonb_build_object('start', 121, 'rounds', 8, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 12 then jsonb_build_object('start', 121, 'rounds', 7, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 13 then jsonb_build_object('start', 121, 'rounds', 6, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 14 then jsonb_build_object('start', 121, 'rounds', 5, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 15 then jsonb_build_object('start', 121, 'rounds', 5, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 16 then jsonb_build_object('start', 121, 'rounds', 4, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 17 then jsonb_build_object('start', 121, 'rounds', 3, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 18 then jsonb_build_object('start', 121, 'rounds', 2, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        when 19 then jsonb_build_object('start', 121, 'rounds', 2, 'check', 'single-double', 'totalTargets', 7, 'minPoints', 30, 'resetToStart', true, 'malus', 6, 'switchTarget', 123, 'minTargetToReach', 123)
        else jsonb_build_object('start', 61, 'rounds', 3, 'check', 'single', 'totalTargets', 3, 'minPoints', 5, 'resetToStart', false, 'malus', 1, 'switchTarget', 100, 'minTargetToReach', 0)
    end;
$$;

create or replace function public.game121_default_player_stats()
returns jsonb
language sql
immutable
as $$
    select jsonb_build_object(
        'checks', 0,
        'totalDarts', 0,
        'doubles', 0,
        'triples', 0,
        't20FirstDart', 0,
        't19FirstDart', 0,
        'perfectDartsNeeded', 0
    );
$$;

create or replace function public.game121_current_check_mode(
    p_current_target int,
    p_check_mode text,
    p_switch_target int
)
returns text
language sql
immutable
as $$
    select case
        when coalesce(p_check_mode, 'single') = 'single-double'
            then case when coalesce(p_current_target, 0) >= coalesce(p_switch_target, 100) then 'double' else 'single' end
        else coalesce(p_check_mode, 'single')
    end;
$$;

create or replace function public.apply_121_turn(
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
    v_round_throws jsonb := '[]'::jsonb;
    v_stats jsonb := coalesce(p_player_state->'stats', public.game121_default_player_stats());
    v_points int := coalesce((p_player_state->>'points')::int, 0);
    v_malus_score int := coalesce((p_player_state->>'malusScore')::int, 0);
    v_round int := coalesce((p_player_state->>'round')::int, 1);
    v_round_darts int := 0;
    v_targets_played int := coalesce((p_player_state->>'targetsPlayed')::int, 0);
    v_rounds_used int := coalesce((p_player_state->>'roundsUsedForTarget')::int, 0);
    v_current_target int := coalesce((p_player_state->>'currentTarget')::int, coalesce((p_settings->>'start')::int, 61));
    v_current_score int := coalesce((p_player_state->>'currentScore')::int, v_current_target);
    v_start_target int := coalesce((p_player_state->>'startTarget')::int, coalesce((p_settings->>'start')::int, 61));
    v_max_rounds int := coalesce((p_settings->>'rounds')::int, 3);
    v_total_targets int := coalesce((p_settings->>'totalTargets')::int, 3);
    v_min_points int := coalesce((p_settings->>'minPoints')::int, 0);
    v_malus_amount int := coalesce((p_settings->>'malus')::int, 1);
    v_reset_to_start boolean := coalesce((p_settings->>'resetToStart')::boolean, false);
    v_check_mode text := coalesce(p_settings->>'check', 'single');
    v_switch_target int := coalesce((p_settings->>'switchTarget')::int, 100);
    v_min_target_to_reach int := coalesce((p_settings->>'minTargetToReach')::int, 0);
    v_is_finished boolean := coalesce((p_player_state->>'isFinished')::boolean, false);
    v_active_check_mode text;
    v_round_start_score int;
    v_throw jsonb;
    v_val int;
    v_mult int;
    v_points_hit int;
    v_score_after int;
    v_is_bust boolean;
    v_checked boolean := false;
begin
    if jsonb_typeof(v_throws) <> 'array' then
        raise exception 'throws must be a json array';
    end if;

    if jsonb_array_length(v_throws) < 1 or jsonb_array_length(v_throws) > 3 then
        raise exception 'turn must contain between 1 and 3 throws';
    end if;

    if v_is_finished then
        return p_player_state;
    end if;

    v_round_start_score := v_current_score;
    v_active_check_mode := public.game121_current_check_mode(v_current_target, v_check_mode, v_switch_target);

    for v_throw in
        select value from jsonb_array_elements(v_throws)
    loop
        exit when v_round_darts >= 3 or v_is_finished or v_checked;

        v_val := coalesce((v_throw->>'val')::int, -1);
        v_mult := coalesce((v_throw->>'mult')::int, -1);

        if not public.is_valid_x01_throw(v_val, v_mult) then
            raise exception 'invalid throw: val %, mult %', v_val, v_mult;
        end if;

        v_round_darts := v_round_darts + 1;
        v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);

        if v_mult = 2 then
            v_stats := jsonb_set(v_stats, '{doubles}', to_jsonb(coalesce((v_stats->>'doubles')::int, 0) + 1), true);
        end if;

        if v_mult = 3 then
            v_stats := jsonb_set(v_stats, '{triples}', to_jsonb(coalesce((v_stats->>'triples')::int, 0) + 1), true);
        end if;

        if v_round_darts = 1 and v_val = 20 and v_mult = 3 then
            v_stats := jsonb_set(v_stats, '{t20FirstDart}', to_jsonb(coalesce((v_stats->>'t20FirstDart')::int, 0) + 1), true);
        end if;

        if v_round_darts = 1 and v_val = 19 and v_mult = 3 then
            v_stats := jsonb_set(v_stats, '{t19FirstDart}', to_jsonb(coalesce((v_stats->>'t19FirstDart')::int, 0) + 1), true);
        end if;

        v_points_hit := public.x01_throw_points(v_val, v_mult);
        v_score_after := v_current_score - v_points_hit;
        v_is_bust := false;

        if v_score_after < 0 then
            v_is_bust := true;
        elsif v_score_after = 0 then
            if v_active_check_mode = 'double' and v_mult <> 2 then
                v_is_bust := true;
            end if;
            if v_active_check_mode = 'double' and v_val = 25 and v_mult = 1 then
                v_is_bust := true;
            end if;
        elsif v_score_after = 1 and v_active_check_mode = 'double' then
            v_is_bust := true;
        end if;

        v_round_throws := v_round_throws || jsonb_build_array(jsonb_build_object(
            'val', v_val,
            'mult', v_mult,
            'base', v_val,
            'isBust', v_is_bust,
            'scoreBefore', v_current_score
        ));

        if v_is_bust then
            v_current_score := v_round_start_score;

            while jsonb_array_length(v_round_throws) < 3 loop
                v_round_throws := v_round_throws || jsonb_build_array(jsonb_build_object(
                    'val', 0,
                    'mult', 1,
                    'base', 0,
                    'isBust', true,
                    'scoreBefore', v_current_score
                ));
                v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);
            end loop;

            exit;
        end if;

        v_current_score := v_score_after;

        if v_current_score = 0 then
            v_checked := true;
            v_points := v_points + 10;
            v_stats := jsonb_set(v_stats, '{checks}', to_jsonb(coalesce((v_stats->>'checks')::int, 0) + 1), true);
            v_stats := jsonb_set(v_stats, '{perfectDartsNeeded}', to_jsonb(coalesce((v_stats->>'perfectDartsNeeded')::int, 0) + ceil(v_current_target::numeric / 30)::int), true);
            v_targets_played := v_targets_played + 1;

            if coalesce((p_settings->>'isTraining')::boolean, false) then
                v_current_target := v_current_target + 1;
            else
                v_current_target := v_current_target + case when coalesce((p_settings->>'level')::int, 1) >= 10 then 1 else 5 end;
            end if;

            v_rounds_used := -1;

            while jsonb_array_length(v_round_throws) < 3 loop
                v_round_throws := v_round_throws || jsonb_build_array(jsonb_build_object(
                    'val', 0,
                    'mult', 0,
                    'base', 0,
                    'isDummy', true,
                    'scoreBefore', 0
                ));
            end loop;

            if v_targets_played >= v_total_targets then
                v_is_finished := true;
            end if;

            exit;
        end if;
    end loop;

    if not v_checked then
        while jsonb_array_length(v_round_throws) < 3 loop
            v_round_throws := v_round_throws || jsonb_build_array(jsonb_build_object(
                'val', 0,
                'mult', 1,
                'base', 0,
                'isBust', false,
                'scoreBefore', v_current_score
            ));
            v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);
        end loop;
    end if;

    v_rounds_used := v_rounds_used + 1;

    if not v_checked and v_rounds_used >= v_max_rounds then
        v_points := v_points - case when coalesce((p_settings->>'isTraining')::boolean, false) then 0 else v_malus_amount end;
        v_targets_played := v_targets_played + 1;

        if v_reset_to_start then
            v_current_target := v_start_target;
        end if;

        if v_targets_played >= v_total_targets then
            v_is_finished := true;
        else
            v_rounds_used := 0;
            v_current_score := v_current_target;
        end if;
    end if;

    if not v_is_finished then
        v_round := v_round + 1;
        if v_checked or v_rounds_used = 0 then
            v_current_score := v_current_target;
        end if;
    end if;

    return jsonb_build_object(
        'points', v_points,
        'malusScore', v_malus_score,
        'round', v_round,
        'roundDarts', 0,
        'roundsUsedForTarget', v_rounds_used,
        'targetsPlayed', v_targets_played,
        'currentTarget', v_current_target,
        'currentScore', v_current_score,
        'startTarget', v_start_target,
        'maxRoundsPerTarget', v_max_rounds,
        'checkMode', v_check_mode,
        'activeCheckMode', public.game121_current_check_mode(v_current_target, v_check_mode, v_switch_target),
        'switchTarget', v_switch_target,
        'totalTargetsToPlay', v_total_targets,
        'minPointsRequired', v_min_points,
        'minTargetToReach', v_min_target_to_reach,
        'resetToStart', v_reset_to_start,
        'lastRoundThrows', v_round_throws,
        'currentRoundThrows', '[]'::jsonb,
        'isFinished', v_is_finished,
        'stats', v_stats
    );
end;
$$;

create or replace function public.start_online_121_match(
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

    if v_room.game_id <> 'game121' then
        raise exception 'Room is not a 121 room';
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
    v_config := public.game121_level_config(v_level) || jsonb_build_object('level', v_level, 'isTraining', false);

    v_live_state := jsonb_build_object(
        'gameId', 'game121',
        'status', 'live',
        'startedAt', now(),
        'settings', v_config,
        'currentTurnPlayerId', v_player_1,
        'players', jsonb_build_object(
            v_player_1::text, jsonb_build_object(
                'points', 0,
                'malusScore', 0,
                'round', 1,
                'roundDarts', 0,
                'roundsUsedForTarget', 0,
                'targetsPlayed', 0,
                'currentTarget', coalesce((v_config->>'start')::int, 61),
                'currentScore', coalesce((v_config->>'start')::int, 61),
                'startTarget', coalesce((v_config->>'start')::int, 61),
                'maxRoundsPerTarget', coalesce((v_config->>'rounds')::int, 3),
                'checkMode', coalesce(v_config->>'check', 'single'),
                'activeCheckMode', public.game121_current_check_mode(coalesce((v_config->>'start')::int, 61), v_config->>'check', coalesce((v_config->>'switchTarget')::int, 100)),
                'switchTarget', coalesce((v_config->>'switchTarget')::int, 100),
                'totalTargetsToPlay', coalesce((v_config->>'totalTargets')::int, 3),
                'minPointsRequired', coalesce((v_config->>'minPoints')::int, 0),
                'minTargetToReach', coalesce((v_config->>'minTargetToReach')::int, 0),
                'resetToStart', coalesce((v_config->>'resetToStart')::boolean, false),
                'lastRoundThrows', '[]'::jsonb,
                'currentRoundThrows', '[]'::jsonb,
                'isFinished', false,
                'stats', public.game121_default_player_stats()
            ),
            v_player_2::text, jsonb_build_object(
                'points', 0,
                'malusScore', 0,
                'round', 1,
                'roundDarts', 0,
                'roundsUsedForTarget', 0,
                'targetsPlayed', 0,
                'currentTarget', coalesce((v_config->>'start')::int, 61),
                'currentScore', coalesce((v_config->>'start')::int, 61),
                'startTarget', coalesce((v_config->>'start')::int, 61),
                'maxRoundsPerTarget', coalesce((v_config->>'rounds')::int, 3),
                'checkMode', coalesce(v_config->>'check', 'single'),
                'activeCheckMode', public.game121_current_check_mode(coalesce((v_config->>'start')::int, 61), v_config->>'check', coalesce((v_config->>'switchTarget')::int, 100)),
                'switchTarget', coalesce((v_config->>'switchTarget')::int, 100),
                'totalTargetsToPlay', coalesce((v_config->>'totalTargets')::int, 3),
                'minPointsRequired', coalesce((v_config->>'minPoints')::int, 0),
                'minTargetToReach', coalesce((v_config->>'minTargetToReach')::int, 0),
                'resetToStart', coalesce((v_config->>'resetToStart')::boolean, false),
                'lastRoundThrows', '[]'::jsonb,
                'currentRoundThrows', '[]'::jsonb,
                'isFinished', false,
                'stats', public.game121_default_player_stats()
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
            'gameId', 'game121',
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

create or replace function public.finalize_online_121_results(
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
    v_level int;
    v_min_points int;
    v_total_targets int;
    v_mode_label text;
    v_player record;
    v_player_state jsonb;
    v_stats jsonb;
    v_total_darts int;
    v_checks int;
    v_doubles int;
    v_triples int;
    v_t20 int;
    v_t19 int;
    v_perfect_needed int;
    v_points int;
    v_malus int;
    v_final_points int;
    v_won boolean;
    v_sr numeric;
    v_base_xp numeric;
    v_bonus_xp numeric;
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
    v_level := greatest(1, least(20, coalesce((v_settings->>'level')::int, 1)));
    v_min_points := coalesce((v_settings->>'minPoints')::int, 0);
    v_total_targets := coalesce((v_settings->>'totalTargets')::int, 1);
    v_mode_label := format('121 Level %s', v_level);

    for v_player in
        select rp.player_id, rp.seat
        from public.online_room_players rp
        where rp.room_id = p_room_id
        order by rp.seat
    loop
        v_player_state := v_state->'players'->(v_player.player_id::text);
        v_stats := coalesce(v_player_state->'stats', public.game121_default_player_stats());
        v_total_darts := coalesce((v_stats->>'totalDarts')::int, 0);
        v_checks := coalesce((v_stats->>'checks')::int, 0);
        v_doubles := coalesce((v_stats->>'doubles')::int, 0);
        v_triples := coalesce((v_stats->>'triples')::int, 0);
        v_t20 := coalesce((v_stats->>'t20FirstDart')::int, 0);
        v_t19 := coalesce((v_stats->>'t19FirstDart')::int, 0);
        v_perfect_needed := greatest(1, coalesce((v_stats->>'perfectDartsNeeded')::int, 0));
        v_points := coalesce((v_player_state->>'points')::int, 0);
        v_malus := coalesce((v_player_state->>'malusScore')::int, 0);
        v_final_points := v_points;
        v_won := v_points >= v_min_points;

        v_sr := (v_perfect_needed::numeric / greatest(1, v_total_darts)) * 100;
        v_sr := v_sr + (v_doubles * 2) + v_triples + (v_t20 * 5) + (v_t19 * 5);
        if v_min_points > 0 then
            v_sr := v_sr * greatest(0, v_points::numeric / v_min_points);
        end if;
        v_sr := least(180, floor(v_sr));

        v_base_xp := case when v_won then (700 + (v_level * 20)) else 200 end;
        v_bonus_xp := case
            when v_won
                then (v_base_xp * 0.5) + ((v_checks::numeric / greatest(1, v_total_targets)) * (v_base_xp * 0.3))
            else 0
        end;
        v_total_xp := v_base_xp + v_bonus_xp;

        insert into public.online_room_results (
            room_id, player_id, seat, game_id, won, finished, result_status,
            start_score, final_score, round_reached, darts_thrown, xp_earned,
            sr_value, sr_category, result_stats
        )
        values (
            p_room_id,
            v_player.player_id,
            v_player.seat,
            'game121',
            v_room.winner_id = v_player.player_id,
            coalesce((v_player_state->>'isFinished')::boolean, false),
            p_result_status,
            coalesce((v_settings->>'start')::int, 61),
            v_final_points,
            greatest(1, coalesce((v_player_state->>'round')::int, 1) - 1),
            v_total_darts,
            floor(v_total_xp)::int,
            v_sr::int,
            'finishing',
            coalesce(v_stats, '{}'::jsonb)
                || jsonb_build_object(
                    'points', v_points,
                    'malus', v_malus,
                    'finalPoints', v_final_points,
                    'mode', v_mode_label,
                    'online', true,
                    'onlineRoomId', p_room_id,
                    'level', v_level,
                    'targetsPlayed', coalesce((v_player_state->>'targetsPlayed')::int, 0),
                    'totalTargets', v_total_targets,
                    'minPoints', v_min_points,
                    'currentTarget', coalesce((v_player_state->>'currentTarget')::int, coalesce((v_settings->>'start')::int, 61)),
                    'minTargetToReach', coalesce((v_settings->>'minTargetToReach')::int, 0),
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

create or replace function public.finish_online_121_match(
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

    perform public.finalize_online_121_results(p_room_id, 'finished');

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
        jsonb_build_object('winner_id', p_winner_id, 'gameId', 'game121')
    );
end;
$$;

create or replace function public.submit_121_turn(
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
    v_current_final_points int;
    v_other_final_points int;
    v_current_target int;
    v_other_target int;
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

    if v_room.game_id <> 'game121' then
        raise exception 'Room is not a 121 room';
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

    v_updated_player_state := public.apply_121_turn(
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
        v_current_final_points := coalesce((v_updated_player_state->>'points')::int, 0);
        v_other_final_points := coalesce((v_other_player_state->>'points')::int, 0);
        v_current_target := coalesce((v_updated_player_state->>'currentTarget')::int, 0);
        v_other_target := coalesce((v_other_player_state->>'currentTarget')::int, 0);

        if v_current_final_points > v_other_final_points then
            v_winner_id := v_current_player_id;
        elsif v_other_final_points > v_current_final_points then
            v_winner_id := v_other_player_id;
        elsif v_current_target > v_other_target then
            v_winner_id := v_current_player_id;
        elsif v_other_target > v_current_target then
            v_winner_id := v_other_player_id;
        elsif coalesce((v_updated_player_state->'stats'->>'checks')::int, 0) > coalesce((v_other_player_state->'stats'->>'checks')::int, 0) then
            v_winner_id := v_current_player_id;
        elsif coalesce((v_other_player_state->'stats'->>'checks')::int, 0) > coalesce((v_updated_player_state->'stats'->>'checks')::int, 0) then
            v_winner_id := v_other_player_id;
        else
            v_winner_id := v_player_ids[1];
        end if;

        perform public.finish_online_121_match(
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
                'gameId', 'game121'
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
            'gameId', 'game121'
        )
    );

    return jsonb_build_object(
        'room_id', p_room_id,
        'status', 'live',
        'next_player_id', v_next_player_id
    );
end;
$$;

create or replace function public.sync_my_online_121_result(
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

    perform public.finalize_online_121_results(p_room_id, 'finished');

    select * into v_result
    from public.online_room_results
    where room_id = p_room_id
      and player_id = auth.uid()
      and game_id = 'game121'
    limit 1;

    if v_result.id is null then
        raise exception 'Online 121 result not found';
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
        coalesce(v_result.result_stats->>'mode', 'Online 121'),
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
        games_finishing = coalesce(games_finishing, 0) + 1,
        total_wins = case when v_result.won then coalesce(total_wins, 0) + 1 else coalesce(total_wins, 0) end,
        sr_finishing = v_result.sr_value,
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
