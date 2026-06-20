/**
 * tournament_config.js
 * Configuración central del sistema de torneos.
 * Expone window.TOURNAMENT_CONFIG y funciones auxiliares.
 * Se carga como script tradicional (no módulo ES).
 */

window.TOURNAMENT_CONFIG = (function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURACIÓN GENERAL DEL SITIO
    // ============================================================
    const site = {
        name: 'Sistema de Estadísticas de Torneos',
        defaultTitle: 'Torneos · 5 divisiones',
        indexLogo: 'assets/default-team.png',
        defaultMonth: '2026-06',
        dataRefreshMs: 60000, // 30 segundos
        useFallbackData: false // false = Google Sheets, true = archivos locales
    };

    // ============================================================
    // 2. ASSETS (rutas a imágenes por defecto)
    // ============================================================
    const assets = {
        defaultTeam: 'assets/default-team.png',
        defaultPlayer: 'assets/default-player.png'
    };

    // ============================================================
    // 3. SISTEMA DE PUNTUACIÓN
    // ============================================================
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

    // ============================================================
    // 4. MESES DISPONIBLES
    // ============================================================
    const months = {
        '2026-06': {
            name: 'Junio 2026',
            spreadsheetId: '1mi95f7f4Z8H_5NcR-iqXSSprKsI_sSCApI_icCXLeHk'
        }
        // Se pueden agregar más meses:
        // '2026-07': { name: 'Julio 2026', spreadsheetId: '...' }
    };

    // ============================================================
    // 5. COMPETENCIAS (5 divisiones)
    // ============================================================
    const competitions = {};

    // ----- División 1 -------------------------------------------
    competitions.div1 = {
        id: 'div1',
        type: 'league', // 'league' | 'special'
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

    // ----- División 2 -------------------------------------------
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

    // ----- División 3 -------------------------------------------
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

    // ----- División 4 -------------------------------------------
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

    // ----- División 5 -------------------------------------------
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

    // ============================================================
    // 6. FUNCIONES AUXILIARES
    // ============================================================

    /**
     * Obtiene la configuración de una competencia por su ID.
     * @param {string} competitionId - 'div1' ... 'div5' o 'special'
     * @returns {object|null} Configuración de la competencia o null si no existe.
     */
    function getCompetitionConfig(competitionId) {
        if (!competitionId) return null;
        const comp = competitions[competitionId];
        if (!comp) {
            console.warn('[tournament_config] Competencia no encontrada:', competitionId);
            return null;
        }
        return comp;
    }

    /**
     * Obtiene la configuración de un mes por su ID.
     * @param {string} monthId - '2026-06' ...
     * @returns {object|null} Configuración del mes o null si no existe.
     */
    function getMonthConfig(monthId) {
        if (!monthId) return null;
        const month = months[monthId];
        if (!month) {
            console.warn('[tournament_config] Mes no encontrado:', monthId);
            return null;
        }
        return month;
    }

    /**
     * Devuelve el ID del mes activo por defecto.
     * @returns {string} ID del mes por defecto.
     */
    function getActiveMonthId() {
        return site.defaultMonth;
    }

    // ============================================================
    // 7. VALIDACIONES
    // ============================================================

    function validateConfig() {
        let hasErrors = false;

        // Validar sitio
        if (!site.name || !site.defaultTitle || !site.defaultMonth) {
            console.error('[tournament_config] Configuración del sitio incompleta.');
            hasErrors = true;
        }

        // Validar meses
        const defaultMonth = months[site.defaultMonth];
        if (!defaultMonth) {
            console.error('[tournament_config] El mes por defecto no existe en months:', site.defaultMonth);
            hasErrors = true;
        }

        // Validar cada competencia habilitada
        Object.keys(competitions).forEach(key => {
            const comp = competitions[key];
            if (!comp.enabled) return; // No validar si está deshabilitada

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

    // Ejecutar validaciones al cargar el script
    validateConfig();

    // ============================================================
    // 8. TORNEOS ESPECIALES (ejemplo comentado)
    // ============================================================
    /*
    // Ejemplo de competencia especial desactivada por defecto
    competitions.specialExample = {
        id: 'specialExample',
        type: 'special',
        enabled: false, // Desactivado por defecto
        name: 'Copa Especial',
        html: 'special.html',
        logo: 'assets/special.png',
        sheets: {
            catalogTeams: 'EQUIPOS_ESPECIALES',
            catalogPlayers: 'JUGADORES_ESPECIALES',
            teams: 'ESPECIAL_TEAMS',
            players: 'ESPECIAL_PLAYERS'
        },
        colors: {
            primary: '#ff6f00',
            secondary: '#ffab00',
            accent: '#ffecb3',
            dark: '#bf360c'
        },
        features: {
            summary: true,
            standings: true,
            mvp: true,
            charts: true
        }
    };
    */

    // ============================================================
    // 9. EXPOSICIÓN PÚBLICA
    // ============================================================

    return {
        site: site,
        assets: assets,
        scoring: scoring,
        months: months,
        competitions: competitions,
        // Funciones auxiliares
        getCompetitionConfig: getCompetitionConfig,
        getMonthConfig: getMonthConfig,
        getActiveMonthId: getActiveMonthId
    };

})();

// ============================================================
// 10. EXPOSICIÓN GLOBAL (window)
// ============================================================
// window.TOURNAMENT_CONFIG ya está definido arriba.
// Para mayor claridad, lo reafirmamos:
if (typeof window.TOURNAMENT_CONFIG === 'undefined') {
    console.warn('[tournament_config] No se pudo asignar window.TOURNAMENT_CONFIG');
} else {
    console.log('[tournament_config] Configuración cargada correctamente.');
}