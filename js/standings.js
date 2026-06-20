/**
 * standings.js
 * Procesa la pestaña horizontal 'DIV X' y genera la clasificación de equipos.
 * Expone window.Standings con funciones para extraer partidas, construir tabla y obtener detalles.
 * Utiliza window.Scoring para cálculos y comparación.
 */

window.Standings = (function() {
    'use strict';

    // ============================================================
    // 1. FUNCIONES AUXILIARES DE DETECCIÓN DE COLUMNAS
    // ============================================================

    /**
     * Detecta pares de columnas 'M<N> POS' y 'M<N> ELIM' a partir de los encabezados.
     * @param {Array<string>} headers - Lista de nombres de encabezados (normalizados).
     * @returns {Array<Object>} Array con objetos { matchNumber, posCol, elimCol }.
     */
    function getMatchNumbers(headers) {
        const matches = [];
        // Patrón para detectar columnas de posición y eliminación
        // Buscamos "M<N> POS" o "M<N> POS" (con espacios) y "M<N> ELIM" (o "ELIMINACIONES")
        const posRegex = /^M(\d+)\s*POS$/i;
        const elimRegex = /^M(\d+)\s*ELIM(?:INACIONES?)?$/i;

        // Mapa de matchNumber -> { posCol, elimCol }
        const matchMap = {};

        headers.forEach((header, index) => {
            // Intentar como posición
            const posMatch = header.match(posRegex);
            if (posMatch) {
                const num = parseInt(posMatch[1], 10);
                if (!matchMap[num]) matchMap[num] = {};
                matchMap[num].posCol = index;
            }

            // Intentar como eliminación
            const elimMatch = header.match(elimRegex);
            if (elimMatch) {
                const num = parseInt(elimMatch[1], 10);
                if (!matchMap[num]) matchMap[num] = {};
                matchMap[num].elimCol = index;
            }
        });

        // Convertir a array y ordenar por número de partida
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

    /**
     * Extrae la información de partidas de una fila (objeto) usando los índices de columnas.
     * @param {Object} row - Fila con datos (claves = encabezados normalizados).
     * @param {Array<Object>} matchNumbers - Resultado de getMatchNumbers.
     * @param {Array<string>} headers - Lista de encabezados (para acceder a valores).
     * @returns {Array<Object>} Array de partidas con { matchNumber, position, eliminations }.
     */
    function extractTeamMatches(row, matchNumbers, headers) {
        const matches = [];

        matchNumbers.forEach(match => {
            const posKey = headers[match.posCol];
            const elimKey = headers[match.elimCol];

            let position = row[posKey] !== undefined ? row[posKey] : '';
            let eliminations = row[elimKey] !== undefined ? row[elimKey] : '';

            // Normalizar: si es cadena, recortar espacios
            if (typeof position === 'string') position = position.trim();
            if (typeof eliminations === 'string') eliminations = eliminations.trim();

            // Si la posición está vacía, consideramos partida no jugada
            if (position === '' || position === null || position === undefined) {
                // No agregamos la partida
                return;
            }

            // Verificar si posición es un número válido (>=1)
            const posNum = Number(position);
            if (isNaN(posNum) || posNum < 1) {
                // Posición inválida, la ignoramos
                return;
            }

            // Eliminaciones: si está vacío o no es número, lo tratamos como 0
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

        // Ordenar partidas por número
        matches.sort((a, b) => a.matchNumber - b.matchNumber);

        return matches;
    }

    // ============================================================
    // 2. CONSTRUCCIÓN DE CLASIFICACIÓN
    // ============================================================

    /**
     * Construye la clasificación completa a partir de los resultados de equipos y el catálogo.
     * @param {Array<Object>} teamResults - Array de filas de la pestaña DIV X (objetos con encabezados).
     * @param {Array<Object>} teamCatalog - Array de objetos del catálogo de equipos (con teamId, teamName, logo, etc.).
     * @param {Object} options - Opciones adicionales (por ejemplo, defaultLogo, fallbackName).
     * @returns {Array<Object>} Array de equipos ordenados con posición y todos los datos.
     */
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

        // Obtener encabezados de la primera fila (objeto -> keys)
        const firstRow = teamResults[0];
        const headers = Object.keys(firstRow);

        // Detectar columnas de partidas
        const matchNumbers = getMatchNumbers(headers);
        if (matchNumbers.length === 0) {
            console.warn('[Standings] No se detectaron columnas de partidas (M<N> POS / M<N> ELIM)');
        }

        // Crear un mapa de catálogo por teamId (normalizado)
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

        // Procesar cada fila de resultados
        const standings = [];

        teamResults.forEach(row => {
            // Obtener teamId
            let teamId = row.teamId || row.TEAM_ID || row['Team ID'] || row.team_id || '';
            if (teamId === undefined || teamId === null) teamId = '';
            teamId = String(teamId).trim();
            if (teamId === '') {
                // Intentar obtener de la columna EQUIPO (por si no hay teamId)
                const teamName = row.EQUIPO || row['Equipo'] || row.teamName || '';
                if (teamName) {
                    // Buscar en catálogo por nombre? Podríamos intentar, pero mejor usar un ID generado
                    // Para evitar errores, usamos un ID temporal
                    teamId = 'temp_' + String(teamName).replace(/\s+/g, '_');
                } else {
                    // Sin ID y sin nombre, saltar
                    return;
                }
            }

            // Obtener nombre del equipo desde el catálogo o desde la fila
            let teamName = '';
            let logo = opts.defaultLogo;

            if (catalogMap.has(teamId)) {
                const cat = catalogMap.get(teamId);
                teamName = cat.teamName || teamId;
                logo = cat.logo || opts.defaultLogo;
            } else {
                // No está en catálogo: usar datos de la fila
                teamName = row.EQUIPO || row['Equipo'] || row.teamName || row.TEAM_NAME || teamId;
                // Intentar obtener logo si existe columna LOGO
                logo = row.logo || row.LOGO || opts.defaultLogo;
            }

            // Extraer partidas
            const matches = extractTeamMatches(row, matchNumbers, headers);

            // Calcular totales usando Scoring
            const totals = window.Scoring.calculateTeamTotals(matches);

            // Construir objeto equipo
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

        // Ordenar usando Scoring.compareTeams
        standings.sort((a, b) => {
            return window.Scoring.compareTeams(a.totals, b.totals);
        });

        // Asignar ranking (1-based)
        let rank = 1;
        let prevTotal = null;
        let prevWwcd = null;
        let prevPp = null;
        let prevPe = null;
        let prevLastPos = null;
        let rankCounter = 1;

        standings.forEach((team, index) => {
            const t = team.totals;
            // Si es el primero, asignar rank 1
            if (index === 0) {
                team.rank = rank;
                prevTotal = t.total;
                prevWwcd = t.wwcd;
                prevPp = t.pp;
                prevPe = t.pe;
                prevLastPos = t.lastPosition;
                rankCounter = 1;
            } else {
                // Comparar con el anterior para decidir si mismo rank
                const prev = standings[index - 1];
                const prevT = prev.totals;
                // Comparar según criterios
                if (t.total === prevT.total &&
                    t.wwcd === prevT.wwcd &&
                    t.pp === prevT.pp &&
                    t.pe === prevT.pe &&
                    t.lastPosition === prevT.lastPosition) {
                    // Empate: mismo rank
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

    // ============================================================
    // 3. OBTENER DETALLE DE UN EQUIPO
    // ============================================================

    /**
     * Obtiene los detalles completos de un equipo por su ID.
     * @param {string} teamId - ID del equipo.
     * @param {Array<Object>} standings - Array de equipos con sus datos (resultado de buildStandings).
     * @returns {Object|null} Datos del equipo o null si no se encuentra.
     */
    function getTeamDetails(teamId, standings) {
        if (!teamId || !Array.isArray(standings)) return null;
        const found = standings.find(team => team.teamId === teamId);
        return found || null;
    }

    // ============================================================
    // 4. EXPOSICIÓN PÚBLICA
    // ============================================================

    return {
        extractTeamMatches: extractTeamMatches,
        buildStandings: buildStandings,
        getTeamDetails: getTeamDetails,
        getMatchNumbers: getMatchNumbers
    };

})();

// Verificación
if (window.Standings) {
    console.log('[Standings] Cargado correctamente.');
} else {
    console.error('[Standings] Error al inicializar.');
}