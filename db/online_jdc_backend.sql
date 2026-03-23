-- =========================================================
-- ONLINE JDC BACKEND PACKAGE
-- Parallel package for JDC Challenge rooms, turns, results and sync.
-- Run after:
--   1. online room base SQL
--   2. online_x01_results_backend.sql
--   3. online_shanghai_backend.sql
--   4. online_atc_backend.sql
--   5. online_121_backend.sql
--
-- Notes:
-- - Keeps X01, Shanghai, ATC and 121 online flow intact.
-- - Adds JDC Challenge support in parallel.
-- - Expected turn payload for submit_jdc_turn:
--   {
--     "throws": [
--       { "val": 20, "mult": 1 },
--       { "val": 20, "mult": 3 },
--       { "val": 20, "mult": 2 }
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

    if p_game_id not in ('x01', 'shanghai', 'atc', 'game121', 'jdc-warmup') then
        raise exception 'Only x01, shanghai, atc, game121 and jdc-warmup are supported';
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

    if v_room.game_id not in ('x01', 'shanghai', 'atc', 'game121', 'jdc-warmup') then
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

create or replace function public.jdc_level_config(p_level int)
returns jsonb
language sql
immutable
as $$
    select case
        when coalesce(p_level, 1) >= 20 then jsonb_build_object('s1', '[10,15]'::jsonb, 'targets', null, 's2', '[15,20]'::jsonb, 'pointsPerDouble', 50, 'minPoints', 1000, 'xpBase', 1600)
        when coalesce(p_level, 1) >= 15 then jsonb_build_object('s1', '[10,15]'::jsonb, 'targets', null, 's2', '[15,20]'::jsonb, 'pointsPerDouble', 50, 'minPoints', 150, 'xpBase', 1300)
        when coalesce(p_level, 1) >= 10 then jsonb_build_object('s1', '[12,20]'::jsonb, 'targets', '[20,19,18,17,16,15,12,10,8,4,2,1]'::jsonb, 's2', '[12,20]'::jsonb, 'pointsPerDouble', 40, 'minPoints', 300, 'xpBase', 1000)
        when coalesce(p_level, 1) >= 5 then jsonb_build_object('s1', '[15,20]'::jsonb, 'targets', '[20,19,18,16,10,8]'::jsonb, 's2', '[15,20]'::jsonb, 'pointsPerDouble', 30, 'minPoints', 150, 'xpBase', 600)
        else jsonb_build_object('s1', '[18,20]'::jsonb, 'targets', '[20,18,10]'::jsonb, 's2', '[18,20]'::jsonb, 'pointsPerDouble', 20, 'minPoints', 50, 'xpBase', 400)
    end;
$$;

create or replace function public.jdc_build_game_plan(p_settings jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
    v_plan jsonb := '[]'::jsonb;
    v_s1_from int := coalesce(((p_settings->'s1')->>0)::int, 18);
    v_s1_to int := coalesce(((p_settings->'s1')->>1)::int, 20);
    v_s2_from int := coalesce(((p_settings->'s2')->>0)::int, 18);
    v_s2_to int := coalesce(((p_settings->'s2')->>1)::int, 20);
    v_targets jsonb := p_settings->'targets';
    v_chunk jsonb;
    v_idx int := 0;
    v_i int;
begin
    for v_i in v_s1_from..v_s1_to loop
        v_plan := v_plan || jsonb_build_array(
            jsonb_build_object(
                'target', jsonb_build_array(v_i, v_i, v_i),
                'type', 'shanghai'
            )
        );
    end loop;

    if v_targets is null or jsonb_typeof(v_targets) = 'null' then
        v_targets := '[]'::jsonb;
        for v_i in 1..20 loop
            v_targets := v_targets || jsonb_build_array(to_jsonb(v_i));
        end loop;
        v_targets := v_targets || jsonb_build_array(to_jsonb(25));
    end if;

    while v_idx < jsonb_array_length(v_targets) loop
        v_chunk := '[]'::jsonb;

        for v_i in 0..2 loop
            exit when v_idx + v_i >= jsonb_array_length(v_targets);
            v_chunk := v_chunk || jsonb_build_array(v_targets->(v_idx + v_i));
        end loop;

        while jsonb_array_length(v_chunk) < 3 loop
            v_chunk := v_chunk || jsonb_build_array(v_chunk->(jsonb_array_length(v_chunk) - 1));
        end loop;

        v_plan := v_plan || jsonb_build_array(
            jsonb_build_object(
                'target', v_chunk,
                'type', 'double'
            )
        );

        v_idx := v_idx + 3;
    end loop;

    for v_i in v_s2_from..v_s2_to loop
        v_plan := v_plan || jsonb_build_array(
            jsonb_build_object(
                'target', jsonb_build_array(v_i, v_i, v_i),
                'type', 'shanghai'
            )
        );
    end loop;

    return v_plan;
end;
$$;

create or replace function public.jdc_default_player_stats()
returns jsonb
language sql
immutable
as $$
    select jsonb_build_object(
        'hits', 0,
        'misses', 0,
        'doubles', 0,
        'triples', 0,
        'totalDarts', 0,
        'shanghais', 0,
        'doubleHits', 0
    );
$$;

create or replace function public.apply_jdc_turn(
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
    v_stats jsonb := coalesce(p_player_state->'stats', public.jdc_default_player_stats());
    v_points int := coalesce((p_player_state->>'points')::int, 0);
    v_round int := coalesce((p_player_state->>'round')::int, 1);
    v_max_rounds int := coalesce((p_player_state->>'maxRounds')::int, coalesce((p_settings->>'maxRounds')::int, 1));
    v_is_finished boolean := coalesce((p_player_state->>'isFinished')::boolean, false);
    v_plan jsonb := coalesce(p_settings->'gamePlan', '[]'::jsonb);
    v_step jsonb;
    v_type text;
    v_targets jsonb;
    v_points_per_double int := coalesce((p_settings->>'pointsPerDouble')::int, 50);
    v_throw jsonb;
    v_dart_index int;
    v_target int;
    v_val int;
    v_mult int;
    v_is_correct_number boolean;
    v_is_hit boolean;
    v_points_gained int;
    v_has_single boolean;
    v_has_double boolean;
    v_has_triple boolean;
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

    v_step := coalesce(v_plan -> greatest(v_round - 1, 0), '{}'::jsonb);
    v_type := coalesce(v_step->>'type', 'shanghai');
    v_targets := coalesce(v_step->'target', '[20,20,20]'::jsonb);

    for v_throw in
        select value from jsonb_array_elements(v_throws)
    loop
        exit when jsonb_array_length(v_round_throws) >= 3;

        v_dart_index := jsonb_array_length(v_round_throws);
        v_target := coalesce((v_targets->>v_dart_index)::int, (v_targets->>2)::int, 0);
        v_val := coalesce((v_throw->>'val')::int, -1);
        v_mult := coalesce((v_throw->>'mult')::int, -1);

        if not public.is_valid_x01_throw(v_val, v_mult) then
            raise exception 'invalid throw: val %, mult %', v_val, v_mult;
        end if;

        v_points_gained := 0;
        v_is_correct_number := v_val = v_target;
        v_is_hit := false;

        if v_type = 'shanghai' then
            if v_is_correct_number then
                v_points_gained := public.x01_throw_points(v_val, v_mult);
                v_is_hit := true;
                v_stats := jsonb_set(v_stats, '{hits}', to_jsonb(coalesce((v_stats->>'hits')::int, 0) + 1), true);

                if v_mult = 2 then
                    v_stats := jsonb_set(v_stats, '{doubles}', to_jsonb(coalesce((v_stats->>'doubles')::int, 0) + 1), true);
                elsif v_mult = 3 then
                    v_stats := jsonb_set(v_stats, '{triples}', to_jsonb(coalesce((v_stats->>'triples')::int, 0) + 1), true);
                end if;
            else
                v_stats := jsonb_set(v_stats, '{misses}', to_jsonb(coalesce((v_stats->>'misses')::int, 0) + 1), true);
            end if;
        else
            if v_is_correct_number and v_mult = 2 then
                v_points_gained := v_points_per_double;
                v_is_hit := true;
                v_stats := jsonb_set(v_stats, '{doubleHits}', to_jsonb(coalesce((v_stats->>'doubleHits')::int, 0) + 1), true);
                v_stats := jsonb_set(v_stats, '{hits}', to_jsonb(coalesce((v_stats->>'hits')::int, 0) + 1), true);
            else
                v_stats := jsonb_set(v_stats, '{misses}', to_jsonb(coalesce((v_stats->>'misses')::int, 0) + 1), true);
            end if;
        end if;

        v_points := v_points + v_points_gained;
        v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);

        v_round_throws := v_round_throws || jsonb_build_array(jsonb_build_object(
            'val', v_val,
            'base', v_val,
            'mult', v_mult,
            'target', v_target,
            'pointsGained', v_points_gained,
            'isHit', v_is_hit,
            'displayValue', case when v_val = 25 then 'DB' else v_val::text end
        ));
    end loop;

    while jsonb_array_length(v_round_throws) < 3 loop
        v_dart_index := jsonb_array_length(v_round_throws);
        v_target := coalesce((v_targets->>v_dart_index)::int, (v_targets->>2)::int, 0);

        v_stats := jsonb_set(v_stats, '{misses}', to_jsonb(coalesce((v_stats->>'misses')::int, 0) + 1), true);
        v_stats := jsonb_set(v_stats, '{totalDarts}', to_jsonb(coalesce((v_stats->>'totalDarts')::int, 0) + 1), true);

        v_round_throws := v_round_throws || jsonb_build_array(jsonb_build_object(
            'val', 0,
            'base', 0,
            'mult', 1,
            'target', v_target,
            'pointsGained', 0,
            'isHit', false,
            'displayValue', '0'
        ));
    end loop;

    if v_type = 'shanghai' then
        select
            exists(select 1 from jsonb_array_elements(v_round_throws) as t(value) where coalesce((value->>'isHit')::boolean, false) and coalesce((value->>'mult')::int, 0) = 1),
            exists(select 1 from jsonb_array_elements(v_round_throws) as t(value) where coalesce((value->>'isHit')::boolean, false) and coalesce((value->>'mult')::int, 0) = 2),
            exists(select 1 from jsonb_array_elements(v_round_throws) as t(value) where coalesce((value->>'isHit')::boolean, false) and coalesce((value->>'mult')::int, 0) = 3)
        into v_has_single, v_has_double, v_has_triple;

        if v_has_single and v_has_double and v_has_triple then
            v_points := v_points + 100;
            v_stats := jsonb_set(v_stats, '{shanghais}', to_jsonb(coalesce((v_stats->>'shanghais')::int, 0) + 1), true);
        end if;
    end if;

    if v_round < v_max_rounds then
        v_round := v_round + 1;
    else
        v_is_finished := true;
    end if;

    return jsonb_build_object(
        'points', v_points,
        'round', v_round,
        'maxRounds', v_max_rounds,
        'currentRoundThrows', '[]'::jsonb,
        'lastRoundThrows', v_round_throws,
        'isFinished', v_is_finished,
        'stats', v_stats
    );
end;
$$;

create or replace function public.start_online_jdc_match(
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
    v_plan jsonb;
    v_match_settings jsonb;
    v_max_rounds int;
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

    if v_room.game_id <> 'jdc-warmup' then
        raise exception 'Room is not a JDC room';
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
    v_config := public.jdc_level_config(v_level) || jsonb_build_object('level', v_level, 'isTraining', false);
    v_plan := public.jdc_build_game_plan(v_config);
    v_max_rounds := jsonb_array_length(v_plan);
    v_match_settings := v_config || jsonb_build_object(
        'gamePlan', v_plan,
        'maxRounds', v_max_rounds
    );

    v_live_state := jsonb_build_object(
        'gameId', 'jdc-warmup',
        'status', 'live',
        'startedAt', now(),
        'settings', v_match_settings,
        'currentTurnPlayerId', v_player_1,
        'players', jsonb_build_object(
            v_player_1::text, jsonb_build_object(
                'points', 0,
                'round', 1,
                'maxRounds', v_max_rounds,
                'currentRoundThrows', '[]'::jsonb,
                'lastRoundThrows', '[]'::jsonb,
                'isFinished', false,
                'stats', public.jdc_default_player_stats()
            ),
            v_player_2::text, jsonb_build_object(
                'points', 0,
                'round', 1,
                'maxRounds', v_max_rounds,
                'currentRoundThrows', '[]'::jsonb,
                'lastRoundThrows', '[]'::jsonb,
                'isFinished', false,
                'stats', public.jdc_default_player_stats()
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
            'gameId', 'jdc-warmup',
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

create or replace function public.finalize_online_jdc_results(
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
    v_points_per_double int;
    v_mode_label text;
    v_player record;
    v_player_state jsonb;
    v_stats jsonb;
    v_total_darts int;
    v_hits int;
    v_misses int;
    v_doubles int;
    v_triples int;
    v_shanghais int;
    v_double_hits int;
    v_points int;
    v_goal_met boolean;
    v_hit_rate numeric;
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
    v_points_per_double := coalesce((v_settings->>'pointsPerDouble')::int, 50);
    v_mode_label := format('JDC Level %s', v_level);

    for v_player in
        select rp.player_id, rp.seat
        from public.online_room_players rp
        where rp.room_id = p_room_id
        order by rp.seat
    loop
        v_player_state := v_state->'players'->(v_player.player_id::text);
        v_stats := coalesce(v_player_state->'stats', public.jdc_default_player_stats());
        v_total_darts := coalesce((v_stats->>'totalDarts')::int, 0);
        v_hits := coalesce((v_stats->>'hits')::int, 0);
        v_misses := coalesce((v_stats->>'misses')::int, 0);
        v_doubles := coalesce((v_stats->>'doubles')::int, 0);
        v_triples := coalesce((v_stats->>'triples')::int, 0);
        v_shanghais := coalesce((v_stats->>'shanghais')::int, 0);
        v_double_hits := coalesce((v_stats->>'doubleHits')::int, 0);
        v_points := coalesce((v_player_state->>'points')::int, 0);
        v_goal_met := v_points >= v_min_points;

        v_hit_rate := (v_hits::numeric / greatest(1, v_total_darts));
        v_sr := (v_points::numeric / greatest(1, case when v_min_points > 0 then v_min_points else 500 end)) * 100;
        v_sr := v_sr + (v_shanghais * 25) + (v_triples * 2);
        v_sr := least(180, greatest(0, floor(v_sr)));

        v_base_xp := coalesce((v_settings->>'xpBase')::numeric, 400);
        if v_goal_met then
            v_bonus_xp := (v_shanghais * 150) + (v_double_hits * 20) + (v_triples * 30);
            v_total_xp := v_base_xp + least(v_bonus_xp, v_base_xp * 0.8);
            if v_hit_rate > 0.4 then
                v_total_xp := v_total_xp * 1.2;
            end if;
        else
            v_total_xp := greatest(50, floor(v_base_xp * 0.25));
        end if;

        insert into public.online_room_results (
            room_id, player_id, seat, game_id, won, finished, result_status,
            start_score, final_score, round_reached, darts_thrown, xp_earned,
            sr_value, sr_category, result_stats
        )
        values (
            p_room_id,
            v_player.player_id,
            v_player.seat,
            'jdc-warmup',
            v_room.winner_id = v_player.player_id,
            coalesce((v_player_state->>'isFinished')::boolean, false),
            p_result_status,
            0,
            v_points,
            least(coalesce((v_player_state->>'round')::int, 1), coalesce((v_settings->>'maxRounds')::int, 1)),
            v_total_darts,
            floor(v_total_xp)::int,
            v_sr::int,
            'boardcontrol',
            coalesce(v_stats, '{}'::jsonb)
                || jsonb_build_object(
                    'points', v_points,
                    'finalScore', v_points,
                    'mode', v_mode_label,
                    'online', true,
                    'onlineRoomId', p_room_id,
                    'level', v_level,
                    'minPoints', v_min_points,
                    'pointsPerDouble', v_points_per_double,
                    'goalMet', v_goal_met,
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

create or replace function public.finish_online_jdc_match(
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

    perform public.finalize_online_jdc_results(p_room_id, 'finished');

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
        jsonb_build_object('winner_id', p_winner_id, 'gameId', 'jdc-warmup')
    );
end;
$$;

create or replace function public.submit_jdc_turn(
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
    v_current_points int;
    v_other_points int;
    v_current_shanghais int;
    v_other_shanghais int;
    v_current_double_hits int;
    v_other_double_hits int;
    v_current_hits int;
    v_other_hits int;
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

    if v_room.game_id <> 'jdc-warmup' then
        raise exception 'Room is not a JDC room';
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

    v_updated_player_state := public.apply_jdc_turn(
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
        v_current_points := coalesce((v_updated_player_state->>'points')::int, 0);
        v_other_points := coalesce((v_other_player_state->>'points')::int, 0);
        v_current_shanghais := coalesce((v_updated_player_state->'stats'->>'shanghais')::int, 0);
        v_other_shanghais := coalesce((v_other_player_state->'stats'->>'shanghais')::int, 0);
        v_current_double_hits := coalesce((v_updated_player_state->'stats'->>'doubleHits')::int, 0);
        v_other_double_hits := coalesce((v_other_player_state->'stats'->>'doubleHits')::int, 0);
        v_current_hits := coalesce((v_updated_player_state->'stats'->>'hits')::int, 0);
        v_other_hits := coalesce((v_other_player_state->'stats'->>'hits')::int, 0);

        if v_current_points > v_other_points then
            v_winner_id := v_current_player_id;
        elsif v_other_points > v_current_points then
            v_winner_id := v_other_player_id;
        elsif v_current_shanghais > v_other_shanghais then
            v_winner_id := v_current_player_id;
        elsif v_other_shanghais > v_current_shanghais then
            v_winner_id := v_other_player_id;
        elsif v_current_double_hits > v_other_double_hits then
            v_winner_id := v_current_player_id;
        elsif v_other_double_hits > v_current_double_hits then
            v_winner_id := v_other_player_id;
        elsif v_current_hits > v_other_hits then
            v_winner_id := v_current_player_id;
        elsif v_other_hits > v_current_hits then
            v_winner_id := v_other_player_id;
        else
            v_winner_id := v_player_ids[1];
        end if;

        perform public.finish_online_jdc_match(
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
                'gameId', 'jdc-warmup'
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
            'gameId', 'jdc-warmup'
        )
    );

    return jsonb_build_object(
        'room_id', p_room_id,
        'status', 'live',
        'next_player_id', v_next_player_id
    );
end;
$$;

create or replace function public.sync_my_online_jdc_result(
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

    perform public.finalize_online_jdc_results(p_room_id, 'finished');

    select * into v_result
    from public.online_room_results
    where room_id = p_room_id
      and player_id = auth.uid()
      and game_id = 'jdc-warmup'
    limit 1;

    if v_result.id is null then
        raise exception 'Online JDC result not found';
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
        coalesce(v_result.result_stats->>'mode', 'Online JDC'),
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
