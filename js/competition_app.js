(function() {
    'use strict';

    const requiredModules = [
        'TOURNAMENT_CONFIG',
        'DataProvider',
        'Scoring',
        'Standings',
        'MVP',
        'TournamentCharts',
        'UI'
    ];

    const missing = requiredModules.filter(name => !window[name]);
    if (missing.length) {
        console.error('[competition_app] Dependencias faltantes:', missing.join(', '));
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="display:flex;">
                    <span class="error-icon" aria-hidden="true">⚠️</span>
                    <strong>Error de configuración</strong>
                    <p>Faltan módulos necesarios: ${missing.join(', ')}</p>
                </div>
            `;
        }
        return;
    }


    const competitionId = document.body.dataset.competition;
    if (!competitionId) {
        console.error('[competition_app] No se encontró data-competition en el body.');
        return;
    }

    const config = window.TOURNAMENT_CONFIG;
    const compConfig = config.getCompetitionConfig(competitionId);
    if (!compConfig) {
        console.error(`[competition_app] Competencia "${competitionId}" no encontrada.`);
        return;
    }

    if (!compConfig.enabled) {
        console.warn(`[competition_app] Competencia "${competitionId}" está deshabilitada.`);
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="display:flex;">
                    <span class="error-icon" aria-hidden="true">⛔</span>
                    <strong>Competencia deshabilitada</strong>
                    <p>Esta división no está disponible actualmente.</p>
                </div>
            `;
        }
        return;
    }


    let currentMonthId = config.getActiveMonthId();
    let currentData = null;
    let currentStandings = [];
    let currentMvpRanking = [];
    let currentTeam = null;
    let requestSequence = 0; 

    const elements = {
        logo: document.getElementById('competition-logo'),
        name: document.getElementById('competition-name'),
        pageTitle: document.getElementById('competition-page-title'),
        pageDesc: document.getElementById('competition-page-description'),
        monthSelect: document.getElementById('month-select'),
        summaryContainer: document.getElementById('summary-stats'),
        standingsBody: document.getElementById('standings-body'),
        mvpBody: document.getElementById('mvp-body'),
        teamSelect: document.getElementById('team-select'),
        chartContainer: document.getElementById('progress-chart-container'),
        loadingEl: document.getElementById('competition-loading'),
        errorEl: document.getElementById('competition-error'),
        emptyEl: document.getElementById('competition-empty'),
        retryBtn: document.getElementById('retry-competition')
    };


    function showCompetitionLoading() {
        if (elements.loadingEl) elements.loadingEl.style.display = 'flex';
        if (elements.errorEl) elements.errorEl.style.display = 'none';
        if (elements.emptyEl) elements.emptyEl.style.display = 'none';
    }

    function showCompetitionError(message) {
        if (elements.loadingEl) elements.loadingEl.style.display = 'none';
        if (elements.emptyEl) elements.emptyEl.style.display = 'none';
        if (elements.errorEl) {
            const p = elements.errorEl.querySelector('p');
            if (p) p.textContent = message || 'Error desconocido';
            elements.errorEl.style.display = 'flex';
        }
    }

    function showCompetitionEmpty(message) {
        if (elements.loadingEl) elements.loadingEl.style.display = 'none';
        if (elements.errorEl) elements.errorEl.style.display = 'none';
        if (elements.emptyEl) {
            const p = elements.emptyEl.querySelector('p');
            if (p) p.textContent = message || 'Sin datos disponibles';
            elements.emptyEl.style.display = 'flex';
        }
    }

    function hideCompetitionStates() {
        if (elements.loadingEl) elements.loadingEl.style.display = 'none';
        if (elements.errorEl) elements.errorEl.style.display = 'none';
        if (elements.emptyEl) elements.emptyEl.style.display = 'none';
    }


    function applyBranding() {
        document.title = `${compConfig.name} · Sistema de Torneos`;

        if (elements.logo) {
            const logoImg = UI.createSafeImage(compConfig.logo, `Logo de ${compConfig.name}`, config.assets.defaultTeam);
            elements.logo.innerHTML = '';
            elements.logo.appendChild(logoImg);
        }

        if (elements.name) {
            elements.name.textContent = compConfig.name;
        }

        if (elements.pageTitle) {
            elements.pageTitle.textContent = compConfig.name;
        }
        if (elements.pageDesc) {
            elements.pageDesc.textContent = `Estadísticas de ${compConfig.name}`;
        }

        const root = document.documentElement;
        const colors = compConfig.colors;
        if (colors) {
            root.style.setProperty('--division-primary', colors.primary);
            root.style.setProperty('--division-secondary', colors.secondary);
            root.style.setProperty('--division-accent', colors.accent);
            root.style.setProperty('--division-dark', colors.dark);
        }

        const mobileLogo = document.getElementById('mobile-competition-logo');
        if (mobileLogo) {
            const mobileImg = UI.createSafeImage(compConfig.logo, `Logo de ${compConfig.name}`, config.assets.defaultTeam);
            mobileLogo.innerHTML = '';
            mobileLogo.appendChild(mobileImg);
        }
        const mobileName = document.getElementById('mobile-competition-name');
        if (mobileName) {
            mobileName.textContent = compConfig.name;
        }
    }

    function updateActiveCompetitionLinks() {
        const targetHref = compConfig.html || '';
        document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            const isActive = href === targetHref;
            link.classList.toggle('is-active', isActive);
            if (isActive) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }


    function applyFeatureFlags() {
        const features = compConfig.features || {};
        const featureMap = {
            'section-summary': 'summary',
            'section-standings': 'standings',
            'section-mvp': 'mvp',
            'section-team-progress': 'charts'
        };

        document.querySelectorAll('[data-section]').forEach(btn => {
            const sectionId = btn.getAttribute('data-section');
            const featureKey = featureMap[sectionId];
            if (featureKey && features[featureKey] === false) {
                btn.style.display = 'none';
            } else {
                btn.style.display = '';
            }
        });

        document.querySelectorAll('.spa-section').forEach(sec => {
            const sectionId = sec.id;
            const featureKey = featureMap[sectionId];
            if (featureKey && features[featureKey] === false) {
                sec.style.display = 'none';
            } else {
                sec.style.display = '';
            }
        });

        const activeSection = document.querySelector('.spa-section.is-active');
        if (activeSection && activeSection.style.display === 'none') {
            const firstVisible = document.querySelector('.spa-section:not([style*="display: none"])');
            if (firstVisible) {
                UI.showSection(firstVisible.id);
            }
        }
    }


    function countDistinctMatches(standings) {
        const matchNumbers = new Set();
        standings.forEach(team => {
            (team.matches || []).forEach(match => {
                const number = Number(match.matchNumber);
                if (Number.isFinite(number)) {
                    matchNumbers.add(number);
                }
            });
        });
        return matchNumbers.size;
    }

    function renderSummary(data, standings) {
        const container = elements.summaryContainer;
        if (!container) return;

        const totalTeams = standings.length;
        const totalMatches = countDistinctMatches(standings);

        const totalKills = currentMvpRanking.reduce(
            (sum, player) => sum + (Number(player.totalEliminations) || 0),
            0
        );

        let leaderName = '—';
        if (standings.length > 0) {
            leaderName = standings[0].teamName || '—';
        }

        let mvpName = '—';
        if (currentMvpRanking.length > 0) {
            mvpName = currentMvpRanking[0].playerName || '—';
        }

        let mostWwcd = '—';
        if (standings.length > 0) {
            const sorted = [...standings].sort((a, b) => b.totals.wwcd - a.totals.wwcd);
            if (sorted[0].totals.wwcd > 0) {
                mostWwcd = sorted[0].teamName;
            }
        }

        const cards = [
            { label: 'Equipos participantes', value: totalTeams },
            { label: 'Partidas disputadas', value: totalMatches },
            { label: 'Eliminaciones totales', value: totalKills },
            { label: 'Líder actual', value: leaderName },
            { label: 'MVP actual', value: mvpName },
            { label: 'Mayor WWCD', value: mostWwcd }
        ];

        container.innerHTML = cards.map(card => `
            <div class="stat-card">
                <div class="stat-label">${UI.escapeHtml(card.label)}</div>
                <div class="stat-value">${UI.escapeHtml(UI.formatNumber(card.value))}</div>
            </div>
        `).join('');
    }

    function renderStandings(standings) {
        const tbody = elements.standingsBody;
        if (!tbody) return;

        if (!standings || standings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay datos de clasificación</td></tr>`;
            return;
        }

        let html = '';
        standings.forEach(team => {
            const rank = team.rank || '—';
            const logo = team.logo || config.assets.defaultTeam;
            const name = UI.escapeHtml(team.teamName);
            const pp = UI.formatNumber(team.totals.pp);
            const pe = UI.formatNumber(team.totals.pe);
            const total = UI.formatNumber(team.totals.total);
            const wwcd = UI.formatNumber(team.totals.wwcd);
            const isFirst = (rank === 1) ? 'is-first-place' : '';

            html += `
                <tr class="${isFirst}" data-team-id="${UI.escapeHtml(team.teamId)}">
                    <td><strong>${rank}</strong></td>
                    <td>
                        <div class="team-cell">
                            <img src="${UI.escapeHtml(logo)}" alt="Logo ${name}" class="team-logo" loading="lazy"
                                 onerror="this.onerror=null;this.src='${config.assets.defaultTeam}';">
                        </div>
                    </td>
                    <td>${name}</td>
                    <td>${pp}</td>
                    <td>${pe}</td>
                    <td><strong>${total}</strong></td>
                    <td>${wwcd}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        tbody.querySelectorAll('tr[data-team-id]').forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function() {
                const teamId = this.getAttribute('data-team-id');
                const team = Standings.getTeamDetails(teamId, standings);
                if (team) {
                    renderTeamModal(team);
                }
            });
        });
    }

    function renderTeamModal(team) {
        if (!team) return;
        const title = `Detalles de ${UI.escapeHtml(team.teamName)}`;
        let content = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Partida</th>
                            <th>Posición</th>
                            <th>PP</th>
                            <th>Eliminaciones</th>
                            <th>PE</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (team.matches && team.matches.length > 0) {
            team.matches.forEach(m => {
                const matchNum = m.matchNumber || '—';
                const pos = m.position !== undefined ? m.position : '—';
                const elim = m.eliminations !== undefined ? m.eliminations : 0;
                const pp = window.Scoring.getPlacementPoints(pos);
                const pe = window.Scoring.getEliminationPoints(elim);
                const total = pp + pe;
                content += `
                    <tr>
                        <td>M${matchNum}</td>
                        <td>${pos}</td>
                        <td>${pp}</td>
                        <td>${elim}</td>
                        <td>${pe}</td>
                        <td><strong>${total}</strong></td>
                    </tr>
                `;
            });
        } else {
            content += `<tr><td colspan="6" class="text-center text-muted">Sin partidas registradas</td></tr>`;
        }

        content += `</tbody></table></div>`;
        UI.openModal(title, content);
    }

    function renderMvp(ranking) {
        const tbody = elements.mvpBody;
        if (!tbody) return;

        if (!ranking || ranking.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay datos de MVP</td></tr>`;
            return;
        }

        let html = '';
        ranking.forEach(player => {
            const rank = player.rank || '—';
            const photo = player.image || config.assets.defaultPlayer;
            const name = UI.escapeHtml(player.playerName);
            const teamName = UI.escapeHtml(player.teamName);
            const kills = UI.formatNumber(player.totalEliminations);

            html += `
                <tr data-player-id="${UI.escapeHtml(player.playerId)}">
                    <td><strong>${rank}</strong></td>
                    <td>
                        <div class="player-cell">
                            <img src="${UI.escapeHtml(photo)}" alt="Foto de ${name}" class="player-photo" loading="lazy"
                                 onerror="this.onerror=null;this.src='${config.assets.defaultPlayer}';">
                            <span class="player-name">${name}</span>
                        </div>
                    </td>
                    <td><span class="player-team">${teamName}</span></td>
                    <td><strong>${kills}</strong></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        tbody.querySelectorAll('tr[data-player-id]').forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function() {
                const playerId = this.getAttribute('data-player-id');
                const player = MVP.getPlayerDetails(playerId, ranking);
                if (player) {
                    renderPlayerModal(player);
                }
            });
        });
    }

    function renderPlayerModal(player) {
        if (!player) return;
        const title = `Detalles de ${UI.escapeHtml(player.playerName)}`;
        let content = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Partida</th>
                            <th>Eliminaciones</th>
                            <th>Posición del equipo</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (player.matches && player.matches.length > 0) {
            player.matches.forEach(m => {
                const matchNum = m.matchNumber || '—';
                const elim = m.eliminations !== undefined ? m.eliminations : 0;
                const teamPos = m.teamPosition !== undefined && m.teamPosition !== null ? m.teamPosition : '—';
                content += `
                    <tr>
                        <td>M${matchNum}</td>
                        <td>${elim}</td>
                        <td>${teamPos}</td>
                    </tr>
                `;
            });
        } else {
            content += `<tr><td colspan="3" class="text-center text-muted">Sin partidas registradas</td></tr>`;
        }

        content += `</tbody></table></div>`;
        UI.openModal(title, content);
    }

    function populateTeamSelector(standings) {
        const select = elements.teamSelect;
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar equipo...</option>';
        if (!standings || standings.length === 0) {
            select.disabled = true;
            return;
        }
        select.disabled = false;

        const sorted = [...standings].sort((a, b) => a.teamName.localeCompare(b.teamName));
        sorted.forEach(team => {
            const option = document.createElement('option');
            option.value = team.teamId;
            option.textContent = team.teamName;
            select.appendChild(option);
        });

        if (sorted.length > 0) {
            select.value = sorted[0].teamId;
            currentTeam = sorted[0];
            renderSelectedTeamChart(currentTeam);
        }

        if (select._listener) {
            select.removeEventListener('change', select._listener);
        }
        const listener = function() {
            const teamId = this.value;
            if (!teamId) {
                destroyChartInContainer();
                if (elements.chartContainer) {
                    elements.chartContainer.innerHTML = '<p class="text-muted">Selecciona un equipo para ver su evolución.</p>';
                }
                currentTeam = null;
                return;
            }
            const team = Standings.getTeamDetails(teamId, standings);
            if (team) {
                currentTeam = team;
                renderSelectedTeamChart(team);
            }
        };
        select.addEventListener('change', listener);
        select._listener = listener;
    }

    function destroyChartInContainer() {
        const container = elements.chartContainer;
        if (!container) return;
        const canvas = container.querySelector('canvas');
        if (canvas) {
            TournamentCharts.destroyChart(canvas);
        }
    }

    function renderSelectedTeamChart(team) {
        const container = elements.chartContainer;
        if (!container) return;

        destroyChartInContainer();

        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-label', 'Gráfica de evolución del equipo');
        container.innerHTML = '';
        container.appendChild(canvas);

        const success = TournamentCharts.renderTeamProgress(canvas, team);
        if (!success) {
            container.innerHTML = '<p class="text-muted">No se pudo generar la gráfica.</p>';
        }
    }


    function loadAndRender(monthId, forceRefresh = false) {
        const requestId = ++requestSequence;
        showCompetitionLoading();

        DataProvider.loadCompetitionData(competitionId, monthId, forceRefresh)
            .then(data => {
                if (requestId !== requestSequence) {
                    console.log('[competition_app] Solicitud obsoleta, ignorando resultados.');
                    return;
                }

                currentData = data;
                currentMonthId = monthId;

                const standings = Standings.buildStandings(
                    data.results.teams,
                    data.catalogs.teams,
                    { defaultLogo: config.assets.defaultTeam }
                );
                currentStandings = standings;

                const mvpRanking = MVP.buildMvpRanking(
                    data.results.players,
                    data.catalogs.players,
                    data.catalogs.teams,
                    standings,
                    { defaultPlayer: config.assets.defaultPlayer, defaultTeamLogo: config.assets.defaultTeam }
                );
                currentMvpRanking = mvpRanking;

                renderSummary(data, standings);
                renderStandings(standings);
                renderMvp(mvpRanking);
                populateTeamSelector(standings);

                hideCompetitionStates();

                if (standings.length === 0 && mvpRanking.length === 0) {
                    showCompetitionEmpty('No se encontraron datos para este mes.');
                }

                console.log(`[competition_app] Datos cargados para ${competitionId} - ${monthId}`);
            })
            .catch(error => {
                if (requestId !== requestSequence) {
                    console.log('[competition_app] Solicitud obsoleta, ignorando error.');
                    return;
                }
                console.error('[competition_app] Error al cargar datos:', error);
                showCompetitionError(error.message || 'Error al cargar los datos.');
            })
            .finally(() => {
                if (requestId === requestSequence && elements.loadingEl) {
                    elements.loadingEl.style.display = 'none';
                }
            });
    }


    function init() {
        applyBranding();
        updateActiveCompetitionLinks();

        UI.initResponsiveMenu();
        UI.initSpaNavigation();
        UI.setCurrentYear();

        applyFeatureFlags();

        const months = config.months || {};
        const activeMonth = currentMonthId;
        UI.populateMonthSelector(months, activeMonth, function(newMonthId) {
            if (newMonthId && newMonthId !== currentMonthId) {
                loadAndRender(newMonthId, true);
            }
        });

        if (elements.retryBtn) {
            elements.retryBtn.addEventListener('click', function() {
                loadAndRender(currentMonthId, true);
            });
        }

        loadAndRender(currentMonthId);
        console.log(`[competition_app] Inicializado para ${competitionId}`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
