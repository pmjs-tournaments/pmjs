window.MVP = (function() {
    'use strict';

    function getPlayerMatchColumns(headers) {
        const matches = [];
        const elimRegex = /^M(\d+)\s*ELIM(?:INACIONES?)?$/i;

        headers.forEach((header, index) => {
            const elimMatch = header.match(elimRegex);
            if (elimMatch) {
                const num = parseInt(elimMatch[1], 10);
                matches.push({
                    matchNumber: num,
                    elimCol: index
                });
            }
        });

        matches.sort((a, b) => a.matchNumber - b.matchNumber);
        return matches;
    }

    function extractPlayerMatches(row, matchColumns, headers) {
        const matches = [];

        matchColumns.forEach(match => {
            const elimKey = headers[match.elimCol];
            let eliminations = row[elimKey] !== undefined ? row[elimKey] : '';

            if (typeof eliminations === 'string') eliminations = eliminations.trim();
            if (eliminations === '' || eliminations === null || eliminations === undefined) {
                return;
            }

            const elimNum = Number(eliminations);
            if (isNaN(elimNum) || elimNum < 0) {
                return;
            }

            matches.push({
                matchNumber: match.matchNumber,
                eliminations: elimNum
            });
        });

        matches.sort((a, b) => a.matchNumber - b.matchNumber);
        return matches;
    }

    function buildMvpRanking(playerResults, playerCatalog, teamCatalog, standings, options) {
        if (!Array.isArray(playerResults) || playerResults.length === 0) {
            console.warn('[MVP] buildMvpRanking: playerResults vacío o inválido');
            return [];
        }

        const defaultOptions = {
            defaultPlayer: (window.TOURNAMENT_CONFIG && window.TOURNAMENT_CONFIG.assets && window.TOURNAMENT_CONFIG.assets.defaultPlayer) || 'assets/default-player.png',
            defaultTeamLogo: (window.TOURNAMENT_CONFIG && window.TOURNAMENT_CONFIG.assets && window.TOURNAMENT_CONFIG.assets.defaultTeam) || 'assets/default-team.png'
        };
        const opts = Object.assign({}, defaultOptions, options);

        const firstRow = playerResults[0];
        const headers = Object.keys(firstRow);

        const matchColumns = getPlayerMatchColumns(headers);
        if (matchColumns.length === 0) {
            console.warn('[MVP] No se detectaron columnas de partidas (M<N> ELIM)');
        }

        const playerCatalogMap = new Map();
        if (Array.isArray(playerCatalog)) {
            playerCatalog.forEach(item => {
                let id = item.playerId || item.PLAYER_ID || item['Player ID'] || item.player_id || '';
                if (id !== undefined && id !== null) {
                    id = String(id).trim();
                    if (id !== '') {
                        playerCatalogMap.set(id, {
                            playerName: item.playerName || item.PLAYER_NAME || item['Player Name'] || item.player_name || 'Sin nombre',
                            photo: item.photo || item.PHOTO || item.foto || opts.defaultPlayer
                        });
                    }
                }
            });
        }

        const teamCatalogMap = new Map();
        if (Array.isArray(teamCatalog)) {
            teamCatalog.forEach(item => {
                let id = item.teamId || item.TEAM_ID || item['Team ID'] || item.team_id || '';
                if (id !== undefined && id !== null) {
                    id = String(id).trim();
                    if (id !== '') {
                        teamCatalogMap.set(id, {
                            teamName: item.teamName || item.TEAM_NAME || item['Team Name'] || item.team_name || 'Sin equipo',
                            logo: item.logo || item.LOGO || opts.defaultTeamLogo
                        });
                    }
                }
            });
        }

        const teamMatchPositionMap = new Map();
        if (Array.isArray(standings)) {
            standings.forEach(team => {
                const teamId = team.teamId;
                if (!teamId) return;
                const posMap = {};
                if (Array.isArray(team.matches)) {
                    team.matches.forEach(match => {
                        posMap[match.matchNumber] = match.position;
                    });
                }
                teamMatchPositionMap.set(teamId, posMap);
            });
        }

        const ranking = [];

        playerResults.forEach(row => {
            let playerId = row.playerId || row.PLAYER_ID || row['Player ID'] || row.player_id || '';
            if (playerId === undefined || playerId === null) playerId = '';
            playerId = String(playerId).trim();
            if (playerId === '') {
                const playerName = row.JUGADOR || row['Jugador'] || row.playerName || '';
                if (playerName) {
                    playerId = 'temp_' + String(playerName).replace(/\s+/g, '_');
                } else {
                    return;
                }
            }

            let teamId = row.teamId || row.TEAM_ID || row['Team ID'] || row.team_id || '';
            if (teamId === undefined || teamId === null) teamId = '';
            teamId = String(teamId).trim();
            if (teamId === '') {
                const teamName = row.EQUIPO || row['Equipo'] || row.teamName || '';
                if (teamName) {
                    teamId = 'temp_' + String(teamName).replace(/\s+/g, '_');
                } else {
                    teamId = 'unknown_team';
                }
            }

            let playerName = '';
            let photo = opts.defaultPlayer;
            if (playerCatalogMap.has(playerId)) {
                const cat = playerCatalogMap.get(playerId);
                playerName = cat.playerName || playerId;
                photo = cat.photo || opts.defaultPlayer;
            } else {
                playerName = row.JUGADOR || row['Jugador'] || row.playerName || row.PLAYER_NAME || playerId;
                photo = row.foto || row.FOTO || row.photo || row.PHOTO || opts.defaultPlayer;
            }

            let teamName = '';
            let teamLogo = opts.defaultTeamLogo;
            if (teamCatalogMap.has(teamId)) {
                const cat = teamCatalogMap.get(teamId);
                teamName = cat.teamName || teamId;
                teamLogo = cat.logo || opts.defaultTeamLogo;
            } else {
                teamName = row.EQUIPO || row['Equipo'] || row.teamName || row.TEAM_NAME || teamId;
                teamLogo = row.logo || row.LOGO || opts.defaultTeamLogo;
            }

            const playerMatches = extractPlayerMatches(row, matchColumns, headers);

            let totalEliminations = 0;
            playerMatches.forEach(m => {
                if (typeof m.eliminations === 'number' && m.eliminations >= 0) {
                    totalEliminations += m.eliminations;
                }
            });

            const teamPosMap = teamMatchPositionMap.get(teamId) || {};

            const enrichedMatches = playerMatches.map(m => {
                const teamPosition = teamPosMap[m.matchNumber] !== undefined ? teamPosMap[m.matchNumber] : null;
                return {
                    matchNumber: m.matchNumber,
                    eliminations: m.eliminations,
                    teamPosition: teamPosition
                };
            });

            let lastTeamPosition = null;
            let lastMatchNumber = null;
            const teamMatchNumbers = Object.keys(teamPosMap).map(Number);
            if (teamMatchNumbers.length > 0) {
                lastMatchNumber = Math.max(...teamMatchNumbers);
                lastTeamPosition = teamPosMap[lastMatchNumber];
            }
            let eliminationsInLastMatch = 0;
            if (lastMatchNumber !== null) {
                const matchInPlayer = playerMatches.find(m => m.matchNumber === lastMatchNumber);
                if (matchInPlayer) {
                    eliminationsInLastMatch = matchInPlayer.eliminations;
                }
            }

            const playerData = {
                playerId: playerId,
                playerName: playerName,
                teamId: teamId,
                teamName: teamName,
                teamLogo: teamLogo,
                image: photo,
                matches: enrichedMatches,
                totalEliminations: totalEliminations,
                lastTeamPosition: lastTeamPosition,
                lastMatchNumber: lastMatchNumber,
                eliminationsInLastMatch: eliminationsInLastMatch
            };

            ranking.push(playerData);
        });

        ranking.sort((a, b) => {
            if (a.totalEliminations !== b.totalEliminations) {
                return b.totalEliminations - a.totalEliminations;
            }
            const aPos = a.lastTeamPosition !== null ? a.lastTeamPosition : Infinity;
            const bPos = b.lastTeamPosition !== null ? b.lastTeamPosition : Infinity;
            if (aPos !== bPos) {
                return aPos - bPos;
            }
            if (a.eliminationsInLastMatch !== b.eliminationsInLastMatch) {
                return b.eliminationsInLastMatch - a.eliminationsInLastMatch;
            }
            return a.playerName.localeCompare(b.playerName);
        });

        ranking.forEach((player, index) => {
            player.rank = index + 1;
        });

        return ranking;
    }

    function getPlayerDetails(playerId, ranking) {
        if (!playerId || !Array.isArray(ranking)) return null;
        const found = ranking.find(p => p.playerId === playerId);
        return found || null;
    }


    return {
        extractPlayerMatches: extractPlayerMatches,
        buildMvpRanking: buildMvpRanking,
        getPlayerDetails: getPlayerDetails
    };

})();

if (window.MVP) {
    console.log('[MVP] Cargado correctamente.');
} else {
    console.error('[MVP] Error al inicializar.');
}
