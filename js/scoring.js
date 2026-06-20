/**
 * scoring.js
 * Centraliza todos los cálculos de puntuación.
 * Expone window.Scoring con funciones para calcular puntos, totales por equipo y comparación.
 * Utiliza window.TOURNAMENT_CONFIG.scoring para las reglas.
 */

window.Scoring = (function() {
    'use strict';

    // ============================================================
    // 1. OBTENER CONFIGURACIÓN DE PUNTUACIÓN
    // ============================================================

    /**
     * Obtiene la configuración de puntuación desde TOURNAMENT_CONFIG.
     * Si no está disponible, usa valores por defecto.
     * @returns {object} Configuración de puntuación.
     */
    function getScoringConfig() {
        const config = window.TOURNAMENT_CONFIG;
        if (config && config.scoring) {
            return config.scoring;
        }
        // Fallback por defecto
        console.warn('[Scoring] TOURNAMENT_CONFIG.scoring no disponible, usando valores por defecto.');
        return {
            eliminationPoint: 1,
            placementPoints: {
                1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
            }
        };
    }

    /**
     * Obtiene el valor de puntos por eliminación desde la configuración,
     * validando que sea un número finito. Si no es válido, devuelve 1.
     * @returns {number} Puntos por eliminación.
     */
    function getEliminationPointValue() {
        const config = getScoringConfig();
        const parsed = Number(config.eliminationPoint);
        return Number.isFinite(parsed) ? parsed : 1;
    }

    // ============================================================
    // 2. FUNCIONES DE CÁLCULO DE PUNTOS
    // ============================================================

    /**
     * Obtiene los puntos por posición según la configuración.
     * @param {number|string} position - Posición obtenida (número o cadena).
     * @returns {number} Puntos por posición, 0 si es inválida o no existe.
     */
    function getPlacementPoints(position) {
        // Normalizar: convertir a número, quitar espacios
        if (typeof position === 'string') {
            position = position.trim();
            if (position === '') return 0;
            const parsed = Number(position);
            if (isNaN(parsed)) return 0;
            position = parsed;
        }
        if (typeof position !== 'number' || !isFinite(position)) return 0;
        if (position < 1) return 0; // Posiciones inválidas menores que 1

        const config = getScoringConfig();
        const placementPoints = config.placementPoints || {};
        // Si la posición no está en el mapa, devolver 0 (por ejemplo, posiciones > 8)
        return placementPoints[position] || 0;
    }

    /**
     * Calcula los puntos por eliminaciones.
     * @param {number|string} eliminations - Número de eliminaciones.
     * @returns {number} Puntos por eliminaciones (eliminaciones * eliminationPoint).
     */
    function getEliminationPoints(eliminations) {
        // Normalizar
        if (typeof eliminations === 'string') {
            eliminations = eliminations.trim();
            if (eliminations === '') return 0;
            const parsed = Number(eliminations);
            if (isNaN(parsed)) return 0;
            eliminations = parsed;
        }
        if (typeof eliminations !== 'number' || !isFinite(eliminations)) return 0;
        if (eliminations < 0) return 0; // Eliminaciones negativas inválidas

        const eliminationPoint = getEliminationPointValue();
        return eliminations * eliminationPoint;
    }

    /**
     * Calcula el puntaje total de una partida.
     * @param {number|string} position - Posición.
     * @param {number|string} eliminations - Eliminaciones.
     * @returns {number} Puntuación total de la partida.
     */
    function calculateMatchScore(position, eliminations) {
        const pp = getPlacementPoints(position);
        const pe = getEliminationPoints(eliminations);
        return pp + pe;
    }

    // ============================================================
    // 3. CÁLCULO DE TOTALES POR EQUIPO
    // ============================================================

    /**
     * Calcula los totales de un equipo a partir de sus partidas.
     * @param {Array<Object>} matches - Array de objetos con campos 'position' y 'eliminations' (o 'eliminaciones').
     * @returns {Object} Totales del equipo.
     */
    function calculateTeamTotals(matches) {
        if (!Array.isArray(matches)) {
            console.warn('[Scoring] calculateTeamTotals: matches no es un array');
            matches = [];
        }

        let pp = 0;
        let pe = 0;
        let total = 0;
        let wwcd = 0;
        let matchesPlayed = 0;
        let lastPosition = null;

        const eliminationPoint = getEliminationPointValue();

        for (const match of matches) {
            // Intentar obtener position y eliminations (soportar nombres de campo variantes)
            let position = match.position !== undefined ? match.position : match.Position;
            let eliminations = match.eliminations !== undefined ? match.eliminations : match.Eliminations;

            // Normalizar posición: si es cadena vacía o undefined, considerar partida no disputada
            let posNum = null;
            if (position !== undefined && position !== null && position !== '') {
                const trimmed = String(position).trim();
                if (trimmed !== '') {
                    const parsed = Number(trimmed);
                    if (!isNaN(parsed) && parsed >= 1) {
                        posNum = parsed;
                    }
                }
            }

            // Si no hay posición válida, esta partida no se disputó, saltar
            if (posNum === null) {
                continue;
            }

            // Eliminaciones: si está vacía o no existe, consideramos 0 solo si existe posición
            let elimNum = 0;
            if (eliminations !== undefined && eliminations !== null && eliminations !== '') {
                const trimmed = String(eliminations).trim();
                if (trimmed !== '') {
                    const parsed = Number(trimmed);
                    if (!isNaN(parsed) && parsed >= 0) {
                        elimNum = parsed;
                    }
                }
            }

            // Calcular puntos para esta partida
            const matchPP = getPlacementPoints(posNum);
            const matchPE = elimNum * eliminationPoint;
            const matchTotal = matchPP + matchPE;

            pp += matchPP;
            pe += matchPE;
            total += matchTotal;
            matchesPlayed++;

            // WWCD: posición 1
            if (posNum === 1) {
                wwcd++;
            }

            // Registrar última posición (para desempate)
            lastPosition = posNum;
        }

        // Si no se jugó ninguna partida, lastPosition puede ser null
        return {
            pp: pp,
            pe: pe,
            total: total,
            wwcd: wwcd,
            lastPosition: lastPosition,
            matchesPlayed: matchesPlayed
        };
    }

    // ============================================================
    // 4. COMPARACIÓN DE EQUIPOS PARA ORDENAMIENTO
    // ============================================================

    /**
     * Compara dos equipos según las reglas de desempate.
     * @param {Object} a - Objeto con campos pp, pe, total, wwcd, lastPosition.
     * @param {Object} b - Objeto con campos pp, pe, total, wwcd, lastPosition.
     * @returns {number} Negativo si a < b (a debe ir antes), positivo si a > b (b debe ir antes), 0 si iguales.
     */
    function compareTeams(a, b) {
        // 1. Mayor TOTAL
        if (a.total !== b.total) {
            return (b.total - a.total);
        }
        // 2. Mayor WWCD
        if (a.wwcd !== b.wwcd) {
            return (b.wwcd - a.wwcd);
        }
        // 3. Mayor PP
        if (a.pp !== b.pp) {
            return (b.pp - a.pp);
        }
        // 4. Mayor PE
        if (a.pe !== b.pe) {
            return (b.pe - a.pe);
        }
        // 5. Mejor posición en la última partida (menor número)
        // Si uno no tiene última posición (null), lo ponemos al final
        const aLast = a.lastPosition !== null ? a.lastPosition : Infinity;
        const bLast = b.lastPosition !== null ? b.lastPosition : Infinity;
        if (aLast !== bLast) {
            return (aLast - bLast);
        }
        return 0;
    }

    // ============================================================
    // 5. EXPOSICIÓN PÚBLICA
    // ============================================================

    return {
        getPlacementPoints: getPlacementPoints,
        getEliminationPoints: getEliminationPoints,
        calculateMatchScore: calculateMatchScore,
        calculateTeamTotals: calculateTeamTotals,
        compareTeams: compareTeams
    };

})();

// Verificación de carga
if (window.Scoring) {
    console.log('[Scoring] Cargado correctamente.');
} else {
    console.error('[Scoring] Error al inicializar.');
}