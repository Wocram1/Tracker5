// js/stats-controller.js
import { supabase } from './supabase_client.js'; // Pfad eventuell anpassen

export const StatsController = {
    async loadStats() {
        console.log("Loading live stats from Supabase...");
        
        try {
            // Nutze den importierten supabase client
            const { data: rows, error } = await supabase
                .from('match_history')
                .select('*')
                .order('played_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            if (!rows || rows.length === 0) return;

            // 2. Daten verarbeiten
            const processedData = this.processMatchHistory(rows);

            // 3. UI mit echten Daten rendern
            this.renderProgressChart(processedData.xpTrend);
            this.renderDeepDiveStats(processedData);
            this.renderHeatmap(processedData.heatmapCounts);
            this.renderAchievements(processedData);

        } catch (err) {
            console.error("Fehler beim Laden der Statistiken:", err);
        }
    },

    processMatchHistory(rows) {
        const stats = {
            xpTrend: [0, 0, 0, 0, 0, 0, 0], // Letzte 7 Tage
            x01: { f9Avg: 0, coPct: 0, highFinish: 0, s180: 0, s140: 0, bestLeg: 0, count: 0 },
            board: { hitRate: 0, maxStreak: 0, accuracy: 0, count: 0 },
            finish: { rate40: 0, avgDarts: 0, count: 0 },
            heatmapCounts: {} 
        };

        const now = new Date();
        
        rows.forEach(row => {
            const mStats = row.match_stats || {};
            const playedDate = new Date(row.played_at);
            
            const diffDays = Math.floor((now - playedDate) / (1000 * 60 * 60 * 24));
            if (diffDays < 7) {
                stats.xpTrend[6 - diffDays] += parseInt(row.xp_earned || 0);
            }

            if (row.game_mode?.includes('X01')) {
                const avg = parseFloat(mStats.avg) || 0;
                stats.x01.f9Avg = (stats.x01.f9Avg * stats.x01.count + avg) / (stats.x01.count + 1);
                stats.x01.s180 += (mStats.oneEighty || 0);
                stats.x01.count++;
            }

            if (row.game_mode?.includes('ATC')) {
                stats.board.maxStreak = Math.max(stats.board.maxStreak, mStats.maxStreak || 0);
                const hr = parseFloat(mStats.hitRate) || 0;
                stats.board.hitRate = (stats.board.hitRate * stats.board.count + hr) / (stats.board.count + 1);
                stats.board.count++;
            }

            if (row.game_mode?.includes('Catch 40') || row.game_mode?.includes('121')) {
                stats.finish.rate40 = (stats.finish.rate40 * stats.finish.count + (mStats.checks || 0)) / (stats.finish.count + 1);
                stats.finish.count++;
            }

            const mainSegment = row.game_mode?.includes('20') ? 20 : (row.game_mode?.includes('19') ? 19 : 20);
            stats.heatmapCounts[mainSegment] = (stats.heatmapCounts[mainSegment] || 0) + (mStats.hits || 5);
        });

        stats.x01.f9Avg = stats.x01.f9Avg.toFixed(1);
        stats.board.hitRate = stats.board.hitRate.toFixed(2);

        return stats;
    },

    renderProgressChart(xpData) {
        const container = document.getElementById('xp-trend-chart');
        if (!container) return;
        container.innerHTML = '';

        const maxXP = Math.max(...xpData, 100); 
        const daysShort = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        const todayIdx = new Date().getDay(); 
        const labels = [];
        for(let i = 0; i < 7; i++) {
            labels.push(daysShort[(todayIdx - (6 - i) + 7) % 7]);
        }

        xpData.forEach((xp, index) => {
            const heightPct = (xp / maxXP) * 100;
            container.insertAdjacentHTML('beforeend', `
                <div class="chart-bar-group">
                    <div class="chart-bar" style="height: 0px;" data-target-height="${heightPct}%"></div>
                    <span class="chart-label">${labels[index]}</span>
                </div>
            `);
        });

        setTimeout(() => {
            container.querySelectorAll('.chart-bar').forEach(bar => {
                bar.style.height = bar.getAttribute('data-target-height');
            });
        }, 100);

        // FIX: Sicherstellen dass Elemente existieren bevor darauf zugegriffen wird
        const avgEl = document.getElementById('stat-trend-avg');
        const winEl = document.getElementById('stat-trend-winrate');
        if (avgEl) avgEl.innerText = (xpData.reduce((a,b) => a+b, 0) / 7).toFixed(0);
        if (winEl) winEl.innerText = "Live";
    },

    switchTab(tabId) {
        document.querySelectorAll('.stat-tab').forEach(b => b.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        document.querySelectorAll('.stat-tab-content').forEach(c => c.classList.add('hidden'));
        const target = document.getElementById(`stat-content-${tabId}`);
        if (target) target.classList.remove('hidden');
    },

    renderDeepDiveStats(data) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setVal('stat-f9-avg', data.x01.f9Avg);
        setVal('stat-co-pct', data.x01.coPct + '%');
        setVal('stat-high-finish', data.x01.highFinish || '--');
        setVal('stat-180s', data.x01.s180);
        setVal('stat-140s', data.x01.s140 || '0');
        setVal('stat-best-leg', data.x01.bestLeg > 0 ? data.x01.bestLeg : '--');

        const boardGrid = document.getElementById('stat-grid-board');
        if (boardGrid) {
            boardGrid.innerHTML = `
                <div class="res-dyn-stat"><span class="label">Ø Trefferquote</span><span class="value">${data.board.hitRate}</span></div>
                <div class="res-dyn-stat primary-stat"><span class="label">Beste Serie</span><span class="value">${data.board.maxStreak}</span></div>
            `;
        }

        const finishGrid = document.getElementById('stat-grid-finish');
        if (finishGrid) {
            finishGrid.innerHTML = `
                <div class="res-dyn-stat"><span class="label">Checkouts total</span><span class="value">${data.finish.rate40.toFixed(0)}</span></div>
            `;
        }
    },

    renderHeatmap(heatmapCounts) {
        const container = document.getElementById('heatmap-svg-container');
        if(!container) return;

        const maxHits = Math.max(...Object.values(heatmapCounts), 1);
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
            const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
            return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${startInner.x} ${startInner.y} Z`;
        };

        const svgHTML = `
            <svg viewBox="0 0 200 200" style="width: 100%; height: auto;">
                <circle cx="100" cy="100" r="95" fill="#1e293b" />
                ${dartNumbers.map((num, i) => {
                    const startAngle = i * 18 - 9;
                    const endAngle = i * 18 + 9;
                    const textPos = polarToCartesian(100, 100, 85, i * 18);
                    const hits = heatmapCounts[num] || 0;
                    const intensity = hits / maxHits;
                    const heatColor = intensity > 0 ? `rgba(255, 50, 50, ${0.2 + (intensity * 0.7)})` : 'rgba(255,255,255,0.05)';

                    return `
                        <path d="${describeSegment(100, 100, 10, 75, startAngle, endAngle)}" fill="${heatColor}" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>
                        <text x="${textPos.x}" y="${textPos.y}" font-size="7" text-anchor="middle" fill="white" opacity="0.6">${num}</text>
                    `;
                }).join('')}
                <circle cx="100" cy="100" r="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)"/>
            </svg>
        `;
        container.innerHTML = svgHTML;
    },

    renderAchievements(processed) {
        const container = document.getElementById('achievements-container');
        if (!container) return;

        const achievements = [
            { id: 'first', title: 'Starter', desc: 'Erstes Spiel getrackt', icon: 'ri-rocket-line', unlocked: processed.x01.count > 0 || processed.board.count > 0 },
            { id: '180', title: 'Maximum!', desc: 'Eine 180 geworfen', icon: 'ri-fire-fill', unlocked: processed.x01.s180 > 0 },
            { id: 'xp1000', title: 'Grinder', desc: 'Über 1000 XP an einem Tag', icon: 'ri-trophy-line', unlocked: Math.max(...processed.xpTrend) > 1000 }
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

    switchMainTab(tabId) {
        document.querySelectorAll('.stat-pill').forEach(btn => btn.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');

        document.querySelectorAll('.stat-main-tab').forEach(tab => tab.classList.add('hidden'));
        const targetTab = document.getElementById(`tab-${tabId}`);
        if (targetTab) targetTab.classList.remove('hidden');

        if (tabId === 'leaderboard') {
            this.loadLeaderboard();
        }
    },

    async loadLeaderboard() {
        const container = document.getElementById('leaderboard-container');
        if (!container) return;
        
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('username, level, sr_scoring, sr_finishing, sr_boardcontrol');

            if (error) throw error;

            const rankedPlayers = profiles.map(p => {
                const level = p.level || 1;
                const srS = p.sr_scoring || 0;
                const srF = p.sr_finishing || 0;
                const srB = p.sr_boardcontrol || 0;
                const powerScore = level + ((srS + srF + srB) / 100);
                
                return {
                    name: p.username || 'Unknown Darter',
                    level: level,
                    score: powerScore.toFixed(2),
                    rawScore: powerScore
                };
            });

            rankedPlayers.sort((a, b) => b.rawScore - a.rawScore);

            container.innerHTML = rankedPlayers.length === 0 
                ? '<p>Noch keine Spieler im Ranking.</p>' 
                : rankedPlayers.map((player, index) => {
                    const rank = index + 1;
                    const rankClass = rank <= 3 ? `rank-${rank}` : '';
                    const trophy = rank === 1 ? '👑' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''));

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

        } catch (err) {
            console.error("Fehler beim Laden des Leaderboards:", err);
            container.innerHTML = '<div class="error-msg">Leaderboard konnte nicht geladen werden.</div>';
        }
    }
};

window.StatsController = StatsController;