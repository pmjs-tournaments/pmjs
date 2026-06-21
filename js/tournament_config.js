window.TOURNAMENT_CONFIG = (function() {
    'use strict';

    const site = {
        name: 'Sistema de Estadísticas de Torneos',
        defaultTitle: 'Torneos · 5 divisiones',
        indexLogo: 'assets/default-team.png',
        defaultMonth: '2026-06',
        dataRefreshMs: 60000, 
        useFallbackData: false 
    };

    const assets = {
        defaultTeam: 'assets/default-team.png',
        defaultPlayer: 'assets/default-player.png'
    };

    const scoring = {
        eliminationPoint: 1,
        placementPoints: {
            1: 10,
            2: 6,
            3: 5,
            4: 4,
            5: 3,
            6: 2,
            7: 1,
            8: 1
        }
    };

    const months = {
        '2026-06': {
            name: 'Junio 2026',
            spreadsheetId: '1mi95f7f4Z8H_5NcR-iqXSSprKsI_sSCApI_icCXLeHk'
        }
      
    };

    const competitions = {};

    competitions.div1 = {
        id: 'div1',
        type: 'league',
        enabled: true,
        name: 'División 1',
        html: 'division-1.html',
        logo: 'assets/div1.png',
        sheets: {
            catalogTeams: 'EQUIPOS',
            catalogPlayers: 'JUGADORES',
            teams: 'DIV 1',
            players: 'JUGADORES DIV 1'
        },
        colors: {
            primary: '#e53935',
            secondary: '#ef5350',
            accent: '#ffcdd2',
            dark: '#b71c1c'
        },
        features: {
            summary: true,
            standings: true,
            mvp: true,
            charts: true
        }
    };

    competitions.div2 = {
        id: 'div2',
        type: 'league',
        enabled: true,
        name: 'División 2',
        html: 'division-2.html',
        logo: 'assets/div2.png',
        sheets: {
            catalogTeams: 'EQUIPOS',
            catalogPlayers: 'JUGADORES',
            teams: 'DIV 2',
            players: 'JUGADORES DIV 2'
        },
        colors: {
            primary: '#1e88e5',
            secondary: '#42a5f5',
            accent: '#90caf9',
            dark: '#0d47a1'
        },
        features: {
            summary: true,
            standings: true,
            mvp: true,
            charts: true
        }
    };

    competitions.div3 = {
        id: 'div3',
        type: 'league',
        enabled: true,
        name: 'División 3',
        html: 'division-3.html',
        logo: 'assets/div3.png',
        sheets: {
            catalogTeams: 'EQUIPOS',
            catalogPlayers: 'JUGADORES',
            teams: 'DIV 3',
            players: 'JUGADORES DIV 3'
        },
        colors: {
            primary: '#43a047',
            secondary: '#66bb6a',
            accent: '#c8e6c9',
            dark: '#1b5e20'
        },
        features: {
            summary: true,
            standings: true,
            mvp: true,
            charts: true
        }
    };

    competitions.div4 = {
        id: 'div4',
        type: 'league',
        enabled: true,
        name: 'División 4',
        html: 'division-4.html',
        logo: 'assets/div4.png',
        sheets: {
            catalogTeams: 'EQUIPOS',
            catalogPlayers: 'JUGADORES',
            teams: 'DIV 4',
            players: 'JUGADORES DIV 4'
        },
        colors: {
            primary: '#fb8c00',
            secondary: '#ffa726',
            accent: '#ffe0b2',
            dark: '#e65100'
        },
        features: {
            summary: true,
            standings: true,
            mvp: true,
            charts: true
        }
    };

    competitions.div5 = {
        id: 'div5',
        type: 'league',
        enabled: true,
        name: 'División 5',
        html: 'division-5.html',
        logo: 'assets/div5.png',
        sheets: {
            catalogTeams: 'EQUIPOS',
            catalogPlayers: 'JUGADORES',
            teams: 'DIV 5',
            players: 'JUGADORES DIV 5'
        },
        colors: {
            primary: '#8e24aa',
            secondary: '#ab47bc',
            accent: '#e1bee7',
            dark: '#4a148c'
        },
        features: {
            summary: true,
            standings: true,
            mvp: true,
            charts: true
        }
    };


    function getCompetitionConfig(competitionId) {
        if (!competitionId) return null;
        const comp = competitions[competitionId];
        if (!comp) {
            console.warn('[tournament_config] Competencia no encontrada:', competitionId);
            return null;
        }
        return comp;
    }

    function getMonthConfig(monthId) {
        if (!monthId) return null;
        const month = months[monthId];
        if (!month) {
            console.warn('[tournament_config] Mes no encontrado:', monthId);
            return null;
        }
        return month;
    }

    function getActiveMonthId() {
        return site.defaultMonth;
    }


    function validateConfig() {
        let hasErrors = false;

        if (!site.name || !site.defaultTitle || !site.defaultMonth) {
            console.error('[tournament_config] Configuración del sitio incompleta.');
            hasErrors = true;
        }

        const defaultMonth = months[site.defaultMonth];
        if (!defaultMonth) {
            console.error('[tournament_config] El mes por defecto no existe en months:', site.defaultMonth);
            hasErrors = true;
        }

        Object.keys(competitions).forEach(key => {
            const comp = competitions[key];
            if (!comp.enabled) return; 

            const errors = [];
            if (!comp.id) errors.push('id');
            if (!comp.name) errors.push('name');
            if (!comp.html) errors.push('html');
            if (!comp.logo) errors.push('logo');
            if (!comp.sheets || !comp.sheets.catalogTeams || !comp.sheets.catalogPlayers ||
                !comp.sheets.teams || !comp.sheets.players) {
                errors.push('sheets (faltan algunas hojas)');
            }
            if (!comp.colors || !comp.colors.primary || !comp.colors.secondary ||
                !comp.colors.accent || !comp.colors.dark) {
                errors.push('colores (faltan algunos)');
            }
            if (!comp.features || typeof comp.features !== 'object') {
                errors.push('features (debe ser objeto)');
            }

            if (errors.length > 0) {
                console.error(
                    '[tournament_config] Configuración incompleta para competencia "%s": faltan %s',
                    key, errors.join(', ')
                );
                hasErrors = true;
            }
        });

        if (!hasErrors) {
            console.log('[tournament_config] Configuración validada correctamente.');
        } else {
            console.warn('[tournament_config] Se encontraron errores en la configuración.');
        }
    }

    validateConfig();

    return {
        site: site,
        assets: assets,
        scoring: scoring,
        months: months,
        competitions: competitions,
        getCompetitionConfig: getCompetitionConfig,
        getMonthConfig: getMonthConfig,
        getActiveMonthId: getActiveMonthId
    };

})();

if (typeof window.TOURNAMENT_CONFIG === 'undefined') {
    console.warn('[tournament_config] No se pudo asignar window.TOURNAMENT_CONFIG');
} else {
    console.log('[tournament_config] Configuración cargada correctamente.');
}
