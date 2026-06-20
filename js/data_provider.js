/**
 * data_provider.js
 * Carga y transforma datos desde Google Sheets (formato CSV).
 * Expone window.DataProvider con métodos para cargar hojas y datos de competencias.
 * No usa librerías externas.
 */

window.DataProvider = (function() {
    'use strict';

    // ============================================================
    // 1. CACHÉ EN MEMORIA
    // ============================================================
    const cache = new Map();

    // ============================================================
    // 2. FUNCIONES AUXILIARES DE NORMALIZACIÓN DE ENCABEZADOS
    // ============================================================

    /**
     * Normaliza el nombre de un encabezado a un nombre canónico para ciertos campos,
     * manteniendo el resto sin cambios (recortando espacios).
     * @param {string} header - Encabezado original.
     * @param {number} index - Índice de la columna (para duplicados).
     * @param {Map} usedMap - Mapa de nombres ya usados para detectar duplicados.
     * @returns {string} Nombre normalizado.
     */
    function normalizeHeader(header, index, usedMap) {
        if (typeof header !== 'string') return header;
        const trimmed = header.trim();

        // Mapeo de patrones a nombres canónicos (incluye español)
        const patterns = [
            { regex: /^\s*team\s*id\s*$/i, canonical: 'teamId' },
            { regex: /^\s*team_id\s*$/i, canonical: 'teamId' },
            { regex: /^\s*teamid\s*$/i, canonical: 'teamId' },
            { regex: /^\s*player\s*id\s*$/i, canonical: 'playerId' },
            { regex: /^\s*player_id\s*$/i, canonical: 'playerId' },
            { regex: /^\s*playerid\s*$/i, canonical: 'playerId' },
            { regex: /^\s*team\s*name\s*$/i, canonical: 'teamName' },
            { regex: /^\s*team_name\s*$/i, canonical: 'teamName' },
            { regex: /^\s*teamname\s*$/i, canonical: 'teamName' },
            { regex: /^\s*player\s*name\s*$/i, canonical: 'playerName' },
            { regex: /^\s*player_name\s*$/i, canonical: 'playerName' },
            { regex: /^\s*playername\s*$/i, canonical: 'playerName' },
            { regex: /^\s*equipo\s*$/i, canonical: 'teamName' },
            { regex: /^\s*jugador\s*$/i, canonical: 'playerName' },
            { regex: /^\s*divisi[óo]n\s*$/i, canonical: 'division' },
            { regex: /^\s*estado\s*$/i, canonical: 'status' },
            { regex: /^\s*logo\s*$/i, canonical: 'logo' },
            { regex: /^\s*foto\s*$/i, canonical: 'photo' },
            { regex: /^\s*photo\s*$/i, canonical: 'photo' }
        ];

        let canonical = trimmed;
        for (const p of patterns) {
            if (p.regex.test(trimmed)) {
                canonical = p.canonical;
                break;
            }
        }

        // Detectar duplicados
        if (usedMap.has(canonical)) {
            const count = usedMap.get(canonical) + 1;
            usedMap.set(canonical, count);
            canonical = canonical + '_' + count;
        } else {
            usedMap.set(canonical, 1);
        }

        return canonical;
    }

    // ============================================================
    // 3. PARSEO DE CSV
    // ============================================================

    function parseCsv(csvText) {
        if (!csvText || typeof csvText !== 'string') {
            return [];
        }

        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.slice(1);
        }

        const lines = [];
        let currentLine = '';
        let insideQuotes = false;
        let i = 0;
        const len = csvText.length;

        while (i < len) {
            const char = csvText[i];
            if (char === '"') {
                if (insideQuotes && i + 1 < len && csvText[i + 1] === '"') {
                    currentLine += '"';
                    i += 2;
                    continue;
                }
                insideQuotes = !insideQuotes;
                currentLine += char;
                i++;
                continue;
            }

            if (char === '\n' && !insideQuotes) {
                lines.push(currentLine);
                currentLine = '';
                i++;
                continue;
            }

            if (char === '\r' && !insideQuotes) {
                i++;
                continue;
            }

            currentLine += char;
            i++;
        }

        if (currentLine.length > 0) {
            lines.push(currentLine);
        }

        const nonEmptyLines = lines.filter(line => line.trim().length > 0);
        if (nonEmptyLines.length === 0) {
            return [];
        }

        function parseLine(line) {
            const fields = [];
            let field = '';
            let inQuotes = false;
            let j = 0;
            const lineLen = line.length;

            while (j < lineLen) {
                const ch = line[j];
                if (ch === '"') {
                    if (inQuotes && j + 1 < lineLen && line[j + 1] === '"') {
                        field += '"';
                        j += 2;
                        continue;
                    }
                    inQuotes = !inQuotes;
                    j++;
                    continue;
                }
                if (ch === ',' && !inQuotes) {
                    fields.push(field);
                    field = '';
                    j++;
                    continue;
                }
                field += ch;
                j++;
            }
            fields.push(field);

            return fields.map(f => {
                let trimmed = f.trim();
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                    trimmed = trimmed.slice(1, -1);
                    trimmed = trimmed.replace(/""/g, '"');
                }
                return trimmed;
            });
        }

        const headerLine = nonEmptyLines[0];
        const headerFields = parseLine(headerLine);
        const usedMap = new Map();
        const headers = headerFields.map((h, idx) => normalizeHeader(h, idx, usedMap));

        const result = [];
        for (let r = 1; r < nonEmptyLines.length; r++) {
            const lineFields = parseLine(nonEmptyLines[r]);
            const obj = {};
            headers.forEach((header, idx) => {
                const value = (idx < lineFields.length) ? lineFields[idx] : '';
                obj[header] = value;
            });
            const hasValue = Object.values(obj).some(v => v !== '');
            if (hasValue) {
                result.push(obj);
            }
        }

        return result;
    }

    // ============================================================
    // 4. CARGA DE CSV DESDE URL CON CACHÉ Y TIMEOUT
    // ============================================================

    function loadCsv(url, forceRefresh = false) {
        if (!url || typeof url !== 'string') {
            return Promise.reject(new Error('URL inválida para loadCsv'));
        }

        const cacheKey = url;

        if (!forceRefresh && cache.has(cacheKey)) {
            console.debug(`[DataProvider] Cache hit para ${url}`);
            return Promise.resolve(cache.get(cacheKey));
        }

        console.debug(`[DataProvider] Fetching ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 15000); // 15 segundos

        return fetch(url, { signal: controller.signal })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`Error al descargar CSV: ${response.status} ${response.statusText}`);
                }
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('text/html')) {
                    throw new Error('Google Sheets devolvió una página HTML. Verifica que el documento sea público y que la pestaña exista.');
                }
                return response.text();
            })
            .then(text => {
                // Detectar si el contenido es HTML (por si el content-type no es fiable)
                const trimmed = text.trim();
                if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
                    throw new Error('Google Sheets devolvió una página HTML. Verifica que el documento sea público y que la pestaña exista.');
                }
                const data = parseCsv(text);
                cache.set(cacheKey, data);
                return data;
            })
            .catch(error => {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new Error('Tiempo de espera agotado al descargar los datos.');
                }
                throw error;
            });
    }

    // ============================================================
    // 5. CARGA DE HOJA DE GOOGLE SHEETS (con gviz/tq)
    // ============================================================

    function loadSheet(spreadsheetId, sheetName, forceRefresh = false) {
        if (!spreadsheetId || !sheetName) {
            return Promise.reject(new Error('spreadsheetId y sheetName son requeridos'));
        }

        const url =
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq` +
            `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

        return loadCsv(url, forceRefresh);
    }

    // ============================================================
    // 6. CARGA COMPLETA DE DATOS DE UNA COMPETENCIA (con fallback local)
    // ============================================================

    function loadCompetitionData(competitionId, monthId, forceRefresh = false) {
        const config = window.TOURNAMENT_CONFIG;
        if (!config) {
            return Promise.reject(new Error('TOURNAMENT_CONFIG no está disponible'));
        }

        const compConfig = config.getCompetitionConfig(competitionId);
        if (!compConfig) {
            return Promise.reject(new Error(`Competencia "${competitionId}" no encontrada`));
        }
        if (!compConfig.enabled) {
            return Promise.reject(new Error(`Competencia "${competitionId}" está deshabilitada`));
        }

        const monthConfig = config.getMonthConfig(monthId);
        if (!monthConfig) {
            return Promise.reject(new Error(`Mes "${monthId}" no encontrado`));
        }

        // Verificar si se debe usar el modo fallback
        const useFallback = config.site && config.site.useFallbackData === true;

        if (useFallback) {
            // Modo fallback: cargar archivos locales y filtrar por división
            const divisionNumber = competitionId.replace('div', ''); // "1", "2", ...
            const divisionLabel = 'DIV ' + divisionNumber; // "DIV 1", "DIV 2", ...

            return Promise.all([
                loadCsv('data/fallback/teams.csv', forceRefresh),
                loadCsv('data/fallback/players.csv', forceRefresh)
            ]).then(([teamsData, playersData]) => {
                // Filtrar por división
                const filteredTeams = teamsData.filter(row => {
                    const div = row.division || row.DIVISION || '';
                    return div.trim().toUpperCase() === divisionLabel;
                });

                const filteredPlayers = playersData.filter(row => {
                    const div = row.division || row.DIVISION || '';
                    return div.trim().toUpperCase() === divisionLabel;
                });

                // Devolver la misma estructura que Google Sheets
                return {
                    competition: compConfig,
                    month: monthConfig,
                    catalogs: {
                        teams: filteredTeams,
                        players: filteredPlayers
                    },
                    results: {
                        teams: filteredTeams,
                        players: filteredPlayers
                    }
                };
            });
        }

        // ============================================================
        // MODO NORMAL: Google Sheets
        // ============================================================

        const spreadsheetId = monthConfig.spreadsheetId;
        if (!spreadsheetId || spreadsheetId === 'REEMPLAZAR_ID_SHEET') {
            return Promise.reject(new Error(`El spreadsheetId para el mes "${monthId}" no está configurado`));
        }

        const sheets = compConfig.sheets;
        if (!sheets || !sheets.catalogTeams || !sheets.catalogPlayers || !sheets.teams || !sheets.players) {
            return Promise.reject(new Error(`Configuración de hojas incompleta para "${competitionId}"`));
        }

        const sheetNames = [
            { key: 'catalogTeams', name: sheets.catalogTeams },
            { key: 'catalogPlayers', name: sheets.catalogPlayers },
            { key: 'teams', name: sheets.teams },
            { key: 'players', name: sheets.players }
        ];

        const loadPromises = sheetNames.map(sheet => {
            return loadSheet(spreadsheetId, sheet.name, forceRefresh)
                .then(data => ({ key: sheet.key, data: data }))
                .catch(error => {
                    throw new Error(`Error al cargar la hoja "${sheet.name}": ${error.message}`);
                });
        });

        return Promise.all(loadPromises)
            .then(results => {
                const catalogTeams = results.find(r => r.key === 'catalogTeams')?.data || [];
                const catalogPlayers = results.find(r => r.key === 'catalogPlayers')?.data || [];
                const teamsResults = results.find(r => r.key === 'teams')?.data || [];
                const playersResults = results.find(r => r.key === 'players')?.data || [];

                // Validaciones básicas
                const hasTeamId = (row) => row.teamId && row.teamId.trim() !== '';
                const hasPlayerId = (row) => row.playerId && row.playerId.trim() !== '';
                const hasTeamName = (row) => row.teamName && row.teamName.trim() !== '';
                const hasPlayerName = (row) => row.playerName && row.playerName.trim() !== '';

                if (catalogTeams.length > 0 && !catalogTeams.some(hasTeamId)) {
                    console.warn('[DataProvider] Catálogo de equipos no contiene teamId identificable');
                }
                if (catalogPlayers.length > 0 && !catalogPlayers.some(hasPlayerId)) {
                    console.warn('[DataProvider] Catálogo de jugadores no contiene playerId identificable');
                }
                if (teamsResults.length > 0 && !teamsResults.some(row => hasTeamId(row) || hasTeamName(row))) {
                    console.warn('[DataProvider] Resultados de equipos no contienen teamId ni teamName identificable');
                }
                if (playersResults.length > 0 && !playersResults.some(row => hasPlayerId(row) || hasPlayerName(row))) {
                    console.warn('[DataProvider] Resultados de jugadores no contienen playerId ni playerName identificable');
                }

                return {
                    competition: compConfig,
                    month: monthConfig,
                    catalogs: {
                        teams: catalogTeams,
                        players: catalogPlayers
                    },
                    results: {
                        teams: teamsResults,
                        players: playersResults
                    }
                };
            });
    }

    // ============================================================
    // 7. LIMPIAR CACHÉ
    // ============================================================

    function clearCache() {
        cache.clear();
        console.debug('[DataProvider] Caché limpiada');
    }

    // ============================================================
    // 8. EXPOSICIÓN PÚBLICA
    // ============================================================

    return {
        loadCsv: loadCsv,
        loadSheet: loadSheet,
        loadCompetitionData: loadCompetitionData,
        clearCache: clearCache
    };

})();

if (window.DataProvider) {
    console.log('[DataProvider] Cargado correctamente.');
} else {
    console.error('[DataProvider] Error al inicializar.');
}