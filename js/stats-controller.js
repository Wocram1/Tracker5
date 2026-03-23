import { supabase } from './supabase_client.js';

const EMPTY_OVERVIEW = {
    total_matches: 0,
    total_xp_from_history: 0,
    total_darts_from_history: 0,
    matches_x01: 0,
    matches_boardcontrol: 0,
    matches_finishing: 0,
    matches_warmup: 0,
    online_x01_matches: 0,
    online_x01_wins: 0,
    online_shanghai_matches: 0,
    online_shanghai_wins: 0,
    online_atc_matches: 0,
    online_atc_wins: 0,
    last_match_at: null
};

const EMPTY_X01 = {
    matches_played: 0,
    avg_score: 0,
    total_180s: 0,
    total_triples: 0,
    total_doubles: 0,
    total_points: 0,
    online_matches: 0,
    online_wins: 0
};

const EMPTY_BOARD = {
    matches_played: 0,
    avg_hit_rate: 0,
    best_streak: 0,
    total_hits: 0,
    total_misses: 0,
    total_singles: 0,
    total_doubles: 0,
    total_triples: 0,
    total_first_dart_hits: 0,
    online_matches: 0,
    online_wins: 0
};

const EMPTY_FINISH = {
    matches_played: 0,
    total_checkouts: 0,
    total_darts: 0,
    total_doubles: 0,
    total_triples: 0,
    avg_checkouts_per_match: 0,
    avg_darts_per_match: 0
};

function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatCompact(value) {
    const n = num(value);
    return n.toLocaleString('de-DE');
}

function formatDateShort(value) {
    if (!value) return 'Keine Session';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Keine Session';
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function dayKeyLocal(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function categoryLabel(overview) {
    const entries = [
        ['Scoring', num(overview.matches_x01)],
        ['Board', num(overview.matches_boardcontrol)],
        ['Finishing', num(overview.matches_finishing)],
        ['Warmup', num(overview.matches_warmup)]
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][1] > 0 ? entries[0][0] : '--';
}

export const StatsController = {
    currentOverviewPanel: 'snapshot',
    currentDeepDivePanel: 'x01',

    async loadStats() {
        const playerId = window.appState?.user?.id;
        if (!playerId) return;

        try {
            const [
                overviewRes,
                xpDailyRes,
                x01Res,
                boardRes,
                finishRes,
                leaderboardRes,
                heatmapRes,
                fallbackHistoryRes,
                onlineResultsRes
            ] = await Promise.all([
                supabase.from('stats_overview_user').select('*').eq('player_id', playerId).maybeSingle(),
                supabase.from('stats_xp_daily_30d').select('*').eq('player_id', playerId).order('day', { ascending: true }),
                supabase.from('stats_deep_dive_x01').select('*').eq('player_id', playerId).maybeSingle(),
                supabase.from('stats_deep_dive_boardcontrol').select('*').eq('player_id', playerId).maybeSingle(),
                supabase.from('stats_deep_dive_finishing').select('*').eq('player_id', playerId).maybeSingle(),
                supabase.from('leaderboard_power').select('*').order('power_score', { ascending: false }).limit(50),
                supabase.from('throw_events').select('hit_number').eq('player_id', playerId).eq('was_hit', true).limit(5000),
                supabase.from('match_history').select('game_mode, xp_earned, played_at, match_stats').eq('player_id', playerId).order('played_at', { ascending: false }).limit(150),
                supabase.from('online_room_results').select('won, darts_thrown, xp_earned, sr_value, result_stats, created_at, game_id').eq('player_id', playerId).in('game_id', ['x01', 'shanghai', 'atc']).order('created_at', { ascending: false }).limit(200)
            ]);

            const historyRows = fallbackHistoryRes.data || [];
            const fallbackData = this.processMatchHistory(historyRows);
            const onlineStats = this.processOnlineResults(onlineResultsRes.data || []);

            const overview = this.mergeOverviewData(overviewRes.data || this.buildOverviewFallback(fallbackData), onlineStats);
            const xpDaily = xpDailyRes.data || [];
            const x01 = this.mergeX01Data(x01Res.data || this.buildX01Fallback(fallbackData), onlineStats);
            const board = this.mergeBoardData(boardRes.data || this.buildBoardFallback(fallbackData), onlineStats);
            const finish = finishRes.data || this.buildFinishFallback(fallbackData);
            const leaderboard = leaderboardRes.data || [];
            const heatmapCounts = this.buildHeatmapCounts(heatmapRes.data, fallbackData.heatmapCounts);

            this.renderOverview(overview);
            this.renderProgressChart(xpDaily, fallbackData);
            this.renderDeepDiveStats(x01, board, finish);
            this.renderHeatmap(heatmapCounts);
            this.renderAchievements(overview, x01, board, finish, fallbackData, onlineStats);
            this.renderLeaderboard(leaderboard);
            this.switchOverviewPanel(this.currentOverviewPanel);
            this.switchDeepDivePanel(this.currentDeepDivePanel);
        } catch (err) {
            console.error('Fehler beim Laden der Statistiken:', err);
        }
    },

    processOnlineResults(rows) {
        const stats = {
            totalWins: 0,
            x01: {
                matches: 0,
                wins: 0,
                darts: 0,
                xp: 0,
                avgScoreSum: 0,
                total180s: 0,
                totalTriples: 0,
                totalDoubles: 0,
                totalPoints: 0
            },
            shanghai: {
                matches: 0,
                wins: 0,
                darts: 0,
                xp: 0,
                hitRateSum: 0,
                totalHits: 0,
                totalMisses: 0,
                totalPoints: 0,
                totalMalus: 0,
                bestStreak: 0
            },
            atc: {
                matches: 0,
                wins: 0,
                darts: 0,
                xp: 0,
                hitRateSum: 0,
                totalHits: 0,
                totalMisses: 0,
                totalPoints: 0,
                totalMalus: 0,
                bestStreak: 0
            }
        };

        rows.forEach(row => {
            const resultStats = row.result_stats || {};
            const bucket = row.game_id === 'shanghai'
                ? stats.shanghai
                : row.game_id === 'atc'
                    ? stats.atc
                    : stats.x01;
            bucket.matches += 1;
            bucket.wins += row.won ? 1 : 0;
            bucket.darts += num(row.darts_thrown);
            bucket.xp += num(row.xp_earned);
            stats.totalWins += row.won ? 1 : 0;

            if (row.game_id === 'shanghai' || row.game_id === 'atc') {
                bucket.hitRateSum += num(String(resultStats.hitRate || '0').replace('%', ''));
                bucket.totalHits += num(resultStats.hits);
                bucket.totalMisses += num(resultStats.misses);
                bucket.totalPoints += num(resultStats.points);
                bucket.totalMalus += num(resultStats.malus);
                bucket.bestStreak = Math.max(bucket.bestStreak, num(resultStats.maxStreak));
            } else {
                bucket.avgScoreSum += num(resultStats.avg);
                bucket.total180s += num(resultStats.oneEighty);
                bucket.totalTriples += num(resultStats.triples);
                bucket.totalDoubles += num(resultStats.doubles);
                bucket.totalPoints += num(resultStats.totalPoints);
            }
        });

        stats.x01.avgScore = stats.x01.matches > 0 ? (stats.x01.avgScoreSum / stats.x01.matches) : 0;
        stats.shanghai.avgHitRate = stats.shanghai.matches > 0 ? (stats.shanghai.hitRateSum / stats.shanghai.matches) : 0;
        stats.atc.avgHitRate = stats.atc.matches > 0 ? (stats.atc.hitRateSum / stats.atc.matches) : 0;
        return stats;
    },

    mergeOverviewData(baseOverview, onlineStats) {
        const overview = { ...EMPTY_OVERVIEW, ...baseOverview };
        overview.online_x01_matches = num(onlineStats.x01?.matches);
        overview.online_x01_wins = num(onlineStats.x01?.wins);
        overview.online_shanghai_matches = num(onlineStats.shanghai?.matches);
        overview.online_shanghai_wins = num(onlineStats.shanghai?.wins);
        overview.online_atc_matches = num(onlineStats.atc?.matches);
        overview.online_atc_wins = num(onlineStats.atc?.wins);
        return overview;
    },

    mergeX01Data(baseX01, onlineStats) {
        const x01 = { ...EMPTY_X01, ...baseX01 };
        x01.online_matches = num(onlineStats.x01?.matches);
        x01.online_wins = num(onlineStats.x01?.wins);
        return x01;
    },

    mergeBoardData(baseBoard, onlineStats) {
        const board = { ...EMPTY_BOARD, ...baseBoard };
        board.online_matches = num(onlineStats.shanghai?.matches) + num(onlineStats.atc?.matches);
        board.online_wins = num(onlineStats.shanghai?.wins) + num(onlineStats.atc?.wins);
        return board;
    },

    processMatchHistory(rows) {
        const stats = {
            xpTrend: Array(7).fill(0),
            matchesLast7: 0,
            x01: { avg_score: 0, total_180s: 0, total_triples: 0, total_doubles: 0, total_points: 0, matches_played: 0 },
            board: { avg_hit_rate: 0, best_streak: 0, total_hits: 0, total_misses: 0, total_singles: 0, total_doubles: 0, total_triples: 0, total_first_dart_hits: 0, matches_played: 0 },
            finish: { total_checkouts: 0, total_darts: 0, total_doubles: 0, total_triples: 0, avg_checkouts_per_match: 0, avg_darts_per_match: 0, matches_played: 0 },
            heatmapCounts: {},
            overview: { ...EMPTY_OVERVIEW }
        };

        const now = new Date();

        rows.forEach(row => {
            const mStats = row.match_stats || {};
            const playedDate = new Date(row.played_at);
            const diffDays = Math.floor((now - playedDate) / (1000 * 60 * 60 * 24));

            stats.overview.total_matches += 1;
            stats.overview.total_xp_from_history += num(row.xp_earned);
            stats.overview.total_darts_from_history += num(mStats.totalDarts);
            stats.overview.last_match_at = stats.overview.last_match_at || row.played_at;

            if (row.game_mode?.includes('X01')) stats.overview.matches_x01 += 1;
            else if (row.game_mode?.includes('121') || row.game_mode?.includes('Catch 40') || row.game_mode?.includes('Checkout')) stats.overview.matches_finishing += 1;
            else if (row.game_mode?.includes('ATC') || row.game_mode?.includes('Shanghai') || row.game_mode?.includes('Bermuda') || row.game_mode?.includes('Section')) stats.overview.matches_boardcontrol += 1;
            else stats.overview.matches_warmup += 1;

            if (diffDays >= 0 && diffDays < 7) {
                stats.xpTrend[6 - diffDays] += num(row.xp_earned);
                stats.matchesLast7 += 1;
            }

            if (row.game_mode?.includes('X01')) {
                stats.x01.matches_played += 1;
                stats.x01.avg_score += num(mStats.avg);
                stats.x01.total_180s += num(mStats.oneEighty);
                stats.x01.total_triples += num(mStats.triples);
                stats.x01.total_doubles += num(mStats.doubles);
                stats.x01.total_points += num(mStats.totalPoints);
            }

            if (row.game_mode?.includes('ATC') || row.game_mode?.includes('Shanghai') || row.game_mode?.includes('Bermuda') || row.game_mode?.includes('Section')) {
                stats.board.matches_played += 1;
                stats.board.avg_hit_rate += num(String(mStats.hitRate || '0').replace('%', ''));
                stats.board.best_streak = Math.max(stats.board.best_streak, num(mStats.maxStreak));
                stats.board.total_hits += num(mStats.hits);
                stats.board.total_misses += num(mStats.misses);
                stats.board.total_singles += num(mStats.singles);
                stats.board.total_doubles += num(mStats.doubles);
                stats.board.total_triples += num(mStats.triples);
                stats.board.total_first_dart_hits += num(mStats.firstDartHits);
            }

            if (row.game_mode?.includes('121') || row.game_mode?.includes('Catch 40') || row.game_mode?.includes('Checkout')) {
                stats.finish.matches_played += 1;
                stats.finish.total_checkouts += num(mStats.checks);
                stats.finish.total_darts += num(mStats.totalDarts);
                stats.finish.total_doubles += num(mStats.doubles);
                stats.finish.total_triples += num(mStats.triples);
            }

            const heatTargets = mStats.targetHitsByNumber || mStats.target_hits_by_number;
            if (heatTargets && typeof heatTargets === 'object') {
                Object.entries(heatTargets).forEach(([key, value]) => {
                    const hitKey = num(key);
                    if (hitKey > 0) stats.heatmapCounts[hitKey] = (stats.heatmapCounts[hitKey] || 0) + num(value);
                });
            } else {
                const mainSegment = row.game_mode?.includes('20') ? 20 : (row.game_mode?.includes('19') ? 19 : 20);
                stats.heatmapCounts[mainSegment] = (stats.heatmapCounts[mainSegment] || 0) + Math.max(1, num(mStats.hits, 1));
            }
        });

        if (stats.x01.matches_played > 0) stats.x01.avg_score = stats.x01.avg_score / stats.x01.matches_played;
        if (stats.board.matches_played > 0) stats.board.avg_hit_rate = stats.board.avg_hit_rate / stats.board.matches_played;
        if (stats.finish.matches_played > 0) {
            stats.finish.avg_checkouts_per_match = stats.finish.total_checkouts / stats.finish.matches_played;
            stats.finish.avg_darts_per_match = stats.finish.total_darts / stats.finish.matches_played;
        }

        return stats;
    },

    buildOverviewFallback(fallbackData) {
        return fallbackData.overview || { ...EMPTY_OVERVIEW };
    },

    buildX01Fallback(fallbackData) {
        return fallbackData.x01 || { ...EMPTY_X01 };
    },

    buildBoardFallback(fallbackData) {
        return fallbackData.board || { ...EMPTY_BOARD };
    },

    buildFinishFallback(fallbackData) {
        return fallbackData.finish || { ...EMPTY_FINISH };
    },

    buildHeatmapCounts(rows, fallbackCounts) {
        if (rows && rows.length > 0) {
            return rows.reduce((acc, row) => {
                const key = num(row.hit_number);
                if (key > 0) acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
        }
        return fallbackCounts || {};
    },

    renderOverview(overviewData) {
        const overview = { ...EMPTY_OVERVIEW, ...overviewData };
        setText('stats-total-matches', formatCompact(overview.total_matches));
        setText('stats-total-xp-history', formatCompact(overview.total_xp_from_history));
        setText('stats-total-darts-history', formatCompact(overview.total_darts_from_history));
        setText('stats-favorite-category', categoryLabel(overview));
        setText('stats-cat-scoring', formatCompact(overview.matches_x01));
        setText('stats-cat-board', formatCompact(overview.matches_boardcontrol));
        setText('stats-cat-finishing', formatCompact(overview.matches_finishing));
        setText('stats-cat-warmup', formatCompact(overview.matches_warmup));
        setText('stats-online-matches', formatCompact(overview.online_x01_matches));
        setText('stats-online-wins', formatCompact(overview.online_x01_wins));
        setText('stats-online-shanghai-matches', formatCompact(overview.online_shanghai_matches));
        setText('stats-online-shanghai-wins', formatCompact(overview.online_shanghai_wins));
        setText('stats-online-atc-matches', formatCompact(overview.online_atc_matches));
        setText('stats-online-atc-wins', formatCompact(overview.online_atc_wins));
        setText('stats-last-match', formatDateShort(overview.last_match_at));
        setText('overview-chip-snapshot-meta', `${formatCompact(overview.total_matches)} Sessions`);
        setText('overview-chip-insights-meta', `${categoryLabel(overview)} Fokus`);
    },

    renderProgressChart(xpRows, fallbackData) {
        const container = document.getElementById('xp-trend-chart');
        if (!container) return;
        container.innerHTML = '';

        const daysShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        const today = new Date();
        const last7 = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() - (6 - index));
            const key = dayKeyLocal(date);
            return { key, label: daysShort[date.getDay()], xp: 0, matches: 0 };
        });

        if (xpRows && xpRows.length > 0) {
            const map = new Map(
                xpRows.map(row => {
                    const key = dayKeyLocal(row.day);
                    return [key, row];
                })
            );

            last7.forEach(day => {
                const row = map.get(day.key);
                if (row) {
                    day.xp = num(row.xp_earned);
                    day.matches = num(row.matches_played);
                }
            });
        } else {
            fallbackData.xpTrend.forEach((xp, index) => {
                last7[index].xp = num(xp);
            });
        }

        const maxXP = Math.max(...last7.map(day => day.xp), 100);

        last7.forEach(day => {
            const heightPct = (day.xp / maxXP) * 100;
            container.insertAdjacentHTML('beforeend', `
                <div class="chart-bar-group">
                    <span class="chart-value">${day.xp > 0 ? formatCompact(day.xp) : ''}</span>
                    <div class="chart-bar" style="height: 0px;" data-target-height="${heightPct}%"></div>
                    <span class="chart-label">${day.label}</span>
                </div>
            `);
        });

        setTimeout(() => {
            container.querySelectorAll('.chart-bar').forEach(bar => {
                bar.style.height = bar.getAttribute('data-target-height');
            });
        }, 100);

        const totalXp = last7.reduce((sum, day) => sum + day.xp, 0);
        const totalMatches = last7.reduce((sum, day) => sum + day.matches, 0) || fallbackData.matchesLast7 || 0;
        setText('stat-trend-avg', Math.round(totalXp / 7).toString());
        setText('stat-trend-matches', totalMatches.toString());
        setText('overview-chip-trend-meta', `${totalMatches} Sessions`);
    },

    renderDeepDiveStats(x01Data, boardData, finishData) {
        const x01 = { ...EMPTY_X01, ...x01Data };
        const board = { ...EMPTY_BOARD, ...boardData };
        const finish = { ...EMPTY_FINISH, ...finishData };

        setText('stat-f9-avg', num(x01.avg_score).toFixed(1));
        setText('stat-x01-matches', formatCompact(x01.matches_played));
        setText('stat-180s', formatCompact(x01.total_180s));
        setText('stat-total-points', formatCompact(x01.total_points));
        setText('stat-140s', formatCompact(x01.total_triples));
        setText('stat-co-pct', formatCompact(x01.total_doubles));
        setText('stat-online-x01-matches', formatCompact(x01.online_matches));
        setText('stat-online-x01-wins', formatCompact(x01.online_wins));
        setText('deepdive-chip-x01-meta', `${formatCompact(x01.matches_played)} Matches`);
        setText('deepdive-chip-board-meta', `${num(board.avg_hit_rate).toFixed(0)}% Hit Rate`);
        setText('deepdive-chip-finishing-meta', `${formatCompact(finish.total_checkouts)} Checkouts`);

        const boardGrid = document.getElementById('stat-grid-board');
        if (boardGrid) {
            boardGrid.innerHTML = `
                <div class="stat-box"><span>Matches</span><strong>${formatCompact(board.matches_played)}</strong></div>
                <div class="stat-box"><span>Ø Hit Rate</span><strong>${num(board.avg_hit_rate).toFixed(1)}%</strong></div>
                <div class="stat-box"><span>Best Streak</span><strong>${formatCompact(board.best_streak)}</strong></div>
                <div class="stat-box"><span>First Dart Hits</span><strong>${formatCompact(board.total_first_dart_hits)}</strong></div>
                <div class="stat-box"><span>Singles</span><strong>${formatCompact(board.total_singles)}</strong></div>
                <div class="stat-box"><span>Doubles</span><strong>${formatCompact(board.total_doubles)}</strong></div>
                <div class="stat-box"><span>Triples</span><strong>${formatCompact(board.total_triples)}</strong></div>
                <div class="stat-box"><span>Misses</span><strong>${formatCompact(board.total_misses)}</strong></div>
                <div class="stat-box"><span>Online Matches</span><strong>${formatCompact(board.online_matches)}</strong></div>
                <div class="stat-box"><span>Online Wins</span><strong>${formatCompact(board.online_wins)}</strong></div>
            `;
        }

        const finishGrid = document.getElementById('stat-grid-finish');
        if (finishGrid) {
            finishGrid.innerHTML = `
                <div class="stat-box"><span>Matches</span><strong>${formatCompact(finish.matches_played)}</strong></div>
                <div class="stat-box"><span>Checkouts</span><strong>${formatCompact(finish.total_checkouts)}</strong></div>
                <div class="stat-box"><span>Ø Checks / Match</span><strong>${num(finish.avg_checkouts_per_match).toFixed(2)}</strong></div>
                <div class="stat-box"><span>Ø Darts / Match</span><strong>${num(finish.avg_darts_per_match).toFixed(1)}</strong></div>
                <div class="stat-box"><span>Doubles</span><strong>${formatCompact(finish.total_doubles)}</strong></div>
                <div class="stat-box"><span>Triples</span><strong>${formatCompact(finish.total_triples)}</strong></div>
                <div class="stat-box"><span>Total Darts</span><strong>${formatCompact(finish.total_darts)}</strong></div>
                <div class="stat-box"><span>Closing Form</span><strong>${finish.matches_played > 0 ? 'Live' : '--'}</strong></div>
            `;
        }
    },

    renderHeatmap(heatmapCounts) {
        const container = document.getElementById('heatmap-svg-container');
        if (!container) return;

        const maxHits = Math.max(...Object.values(heatmapCounts || {}), 1);
        const dartNumbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

        const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
            const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
            return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) };
        };

        const describeSegment = (x, y, innerR, outerR, startAngle, endAngle) => {
            const startOuter = polarToCartesian(x, y, outerR, endAngle);
            const endOuter = polarToCartesian(x, y, outerR, startAngle);
            const startInner = polarToCartesian(x, y, innerR, endAngle);
            const endInner = polarToCartesian(x, y, innerR, startAngle);
            const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
            return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${startInner.x} ${startInner.y} Z`;
        };

        container.innerHTML = `
            <svg viewBox="0 0 200 200" style="width: 100%; height: auto;">
                <circle cx="100" cy="100" r="95" fill="#0f172a" />
                ${dartNumbers.map((num, i) => {
                    const startAngle = i * 18 - 9;
                    const endAngle = i * 18 + 9;
                    const textPos = polarToCartesian(100, 100, 85, i * 18);
                    const hits = heatmapCounts[num] || 0;
                    const intensity = hits / maxHits;
                    const heatColor = intensity > 0 ? `rgba(34, 211, 238, ${0.18 + (intensity * 0.72)})` : 'rgba(255,255,255,0.04)';

                    return `
                        <path d="${describeSegment(100, 100, 10, 75, startAngle, endAngle)}" fill="${heatColor}" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>
                        <text x="${textPos.x}" y="${textPos.y}" font-size="7" text-anchor="middle" fill="white" opacity="0.7">${num}</text>
                    `;
                }).join('')}
                <circle cx="100" cy="100" r="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)"/>
            </svg>
        `;
    },

    renderAchievements(overview, x01, board, finish, fallbackData, onlineStats) {
        const container = document.getElementById('achievements-container');
        if (!container) return;

        const achievements = [
            {
                title: 'Im Flow',
                desc: 'Mindestens 10 Sessions gespielt',
                icon: 'ri-rocket-line',
                unlocked: num(overview.total_matches) >= 10
            },
            {
                title: 'Maximum!',
                desc: 'Mindestens eine 180 geloggt',
                icon: 'ri-fire-fill',
                unlocked: num(x01.total_180s) > 0 || num(fallbackData?.x01?.total_180s) > 0
            },
            {
                title: 'Laser Focus',
                desc: 'Board Control mit 90%+ Hitrate',
                icon: 'ri-focus-3-line',
                unlocked: num(board.avg_hit_rate) >= 90
            },
            {
                title: 'Closer',
                desc: 'Erste Checkouts in Finishing gesichert',
                icon: 'ri-check-double-line',
                unlocked: num(finish.total_checkouts) > 0
            },
            {
                title: 'Online Ready',
                desc: 'Erstes Online-Duell gewonnen',
                icon: 'ri-wifi-line',
                unlocked: num(onlineStats?.totalWins) > 0
            }
        ];

        container.innerHTML = achievements.map(ach => `
            <div class="achievement-card ${ach.unlocked ? '' : 'locked'}">
                <div class="ach-icon"><i class="${ach.icon}"></i></div>
                <div class="ach-info">
                    <h4>${ach.title}</h4>
                    <p>${ach.desc}</p>
                </div>
                <i class="${ach.unlocked ? 'ri-check-line' : 'ri-lock-line'}" style="margin-left:auto; color: ${ach.unlocked ? 'var(--neon-green)' : 'gray'}"></i>
            </div>
        `).join('');
    },

    renderLeaderboard(profiles) {
        const container = document.getElementById('leaderboard-container');
        if (!container) return;

        const rankedPlayers = (profiles || []).map(p => ({
            name: p.username || 'Unknown Darter',
            level: p.level || 1,
            score: num(p.power_score).toFixed(2),
            rawScore: num(p.power_score)
        }));

        rankedPlayers.sort((a, b) => b.rawScore - a.rawScore);

        container.innerHTML = rankedPlayers.length === 0
            ? '<p>Noch keine Spieler im Ranking.</p>'
            : rankedPlayers.map((player, index) => {
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                const trophy = rank === 1 ? '#1' : (rank === 2 ? '#2' : (rank === 3 ? '#3' : ''));

                return `
                    <div class="lb-item ${rankClass}">
                        <div class="lb-rank">${rank}.</div>
                        <div class="lb-info">
                            <span class="lb-name">${player.name} ${trophy}</span>
                            <span class="lb-level">Level ${player.level}</span>
                        </div>
                        <div class="lb-score">${player.score}</div>
                    </div>
                `;
            }).join('');
    },

    switchOverviewPanel(panelId) {
        this.currentOverviewPanel = panelId;

        document.querySelectorAll('#tab-overview .overview-chip').forEach(btn => {
            const isActive = btn.dataset.panel === panelId;
            btn.classList.toggle('active', Boolean(isActive));
        });

        document.querySelectorAll('#tab-overview .overview-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `overview-panel-${panelId}`);
            panel.classList.toggle('active', panel.id === `overview-panel-${panelId}`);
        });
    },

    switchDeepDivePanel(panelId) {
        this.currentDeepDivePanel = panelId;

        document.querySelectorAll('#tab-deepdive .deepdive-chip').forEach(btn => {
            const isActive = btn.dataset.deepdivePanel === panelId;
            btn.classList.toggle('active', Boolean(isActive));
        });

        document.querySelectorAll('#tab-deepdive .deepdive-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `deepdive-panel-${panelId}`);
            panel.classList.toggle('active', panel.id === `deepdive-panel-${panelId}`);
        });
    },

    switchMainTab(tabId) {
        document.querySelectorAll('.stat-pill').forEach(btn => btn.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');

        document.querySelectorAll('.stat-main-tab').forEach(tab => tab.classList.add('hidden'));
        const targetTab = document.getElementById(`tab-${tabId}`);
        if (targetTab) targetTab.classList.remove('hidden');

        if (tabId === 'leaderboard') {
            this.loadStats();
        }

        if (tabId === 'overview') {
            this.switchOverviewPanel(this.currentOverviewPanel || 'snapshot');
        }

        if (tabId === 'deepdive') {
            this.switchDeepDivePanel(this.currentDeepDivePanel || 'x01');
        }
    }
};

window.StatsController = StatsController;
