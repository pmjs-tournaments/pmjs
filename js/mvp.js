/**
 * mvp.js
 * Procesa la pestaña 'JUGADORES DIV X' y genera la tabla MVP.
 * Expone window.MVP con funciones para extraer partidas de jugadores, construir ranking y obtener detalles.
 * Utiliza window.TOURNAMENT_CONFIG.assets.defaultPlayer para imagen por defecto.
 */

window.MVP = (function() {
    'use strict';

    // ============================================================
    // 1. FUNCIONES AUXILIARES DE DETECCIÓN DE COLUMNAS
    // ============================================================

    /**
     * Detecta columnas de eliminaciones de jugadores con patrón 'M<N> ELIM' o 'M<N> ELIMINACIONES'.
     * @param {Array<string>} headers - Lista de nombres de encabezados (normalizados).
     * @returns {Array<Object>} Array con objetos { matchNumber, elimCol }.
     */
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

        // Ordenar por número de partida
        matches.sort((a, b) => a.matchNumber - b.matchNumber);
        return matches;
    }

    /**
     * Extrae las partidas de un jugador a partir de una fila y las columnas detectadas.
     * @param {Object} row - Fila de datos (objeto con claves = encabezados).
     * @param {Array<Object>} matchColumns - Resultado de getPlayerMatchColumns.
     * @param {Array<string>} headers - Lista de encabezados.
     * @returns {Array<Object>} Array de { matchNumber, eliminations }.
     */
    function extractPlayerMatches(row, matchColumns, headers) {
        const matches = [];

        matchColumns.forEach(match => {
            const elimKey = headers[match.elimCol];
            let eliminations = row[elimKey] !== undefined ? row[elimKey] : '';

            // Normalizar
            if (typeof eliminations === 'string') eliminations = eliminations.trim();
            if (eliminations === '' || eliminations === null || eliminations === undefined) {
                // No se registra partida (no se suma)
                return;
            }

            const elimNum = Number(eliminations);
            if (isNaN(elimNum) || elimNum < 0) {
                // Valor inválido, se ignora
                return;
            }

            matches.push({
                matchNumber: match.matchNumber,
                eliminations: elimNum
            });
        });

        // Ordenar por número de partida
        matches.sort((a, b) => a.matchNumber - b.matchNumber);
        return matches;
    }

    // ============================================================
    // 2. CONSTRUCCIÓN DEL RANKING MVP
    // ============================================================

    /**
     * Construye el ranking de jugadores MVP.
     * @param {Array<Object>} playerResults - Array de filas de la pestaña JUGADORES DIV X.
     * @param {Array<Object>} playerCatalog - Catálogo de jugadores (con playerId, playerName, photo, etc.).
     * @param {Array<Object>} teamCatalog - Catálogo de equipos (con teamId, teamName, logo).
     * @param {Array<Object>} standings - Resultado de Standings.buildStandings (equipos con sus partidas y posiciones).
     * @param {Object} options - Opciones (defaultPlayer, defaultTeamLogo).
     * @returns {Array<Object>} Array de jugadores ordenados con rank y datos.
     */
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

        // Obtener encabezados
        const firstRow = playerResults[0];
        const headers = Object.keys(firstRow);

        // Detectar columnas de partidas
        const matchColumns = getPlayerMatchColumns(headers);
        if (matchColumns.length === 0) {
            console.warn('[MVP] No se detectaron columnas de partidas (M<N> ELIM)');
        }

        // Construir catálogo de jugadores: mapa playerId -> { playerName, photo }
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

        // Construir catálogo de equipos: mapa teamId -> { teamName, logo }
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

        // Construir mapa de posiciones de equipo por partida: teamId -> { matchNumber: position }
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

        // Procesar cada fila de resultados de jugadores
        const ranking = [];

        playerResults.forEach(row => {
            // Obtener playerId
            let playerId = row.playerId || row.PLAYER_ID || row['Player ID'] || row.player_id || '';
            if (playerId === undefined || playerId === null) playerId = '';
            playerId = String(playerId).trim();
            if (playerId === '') {
                // Intentar usar JUGADOR como fallback
                const playerName = row.JUGADOR || row['Jugador'] || row.playerName || '';
                if (playerName) {
                    playerId = 'temp_' + String(playerName).replace(/\s+/g, '_');
                } else {
                    // Sin identificador, saltar
                    return;
                }
            }

            // Obtener teamId
            let teamId = row.teamId || row.TEAM_ID || row['Team ID'] || row.team_id || '';
            if (teamId === undefined || teamId === null) teamId = '';
            teamId = String(teamId).trim();
            if (teamId === '') {
                // Usar EQUIPO de la fila
                const teamName = row.EQUIPO || row['Equipo'] || row.teamName || '';
                if (teamName) {
                    teamId = 'temp_' + String(teamName).replace(/\s+/g, '_');
                } else {
                    teamId = 'unknown_team';
                }
            }

            // Obtener nombre del jugador desde catálogo o fila
            let playerName = '';
            let photo = opts.defaultPlayer;
            if (playerCatalogMap.has(playerId)) {
                const cat = playerCatalogMap.get(playerId);
                playerName = cat.playerName || playerId;
                photo = cat.photo || opts.defaultPlayer;
            } else {
                playerName = row.JUGADOR || row['Jugador'] || row.playerName || row.PLAYER_NAME || playerId;
                // Intentar obtener foto si existe columna FOTO
                photo = row.foto || row.FOTO || row.photo || row.PHOTO || opts.defaultPlayer;
            }

            // Obtener nombre y logo del equipo desde catálogo o fila
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

            // Extraer partidas del jugador (eliminaciones)
            const playerMatches = extractPlayerMatches(row, matchColumns, headers);

            // Calcular total de eliminaciones (sumar todas las que sean números >=0)
            let totalEliminations = 0;
            playerMatches.forEach(m => {
                if (typeof m.eliminations === 'number' && m.eliminations >= 0) {
                    totalEliminations += m.eliminations;
                }
            });

            // Obtener posiciones del equipo por partida
            const teamPosMap = teamMatchPositionMap.get(teamId) || {};

            // Construir array de matches enriquecido con teamPosition
            const enrichedMatches = playerMatches.map(m => {
                const teamPosition = teamPosMap[m.matchNumber] !== undefined ? teamPosMap[m.matchNumber] : null;
                return {
                    matchNumber: m.matchNumber,
                    eliminations: m.eliminations,
                    teamPosition: teamPosition
                };
            });

            // Determinar la última partida del equipo (máximo matchNumber en teamPosMap)
            let lastTeamPosition = null;
            let lastMatchNumber = null;
            const teamMatchNumbers = Object.keys(teamPosMap).map(Number);
            if (teamMatchNumbers.length > 0) {
                lastMatchNumber = Math.max(...teamMatchNumbers);
                lastTeamPosition = teamPosMap[lastMatchNumber];
            }
            // Si no hay partidas del equipo, lastTeamPosition = null (se pondrá al final)

            // Eliminaciones en la última partida del equipo (para el jugador)
            let eliminationsInLastMatch = 0;
            if (lastMatchNumber !== null) {
                const matchInPlayer = playerMatches.find(m => m.matchNumber === lastMatchNumber);
                if (matchInPlayer) {
                    eliminationsInLastMatch = matchInPlayer.eliminations;
                }
            }

            // Construir objeto del jugador
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

        // Ordenar según criterios:
        // 1. Mayor totalEliminations (descendente)
        // 2. Mejor lastTeamPosition (ascendente, null va al final)
        // 3. Mayor eliminationsInLastMatch (descendente)
        // 4. playerName alfabéticamente (ascendente)
        ranking.sort((a, b) => {
            // 1. totalEliminations desc
            if (a.totalEliminations !== b.totalEliminations) {
                return b.totalEliminations - a.totalEliminations;
            }
            // 2. lastTeamPosition asc (null va al final)
            const aPos = a.lastTeamPosition !== null ? a.lastTeamPosition : Infinity;
            const bPos = b.lastTeamPosition !== null ? b.lastTeamPosition : Infinity;
            if (aPos !== bPos) {
                return aPos - bPos;
            }
            // 3. eliminationsInLastMatch desc
            if (a.eliminationsInLastMatch !== b.eliminationsInLastMatch) {
                return b.eliminationsInLastMatch - a.eliminationsInLastMatch;
            }
            // 4. playerName alfabético
            return a.playerName.localeCompare(b.playerName);
        });

        // Asignar rank (1, 2, 3, ...) - en caso de empate total, se podría mantener mismo rank, pero con el orden alfabético final no debería haber empates.
        ranking.forEach((player, index) => {
            player.rank = index + 1;
        });

        return ranking;
    }

    // ============================================================
    // 3. OBTENER DETALLE DE UN JUGADOR
    // ============================================================

    /**
     * Obtiene los detalles de un jugador por su ID.
     * @param {string} playerId - ID del jugador.
     * @param {Array<Object>} ranking - Ranking de jugadores (resultado de buildMvpRanking).
     * @returns {Object|null} Datos del jugador o null si no se encuentra.
     */
    function getPlayerDetails(playerId, ranking) {
        if (!playerId || !Array.isArray(ranking)) return null;
        const found = ranking.find(p => p.playerId === playerId);
        return found || null;
    }

    // ============================================================
    // 4. EXPOSICIÓN PÚBLICA
    // ============================================================

    return {
        extractPlayerMatches: extractPlayerMatches,
        buildMvpRanking: buildMvpRanking,
        getPlayerDetails: getPlayerDetails
    };

})();

// Verificación
if (window.MVP) {
    console.log('[MVP] Cargado correctamente.');
} else {
    console.error('[MVP] Error al inicializar.');
}