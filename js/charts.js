
window.TournamentCharts = (function() {
    'use strict';

    const chartInstances = new WeakMap();

    function destroyChart(canvas) {
        if (!canvas) return;
        const instance = chartInstances.get(canvas);
        if (instance) {
            instance.destroy();
            chartInstances.delete(canvas);
        }
    }

    function renderTeamProgress(canvas, team, options) {
        if (!canvas) {
            console.error('[TournamentCharts] Canvas no proporcionado.');
            return false;
        }

        destroyChart(canvas);

        if (typeof Chart === 'undefined') {
            console.error('[TournamentCharts] Chart.js no está disponible. Asegúrate de cargarlo desde CDN.');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '16px sans-serif';
                ctx.fillStyle = '#aeb6c5';
                ctx.textAlign = 'center';
                ctx.fillText('Chart.js no cargado', canvas.width / 2, canvas.height / 2);
            }
            return false;
        }

        if (!team || !Array.isArray(team.matches) || team.matches.length === 0) {
            console.warn('[TournamentCharts] El equipo no tiene partidas para graficar.');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '16px sans-serif';
                ctx.fillStyle = '#aeb6c5';
                ctx.textAlign = 'center';
                ctx.fillText('Sin datos para graficar', canvas.width / 2, canvas.height / 2);
            }
            return false;
        }

        const rootStyles = getComputedStyle(document.documentElement);
        const primaryColor = rootStyles.getPropertyValue('--division-primary').trim() || '#1e88e5';
        const secondaryColor = rootStyles.getPropertyValue('--division-secondary').trim() || '#42a5f5';
        const accentColor = rootStyles.getPropertyValue('--division-accent').trim() || '#90caf9';

        const sortedMatches = [...team.matches].sort((a, b) => a.matchNumber - b.matchNumber);

        const labels = sortedMatches.map(m => `M${m.matchNumber}`);
        const positions = sortedMatches.map(m => m.position);
        const eliminations = sortedMatches.map(m => m.eliminations || 0);

        let cumulative = 0;
        const cumulativePoints = sortedMatches.map(m => {
            let score = 0;
            if (typeof window.Scoring !== 'undefined' && window.Scoring.calculateMatchScore) {
                score = window.Scoring.calculateMatchScore(m.position, m.eliminations || 0);
            } else {
                if (window.Scoring) {
                    const pp = window.Scoring.getPlacementPoints ? window.Scoring.getPlacementPoints(m.position) : 0;
                    const pe = window.Scoring.getEliminationPoints ? window.Scoring.getEliminationPoints(m.eliminations || 0) : 0;
                    score = pp + pe;
                } else {
                    const pp = Math.max(0, 12 - m.position);
                    const pe = m.eliminations || 0;
                    score = pp + pe;
                }
            }
            cumulative += score;
            return cumulative;
        });

        const datasets = [];

        datasets.push({
            label: 'Posición por partida',
            data: positions,
            borderColor: primaryColor,
            backgroundColor: primaryColor + '33',
            yAxisID: 'y',
            tension: 0.1,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
        });

        datasets.push({
            label: 'Eliminaciones por partida',
            data: eliminations,
            borderColor: secondaryColor,
            backgroundColor: secondaryColor + '33',
            yAxisID: 'y1',
            tension: 0.1,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
        });

        datasets.push({
            label: 'Puntos acumulados',
            data: cumulativePoints,
            borderColor: accentColor,
            backgroundColor: accentColor + '33',
            yAxisID: 'y1',
            tension: 0.1,
            fill: false,
            borderDash: [5, 5],
            pointRadius: 4,
            pointHoverRadius: 6,
        });

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Posición',
                            color: '#ffffff'
                        },
                        reverse: true,
                        min: 0,
                        max: Math.max(...positions) + 2 || 10,
                        ticks: {
                            stepSize: 1,
                            color: '#aeb6c5'
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.05)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Eliminaciones / Puntos acum.',
                            color: '#ffffff'
                        },
                        min: 0,
                        ticks: {
                            color: '#aeb6c5'
                        },
                        grid: {
                            drawOnChartArea: false,
                        }
                    },
                    x: {
                        ticks: {
                            color: '#aeb6c5'
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.05)'
                        }
                    }
                }
            }
        });

        chartInstances.set(canvas, chart);

        return true;
    }


    return {
        renderTeamProgress: renderTeamProgress,
        destroyChart: destroyChart
    };

})();

if (window.TournamentCharts) {
    console.log('[TournamentCharts] Cargado correctamente.');
} else {
    console.error('[TournamentCharts] Error al inicializar.');
}
