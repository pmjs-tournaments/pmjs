window.Scoring = (function() {
    'use strict';

    function getScoringConfig() {
        const config = window.TOURNAMENT_CONFIG;
        if (config && config.scoring) {
            return config.scoring;
        }
        console.warn('[Scoring] TOURNAMENT_CONFIG.scoring no disponible, usando valores por defecto.');
        return {
            eliminationPoint: 1,
            placementPoints: {
                1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1
            }
        };
    }

    function getEliminationPointValue() {
        const config = getScoringConfig();
        const parsed = Number(config.eliminationPoint);
        return Number.isFinite(parsed) ? parsed : 1;
    }

    function getPlacementPoints(position) {
        if (typeof position === 'string') {
            position = position.trim();
            if (position === '') return 0;
            const parsed = Number(position);
            if (isNaN(parsed)) return 0;
            position = parsed;
        }
        if (typeof position !== 'number' || !isFinite(position)) return 0;
        if (position < 1) return 0; 

        const config = getScoringConfig();
        const placementPoints = config.placementPoints || {};
        return placementPoints[position] || 0;
    }

    function getEliminationPoints(eliminations) {
        if (typeof eliminations === 'string') {
            eliminations = eliminations.trim();
            if (eliminations === '') return 0;
            const parsed = Number(eliminations);
            if (isNaN(parsed)) return 0;
            eliminations = parsed;
        }
        if (typeof eliminations !== 'number' || !isFinite(eliminations)) return 0;
        if (eliminations < 0) return 0;

        const eliminationPoint = getEliminationPointValue();
        return eliminations * eliminationPoint;
    }

    function calculateMatchScore(position, eliminations) {
        const pp = getPlacementPoints(position);
        const pe = getEliminationPoints(eliminations);
        return pp + pe;
    }

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
            let position = match.position !== undefined ? match.position : match.Position;
            let eliminations = match.eliminations !== undefined ? match.eliminations : match.Eliminations;

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

            if (posNum === null) {
                continue;
            }

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

            const matchPP = getPlacementPoints(posNum);
            const matchPE = elimNum * eliminationPoint;
            const matchTotal = matchPP + matchPE;

            pp += matchPP;
            pe += matchPE;
            total += matchTotal;
            matchesPlayed++;

            if (posNum === 1) {
                wwcd++;
            }

            lastPosition = posNum;
        }

        return {
            pp: pp,
            pe: pe,
            total: total,
            wwcd: wwcd,
            lastPosition: lastPosition,
            matchesPlayed: matchesPlayed
        };
    }

    function compareTeams(a, b) {
        if (a.total !== b.total) {
            return (b.total - a.total);
        }
        if (a.wwcd !== b.wwcd) {
            return (b.wwcd - a.wwcd);
        }
        if (a.pp !== b.pp) {
            return (b.pp - a.pp);
        }
        if (a.pe !== b.pe) {
            return (b.pe - a.pe);
        }
        const aLast = a.lastPosition !== null ? a.lastPosition : Infinity;
        const bLast = b.lastPosition !== null ? b.lastPosition : Infinity;
        if (aLast !== bLast) {
            return (aLast - bLast);
        }
        return 0;
    }

    return {
        getPlacementPoints: getPlacementPoints,
        getEliminationPoints: getEliminationPoints,
        calculateMatchScore: calculateMatchScore,
        calculateTeamTotals: calculateTeamTotals,
        compareTeams: compareTeams
    };

})();

if (window.Scoring) {
    console.log('[Scoring] Cargado correctamente.');
} else {
    console.error('[Scoring] Error al inicializar.');
}
