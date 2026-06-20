/**
 * ui.js
 * Centraliza funciones compartidas de interfaz: menú responsive, navegación SPA, modal,
 * estados de carga/error/vacío, manejo de imágenes, formateo y escape.
 * Expone window.UI.
 */

window.UI = (function() {
    'use strict';

    // ============================================================
    // 1. VARIABLES PRIVADAS
    // ============================================================

    let previousFocus = null;        // Elemento que tenía foco antes de abrir modal
    let modalIsOpen = false;

    // ============================================================
    // 2. ESCAPE DE HTML (seguridad)
    // ============================================================

    /**
     * Escapa caracteres HTML para prevenir inyección.
     * @param {string} value - Texto a escapar.
     * @returns {string} Texto escapado.
     */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // ============================================================
    // 3. FORMATEO DE NÚMEROS
    // ============================================================

    /**
     * Formatea un número para mostrar (con separadores de miles si es entero).
     * @param {number|string} value - Número a formatear.
     * @returns {string} Número formateado.
     */
    function formatNumber(value) {
        if (value === null || value === undefined || value === '') return '0';
        const num = Number(value);
        if (isNaN(num)) return String(value);
        if (Number.isInteger(num)) {
            return num.toLocaleString('es');
        }
        return num.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }

    // ============================================================
    // 4. MANEJO DE IMÁGENES CON FALLBACK
    // ============================================================

    /**
     * Crea un elemento <img> con fallback en caso de error o src vacío.
     * @param {string} src - URL de la imagen.
     * @param {string} alt - Texto alternativo.
     * @param {string} fallback - URL de la imagen de respaldo.
     * @returns {HTMLImageElement} Elemento img configurado.
     */
    function createSafeImage(src, alt, fallback) {
        const img = document.createElement('img');
        img.alt = escapeHtml(alt) || 'Imagen';
        const fallbackSrc = fallback || 'assets/default-team.png';

        if (src && typeof src === 'string' && src.trim() !== '') {
            img.src = src;
        } else {
            img.src = fallbackSrc;
        }

        img.addEventListener('error', function onError() {
            if (img.src !== fallbackSrc) {
                img.src = fallbackSrc;
            } else {
                img.style.display = 'none';
            }
            img.removeEventListener('error', onError);
        });

        return img;
    }

    /**
     * Aplica fallback a una imagen existente.
     * @param {HTMLImageElement} img - Elemento img.
     * @param {string} fallback - URL de fallback.
     */
    function applyImageFallback(img, fallback) {
        if (!img || !(img instanceof HTMLImageElement)) return;
        const fallbackSrc = fallback || 'assets/default-team.png';

        if (!img.src || img.src === '' || img.src === window.location.href) {
            img.src = fallbackSrc;
        }

        img.addEventListener('error', function onError() {
            if (img.src !== fallbackSrc) {
                img.src = fallbackSrc;
            } else {
                img.style.display = 'none';
            }
            img.removeEventListener('error', onError);
        });
    }

    // ============================================================
    // 5. ESTADOS: LOADING, ERROR, EMPTY (legacy)
    // ============================================================

    /**
     * Muestra u oculta el estado de carga en un contenedor.
     * @param {HTMLElement|string} container - Elemento o selector del contenedor.
     * @param {boolean} visible - true para mostrar loading, false para ocultar.
     */
    function setLoading(container, visible) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;
        let loadingEl = el.querySelector('.loading-state');
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.className = 'loading-state';
            loadingEl.setAttribute('role', 'status');
            loadingEl.setAttribute('aria-live', 'polite');
            loadingEl.innerHTML = `
                <div class="spinner" aria-hidden="true"></div>
                <span>Cargando...</span>
            `;
            loadingEl.style.display = 'none';
            el.prepend(loadingEl);
        }

        if (visible) {
            loadingEl.style.display = 'flex';
            const errorEl = el.querySelector('.error-state');
            const emptyEl = el.querySelector('.empty-state');
            if (errorEl) errorEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'none';
        } else {
            loadingEl.style.display = 'none';
        }
    }

    /**
     * Muestra un mensaje de error en el contenedor (legacy).
     * @param {HTMLElement|string} container - Elemento o selector.
     * @param {string} message - Mensaje de error (será escapado).
     */
    function _showErrorLegacy(container, message) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;

        const loadingEl = el.querySelector('.loading-state');
        const emptyEl = el.querySelector('.empty-state');
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';

        let errorEl = el.querySelector('.error-state');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'error-state';
            errorEl.setAttribute('role', 'alert');
            errorEl.innerHTML = `
                <span class="error-icon" aria-hidden="true">⚠️</span>
                <strong></strong>
                <p></p>
            `;
            el.prepend(errorEl);
        }

        const strong = errorEl.querySelector('strong');
        const p = errorEl.querySelector('p');
        if (strong) strong.textContent = 'Error';
        if (p) p.textContent = escapeHtml(message || 'Ocurrió un error inesperado.');
        errorEl.style.display = 'flex';
    }

    /**
     * Muestra un mensaje de estado vacío en el contenedor (legacy).
     * @param {HTMLElement|string} container - Elemento o selector.
     * @param {string} message - Mensaje (será escapado).
     */
    function _showEmptyLegacy(container, message) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;

        const loadingEl = el.querySelector('.loading-state');
        const errorEl = el.querySelector('.error-state');
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';

        let emptyEl = el.querySelector('.empty-state');
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.innerHTML = `
                <span class="empty-icon" aria-hidden="true">📭</span>
                <strong></strong>
                <p></p>
            `;
            el.prepend(emptyEl);
        }

        const strong = emptyEl.querySelector('strong');
        const p = emptyEl.querySelector('p');
        if (strong) strong.textContent = 'Sin datos';
        if (p) p.textContent = escapeHtml(message || 'No hay información disponible.');
        emptyEl.style.display = 'flex';
    }

    // ============================================================
    // 6. FUNCIONES DE COMPATIBILIDAD PARA index_app.js
    // ============================================================

    /**
     * Inicializa componentes UI comunes: menú responsive y año en footer.
     */
    function init() {
        initResponsiveMenu();
        setCurrentYear();
    }

    /**
     * Configura el selector de meses usando TOURNAMENT_CONFIG.months.
     * @param {string} selectId - ID del elemento <select>.
     * @param {string} activeMonthId - ID del mes que debe quedar seleccionado.
     * @param {Function} onChange - Callback cuando cambia el mes.
     * @returns {string|null} El ID del mes activo (seleccionado o el pasado).
     */
    function setupMonthSelector(selectId, activeMonthId, onChange) {
        const select = document.getElementById(selectId);
        if (!select) return null;

        const config = window.TOURNAMENT_CONFIG;
        const months = config && config.months ? config.months : {};

        // Usamos populateMonthSelector (existente) para llenar el select
        populateMonthSelector(months, activeMonthId, onChange);

        // Devolver el valor seleccionado (puede ser el activeMonthId o el primero)
        return select.value || activeMonthId;
    }

    /**
     * Obtiene el mes actualmente seleccionado en el selector.
     * @param {string} selectId - ID del elemento <select>.
     * @returns {string|null} Valor del select o null.
     */
    function getActiveMonth(selectId) {
        const select = document.getElementById(selectId);
        return select ? select.value : null;
    }

    /**
     * Muestra el estado de carga identificado por stateId.
     * @param {string} containerId - ID del contenedor (no se usa, se mantiene por compatibilidad).
     * @param {string} stateId - ID del elemento de carga.
     */
    function showLoading(containerId, stateId) {
        // Ocultar todos los estados de error y vacío a nivel global
        document.querySelectorAll('.error-state').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.empty-state').forEach(el => el.style.display = 'none');

        // Mostrar el loading
        const el = document.getElementById(stateId);
        if (el) el.style.display = 'flex';
    }

    /**
     * Oculta el estado de carga identificado por stateId.
     * @param {string} containerId - ID del contenedor (no se usa).
     * @param {string} stateId - ID del elemento de carga.
     */
    function hideLoading(containerId, stateId) {
        const el = document.getElementById(stateId);
        if (el) el.style.display = 'none';
    }

    /**
     * Muestra un mensaje de error en el estado identificado por stateId.
     * @param {string} containerId - ID del contenedor (no se usa).
     * @param {string} stateId - ID del elemento de error.
     * @param {string} message - Mensaje de error.
     * @param {Function} retryFn - Función para reintentar (opcional).
     */
    function showError(containerId, stateId, message, retryFn) {
        // Si el segundo argumento es un ID de un elemento que es un estado de error,
        // usamos la nueva lógica; de lo contrario, legacy.
        const stateEl = document.getElementById(stateId);
        if (stateEl && stateEl.classList.contains('error-state')) {
            // Nuevo formato
            hideLoading(containerId, null);
            hideEmpty(containerId, null);
            const el = stateEl;
            const p = el.querySelector('p');
            if (p) p.textContent = message || 'Error';
            // Agregar botón retry si se proporciona
            if (retryFn) {
                let btn = el.querySelector('button');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.className = 'button button-primary';
                    el.appendChild(btn);
                }
                btn.textContent = 'Reintentar';
                btn.onclick = retryFn;
            }
            el.style.display = 'flex';
        } else {
            // Legacy: (container, message)
            _showErrorLegacy(containerId, stateId); // stateId es el mensaje aquí
        }
    }

    /**
     * Oculta el estado de error identificado por stateId.
     * @param {string} containerId - ID del contenedor (no se usa).
     * @param {string} stateId - ID del elemento de error.
     */
    function hideError(containerId, stateId) {
        const el = document.getElementById(stateId);
        if (el) el.style.display = 'none';
    }

    /**
     * Muestra un mensaje de estado vacío en el elemento identificado por stateId.
     * @param {string} containerId - ID del contenedor (no se usa).
     * @param {string} stateId - ID del elemento de vacío.
     * @param {string} message - Mensaje a mostrar.
     */
    function showEmpty(containerId, stateId, message) {
        const stateEl = document.getElementById(stateId);
        if (stateEl && stateEl.classList.contains('empty-state')) {
            hideLoading(containerId, null);
            hideError(containerId, null);
            const p = stateEl.querySelector('p');
            if (p) p.textContent = message || 'Sin datos';
            stateEl.style.display = 'flex';
        } else {
            // Legacy: (container, message)
            _showEmptyLegacy(containerId, stateId);
        }
    }

    /**
     * Oculta el estado vacío identificado por stateId.
     * @param {string} containerId - ID del contenedor (no se usa).
     * @param {string} stateId - ID del elemento de vacío.
     */
    function hideEmpty(containerId, stateId) {
        const el = document.getElementById(stateId);
        if (el) el.style.display = 'none';
    }

    // ============================================================
    // 7. MENÚ RESPONSIVE (HAMBURGUESA)
    // ============================================================

    function initResponsiveMenu() {
        const toggle = document.getElementById('menu-toggle');
        const menu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('menu-overlay');
        const closeBtn = document.getElementById('mobile-menu-close');

        if (!toggle || !menu || !overlay) {
            console.warn('[UI] Elementos del menú responsive no encontrados.');
            return;
        }

        function openMenu() {
            menu.classList.add('is-open');
            menu.setAttribute('aria-hidden', 'false');
            overlay.classList.add('is-visible');
            toggle.setAttribute('aria-expanded', 'true');
            document.body.classList.add('has-modal-open');
            previousFocus = document.activeElement;
            const firstLink = menu.querySelector('a, button');
            if (firstLink) setTimeout(() => firstLink.focus(), 50);
        }

        function closeMenu() {
            menu.classList.remove('is-open');
            menu.setAttribute('aria-hidden', 'true');
            overlay.classList.remove('is-visible');
            toggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('has-modal-open');
            if (previousFocus && previousFocus.focus) {
                setTimeout(() => previousFocus.focus(), 50);
            } else {
                toggle.focus();
            }
            previousFocus = null;
        }

        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            if (menu.classList.contains('is-open')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        overlay.addEventListener('click', function(e) {
            e.preventDefault();
            if (menu.classList.contains('is-open')) {
                closeMenu();
            }
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                closeMenu();
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && menu.classList.contains('is-open')) {
                closeMenu();
            }
        });

        menu.addEventListener('click', function(e) {
            const target = e.target.closest('a, button');
            if (target && target.closest('.mobile-menu')) {
                if (target.getAttribute('data-no-close') !== 'true') {
                    closeMenu();
                }
            }
        });
    }

    // ============================================================
    // 8. NAVEGACIÓN SPA
    // ============================================================

    function initSpaNavigation() {
        const buttons = document.querySelectorAll('[data-section]');
        if (buttons.length === 0) return;

        function showSection(sectionId) {
            if (!sectionId) return;

            const sections = document.querySelectorAll('.spa-section');
            sections.forEach(sec => {
                sec.classList.remove('is-active');
                sec.setAttribute('aria-hidden', 'true');
            });

            const target = document.getElementById(sectionId);
            if (target) {
                target.classList.add('is-active');
                target.setAttribute('aria-hidden', 'false');
            } else {
                console.warn('[UI] Sección no encontrada:', sectionId);
            }

            buttons.forEach(btn => {
                const btnSection = btn.getAttribute('data-section');
                const isActive = btnSection === sectionId;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                if (isActive) {
                    btn.setAttribute('aria-current', 'page');
                } else {
                    btn.removeAttribute('aria-current');
                }
            });
        }

        buttons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.getAttribute('data-section');
                if (sectionId) {
                    showSection(sectionId);
                }
            });

            const isActive = btn.classList.contains('is-active');
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            if (isActive) {
                btn.setAttribute('aria-current', 'page');
            }
        });

        const activeSection = document.querySelector('.spa-section.is-active');
        if (!activeSection) {
            const firstSection = document.querySelector('.spa-section');
            if (firstSection) {
                const id = firstSection.id;
                if (id) showSection(id);
            }
        } else {
            const activeId = activeSection.id;
            if (activeId) {
                buttons.forEach(btn => {
                    const isActive = btn.getAttribute('data-section') === activeId;
                    btn.classList.toggle('is-active', isActive);
                    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                    if (isActive) {
                        btn.setAttribute('aria-current', 'page');
                    } else {
                        btn.removeAttribute('aria-current');
                    }
                });
            }
        }

        window.UI.showSection = showSection;
    }

    // ============================================================
    // 9. MODAL
    // ============================================================

    function openModal(title, content) {
        const modal = document.getElementById('details-modal');
        const titleEl = document.getElementById('details-modal-title');
        const bodyEl = document.getElementById('details-modal-body');

        if (!modal || !titleEl || !bodyEl) {
            console.warn('[UI] Elementos del modal no encontrados.');
            return;
        }

        previousFocus = document.activeElement;

        // No escapar el título, solo convertir a string
        titleEl.textContent = String(title || 'Detalles');

        if (typeof content === 'string') {
            bodyEl.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            bodyEl.innerHTML = '';
            bodyEl.appendChild(content);
        } else {
            bodyEl.textContent = 'Contenido no disponible';
        }

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('has-modal-open');
        modalIsOpen = true;

        const focusable = modal.querySelector('button, a, input, select, textarea');
        if (focusable) {
            setTimeout(() => focusable.focus(), 50);
        } else {
            modal.focus();
        }

        setupModalClose();
    }

    function closeModal() {
        const modal = document.getElementById('details-modal');
        if (!modal) return;

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('has-modal-open');
        modalIsOpen = false;

        if (previousFocus && previousFocus.focus) {
            setTimeout(() => previousFocus.focus(), 50);
        }
        previousFocus = null;
    }

    function setupModalClose() {
        const modal = document.getElementById('details-modal');
        const backdrop = document.getElementById('details-modal-backdrop');
        const closeBtn = document.getElementById('details-modal-close');
        const closeFooter = document.getElementById('details-modal-close-footer');

        if (!modal) return;

        if (modal._closeListeners) {
            modal._closeListeners.forEach(({ el, event, handler }) => {
                el.removeEventListener(event, handler);
            });
        }
        modal._closeListeners = [];

        function handleClose(e) {
            if (e) e.preventDefault();
            closeModal();
        }

        if (backdrop) {
            const handler = function(e) {
                if (e.target === backdrop) {
                    handleClose(e);
                }
            };
            backdrop.addEventListener('click', handler);
            modal._closeListeners.push({ el: backdrop, event: 'click', handler: handler });
        }

        if (closeBtn) {
            const handler = function(e) { handleClose(e); };
            closeBtn.addEventListener('click', handler);
            modal._closeListeners.push({ el: closeBtn, event: 'click', handler: handler });
        }

        if (closeFooter) {
            const handler = function(e) { handleClose(e); };
            closeFooter.addEventListener('click', handler);
            modal._closeListeners.push({ el: closeFooter, event: 'click', handler: handler });
        }

        const escapeHandler = function(e) {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) {
                handleClose(e);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        modal._closeListeners.push({ el: document, event: 'keydown', handler: escapeHandler });
    }

    // ============================================================
    // 10. SELECTOR DE MESES (legacy)
    // ============================================================

    function populateMonthSelector(months, activeMonthId, onChange) {
        const select = document.getElementById('month-select');
        if (!select) {
            console.warn('[UI] Elemento #month-select no encontrado.');
            return;
        }

        select._onChange = onChange;

        select.innerHTML = '';

        if (!months || typeof months !== 'object' || Object.keys(months).length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Sin meses disponibles';
            select.appendChild(option);
            return;
        }

        const sortedKeys = Object.keys(months).sort();

        sortedKeys.forEach(key => {
            const month = months[key];
            const option = document.createElement('option');
            option.value = key;
            option.textContent = month.name || key;
            if (key === activeMonthId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        if (select._listener) {
            select.removeEventListener('change', select._listener);
        }
        const listener = function(e) {
            const newValue = this.value;
            if (typeof onChange === 'function') {
                onChange(newValue);
            }
        };
        select.addEventListener('change', listener);
        select._listener = listener;
    }

    // ============================================================
    // 11. AÑO DINÁMICO EN FOOTER
    // ============================================================

    function setCurrentYear() {
        const yearEl = document.getElementById('footer-year');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
    }

    // ============================================================
    // 12. EXPOSICIÓN PÚBLICA
    // ============================================================

    let publicShowSection = function(sectionId) {
        console.warn('[UI] showSection no inicializado aún.');
    };

    const ui = {
        // Funciones existentes (legacy)
        initResponsiveMenu: initResponsiveMenu,
        initSpaNavigation: function() {
            initSpaNavigation();
            publicShowSection = window.UI.showSection || function(id) {
                const sections = document.querySelectorAll('.spa-section');
                sections.forEach(sec => sec.classList.remove('is-active'));
                const target = document.getElementById(id);
                if (target) target.classList.add('is-active');
            };
        },
        showSection: function(sectionId) {
            if (typeof publicShowSection === 'function') {
                publicShowSection(sectionId);
            } else {
                const sections = document.querySelectorAll('.spa-section');
                sections.forEach(sec => sec.classList.remove('is-active'));
                const target = document.getElementById(sectionId);
                if (target) target.classList.add('is-active');
            }
        },
        openModal: openModal,
        closeModal: closeModal,
        setLoading: setLoading,
        showError: showError,         // polimórfica
        showEmpty: showEmpty,         // polimórfica
        createSafeImage: createSafeImage,
        applyImageFallback: applyImageFallback,
        formatNumber: formatNumber,
        escapeHtml: escapeHtml,
        setCurrentYear: setCurrentYear,
        populateMonthSelector: populateMonthSelector,

        // Nuevas funciones de compatibilidad para index_app.js
        init: init,
        setupMonthSelector: setupMonthSelector,
        getActiveMonth: getActiveMonth,
        showLoading: showLoading,
        hideLoading: hideLoading,
        hideError: hideError,
        hideEmpty: hideEmpty
    };

    window.UI = ui;

    console.log('[UI] Cargado correctamente.');
    return ui;

})();