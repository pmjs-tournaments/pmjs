window.Standings = (function() {
    'use strict';

    function getMatchNumbers(headers) {
        const matches = [];
        const posRegex = /^M(\d+)\s*POS$/i;
        const elimRegex = /^M(\d+)\s*ELIM(?:INACIONES?)?$/i;

        const matchMap = {};

        headers.forEach((header, index) => {
            const posMatch = header.match(posRegex);
            if (posMatch) {
                const num = parseInt(posMatch[1], 10);
                if (!matchMap[num]) matchMap[num] = {};
                matchMap[num].posCol = index;
            }

            const elimMatch = header.match(elimRegex);
            if (elimMatch) {
                const num = parseInt(elimMatch[1], 10);
                if (!matchMap[num]) matchMap[num] = {};
                matchMap[num].elimCol = index;
            }
        });

        const keys = Object.keys(matchMap).map(Number).sort((a, b) => a - b);
        keys.forEach(num => {
            const entry = matchMap[num];
            if (entry.posCol !== undefined && entry.elimCol !== undefined) {
                matches.push({
                    matchNumber: num,
                    posCol: entry.posCol,
                    elimCol: entry.elimCol
                });
            }
        });

        return matches;
    }

    function extractTeamMatches(row, matchNumbers, headers) {
        const matches = [];

        matchNumbers.forEach(match => {
            const posKey = headers[match.posCol];
            const elimKey = headers[match.elimCol];

            let position = row[posKey] !== undefined ? row[posKey] : '';
            let eliminations = row[elimKey] !== undefined ? row[elimKey] : '';

            if (typeof position === 'string') position = position.trim();
            if (typeof eliminations === 'string') eliminations = eliminations.trim();

            if (position === '' || position === null || position === undefined) {
                return;
            }

            const posNum = Number(position);
            if (isNaN(posNum) || posNum < 1) {
                return;
            }

            let elimNum = 0;
            if (eliminations !== '' && eliminations !== null && eliminations !== undefined) {
                const parsed = Number(eliminations);
                if (!isNaN(parsed) && parsed >= 0) {
                    elimNum = parsed;
                }
            }

            matches.push({
                matchNumber: match.matchNumber,
                position: posNum,
                eliminations: elimNum
            });
        });

        matches.sort((a, b) => a.matchNumber - b.matchNumber);

        return matches;
    }

    function buildStandings(teamResults, teamCatalog, options) {
        if (!Array.isArray(teamResults) || teamResults.length === 0) {
            console.warn('[Standings] buildStandings: teamResults vacío o inválido');
            return [];
        }
        if (!Array.isArray(teamCatalog)) {
            console.warn('[Standings] buildStandings: teamCatalog no es un array, se usará vacío');
            teamCatalog = [];
        }

        const defaultOptions = {
            defaultLogo: 'assets/default-team.png',
            fallbackName: 'Equipo sin nombre'
        };
        const opts = Object.assign({}, defaultOptions, options);

        const firstRow = teamResults[0];
        const headers = Object.keys(firstRow);

        const matchNumbers = getMatchNumbers(headers);
        if (matchNumbers.length === 0) {
            console.warn('[Standings] No se detectaron columnas de partidas (M<N> POS / M<N> ELIM)');
        }

        const catalogMap = new Map();
        teamCatalog.forEach(item => {
            let id = item.teamId || item.TEAM_ID || item['Team ID'] || item.team_id || '';
            if (id !== undefined && id !== null) {
                id = String(id).trim();
                if (id !== '') {
                    catalogMap.set(id, {
                        teamName: item.teamName || item.TEAM_NAME || item['Team Name'] || item.team_name || 'Sin nombre',
                        logo: item.logo || item.LOGO || opts.defaultLogo
                    });
                }
            }
        });

        const standings = [];

        teamResults.forEach(row => {
            let teamId = row.teamId || row.TEAM_ID || row['Team ID'] || row.team_id || '';
            if (teamId === undefined || teamId === null) teamId = '';
            teamId = String(teamId).trim();
            if (teamId === '') {
                const teamName = row.EQUIPO || row['Equipo'] || row.teamName || '';
                if (teamName) {
                    teamId = 'temp_' + String(teamName).replace(/\s+/g, '_');
                } else {
                    return;
                }
            }

            let teamName = '';
            let logo = opts.defaultLogo;

            if (catalogMap.has(teamId)) {
                const cat = catalogMap.get(teamId);
                teamName = cat.teamName || teamId;
                logo = cat.logo || opts.defaultLogo;
            } else {
                teamName = row.EQUIPO || row['Equipo'] || row.teamName || row.TEAM_NAME || teamId;
                logo = row.logo || row.LOGO || opts.defaultLogo;
            }

            const matches = extractTeamMatches(row, matchNumbers, headers);

            const totals = window.Scoring.calculateTeamTotals(matches);

            const teamData = {
                teamId: teamId,
                teamName: teamName,
                logo: logo,
                division: row.DIVISION || row['División'] || '',
                matches: matches,
                totals: totals
            };

            standings.push(teamData);
        });

        standings.sort((a, b) => {
            return window.Scoring.compareTeams(a.totals, b.totals);
        });

        let rank = 1;
        let prevTotal = null;
        let prevWwcd = null;
        let prevPp = null;
        let prevPe = null;
        let prevLastPos = null;
        let rankCounter = 1;

        standings.forEach((team, index) => {
            const t = team.totals;
            if (index === 0) {
                team.rank = rank;
                prevTotal = t.total;
                prevWwcd = t.wwcd;
                prevPp = t.pp;
                prevPe = t.pe;
                prevLastPos = t.lastPosition;
                rankCounter = 1;
            } else {
                const prev = standings[index - 1];
                const prevT = prev.totals;
                if (t.total === prevT.total &&
                    t.wwcd === prevT.wwcd &&
                    t.pp === prevT.pp &&
                    t.pe === prevT.pe &&
                    t.lastPosition === prevT.lastPosition) {
                    team.rank = rank;
                } else {
                    rank = rankCounter + 1;
                    team.rank = rank;
                }
                rankCounter++;
                prevTotal = t.total;
                prevWwcd = t.wwcd;
                prevPp = t.pp;
                prevPe = t.pe;
                prevLastPos = t.lastPosition;
            }
        });

        return standings;
    }

    function getTeamDetails(teamId, standings) {
        if (!teamId || !Array.isArray(standings)) return null;
        const found = standings.find(team => team.teamId === teamId);
        return found || null;
    }

    return {
        extractTeamMatches: extractTeamMatches,
        buildStandings: buildStandings,
        getTeamDetails: getTeamDetails,
        getMatchNumbers: getMatchNumbers
    };

})();

if (window.Standings) {
    console.log('[Standings] Cargado correctamente.');
} else {
    console.error('[Standings] Error al inicializar.');
}
