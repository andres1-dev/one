/**
 * DecompositionTreeView — Árbol de Descomposición estilo Power BI (2026 Edition)
 *
 * Características inspiradas 1:1 en Microsoft Power BI Decomposition Tree:
 *  • Layout horizontal izquierda → derecha con canvas interactivo y scroll suave.
 *  • Conectores SVG curvos (Cubic Bezier) de precisión entre nodos padre e hijos.
 *  • Línea activa resaltada con glow y color de dimensión; líneas hermanas sutiles.
 *  • Barra de progreso proporcional en cada tarjeta indicando % del total o del nodo padre.
 *  • Menú flotante Power BI (+):
 *      💡 Valor más alto (AI Driver: identifica la dimensión con mayor volumen)
 *      💡 Valor más bajo (AI Bottleneck: identifica menor volumen)
 *      Listado de dimensiones disponibles (Cliente, Productora, Género, Prenda, Clase, etc.)
 *  • Selector dinámico de métricas (Unidades, Por separar, Facturado, Discrepancias, Registros).
 *  • Barra de ruta interactiva (Breadcrumbs) para navegar directamente a cualquier nivel.
 *  • Ordenamiento dinámico (Mayor a menor, Menor a mayor, Alfabético) y búsqueda rápida por columna.
 *  • Botón "Auto-desglose inteligente" para desplegar los mayores causantes con 1 clic.
 */

export class DecompositionTreeView {
  constructor({ containerId = "decompTree", sectionId = "decompSection" } = {}) {
    this.container = document.getElementById(containerId);
    this.section = document.getElementById(sectionId);
    this._rows = [];
    this._metric = "cantidad"; // 'cantidad' | 'porSeparar' | 'facturado' | 'discrepancias' | 'registros'
    this._levels = []; // Array<{ dimension: string, selectedValue: string|null, sortOrder: 'desc'|'asc'|'alpha', search: string }>
    this._popover = null; // { levelIndex: number, anchorEl: HTMLElement }
    this._isFullscreen = false;

    // Catálogo de Dimensiones — Embudo operacional lógico:
    // Productora → Estado Separación → Estado Factura → Cliente → Prenda → Género → Clase
    this._dimensions = [
      {
        key: "productora",
        label: "Productora",
        icon: "fa-industry",
        accent: "#059669",
        accentLight: "#34d399",
        pastelBg: "rgba(236, 253, 245, 0.85)",
        pastelBorder: "rgba(167, 243, 208, 0.95)",
        shadow: "rgba(5, 150, 105, 0.16)",
        hint: "¿Quién fabricó?"
      },
      {
        key: "estado_separacion",
        label: "Separación",
        icon: "fa-boxes-stacked",
        accent: "#0284c7",
        accentLight: "#38bdf8",
        pastelBg: "rgba(240, 249, 255, 0.85)",
        pastelBorder: "rgba(186, 230, 253, 0.95)",
        shadow: "rgba(2, 132, 199, 0.16)",
        hint: "¿Está separado físicamente?"
      },
      {
        key: "estado_factura",
        label: "Factura",
        icon: "fa-file-invoice-dollar",
        accent: "#e11d48",
        accentLight: "#fb7185",
        pastelBg: "rgba(255, 241, 242, 0.85)",
        pastelBorder: "rgba(254, 205, 211, 0.95)",
        shadow: "rgba(225, 29, 72, 0.16)",
        hint: "¿Tiene factura aprobada en SIESA?"
      },
      {
        key: "cliente",
        label: "Cliente",
        icon: "fa-user-tie",
        accent: "#4f46e5",
        accentLight: "#818cf8",
        pastelBg: "rgba(238, 242, 255, 0.85)",
        pastelBorder: "rgba(199, 210, 254, 0.95)",
        shadow: "rgba(79, 70, 229, 0.16)",
        hint: "¿A quién se le vende?"
      },
      {
        key: "prenda",
        label: "Prenda",
        icon: "fa-shirt",
        accent: "#ea580c",
        accentLight: "#fb923c",
        pastelBg: "rgba(255, 247, 237, 0.85)",
        pastelBorder: "rgba(254, 215, 170, 0.95)",
        shadow: "rgba(234, 88, 12, 0.16)",
        hint: "Tipo de prenda"
      },
      {
        key: "genero",
        label: "Género",
        icon: "fa-venus-mars",
        accent: "#9333ea",
        accentLight: "#c084fc",
        pastelBg: "rgba(250, 245, 255, 0.85)",
        pastelBorder: "rgba(233, 213, 255, 0.95)",
        shadow: "rgba(147, 51, 234, 0.16)",
        hint: "Segmento de género"
      },
      {
        key: "clase",
        label: "Clase",
        icon: "fa-tag",
        accent: "#0891b2",
        accentLight: "#22d3ee",
        pastelBg: "rgba(236, 254, 255, 0.85)",
        pastelBorder: "rgba(165, 243, 252, 0.95)",
        shadow: "rgba(8, 145, 178, 0.16)",
        hint: "Clasificación de artículo"
      }
    ];

    // Embudo lógico: secuencia recomendada de expansión automática
    this._funnelOrder = ["productora", "estado_separacion", "estado_factura", "cliente", "prenda", "genero", "clase"];

    // Catálogo de Métricas
    this._metrics = {
      cantidad: {
        label: "Unidades",
        icon: "fa-cubes",
        hint: "Total de unidades físicas",
        calc: rows => rows.reduce((s, r) => s + (Number(r.cantidad) || 0), 0)
      },
      porSeparar: {
        label: "Por Separar",
        icon: "fa-boxes-stacked",
        hint: "Prendas pendientes de separación",
        calc: rows => rows.reduce((s, r) => s + (r.estado_separacion !== "FINALIZADO" ? (Number(r.cantidad) || 0) : 0), 0)
      },
      facturado: {
        label: "Facturado",
        icon: "fa-file-invoice-dollar",
        hint: "Prendas con factura aprobada",
        calc: rows => rows.reduce((s, r) => s + (r.estado_factura === "Aprobadas" ? (Number(r.cantidad) || 0) : 0), 0)
      },
      discrepancias: {
        label: "Discrepancias",
        icon: "fa-triangle-exclamation",
        hint: "Prendas con alerta de cantidad",
        calc: rows => rows.reduce((s, r) => s + (r.alerta_cantidad ? (Number(r.cantidad) || 0) : 0), 0)
      },
      registros: {
        label: "Registros",
        icon: "fa-hashtag",
        hint: "Conteo de filas u órdenes",
        calc: rows => rows.length
      }
    };

    // Bind de eventos globales
    this._onWindowResize = () => this._drawLines();
    window.addEventListener("resize", this._onWindowResize);

    // Salir de pantalla completa con tecla Escape
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && this._isFullscreen) {
        this._toggleFullscreen();
      }
    });

    // Cerrar popover al hacer clic afuera
    document.addEventListener("click", e => {
      if (this._popover && !e.target.closest(".pbi-popover") && !e.target.closest(".pbi-split-trigger")) {
        this._closePopover();
      }
    });
  }

  // ── API Pública ────────────────────────────────────────────────────────────

  render(rows = []) {
    this._rows = Array.isArray(rows) ? rows : [];
    this._levels = [];
    this._closePopover();

    if (!this._rows.length) {
      if (this.section) this.section.hidden = true;
      if (this.container) {
        this.container.innerHTML = `
          <div class="pbi-empty-state">
            <i class="fa-solid fa-sitemap"></i>
            <h3>Sin datos para descomponer</h3>
            <p>Realiza una consulta para explorar las dimensiones operativas en el árbol dinámico.</p>
          </div>
        `;
      }
      return;
    }

    // Inicializar desglose inicial inteligente si no hay niveles
    this._autoInitLevels();
    this._paint();
  }

  onResize() {
    this._drawLines();
    this._animateBars();
  }

  // Inicializa automáticamente el embudo operacional:
  // Productora → Estado Separación → Estado Factura
  _autoInitLevels() {
    if (this._levels.length > 0 || !this._rows.length) return;

    // Nivel 1: Productora (mayor volumen primero)
    const prodGroups = this._groupAndSum(this._rows, "productora");
    const topProd = prodGroups[0]?.val || null;
    this._levels.push({
      dimension: "productora",
      selectedValue: topProd,
      sortOrder: "desc",
      search: ""
    });

    // Nivel 2: Estado de Separación (estado físico en bodega)
    if (topProd) {
      const subRows1 = this._rows.filter(r => String(r.productora ?? "") === topProd);
      const sepGroups = this._groupAndSum(subRows1, "estado_separacion");
      if (sepGroups.length > 0) {
        const topSep = sepGroups[0]?.val || null;
        this._levels.push({
          dimension: "estado_separacion",
          selectedValue: topSep,
          sortOrder: "desc",
          search: ""
        });

        // Nivel 3: Estado de Factura (estado administrativo SIESA)
        if (topSep) {
          const subRows2 = subRows1.filter(r => String(r.estado_separacion ?? "") === topSep);
          const factGroups = this._groupAndSum(subRows2, "estado_factura");
          if (factGroups.length > 0) {
            this._levels.push({
              dimension: "estado_factura",
              selectedValue: factGroups[0]?.val || null,
              sortOrder: "desc",
              search: ""
            });
          }
        }
      }
    }
  }

  // ── Render Principal ───────────────────────────────────────────────────────

  _paint({ autoScrollToEnd = false, preserveScroll = false } = {}) {
    if (!this.container) return;

    const prevWrapper = document.getElementById("pbiCanvasWrapper");
    const prevScrollLeft = prevWrapper ? prevWrapper.scrollLeft : 0;

    const grandTotal = this._computeMetric(this._rows);

    let html = `
      <div class="pbi-tree-container ${this._isFullscreen ? 'is-fullscreen' : ''}">
        ${this._renderToolbar()}
        
        <div class="pbi-canvas-wrapper" id="pbiCanvasWrapper">
          <div class="pbi-canvas" id="pbiCanvas">
            <svg class="pbi-svg" id="pbiSvg" aria-hidden="true"></svg>
            ${this._renderRootCol(grandTotal)}
            ${this._levels.map((lvl, idx) => this._renderLevelCol(lvl, idx)).join("")}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this._bindEvents();

    requestAnimationFrame(() => {
      this._drawLines();
      this._animateBars();

      requestAnimationFrame(() => {
        this._drawLines();

        const wrapper = document.getElementById("pbiCanvasWrapper");
        if (wrapper) {
          if (autoScrollToEnd) {
            wrapper.scrollTo({ left: wrapper.scrollWidth, behavior: "smooth" });
          } else if (preserveScroll) {
            wrapper.scrollLeft = prevScrollLeft;
          }
        }
      });
    });

    // Reaseguro adicional a 60ms y 250ms (fin de scroll suave) para garantizar que todas las curvas se tracen
    setTimeout(() => this._drawLines(), 60);
    setTimeout(() => this._drawLines(), 280);
  }

  // ── Barra de Herramientas ───────────────────────────────────────────────────

  _renderToolbar() {
    const curMetric = this._metric;
    return `
      <div class="pbi-toolbar">
        <div class="pbi-toolbar__left">
          <span class="pbi-toolbar__label"><i class="fa-solid fa-calculator"></i> Analizar Métrica:</span>
          <div class="pbi-metric-group">
            ${Object.entries(this._metrics).map(([key, info]) => `
              <button type="button" class="pbi-metric-btn ${curMetric === key ? "is-active" : ""}"
                      data-action="change-metric" data-metric="${key}" title="${info.hint}">
                <i class="fa-solid ${info.icon}"></i> ${info.label}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="pbi-toolbar__right">
          <button type="button" class="pbi-btn-action pbi-btn-action--ai" data-action="auto-expand"
                  title="Desplegar automáticamente los factores de mayor volumen">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Desglose IA
          </button>
          <button type="button" class="pbi-btn-action" data-action="reset-tree"
                  title="Restablecer árbol al nodo raíz">
            <i class="fa-solid fa-rotate-left"></i> Restablecer
          </button>
          <button type="button" class="pbi-btn-action ${this._isFullscreen ? 'pbi-btn-action--active' : ''}" data-action="toggle-fullscreen"
                  title="${this._isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Expandir árbol a pantalla completa'}">
            <i class="fa-solid ${this._isFullscreen ? 'fa-compress' : 'fa-expand'}"></i> ${this._isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}
          </button>
        </div>
      </div>
    `;
  }

  // ── Columna Raíz (Total) ───────────────────────────────────────────────────

  _renderRootCol(grandTotal) {
    const metricInfo = this._metrics[this._metric];
    const isRootExpanded = this._levels.length > 0;

    return `
      <div class="pbi-col pbi-col--root" id="pbiColRoot"
           style="--dim-accent:#2563eb;--dim-accent-light:#60a5fa;--dim-bg:rgba(239, 246, 255, 0.85);--dim-border:rgba(191, 219, 254, 0.95);--dim-shadow:rgba(37, 99, 235, 0.16);">
        <div class="pbi-col__header">
          <span class="pbi-col__badge">
            <i class="fa-solid fa-chart-simple"></i> Análisis
          </span>
          <span class="pbi-col__count">Raíz</span>
        </div>
        <div class="pbi-col__body" style="overflow:visible;">
          <div class="pbi-root-node" id="pbiNodeRoot">
            <div class="pbi-root-node__header">
              <span class="pbi-root-node__tag">${metricInfo.label}</span>
              <i class="fa-solid ${metricInfo.icon}" style="color:#2563eb;font-size:14px;"></i>
            </div>
            <div class="pbi-root-node__val">${this._fmt(grandTotal)}</div>
            <div class="pbi-root-node__label">${metricInfo.hint}</div>
            <div class="pbi-root-node__track">
              <div class="pbi-root-node__bar"></div>
            </div>
            <button type="button" class="pbi-split-trigger ${isRootExpanded ? "is-expanded" : ""}"
                    id="pbiSplitBtnRoot" data-action="toggle-split" data-step="-1"
                    title="${isRootExpanded ? "Modificar desglose" : "Agregar desglose"}">
              <i class="fa-solid ${isRootExpanded ? "fa-minus" : "fa-plus"}"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Columna de Desglose por Dimensión ──────────────────────────────────────

  _renderLevelCol(lvl, stepIdx) {
    const dim = this._dimInfo(lvl.dimension);
    const parentRows = this._rowsUpTo(stepIdx);
    const parentTotal = this._computeMetric(parentRows);

    // Obtener grupos ordenados
    let groups = this._groupAndSum(parentRows, lvl.dimension);

    // Aplicar orden
    if (lvl.sortOrder === "asc") {
      groups.sort((a, b) => a.sum - b.sum);
    } else if (lvl.sortOrder === "alpha") {
      groups.sort((a, b) => String(a.val).localeCompare(String(b.val)));
    } else {
      groups.sort((a, b) => b.sum - a.sum);
    }

    // Filtro de búsqueda interno si aplica
    const searchFilter = (lvl.search || "").trim().toLowerCase();
    const filteredGroups = searchFilter
      ? groups.filter(g => String(g.val).toLowerCase().includes(searchFilter))
      : groups;

    const maxValInCol = groups[0]?.sum || 1;
    const hasNextLevel = stepIdx < this._levels.length - 1;

    return `
      <div class="pbi-col" id="pbiCol_${stepIdx}" data-step="${stepIdx}"
           style="--dim-accent:${dim.accent};--dim-accent-light:${dim.accentLight};--dim-bg:${dim.pastelBg};--dim-border:${dim.pastelBorder};--dim-shadow:${dim.shadow};">
        <div class="pbi-col__header">
          <span class="pbi-col__badge" style="color:${dim.accent};">
            <i class="fa-solid ${dim.icon}" style="color:${dim.accent};"></i> ${dim.label}
            <span class="pbi-col__count">${groups.length}</span>
          </span>
          <div class="pbi-col__actions">
            <button type="button" class="pbi-col__btn" data-action="cycle-sort" data-step="${stepIdx}"
                    title="Alternar orden (${lvl.sortOrder === "desc" ? "Mayor a menor" : lvl.sortOrder === "asc" ? "Menor a mayor" : "A-Z"})">
              <i class="fa-solid ${lvl.sortOrder === "desc" ? "fa-arrow-down-wide-short" : lvl.sortOrder === "asc" ? "fa-arrow-up-short-wide" : "fa-arrow-down-a-z"}"></i>
            </button>
            <button type="button" class="pbi-col__btn pbi-col__btn--close" data-action="remove-level" data-step="${stepIdx}"
                    title="Cerrar nivel ${dim.label}">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        ${groups.length > 5 ? `
          <div class="pbi-col__search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" placeholder="Filtrar ${dim.label}..."
                   data-action="search-level" data-step="${stepIdx}" value="${this._esc(lvl.search || "")}">
          </div>
        ` : ""}

        <div class="pbi-col__body" id="pbiBody_${stepIdx}">
          ${filteredGroups.map((item, nodeIdx) => {
            const isSelected = lvl.selectedValue === item.val;
            const pctOfParent = parentTotal > 0 ? (item.sum / parentTotal * 100) : 0;
            const barWidthPct = maxValInCol > 0 ? Math.max(3, Math.round(item.sum / maxValInCol * 100)) : 0;
            const nodeId = `pbiNode_${stepIdx}_${nodeIdx}`;
            const metricInfo = this._metrics[this._metric];
            const { labelHtml, badgeHtml } = this._formatNodeLabel(lvl.dimension, item.val, item.count);

            return `
              <div class="pbi-node ${isSelected ? "is-selected" : ""}"
                   id="${nodeId}"
                   data-action="select-node"
                   data-step="${stepIdx}"
                   data-val="${this._esc(item.val)}"
                   role="button" tabindex="0"
                   title="${this._esc(item.val)}">
                
                <div class="pbi-node__header">
                  <span class="pbi-node__label">${labelHtml}</span>
                  ${badgeHtml ? `<span class="pbi-node__badge">${badgeHtml}</span>` : ""}
                </div>

                <div class="pbi-node__body">
                  <div class="pbi-node__metrics">
                    <span class="pbi-node__val">${this._fmt(item.sum)}</span>
                    <span class="pbi-node__unit">${metricInfo.label.toLowerCase()}</span>
                    <span class="pbi-node__pct">${pctOfParent.toFixed(1)}%</span>
                  </div>
                  <div class="pbi-node__track">
                    <div class="pbi-node__bar-fill" style="width:0%;--bw:${barWidthPct}%;"></div>
                  </div>
                </div>

                <!-- Botón Power BI de Desglose (+) en el borde derecho -->
                <button type="button" class="pbi-split-trigger ${isSelected && hasNextLevel ? "is-expanded" : ""}"
                        data-action="node-split-trigger"
                        data-step="${stepIdx}"
                        data-val="${this._esc(item.val)}"
                        title="${isSelected && hasNextLevel ? "Modificar siguiente nivel" : "Desglosar por..."}">
                  <i class="fa-solid ${isSelected && hasNextLevel ? "fa-minus" : "fa-plus"}"></i>
                </button>
              </div>
            `;
          }).join("")}

          ${filteredGroups.length === 0 ? `
            <div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px;">
              Sin coincidencias
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  // ── Formato semántico de etiquetas por dimensión ───────────────────────────

  _formatNodeLabel(dimensionKey, rawVal, count) {
    const val = rawVal || "(sin valor)";
    return {
      labelHtml: this._esc(val),
      badgeHtml: ""
    };
  }

  // ── Dibujar Conectores SVG (Cubic Bezier - Estilo Ejecutivo Power BI Pastel) ──────

  _drawLines() {
    const svg = document.getElementById("pbiSvg");
    const canvas = document.getElementById("pbiCanvas");
    if (!svg || !canvas) return;

    // Ajustar el SVG al tamaño completo del canvas
    const scrollWidth = Math.max(canvas.scrollWidth, canvas.offsetWidth);
    const scrollHeight = Math.max(canvas.scrollHeight, canvas.offsetHeight);
    svg.setAttribute("width", scrollWidth);
    svg.setAttribute("height", scrollHeight);
    svg.style.width = scrollWidth + "px";
    svg.style.height = scrollHeight + "px";

    const cRect = canvas.getBoundingClientRect();
    
    // Gradientes y filtros por dimensión
    let paths = `
      <defs>
        <linearGradient id="pbiGrad_root" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2563eb" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.95" />
        </linearGradient>
    `;

    this._dimensions.forEach(d => {
      paths += `
        <linearGradient id="pbiGrad_${d.key}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${d.accent}" stop-opacity="0.9" />
          <stop offset="100%" stop-color="${d.accentLight}" stop-opacity="0.95" />
        </linearGradient>
      `;
    });

    paths += `</defs>`;

    // Función auxiliar para trazar Bezier conectada exactamente al botón (+) / (-) del padre
    const drawBranch = (parentEl, childNodes, activeValue, targetDim) => {
      if (!parentEl || !childNodes.length) return;

      const triggerBtn = parentEl.querySelector(".pbi-split-trigger");
      let px, py;
      if (triggerBtn) {
        const tRect = triggerBtn.getBoundingClientRect();
        px = (tRect.left + tRect.right) / 2 - cRect.left;
        py = (tRect.top + tRect.bottom) / 2 - cRect.top;
      } else {
        const pRect = parentEl.getBoundingClientRect();
        px = pRect.right - cRect.left;
        py = (pRect.top + pRect.bottom) / 2 - cRect.top;
      }

      const dimKey = targetDim?.key || "root";
      const dimAccent = targetDim?.accent || "#059669";

      childNodes.forEach(child => {
        const chRect = child.getBoundingClientRect();
        if (chRect.width === 0 || chRect.height === 0) return;
        const cx = chRect.left - cRect.left;
        const cy = (chRect.top + chRect.bottom) / 2 - cRect.top;
        const mx = px + (cx - px) * 0.5;

        const isChildActive = child.classList.contains("is-selected") ||
          (activeValue != null && String(child.dataset.val ?? "").trim() === String(activeValue).trim());

        // Color garantizado: sólido y contrastante para nunca depender de fallo de gradiente
        const strokeColor = isChildActive ? dimAccent : "#94a3b8";
        const strokeWidth = isChildActive ? "2.4" : "1.2";
        const cssClass = isChildActive ? "pbi-line is-active" : "pbi-line";
        const childVal = child.dataset.val || "";

        paths += `
          <path d="M ${px.toFixed(1)} ${py.toFixed(1)} C ${mx.toFixed(1)} ${py.toFixed(1)}, ${mx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}"
                class="${cssClass}"
                stroke="${strokeColor}"
                stroke-width="${strokeWidth}"
                data-target-val="${this._esc(childVal)}"
                data-dim="${dimKey}"
                data-accent="${dimAccent}" />
        `;
      });
    };

    // 1. Conexión garantizada: Root → Nivel 0
    if (this._levels.length > 0) {
      const rootNode = document.getElementById("pbiNodeRoot");
      const col0 = document.getElementById("pbiBody_0");
      const childNodes0 = col0 ? [...col0.querySelectorAll(".pbi-node")] : [];
      if (rootNode && childNodes0.length) {
        const dim0 = this._dimInfo(this._levels[0].dimension);
        drawBranch(rootNode, childNodes0, this._levels[0].selectedValue, dim0);
      }
    }

    // 2. Conexión garantizada: Nivel N → Nivel N+1
    for (let i = 0; i < this._levels.length - 1; i++) {
      const curLvl = this._levels[i];
      const parentBody = document.getElementById(`pbiBody_${i}`);
      const nextBody = document.getElementById(`pbiBody_${i + 1}`);
      const nextNodes = nextBody ? [...nextBody.querySelectorAll(".pbi-node")] : [];
      const nextDim = this._dimInfo(this._levels[i + 1].dimension);

      if (!parentBody || !nextNodes.length) continue;

      // Buscar nodo padre de forma 100% robusta sin selector escaping bugs:
      // 1) Primero el que tenga la clase .is-selected
      let parentNode = parentBody.querySelector(".pbi-node.is-selected");
      // 2) Si no, buscar por valor exacto mediante JS puro (dataset.val)
      if (!parentNode && curLvl?.selectedValue) {
        const colNodes = [...parentBody.querySelectorAll(".pbi-node")];
        parentNode = colNodes.find(n => n.dataset.val === curLvl.selectedValue);
      }
      // 3) Fallback: primer nodo disponible en la columna para garantizar la línea
      if (!parentNode) {
        parentNode = parentBody.querySelector(".pbi-node");
      }

      if (parentNode) {
        drawBranch(parentNode, nextNodes, this._levels[i + 1].selectedValue, nextDim);
      }
    }

    svg.innerHTML = paths;
  }

  _animateBars() {
    if (!this.container) return;
    this.container.querySelectorAll(".pbi-node__bar-fill").forEach(bar => {
      bar.style.width = bar.style.getPropertyValue("--bw") || "0%";
    });
  }

  // ── Menú Popover de Desglose (Power BI Split Popover) ──────────────────────

  _showSplitPopover(stepIdx, triggerBtn) {
    this._closePopover();

    const parentRows = stepIdx === -1 ? this._rows : this._rowsUpTo(stepIdx + 1);
    const usedDims = new Set(this._levels.slice(0, stepIdx + 1).map(l => l.dimension));
    const availDims = this._dimensions.filter(d => !usedDims.has(d.key));

    if (!availDims.length) return;

    // Calcular análisis de IA (High value & Low value)
    const aiHigh = this._findAiBestDimension(parentRows, "high", usedDims);
    const aiLow  = this._findAiBestDimension(parentRows, "low", usedDims);

    const popover = document.createElement("div");
    popover.className = "pbi-popover";
    popover.id = "pbiActivePopover";

    popover.innerHTML = `
      <div class="pbi-popover__header">
        <span class="pbi-popover__title"><i class="fa-solid fa-sitemap"></i> Desglosar por</span>
        <button type="button" class="pbi-popover__close" id="pbiPopoverClose">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      ${this._renderPopoverAiSection(stepIdx, parentRows, availDims, aiHigh, aiLow)}
    `;

    document.body.appendChild(popover);

    // Posicionamiento inteligente
    const tRect = triggerBtn.getBoundingClientRect();
    const pWidth = 250;
    let top = tRect.top + window.scrollY - 10;
    let left = tRect.right + window.scrollX + 8;

    // Si desborda por la derecha, colocar hacia la izquierda
    if (left + pWidth > window.innerWidth - 10) {
      left = tRect.left + window.scrollX - pWidth - 8;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    // Eventos del popover
    popover.querySelector("#pbiPopoverClose")?.addEventListener("click", () => this._closePopover());
    popover.querySelectorAll("[data-action='choose-dim']").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetStep = parseInt(btn.dataset.step, 10);
        const chosenDim = btn.dataset.dim;
        this._applyDimensionSplit(targetStep, chosenDim);
        this._closePopover();
      });
    });

    this._popover = popover;
  }

  _closePopover() {
    if (this._popover) {
      this._popover.remove();
      this._popover = null;
    }
  }

  _applyDimensionSplit(stepIdx, dimensionKey) {
    // Truncar niveles a partir de stepIdx + 1
    this._levels = this._levels.slice(0, stepIdx + 1);

    // Obtener los datos disponibles para este nuevo nivel
    const rowsForNext = this._rowsUpTo(this._levels.length);
    const groups = this._groupAndSum(rowsForNext, dimensionKey);
    const defaultTop = groups[0]?.val || null;

    // Agregar el nuevo nivel
    this._levels.push({
      dimension: dimensionKey,
      selectedValue: defaultTop,
      sortOrder: "desc",
      search: ""
    });

    this._paint({ autoScrollToEnd: true });
  }

  // ── IA: Cálculo de Mejor Dimensión (High / Low Value) ──────────────────────

  _findAiBestDimension(rows, mode = "high", excludeKeys = new Set()) {
    const candidates = this._dimensions.filter(d => !excludeKeys.has(d.key));
    if (!candidates.length) return null;

    let bestDim = null;
    let extremeSum = mode === "high" ? -Infinity : Infinity;
    let bestTopVal = "";

    candidates.forEach(dim => {
      const groups = this._groupAndSum(rows, dim.key);
      if (!groups.length) return;

      const topGroup = groups[0]; // Ya ordenado de mayor a menor
      if (mode === "high") {
        if (topGroup.sum > extremeSum) {
          extremeSum = topGroup.sum;
          bestDim = dim;
          bestTopVal = topGroup.val;
        }
      } else {
        const bottomGroup = groups[groups.length - 1];
        if (bottomGroup.sum < extremeSum) {
          extremeSum = bottomGroup.sum;
          bestDim = dim;
          bestTopVal = bottomGroup.val;
        }
      }
    });

    if (!bestDim) return candidates[0];
    return {
      ...bestDim,
      topVal: bestTopVal || "(sin valor)",
      topSum: extremeSum
    };
  }

  // ── Siguiente dimensión lógica según embudo operacional ───────────────────

  _nextFunnelDimension(usedDims) {
    for (const key of this._funnelOrder) {
      if (!usedDims.has(key)) return key;
    }
    return null;
  }

  // ── Sección de IA en el Popover (contextual y operacional) ────────────────

  _renderPopoverAiSection(stepIdx, parentRows, availDims, aiHigh, aiLow) {
    const usedDims = new Set(this._levels.slice(0, stepIdx + 1).map(l => l.dimension));
    const nextFunnel = this._nextFunnelDimension(usedDims);
    const nextFunnelDim = nextFunnel ? this._dimInfo(nextFunnel) : null;

    // Calcular métricas contextuales para mostrar en el popover
    const totalRows = parentRows.length;
    const sepPending = parentRows.filter(r => r.estado_separacion !== "FINALIZADO").length;
    const factPending = parentRows.filter(r => r.estado_factura !== "Aprobadas").length;
    const sepPendingPct = totalRows > 0 ? Math.round(sepPending / totalRows * 100) : 0;
    const factPendingPct = totalRows > 0 ? Math.round(factPending / totalRows * 100) : 0;

    let aiSectionHtml = `<div class="pbi-popover__section-title">Sugerencia Operacional</div>`;

    // Sugerencia principal: siguiente paso en el embudo
    if (nextFunnelDim && availDims.find(d => d.key === nextFunnel)) {
      const funnelGroups = this._groupAndSum(parentRows, nextFunnel);
      const funnelTop = funnelGroups[0];
      let contextHint = nextFunnelDim.hint || nextFunnelDim.label;

      // Hints contextuales según la dimensión
      if (nextFunnel === "estado_separacion" && sepPendingPct > 0) {
        contextHint = `${sepPendingPct}% sin separar`;
      } else if (nextFunnel === "estado_factura" && factPendingPct > 0) {
        contextHint = `${factPendingPct}% sin facturar`;
      } else if (funnelTop) {
        contextHint = `Mayor: ${funnelTop.val} (${this._fmt(funnelTop.sum)})`;
      }

      aiSectionHtml += `
        <button type="button" class="pbi-popover__item pbi-popover__item--ai"
                data-action="choose-dim" data-step="${stepIdx}" data-dim="${nextFunnel}">
          <div class="pbi-popover__item-left">
            <span class="pbi-popover__item-icon" style="background:#eff6ff;color:#2563eb;">
              <i class="fa-solid fa-route"></i>
            </span>
            <div>
              <div class="pbi-popover__item-name"><i class="fa-solid ${nextFunnelDim.icon}" style="color:${nextFunnelDim.accent};margin-right:4px;"></i>${nextFunnelDim.label}</div>
              <div class="pbi-popover__item-desc" style="color:#2563eb;">${contextHint}</div>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right" style="font-size:10px;color:#94a3b8;"></i>
        </button>`;
    }

    // Alerta si hay pendientes críticos
    if (sepPendingPct > 50 && !usedDims.has("estado_separacion") && availDims.find(d => d.key === "estado_separacion")) {
      aiSectionHtml += `
        <button type="button" class="pbi-popover__item pbi-popover__item--ai"
                data-action="choose-dim" data-step="${stepIdx}" data-dim="estado_separacion">
          <div class="pbi-popover__item-left">
            <span class="pbi-popover__item-icon" style="background:#fef3c7;color:#d97706;">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </span>
            <div>
              <div class="pbi-popover__item-name">Alerta Separación</div>
              <div class="pbi-popover__item-desc" style="color:#d97706;">${sepPendingPct}% de registros pendientes</div>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right" style="font-size:10px;color:#94a3b8;"></i>
        </button>`;
    } else if (factPendingPct > 50 && !usedDims.has("estado_factura") && availDims.find(d => d.key === "estado_factura")) {
      aiSectionHtml += `
        <button type="button" class="pbi-popover__item pbi-popover__item--ai"
                data-action="choose-dim" data-step="${stepIdx}" data-dim="estado_factura">
          <div class="pbi-popover__item-left">
            <span class="pbi-popover__item-icon" style="background:#ffe4e6;color:#e11d48;">
              <i class="fa-solid fa-file-circle-exclamation"></i>
            </span>
            <div>
              <div class="pbi-popover__item-name">Alerta Facturación</div>
              <div class="pbi-popover__item-desc" style="color:#e11d48;">${factPendingPct}% sin factura aprobada</div>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right" style="font-size:10px;color:#94a3b8;"></i>
        </button>`;
    }

    // Sección de todas las dimensiones disponibles
    aiSectionHtml += `<div class="pbi-popover__section-title" style="margin-top:4px;">Dimensiones</div>`;
    aiSectionHtml += availDims.map(d => `
      <button type="button" class="pbi-popover__item"
              data-action="choose-dim" data-step="${stepIdx}" data-dim="${d.key}">
        <div class="pbi-popover__item-left">
          <span class="pbi-popover__item-icon" style="background:${d.pastelBg};color:${d.accent};border:1px solid ${d.pastelBorder};">
            <i class="fa-solid ${d.icon}"></i>
          </span>
          <div>
            <div class="pbi-popover__item-name">${d.label}</div>
            ${d.hint ? `<div class="pbi-popover__item-desc">${d.hint}</div>` : ""}
          </div>
        </div>
        <i class="fa-solid fa-plus" style="font-size:10px;color:${d.accent};"></i>
      </button>
    `).join("");

    return aiSectionHtml;
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────

  _bindEvents() {
    if (!this.container) return;

    // Cambio de métrica
    this.container.querySelectorAll("[data-action='change-metric']").forEach(btn => {
      btn.addEventListener("click", () => {
        this._metric = btn.dataset.metric;
        this._paint({ preserveScroll: true });
      });
    });

    // Auto-desglose inteligente IA
    this.container.querySelector("[data-action='auto-expand']")?.addEventListener("click", () => {
      this._levels = [];
      this._autoInitLevels();
      this._paint({ autoScrollToEnd: true });
    });

    // Restablecer árbol
    this.container.querySelector("[data-action='reset-tree']")?.addEventListener("click", () => {
      this._levels = [];
      this._paint();
    });

    // Modo pantalla completa
    this.container.querySelector("[data-action='toggle-fullscreen']")?.addEventListener("click", () => {
      this._toggleFullscreen();
    });

    // Clic en el botón (+) del nodo raíz
    this.container.querySelector("#pbiSplitBtnRoot")?.addEventListener("click", e => {
      e.stopPropagation();
      if (this._levels.length > 0) {
        // Si ya está abierto, colapsar todo
        this._levels = [];
        this._paint();
      } else {
        this._showSplitPopover(-1, e.currentTarget);
      }
    });

    // Clic en la tarjeta de un nodo (seleccionar nodo)
    this.container.querySelectorAll("[data-action='select-node']").forEach(nodeEl => {
      nodeEl.addEventListener("click", e => {
        if (e.target.closest(".pbi-split-trigger")) return; // Dejar que el botón (+) maneje su evento
        const step = parseInt(nodeEl.dataset.step, 10);
        const val = nodeEl.dataset.val;

        // Actualizar selección
        this._levels[step].selectedValue = val;

        // Truncar niveles posteriores si los hay
        this._levels = this._levels.slice(0, step + 1);

        // Siguiente dimensión: seguir el embudo operacional lógico primero,
        // si no hay más embudo entonces recurrir a IA.
        const used = new Set(this._levels.map(l => l.dimension));
        const subRows = this._rowsUpTo(step + 1);
        const nextFunnelKey = this._nextFunnelDimension(used);
        const nextKey = nextFunnelKey || null;

        if (nextKey) {
          const nextGroups = this._groupAndSum(subRows, nextKey);
          if (nextGroups.length > 0) {
            this._levels.push({
              dimension: nextKey,
              selectedValue: nextGroups[0]?.val || null,
              sortOrder: "desc",
              search: ""
            });
          }
        }

        this._paint({ autoScrollToEnd: true });
      });
    });

    // Clic en el botón (+) de un nodo específico
    this.container.querySelectorAll("[data-action='node-split-trigger']").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const step = parseInt(btn.dataset.step, 10);
        const val = btn.dataset.val;

        // Si ya está expandido hacia el siguiente nivel, colapsar niveles posteriores
        if (this._levels[step]?.selectedValue === val && step < this._levels.length - 1) {
          this._levels = this._levels.slice(0, step + 1);
          this._paint({ preserveScroll: true });
        } else {
          // Seleccionar este nodo y abrir popover de dimensiones
          this._levels[step].selectedValue = val;
          this._levels = this._levels.slice(0, step + 1);
          this._paint({ autoScrollToEnd: true });
          // Abrir popover referenciado al botón recién re-renderizado
          requestAnimationFrame(() => {
            const colNodes = [...this.container.querySelectorAll(`.pbi-node[data-step="${step}"]`)];
            const targetNode = colNodes.find(n => n.dataset.val === val);
            const freshBtn = targetNode?.querySelector(".pbi-split-trigger");
            if (freshBtn) this._showSplitPopover(step, freshBtn);
          });
        }
      });
    });

    // Alternar orden de la columna
    this.container.querySelectorAll("[data-action='cycle-sort']").forEach(btn => {
      btn.addEventListener("click", () => {
        const step = parseInt(btn.dataset.step, 10);
        const curOrder = this._levels[step].sortOrder;
        this._levels[step].sortOrder = curOrder === "desc" ? "asc" : curOrder === "asc" ? "alpha" : "desc";
        this._paint({ preserveScroll: true });
      });
    });

    // Cerrar nivel (X)
    this.container.querySelectorAll("[data-action='remove-level']").forEach(btn => {
      btn.addEventListener("click", () => {
        const step = parseInt(btn.dataset.step, 10);
        this._levels = this._levels.slice(0, step);
        this._paint({ preserveScroll: true });
      });
    });

    // Búsqueda en columna
    this.container.querySelectorAll("[data-action='search-level']").forEach(input => {
      input.addEventListener("input", e => {
        const step = parseInt(input.dataset.step, 10);
        this._levels[step].search = e.target.value;
        // Re-render local sin perder foco
        this._updateColumnNodes(step);
      });
    });

    // Resaltar línea Bezier en hover del nodo (inmune a caracteres especiales)
    this.container.querySelectorAll(".pbi-node").forEach(node => {
      node.addEventListener("mouseenter", () => {
        const val = node.dataset.val;
        const allLines = [...this.container.querySelectorAll(".pbi-line")];
        const line = allLines.find(l => l.dataset.targetVal === val);
        if (line) {
          line.classList.add("is-hover");
          if (!line.classList.contains("is-active")) {
            line.style.stroke = line.dataset.accent || "#059669";
            line.style.strokeWidth = "2.2px";
          }
        }
      });
      node.addEventListener("mouseleave", () => {
        const val = node.dataset.val;
        const allLines = [...this.container.querySelectorAll(".pbi-line")];
        const line = allLines.find(l => l.dataset.targetVal === val);
        if (line) {
          line.classList.remove("is-hover");
          if (!line.classList.contains("is-active")) {
            line.style.stroke = "#94a3b8";
            line.style.strokeWidth = "1.2px";
          }
        }
      });
    });

    // Redibujar conexiones dinámicamente cuando el usuario scrollea verticalmente en cualquier columna
    this.container.querySelectorAll(".pbi-col__body").forEach(body => {
      body.addEventListener("scroll", () => this._drawLines(), { passive: true });
    });

    // Redibujar conexiones cuando el lienzo horizontal hace scroll
    const wrapper = document.getElementById("pbiCanvasWrapper");
    if (wrapper) {
      wrapper.addEventListener("scroll", () => this._drawLines(), { passive: true });
    }
  }

  // Actualiza los nodos de una sola columna tras escribir en su buscador
  _updateColumnNodes(stepIdx) {
    const lvl = this._levels[stepIdx];
    const parentRows = this._rowsUpTo(stepIdx);
    const parentTotal = this._computeMetric(parentRows);
    let groups = this._groupAndSum(parentRows, lvl.dimension);

    if (lvl.sortOrder === "asc") groups.sort((a, b) => a.sum - b.sum);
    else if (lvl.sortOrder === "alpha") groups.sort((a, b) => String(a.val).localeCompare(String(b.val)));
    else groups.sort((a, b) => b.sum - a.sum);

    const searchFilter = (lvl.search || "").trim().toLowerCase();
    const filtered = searchFilter ? groups.filter(g => String(g.val).toLowerCase().includes(searchFilter)) : groups;
    const maxValInCol = groups[0]?.sum || 1;
    const hasNext = stepIdx < this._levels.length - 1;

    const body = document.getElementById(`pbiBody_${stepIdx}`);
    if (!body) return;

    const metricInfo = this._metrics[this._metric];

    body.innerHTML = filtered.map((item, nodeIdx) => {
      const isSelected = lvl.selectedValue === item.val;
      const pctOfParent = parentTotal > 0 ? (item.sum / parentTotal * 100) : 0;
      const barWidthPct = maxValInCol > 0 ? Math.max(3, Math.round(item.sum / maxValInCol * 100)) : 0;
      const { labelHtml, badgeHtml } = this._formatNodeLabel(lvl.dimension, item.val, item.count);
      return `
        <div class="pbi-node ${isSelected ? "is-selected" : ""}"
             id="pbiNode_${stepIdx}_${nodeIdx}"
             data-action="select-node"
             data-step="${stepIdx}"
             data-val="${this._esc(item.val)}"
             role="button" tabindex="0"
             title="${this._esc(item.val)}">
          
          <div class="pbi-node__header">
            <span class="pbi-node__label">${labelHtml}</span>
            ${badgeHtml ? `<span class="pbi-node__badge">${badgeHtml}</span>` : ""}
          </div>

          <div class="pbi-node__body">
            <div class="pbi-node__metrics">
              <span class="pbi-node__val">${this._fmt(item.sum)}</span>
              <span class="pbi-node__unit">${metricInfo.label.toLowerCase()}</span>
              <span class="pbi-node__pct">${pctOfParent.toFixed(1)}%</span>
            </div>
            <div class="pbi-node__track">
              <div class="pbi-node__bar-fill" style="width:${barWidthPct}%;"></div>
            </div>
          </div>

          <button type="button" class="pbi-split-trigger ${isSelected && hasNext ? "is-expanded" : ""}"
                  data-action="node-split-trigger" data-step="${stepIdx}" data-val="${this._esc(item.val)}"
                  title="${isSelected && hasNext ? "Modificar siguiente nivel" : "Desglosar por..."}">
            <i class="fa-solid ${isSelected && hasNext ? "fa-minus" : "fa-plus"}"></i>
          </button>
        </div>
      `;
    }).join("");

    this._drawLines();
  }

  // ── Utilidades de Cálculo y Dominio ────────────────────────────────────────

  _rowsUpTo(stepIdxExclusive) {
    let result = this._rows;
    for (let i = 0; i < stepIdxExclusive; i++) {
      const lvl = this._levels[i];
      if (lvl?.selectedValue) {
        result = result.filter(r => String(r[lvl.dimension] ?? "") === lvl.selectedValue);
      }
    }
    return result;
  }

  _groupAndSum(rows, key) {
    const acc = {};
    rows.forEach(r => {
      const v = String(r[key] ?? "").trim() || "(sin valor)";
      if (!acc[v]) acc[v] = [];
      acc[v].push(r);
    });

    return Object.entries(acc)
      .map(([val, rws]) => ({
        val,
        sum: this._computeMetric(rws),
        count: rws.length
      }))
      .sort((a, b) => b.sum - a.sum);
  }

  _toggleFullscreen() {
    this._isFullscreen = !this._isFullscreen;
    const treeContainer = this.container?.querySelector(".pbi-tree-container");
    if (treeContainer) {
      treeContainer.classList.toggle("is-fullscreen", this._isFullscreen);
    }
    document.body.classList.toggle("pbi-modal-open", this._isFullscreen);

    const fsBtn = treeContainer?.querySelector("[data-action='toggle-fullscreen']");
    if (fsBtn) {
      fsBtn.innerHTML = `<i class="fa-solid ${this._isFullscreen ? 'fa-compress' : 'fa-expand'}"></i> ${this._isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}`;
      fsBtn.title = this._isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Expandir árbol a pantalla completa';
      fsBtn.classList.toggle("pbi-btn-action--active", this._isFullscreen);
    }

    this._closePopover();

    // Redibujar conexiones SVG para adaptarse al nuevo tamaño de ventana
    setTimeout(() => {
      this._drawLines();
      this._animateBars();
    }, 60);
  }

  exitFullscreen() {
    if (this._isFullscreen) {
      this._toggleFullscreen();
    }
  }

  _computeMetric(rows) {
    const m = this._metrics[this._metric];
    return m ? m.calc(rows) : 0;
  }

  _dimInfo(key) {
    return this._dimensions.find(d => d.key === key) || {
      key,
      label: key,
      icon: "fa-folder",
      accent: "#64748b",
      accentLight: "#94a3b8",
      pastelBg: "rgba(248, 250, 252, 0.72)",
      pastelBorder: "rgba(226, 232, 240, 0.85)",
      shadow: "rgba(100, 116, 139, 0.12)"
    };
  }

  _fmt(n) {
    return Math.round(Number(n) || 0).toLocaleString("es-CO");
  }

  _esc(s) {
    return String(s ?? "")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
