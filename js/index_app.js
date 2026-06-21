(function() {
    'use strict';


    let requestSequence = 0;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    async function init() {
        console.log('[IndexApp] Inicializando...');

        if (!window.TOURNAMENT_CONFIG) {
            console.error('[IndexApp] TOURNAMENT_CONFIG no disponible.');
            showFallbackError('Configuración no cargada.');
            return;
        }
        if (!window.DataProvider) {
            console.error('[IndexApp] DataProvider no disponible.');
            showFallbackError('Proveedor de datos no disponible.');
            return;
        }
        if (!window.Standings) {
            console.error('[IndexApp] Standings no disponible.');
            showFallbackError('Módulo de clasificación no disponible.');
            return;
        }
        if (!window.MVP) {
            console.error('[IndexApp] MVP no disponible.');
            showFallbackError('Módulo MVP no disponible.');
            return;
        }
        if (!window.UI) {
            console.error('[IndexApp] UI no disponible.');
            showFallbackError('Módulo de UI no disponible.');
            return;
        }

        UI.init();

        configureCompetitionLinks();

        const monthSelect = document.getElementById('month-select');
        if (monthSelect) {
            const defaultMonth = TOURNAMENT_CONFIG.getActiveMonthId ? TOURNAMENT_CONFIG.getActiveMonthId() : null;
            const activeMonth = UI.setupMonthSelector('month-select', defaultMonth, onMonthChange);
            if (activeMonth) {
                await loadData(activeMonth);
            } else {
                showGlobalError('No hay meses configurados.');
            }
        } else {
            showGlobalError('Selector de mes no encontrado.');
        }

        const retryBtn = document.getElementById('retry-global');
        if (retryBtn) {
            retryBtn.addEventListener('click', function() {
                const month = UI.getActiveMonth('month-select');
                if (month) {
                    loadData(month);
                }
            });
        }
    }


    function configureCompetitionLinks() {
        const links = document.querySelectorAll('[data-division-link]');
        if (!links.length) return;

        const config = window.TOURNAMENT_CONFIG;
        const competitions = config.competitions || {};

        links.forEach(link => {
            const divNumber = link.getAttribute('data-division-link');
            if (!divNumber) return;
            const compId = 'div' + divNumber;
            const comp = competitions[compId];

            if (comp && comp.enabled !== false) {
                link.href = comp.html || '#';
                link.textContent = comp.name || ('División ' + divNumber);
                link.style.display = '';
            } else {
                link.style.display = 'none';
            }
        });
    }


    function countDistinctMatches(standings) {
        const matchSet = new Set();
        if (!Array.isArray(standings)) return 0;
        standings.forEach(team => {
            if (Array.isArray(team.matches)) {
                team.matches.forEach(m => {
                    if (m.matchNumber !== undefined && m.matchNumber !== null) {
                        matchSet.add(m.matchNumber);
                    }
                });
            }
        });
        return matchSet.size;
    }


    let currentMonth = null;

    async function loadData(monthId) {
        const requestId = ++requestSequence;
        currentMonth = monthId;

        UI.showLoading('main-content', 'global-loading');
        UI.hideError('main-content', 'global-error');
        UI.hideEmpty('main-content', 'global-empty');

        const statsContainer = document.getElementById('global-stats');
        const divisionsContainer = document.getElementById('divisions-container');
        if (statsContainer) statsContainer.style.display = 'none';
        if (divisionsContainer) divisionsContainer.style.display = 'none';

        try {
            const config = window.TOURNAMENT_CONFIG;
            const competitions = config.competitions || {};
            const enabledDivisions = Object.values(competitions).filter(
                comp => comp.enabled === true && (comp.type === 'division' || comp.type === 'league')
            );

            if (enabledDivisions.length === 0) {
                console.warn('[IndexApp] No hay divisiones habilitadas.');
                UI.hideLoading('main-content', 'global-loading');
                UI.showEmpty('main-content', 'global-empty', 'No hay divisiones configuradas.');
                return;
            }

            const monthConfig = config.getMonthConfig ? config.getMonthConfig(monthId) : null;
            if (!monthConfig || !monthConfig.spreadsheetId || monthConfig.spreadsheetId === 'REEMPLAZAR_ID_SHEET') {
                UI.hideLoading('main-content', 'global-loading');
                UI.showError('main-content', 'global-error', 'El mes seleccionado no tiene configurado un spreadsheetId.', retryLoad);
                return;
            }

            const loadPromises = enabledDivisions.map(comp => {
                return DataProvider.loadCompetitionData(comp.id, monthId)
                    .then(data => ({ competition: comp, data: data, error: null }))
                    .catch(err => ({ competition: comp, data: null, error: err }));
            });

            const results = await Promise.all(loadPromises);

            if (requestId !== requestSequence) {
                console.log('[IndexApp] Solicitud obsoleta, ignorando resultados.');
                return;
            }

            const divisionData = [];
            let allStandings = [];
            let allMvpRankings = [];
            let anySuccess = false;

            for (const result of results) {
                const comp = result.competition;
                if (result.error) {
                    console.error(`[IndexApp] Error cargando ${comp.id}:`, result.error);
                    divisionData.push({
                        competition: comp,
                        standings: null,
                        mvpRanking: null,
                        error: result.error.message || 'Error al cargar datos'
                    });
                    continue;
                }

                const data = result.data;
                if (!data || !data.results) {
                    divisionData.push({
                        competition: comp,
                        standings: null,
                        mvpRanking: null,
                        error: 'Datos incompletos'
                    });
                    continue;
                }

                let standings = [];
                try {
                    const teamResults = data.results.teams || [];
                    const teamCatalog = data.catalogs.teams || [];
                    standings = Standings.buildStandings(teamResults, teamCatalog, {
                        defaultLogo: config.assets.defaultTeam || 'assets/default-team.png'
                    });
                } catch (err) {
                    console.error(`[IndexApp] Error en Standings para ${comp.id}:`, err);
                    standings = [];
                }

                let mvpRanking = [];
                try {
                    const playerResults = data.results.players || [];
                    const playerCatalog = data.catalogs.players || [];
                    const teamCatalog = data.catalogs.teams || [];
                    mvpRanking = MVP.buildMvpRanking(playerResults, playerCatalog, teamCatalog, standings, {
                        defaultPlayer: config.assets.defaultPlayer || 'assets/default-player.png',
                        defaultTeamLogo: config.assets.defaultTeam || 'assets/default-team.png'
                    });
                } catch (err) {
                    console.error(`[IndexApp] Error en MVP para ${comp.id}:`, err);
                    mvpRanking = [];
                }

                divisionData.push({
                    competition: comp,
                    standings: standings,
                    mvpRanking: mvpRanking,
                    error: null
                });

                if (standings.length > 0 || mvpRanking.length > 0) {
                    anySuccess = true;
                }

                allStandings = allStandings.concat(standings);
                allMvpRankings = allMvpRankings.concat(mvpRanking);
            }

            UI.hideLoading('main-content', 'global-loading');

            if (!anySuccess) {
                const allFailed = divisionData.every(d => d.error !== null);
                if (allFailed) {
                    UI.showError('main-content', 'global-error', 'No se pudieron cargar datos de ninguna división.', retryLoad);
                } else {
                    UI.showEmpty('main-content', 'global-empty', 'No se encontraron datos para las divisiones.');
                }
                return;
            }

            const totalGlobalMatches = divisionData.reduce((sum, division) => {
                return sum + countDistinctMatches(division.standings || []);
            }, 0);

            renderGlobalStats(allStandings, allMvpRankings, totalGlobalMatches);

            renderDivisionCards(divisionData);

            if (statsContainer) statsContainer.style.display = '';
            if (divisionsContainer) divisionsContainer.style.display = '';

        } catch (err) {
            console.error('[IndexApp] Error inesperado en loadData:', err);
            UI.hideLoading('main-content', 'global-loading');
            UI.showError('main-content', 'global-error', 'Error inesperado al cargar los datos.', retryLoad);
        }
    }


    function retryLoad() {
        const month = UI.getActiveMonth('month-select');
        if (month) {
            loadData(month);
        }
    }


    function renderGlobalStats(allStandings, allMvpRankings, totalGlobalMatches) {
        let totalEliminations = 0;
        allStandings.forEach(team => {
            if (Array.isArray(team.matches)) {
                team.matches.forEach(m => {
                    const kills = Number(m.eliminations) || 0;
                    totalEliminations += kills;
                });
            }
        });

        let mostWwcdTeam = null;
        let maxWwcd = 0;
        allStandings.forEach(team => {
            const wwcd = team.totals.wwcd || 0;
            if (wwcd > maxWwcd) {
                maxWwcd = wwcd;
                mostWwcdTeam = team;
            }
        });

        let topKiller = null;
        let maxKills = 0;
        allMvpRankings.forEach(player => {
            const kills = player.totalEliminations || 0;
            if (kills > maxKills) {
                maxKills = kills;
                topKiller = player;
            }
        });

        const statTotalMatches = document.getElementById('stat-total-matches');
        const statTotalKills = document.getElementById('stat-total-kills');
        const statMostWwcd = document.getElementById('stat-most-wwcd');
        const statTopKiller = document.getElementById('stat-top-killer');

        if (statTotalMatches) {
            statTotalMatches.textContent = UI.formatNumber(totalGlobalMatches);
        }
        if (statTotalKills) statTotalKills.textContent = totalEliminations;
        if (statMostWwcd) {
            statMostWwcd.textContent = mostWwcdTeam ? UI.escapeHtml(mostWwcdTeam.teamName) || '—' : '—';
        }
        if (statTopKiller) {
            statTopKiller.textContent = topKiller ? UI.escapeHtml(topKiller.playerName) || '—' : '—';
        }
    }


    function renderDivisionCards(divisionData) {
        const container = document.getElementById('divisions-container');
        if (!container) return;

        container.innerHTML = '';

        divisionData.sort((a, b) => a.competition.name.localeCompare(b.competition.name));

        const config = window.TOURNAMENT_CONFIG;
        const defaultLogo = config.assets.defaultTeam || 'assets/default-team.png';

        divisionData.forEach(item => {
            const comp = item.competition;
            const standings = item.standings || [];
            const mvpRanking = item.mvpRanking || [];
            const error = item.error;

            let leader = null;
            if (standings.length > 0) {
                leader = standings[0];
            }

            let mvp = null;
            if (mvpRanking.length > 0) {
                mvp = mvpRanking[0];
            }

            const totalMatches = countDistinctMatches(standings);

            const card = document.createElement('a');
            card.className = 'division-card';
            card.href = comp.html || '#';
            card.setAttribute('role', 'link');

            const colors = comp.colors || {};
            card.style.setProperty('--card-primary', colors.primary || '#1e88e5');
            card.style.setProperty('--card-secondary', colors.secondary || '#42a5f5');
            card.style.setProperty('--card-accent', colors.accent || '#90caf9');
            card.style.setProperty('--card-dark', colors.dark || '#0d47a1');

            const logoUrl = comp.logo || defaultLogo;
            const escapedLogo = UI.escapeHtml(logoUrl);

            const compName = UI.escapeHtml(comp.name || 'División');
            const leaderName = leader ? UI.escapeHtml(leader.teamName) || '—' : '—';
            const mvpName = mvp ? UI.escapeHtml(mvp.playerName) || '—' : '—';

            let content = `
                <div class="division-logo" style="background-color: var(--card-primary);">
                    <img src="${escapedLogo}" alt="${compName}" width="64" height="64"
                         onerror="this.onerror=null;this.src='${defaultLogo}';" />
                </div>
                <div class="division-name">${compName}</div>
                <div class="division-description">${comp.features ? 'Estadísticas completas' : ''}</div>
            `;

            if (error) {
                const safeError = UI.escapeHtml(error);
                content += `
                    <div class="error-state" style="margin: 8px 0; padding: 8px; font-size: 0.8rem; background: rgba(234,84,85,0.1); border-radius: 8px;">
                        <span>⚠️ ${safeError}</span>
                    </div>
                `;
            } else {
                content += `
                    <div class="division-stats">
                        <span>
                            <span class="stat-number">${totalMatches}</span>
                            <span class="stat-label">Partidas</span>
                        </span>
                        <span>
                            <span class="stat-number">${leaderName}</span>
                            <span class="stat-label">Líder</span>
                        </span>
                        <span>
                            <span class="stat-number">${mvpName}</span>
                            <span class="stat-label">MVP</span>
                        </span>
                    </div>
                `;
            }

            card.innerHTML = content;
            container.appendChild(card);
        });
    }


    function showGlobalError(message) {
        UI.showError('main-content', 'global-error', message, retryLoad);
        UI.hideLoading('main-content', 'global-loading');
        UI.hideEmpty('main-content', 'global-empty');
        const statsContainer = document.getElementById('global-stats');
        const divisionsContainer = document.getElementById('divisions-container');
        if (statsContainer) statsContainer.style.display = 'none';
        if (divisionsContainer) divisionsContainer.style.display = 'none';
    }


    function showFallbackError(message) {
        const errorEl = document.getElementById('global-error');
        if (errorEl) {
            const p = errorEl.querySelector('p');
            if (p) p.textContent = message || 'Error crítico.';
            errorEl.style.display = 'flex';
            const loadingEl = document.getElementById('global-loading');
            if (loadingEl) loadingEl.style.display = 'none';
            const emptyEl = document.getElementById('global-empty');
            if (emptyEl) emptyEl.style.display = 'none';
        } else {
            document.body.innerHTML = `<div class="error-state" style="display:flex;padding:2rem;text-align:center;"><span class="error-icon">⚠️</span><strong>Error</strong><p>${message}</p></div>`;
        }
        throw new Error('Inicialización fallida: ' + message);
    }


    function onMonthChange(newMonth) {
        console.log('[IndexApp] Mes cambiado a:', newMonth);
        loadData(newMonth);
    }

})();
