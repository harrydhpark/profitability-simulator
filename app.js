/**
 * LGE Europe TV Profitability Simulator Application Script
 * Executive Portal Design System & Excel Simulator Matrix View with 6 Slicer Filters
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons if loaded
  if (window.lucide) {
    lucide.createIcons();
  }

  const DATA = window.SIMULATOR_DATA;
  const Engine = window.SimulatorEngine;

  if (!DATA || !Engine) {
    console.error('SIMULATOR_DATA or SimulatorEngine not loaded properly.');
    return;
  }

  // 4 Excel Slicer Filter Definitions
  const SLICER_GROUPS = [
    { title: '신모델 구분', key: 'sinModel', options: ['신모델', '구모델', '가모델'], isMulti: false },
    { title: 'BLU 구분', key: 'blu', options: ['OLED', 'UHD', 'FHD'], isMulti: false },
    { title: '인치 (다중 선택)', key: 'inch', options: ['98', '97', '86', '85', '83', '77', '75', '65', '55', '50', '48', '43'], isMulti: true },
    { title: '월 (다중 선택)', key: 'months', options: ['7월', '8월', '9월', '10월', '11월', '12월'], isMulti: true }
  ];

  // Application State
  const state = {
    subCode: 'UK',
    quarter: '3Q',
    viewMode: 'matrix', // 'matrix' | 'list'
    slicerState: {
      sinModel: new Set(['신모델']),
      blu: new Set(['OLED']),
      inch: new Set(),
      months: new Set()
    },
    selectedModels: [], // array of modelName strings derived from slicers
    overrides: {}, // modelName -> { promoPrice, rrpPrice, deductionRate, qty, materialCostPct, sgnaPct }
    chartSensitivity: null,
    chartBluBreakdown: null
  };

  // DOM Elements - Sidebar & Controls
  const subSelector = document.getElementById('subSelector');
  const quarterSelector = document.getElementById('quarterSelector');
  const selectedCountBadge = document.getElementById('selectedCountBadge');
  const slicerFiltersContainer = document.getElementById('slicerFiltersContainer');
  const btnResetAllSlicers = document.getElementById('btnResetAllSlicers');

  const btnViewMatrix = document.getElementById('btnViewMatrix');
  const btnViewList = document.getElementById('btnViewList');

  const viewMatrixContainer = document.getElementById('viewMatrixContainer');
  const viewListContainer = document.getElementById('viewListContainer');

  // Header & Page Titles
  const pageSubTitle = document.getElementById('pageSubTitle');
  const badgeCurrency = document.getElementById('badgeCurrency');

  // Action Buttons
  const btnPresetPricePlus5 = document.getElementById('btnPresetPricePlus5');
  const btnPresetPriceMinus5 = document.getElementById('btnPresetPriceMinus5');
  const btnPresetDeductionMinus1 = document.getElementById('btnPresetDeductionMinus1');
  const btnPresetReset = document.getElementById('btnPresetReset');
  const btnExportCSV = document.getElementById('btnExportCSV');

  // KPI Summary Elements
  const kpiGSalesSim = document.getElementById('kpiGSalesSim');
  const kpiGSalesBase = document.getElementById('kpiGSalesBase');
  const kpiGSalesGap = document.getElementById('kpiGSalesGap');

  const kpiNetSalesSim = document.getElementById('kpiNetSalesSim');
  const kpiNetSalesBase = document.getElementById('kpiNetSalesBase');
  const kpiNetSalesGap = document.getElementById('kpiNetSalesGap');
  const kpiTotalQty = document.getElementById('kpiTotalQty');

  const kpiCogsSim = document.getElementById('kpiCogsSim');
  const kpiCogsRatio = document.getElementById('kpiCogsRatio');
  const kpiSgnaSim = document.getElementById('kpiSgnaSim');
  const kpiExRate = document.getElementById('kpiExRate');

  const kpiCoiSim = document.getElementById('kpiCoiSim');
  const kpiCoiPctSim = document.getElementById('kpiCoiPctSim');
  const kpiCoiBase = document.getElementById('kpiCoiBase');
  const kpiCoiGapBadge = document.getElementById('kpiCoiGapBadge');
  const cardCoiBox = document.getElementById('cardCoiBox');

  const kpiMpSim = document.getElementById('kpiMpSim');
  const kpiMpPctSim = document.getElementById('kpiMpPctSim');
  const kpiMpBase = document.getElementById('kpiMpBase');
  const kpiMpGapBadge = document.getElementById('kpiMpGapBadge');

  // Matrix & List Table Elements
  const matrixHeader = document.getElementById('matrixHeader');
  const matrixBody = document.getElementById('matrixBody');
  const listTableBody = document.getElementById('listTableBody');

  // Formatting Helpers
  const fmtM = (val) => `$${(val / 1e6).toFixed(2)}M`;
  const fmtK = (val) => `${(val / 1e3).toFixed(1)}k`;
  const fmtPct = (val) => `${(val * 100).toFixed(1)}%`;
  const fmtGapM = (val) => `${val >= 0 ? '+' : ''}$${(val / 1e6).toFixed(2)}M`;

  // Initialize Slicer State for Selected Subsidiary (Smart Default Activation)
  function initSlicerStateForSub() {
    const subPnl = DATA.pnlData[state.subCode] || {};
    
    // Single-select defaults
    state.slicerState.sinModel = new Set(['신모델']);
    state.slicerState.blu = new Set(['OLED']);

    // Multi-select defaults: all inch and month options
    const inchGroup = SLICER_GROUPS.find(g => g.key === 'inch');
    const monthsGroup = SLICER_GROUPS.find(g => g.key === 'months');

    state.slicerState.inch = new Set(inchGroup ? inchGroup.options : ['98', '97', '86', '85', '83', '77', '75', '65', '55', '50', '48', '43']);
    state.slicerState.months = new Set(monthsGroup ? monthsGroup.options : ['7월', '8월', '9월', '10월', '11월', '12월']);

    updateSelectedModelsFromSlicers();
    renderSlicerFilters();
  }

  // Derive Selected Models from Slicers
  function updateSelectedModelsFromSlicers() {
    const matched = DATA.models.filter(m => {
      const matchSin = state.slicerState.sinModel.size === 0 || state.slicerState.sinModel.has(m.sinModel);
      const matchBlu = state.slicerState.blu.size === 0 || state.slicerState.blu.has(m.blu);
      const matchInch = state.slicerState.inch.has(String(m.inch));
      const matchMonth = state.slicerState.months.size === 0 || (Array.isArray(m.months) && m.months.some(mo => state.slicerState.months.has(mo)));

      return matchSin && matchBlu && matchInch && matchMonth;
    });

    state.selectedModels = matched.map(m => m.modelName);
  }

  // Render 3 Excel Slicer Filter Cards in Sidebar
  function renderSlicerFilters() {
    if (!slicerFiltersContainer) return;
    slicerFiltersContainer.innerHTML = '';

    if (selectedCountBadge) selectedCountBadge.textContent = `${state.selectedModels.length} / ${DATA.models.length} 모델`;

    SLICER_GROUPS.forEach(group => {
      const card = document.createElement('div');
      card.className = 'bg-slate-900/90 border border-white/15 rounded-lg p-2.5 space-y-1.5 shadow-sm';

      // Header
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between border-b border-white/10 pb-1';
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'text-[11px] font-bold text-white flex items-center gap-1';
      titleSpan.innerHTML = `<span class="material-symbols-outlined text-[13px] text-secondary">filter_list</span>${group.title}`;

      header.appendChild(titleSpan);

      // Multi-select header toggle button (only for multiSelect groups like Inch)
      if (group.isMulti) {
        const toggleAllBtn = document.createElement('button');
        toggleAllBtn.className = 'text-[10px] text-white/50 hover:text-white transition bg-white/5 hover:bg-white/15 px-1.5 py-0.5 rounded';
        
        const allSelected = group.options.every(opt => state.slicerState[group.key].has(opt));
        toggleAllBtn.textContent = allSelected ? '해제' : '전체';

        toggleAllBtn.addEventListener('click', () => {
          if (allSelected) {
            state.slicerState[group.key].clear();
          } else {
            group.options.forEach(opt => state.slicerState[group.key].add(opt));
          }
          updateSelectedModelsFromSlicers();
          renderSlicerFilters();
          updateDashboard();
        });

        header.appendChild(toggleAllBtn);
      } else {
        const typeBadge = document.createElement('span');
        typeBadge.className = 'text-[9px] text-white/40 font-normal px-1.5 py-0.5 rounded bg-white/5';
        typeBadge.textContent = '단일 선택';
        header.appendChild(typeBadge);
      }

      card.appendChild(header);

      // Buttons container
      const btnGrid = document.createElement('div');
      btnGrid.className = 'flex flex-wrap gap-1 pt-0.5';

      group.options.forEach(opt => {
        const isSelected = state.slicerState[group.key].has(opt);
        const btn = document.createElement('button');
        
        if (isSelected) {
          btn.className = 'px-2.5 py-1 text-[11px] font-bold rounded bg-secondary text-white border border-rose-400/50 shadow transition cursor-pointer flex-1 min-w-[42px] text-center';
        } else {
          btn.className = 'px-2.5 py-1 text-[11px] font-medium rounded bg-slate-950/70 text-white/40 border border-white/10 hover:text-white/80 transition cursor-pointer flex-1 min-w-[42px] text-center';
        }
        
        btn.textContent = opt;

        btn.addEventListener('click', () => {
          if (group.isMulti) {
            // Multi-select toggle
            if (isSelected) {
              state.slicerState[group.key].delete(opt);
            } else {
              state.slicerState[group.key].add(opt);
            }
          } else {
            // Single-select toggle: set exactly opt as selected
            state.slicerState[group.key] = new Set([opt]);
          }
          updateSelectedModelsFromSlicers();
          renderSlicerFilters();
          updateDashboard();
        });

        btnGrid.appendChild(btn);
      });

      card.appendChild(btnGrid);
      slicerFiltersContainer.appendChild(card);
    });
  }

  // Subsidiary Display Name Map
  const SUB_NAMES = {
    UK: 'LGEUK (영국)',
    DG: 'LGEDG (독일)',
    BN: 'LGEBN (베네룩스)',
    ES: 'LGEES (스페인)',
    FS: 'LGEFS (프랑스)',
    HS: 'LGEHS (그리스)',
    PL: 'LGEPL (폴란드)',
    CK: 'LGECZ (체코)',
    IS: 'LGEIS (이탈리아)',
    RO: 'LGERO (루마니아)',
    PT: 'LGEPT (포르투갈)',
    AG: 'LGEAG (오스트리아)',
    MK: 'LGEMK (헝가리)',
    LA: 'LGELA (발틱)',
    SW: 'LGESW (스웨덴)',
    Swiss: 'Swiss (스위스)'
  };

  // Step 3: Main Render Dashboard Loop
  function updateDashboard() {
    const subInfo = DATA.subsidiaries[state.subCode] || DATA.subsidiaries['UK'];
    const quarterStr = state.quarter;
    const subTitleName = SUB_NAMES[state.subCode] || `${subInfo.code} 법인`;

    // Update Header Titles
    pageSubTitle.textContent = `${subTitleName} TV 손익 시뮬레이션`;
    if (typeof badgeCurrency !== 'undefined' && badgeCurrency) {
      badgeCurrency.style.display = 'none';
    }

    // Run Simulation Engine with Month Slicer Filtering
    const selectedMonthsArr = state.slicerState.months.size > 0 ? Array.from(state.slicerState.months) : null;
    const result = Engine.simulatePnL(DATA, state.subCode, state.quarter, state.selectedModels, state.overrides, selectedMonthsArr);
    const { summary, models, bluSummary } = result;

    // 1. Update KPI Summary Cards (Guarded if cards exist)
    if (kpiGSalesSim) kpiGSalesSim.textContent = fmtM(summary.sim.gSales);
    if (kpiGSalesBase) kpiGSalesBase.textContent = fmtM(summary.base.gSales);
    if (kpiGSalesGap) updateGapBadge(kpiGSalesGap, summary.gap.gSales);

    if (kpiNetSalesSim) kpiNetSalesSim.textContent = fmtM(summary.sim.netSales);
    if (kpiNetSalesBase) kpiNetSalesBase.textContent = fmtM(summary.base.netSales);
    if (kpiNetSalesGap) updateGapBadge(kpiNetSalesGap, summary.gap.netSales);
    if (kpiTotalQty) kpiTotalQty.textContent = fmtK(summary.sim.qty);

    if (kpiCogsSim) kpiCogsSim.textContent = fmtM(summary.sim.cogs);
    if (kpiCogsRatio) kpiCogsRatio.textContent = `(${summary.sim.netSales > 0 ? ((summary.sim.cogs / summary.sim.netSales) * 100).toFixed(1) : 0}%)`;
    if (kpiSgnaSim) kpiSgnaSim.textContent = fmtM(summary.sim.sgna);
    if (kpiExRate) kpiExRate.textContent = summary.exRate.toFixed(4);

    if (kpiCoiSim) kpiCoiSim.textContent = fmtM(summary.sim.coi);
    if (kpiCoiPctSim) kpiCoiPctSim.textContent = fmtPct(summary.sim.coiPct);
    if (kpiCoiBase) kpiCoiBase.textContent = `${fmtM(summary.base.coi)} (${fmtPct(summary.base.coiPct)})`;
    if (kpiCoiGapBadge) updateGapBadge(kpiCoiGapBadge, summary.gap.coi, true);

    if (cardCoiBox) {
      if (summary.gap.coi > 0) {
        cardCoiBox.className = "bg-white border-2 border-emerald-500 rounded-xl p-4 shadow-md relative overflow-hidden";
      } else if (summary.gap.coi < 0) {
        cardCoiBox.className = "bg-white border-2 border-rose-500 rounded-xl p-4 shadow-md relative overflow-hidden";
      } else {
        cardCoiBox.className = "bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden";
      }
    }

    if (kpiMpSim) kpiMpSim.textContent = fmtM(summary.sim.mp);
    if (kpiMpPctSim) kpiMpPctSim.textContent = fmtPct(summary.sim.mpPct);
    if (kpiMpBase) kpiMpBase.textContent = fmtM(summary.base.mp);
    if (kpiMpGapBadge) updateGapBadge(kpiMpGapBadge, summary.gap.mp);

    // 2. Render Main Matrix or List Table View
    if (state.viewMode === 'matrix') {
      renderMatrixView(summary, models);
    } else {
      renderListView(models);
    }

    // 3. Render Charts
    renderCharts(summary, models, bluSummary);

    // Update Badge (if exists)
    if (selectedCountBadge) selectedCountBadge.textContent = `${state.selectedModels.length} / ${DATA.models.length} 모델`;
  }

  function updateGapBadge(element, gapVal, isCoi = false) {
    const formatted = fmtGapM(gapVal);
    element.textContent = `Gap: ${formatted}`;
    if (gapVal > 0) {
      element.className = isCoi
        ? "px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
        : "text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200";
    } else if (gapVal < 0) {
      element.className = isCoi
        ? "px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300"
        : "text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200";
    } else {
      element.className = "text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600";
    }
  }

  // Mode 1: Render Excel Simulator Matrix View (Models as Columns, PnL Metrics as Rows)
  function renderMatrixView(summary, models) {
    // Header Row: Sticky Metric Label + Model Columns + Total Column
    let headerHtml = `
      <tr>
        <th class="sticky-col w-[220px] min-w-[220px] max-w-[220px]">구분 / 손익지표 (PnL Metric)</th>
    `;
    models.forEach(m => {
      headerHtml += `
        <th class="w-[135px] min-w-[135px] max-w-[135px]">
          <span class="block text-white font-bold text-xs truncate">${m.modelName}</span>
          <span class="block text-[10px] text-white/60 font-normal truncate">${m.blu} · ${m.series} (${m.inch}")</span>
        </th>
      `;
    });
    headerHtml += `</tr>`;
    matrixHeader.innerHTML = headerHtml;

    // Build Rows matching Excel 'Simulator' Sheet Structure
    matrixBody.innerHTML = '';

    // Helper row generator
    const addSectionHeader = (title) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${models.length + 1}" class="bg-section-header sticky-col font-bold">${title}</td>`;
      matrixBody.appendChild(tr);
    };

    const addMetricRow = (label, getValFn, options = {}) => {
      const tr = document.createElement('tr');
      if (options.isHighlight) tr.className = "bg-amber-50 font-bold";

      let rowHtml = `<td class="sticky-col ${options.isBold ? 'font-bold text-slate-900' : 'text-slate-700'}">${label}</td>`;
      
      models.forEach(m => {
        const cellContent = getValFn(m);
        rowHtml += `<td>${cellContent}</td>`;
      });

      tr.innerHTML = rowHtml;
      matrixBody.appendChild(tr);
    };

    // SECTION 1: 선행 수익성 기준 정보
    addSectionHeader('1. 선행 수익성 기준 정보');

    // 1 & 2. Auto-calculated Expected RRP & Promo Prices (Top of Section 1)
    addMetricRow('예상 RRP', m => {
      const val = Math.round(m.estRrpLocal).toLocaleString();
      return `<strong class="text-slate-900">${val}</strong> <span class="text-[10px] text-slate-500">(${m.currency})</span>`;
    });
    addMetricRow('예상 Promo. Price', m => {
      const val = Math.round(m.estPromoLocal).toLocaleString();
      return `<strong class="text-slate-900">${val}</strong> <span class="text-[10px] text-slate-500">(${m.currency})</span>`;
    });

    // 3 & 4. Editable F. Margin Rows (Standardized input styling)
    addMetricRow('F. Margin (%)', m => {
      const currVal = Math.round(m.fmRrp * 100);
      const isChanged = state.overrides[m.modelName]?.fmRrp !== undefined;
      return `<input type="number" step="1" min="0" max="99" value="${currVal}" data-model="${m.modelName}" data-field="fmRrp" class="excel-input ${isChanged ? 'changed' : ''}" />`;
    });

    addMetricRow('F. Margin(Promo) (%)', m => {
      const currVal = Math.round(m.fmPromo * 100);
      const isChanged = state.overrides[m.modelName]?.fmPromo !== undefined;
      return `<input type="number" step="1" min="0" max="99" value="${currVal}" data-model="${m.modelName}" data-field="fmPromo" class="excel-input ${isChanged ? 'changed' : ''}" />`;
    });

    // 5 & 6. VAT and Currency
    addMetricRow('VAT (%)', m => `${(m.vatRate * 100).toFixed(1).replace(/\.0$/, '')}%`);
    addMetricRow('통화 (적용환율)', m => `${m.currency} (${m.exRate ? m.exRate.toFixed(4) : summary.exRate.toFixed(4)})`);

    // 7 & 8. Excel Simulator Sheet Row 27 (G. Price) & Row 31 (가판 %)
    addMetricRow('G. Price', m => `${Math.round(m.baseGAspLocal).toLocaleString()}`);
    addMetricRow('가판 (%)', m => `${(m.baseDeduction * 100).toFixed(1)}%`);

    // 9 & 10. Excel Simulator Sheet Row 49 (영업이익 $) & Row 50 (영업이익 %) (선행 기준)
    addMetricRow('영업이익 ($)', m => {
      const coiPerUnit = m.baseQty > 0 ? (m.baseCoi / m.baseQty) : 0;
      const rounded = Math.round(coiPerUnit);
      const color = rounded >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold';
      const formattedStr = rounded < 0 ? `-$${Math.abs(rounded).toLocaleString()}` : `$${rounded.toLocaleString()}`;
      return `<span class="${color}">${formattedStr}</span>`;
    }, { isHighlight: true, isBold: true });

    addMetricRow('영업이익 (%)', m => {
      const coiPct = m.baseNetSales > 0 ? (m.baseCoi / m.baseNetSales) * 100 : 0;
      return `<strong class="${coiPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${coiPct.toFixed(1)}%</strong>`;
    }, { isHighlight: true, isBold: true });

    // 11 & 12. Excel Simulator Sheet Row 54 (한계이익 $) & Row 55 (한계이익 %) (선행 기준)
    addMetricRow('한계이익 ($)', m => {
      const mpPerUnit = m.baseQty > 0 ? (m.baseMp / m.baseQty) : 0;
      const rounded = Math.round(mpPerUnit);
      const color = rounded >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold';
      const formattedStr = rounded < 0 ? `-$${Math.abs(rounded).toLocaleString()}` : `$${rounded.toLocaleString()}`;
      return `<span class="${color}">${formattedStr}</span>`;
    }, { isBold: true });

    addMetricRow('한계이익 (%)', m => {
      const mpPct = m.baseNetSales > 0 ? (m.baseMp / m.baseNetSales) * 100 : 0;
      return `<strong class="${mpPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${mpPct.toFixed(1)}%</strong>`;
    }, { isBold: true });

    // SECTION 2: 시뮬레이션 입력 요소 (INPUT ROWS - EDITABLE!)
    addSectionHeader('2. 시뮬레이션 입력 요소 (Simulation Inputs - Editable)');

    // 1 & 2. Auto-calculated Expected RRP & Promo Prices for Simulation (Above Simul. G. Price)
    addMetricRow('예상 RRP', m => {
      const val = Math.round(m.estRrpLocal).toLocaleString();
      return `<strong class="text-slate-900">${val}</strong> <span class="text-[10px] text-slate-500">(${m.currency})</span>`;
    });
    addMetricRow('예상 Promo. Price', m => {
      const val = Math.round(m.estPromoLocal).toLocaleString();
      return `<strong class="text-slate-900">${val}</strong> <span class="text-[10px] text-slate-500">(${m.currency})</span>`;
    });

    // 3. Editable Simul. G. Price Input Row (Formerly Simul. Price (Local))
    addMetricRow('Simul. G. Price', m => {
      const currVal = Math.round(m.simGPriceLocal);
      const isChanged = state.overrides[m.modelName]?.promoPrice !== undefined || state.overrides[m.modelName]?.rrpPrice !== undefined;
      return `<input type="number" step="1" value="${currVal}" data-model="${m.modelName}" data-field="price" class="excel-input ${isChanged ? 'changed' : ''}" />`;
    });

    // 4. Editable Simul Deduction Rate Input Row
    addMetricRow('Simul. 차감율 (%)', m => {
      const currVal = (m.simDeduction * 100).toFixed(1);
      const isChanged = state.overrides[m.modelName]?.deductionRate !== undefined;
      return `<input type="number" step="0.1" value="${currVal}" data-model="${m.modelName}" data-field="deduction" class="excel-input ${isChanged ? 'changed' : ''}" />`;
    });

    // SECTION 3: 수익성 지표 산출 결과 (Simulation) - Excel Rows 34, 36-39, 43-44, 49-50, 54-55
    addSectionHeader('3. 수익성 지표 산출 결과 (Simulation)');

    // Helper for Section 3 per-unit values (Strictly Aligned with Excel Simulator Sheet Rows 34~56)
    const getUnitMetrics = (m) => {
      // Row 35: Simul. N.Price ($)
      const simNPrice = m.simNetPriceUSD;

      // Row 36: COGS ($) per unit
      const cogs = m.simQty > 0 ? (m.simCogsUSD / m.simQty) : 0;
      // Row 37: COGS (%) = Row 36 / Row 35 (Excel G36 / G35)
      const cogsPct = simNPrice > 0 ? (cogs / simNPrice) * 100 : 0;

      // Row 38: Material Cost ($) per unit
      const mat = m.simQty > 0 ? (m.simMaterialCostUSD / m.simQty) : 0;
      // Row 39: Material Cost (%) = Row 38 / Row 35 (Excel G38 / G35)
      const matPct = simNPrice > 0 ? (mat / simNPrice) * 100 : 0;

      // Row 43: SG&A ($) per unit
      const sgna = m.simQty > 0 ? (m.simSgnaTotalUSD / m.simQty) : 0;
      // Row 44: SG&A (%) = Row 43 / Row 35 (Excel G43 / G35)
      const sgnaPct = simNPrice > 0 ? (sgna / simNPrice) * 100 : 0;

      // Row 51: Simul. Operating Profit ($) per unit = Row 35 - Row 36 - Row 43 (Excel G35 - G36 - G43)
      const coi = simNPrice - cogs - sgna;
      // Row 52: Simul. Operating Profit (%) = Row 51 / Row 35 (Excel G51 / G35)
      const coiPct = simNPrice > 0 ? (coi / simNPrice) * 100 : 0;

      // Row 56: Simul. Marginal Profit ($) per unit = Row 35 - COGS (or simMpUSD / simQty)
      const mp = m.simQty > 0 ? (m.simMpUSD / m.simQty) : (simNPrice - cogs);
      // Row 55: Simul. Marginal Profit (%) = Row 56 / Row 35 (Excel G56 / G35)
      const mpPct = simNPrice > 0 ? (mp / simNPrice) * 100 : 0;

      return { nPrice: simNPrice, cogs, cogsPct, mat, matPct, sgna, sgnaPct, coi, coiPct, mp, mpPct };
    };

    const fmtIntDollar = (val) => {
      const rounded = Math.round(val);
      if (rounded < 0) return `-$${Math.abs(rounded).toLocaleString()}`;
      return `$${rounded.toLocaleString()}`;
    };

    // Row 34: N.Price ($)
    addMetricRow('N.Price ($)', m => fmtIntDollar(getUnitMetrics(m).nPrice), { isBold: true });

    // Row 36 & 37: COGS ($) and COGS (%)
    addMetricRow('COGS ($)', m => fmtIntDollar(getUnitMetrics(m).cogs));
    addMetricRow('COGS (%)', m => `${getUnitMetrics(m).cogsPct.toFixed(1)}%`);

    // Row 38 & 39: 재료비 ($) and 재료비 (%)
    addMetricRow('재료비 ($)', m => fmtIntDollar(getUnitMetrics(m).mat));
    addMetricRow('재료비 (%)', m => `${getUnitMetrics(m).matPct.toFixed(1)}%`);

    // Row 43 & 44: 판관비 ($) and 판관비 (%)
    addMetricRow('판관비 ($)', m => fmtIntDollar(getUnitMetrics(m).sgna));
    addMetricRow('판관비 (%)', m => `${getUnitMetrics(m).sgnaPct.toFixed(1)}%`);

    // Row 49 & 50: 영업이익 ($) and 영업이익 (%)
    addMetricRow('영업이익 ($)', m => {
      const u = getUnitMetrics(m);
      const rounded = Math.round(u.coi);
      const color = rounded >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold';
      return `<span class="${color}">${fmtIntDollar(u.coi)}</span>`;
    }, { isHighlight: true, isBold: true });

    addMetricRow('영업이익 (%)', m => {
      const u = getUnitMetrics(m);
      return `<strong class="${u.coiPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${u.coiPct.toFixed(1)}%</strong>`;
    }, { isHighlight: true, isBold: true });

    // Row 54 & 55: 한계이익 ($) and 한계이익 (%)
    addMetricRow('한계이익 ($)', m => {
      const u = getUnitMetrics(m);
      const rounded = Math.round(u.mp);
      const color = rounded >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold';
      return `<span class="${color}">${fmtIntDollar(u.mp)}</span>`;
    }, { isBold: true });

    addMetricRow('한계이익 (%)', m => {
      const u = getUnitMetrics(m);
      return `<strong class="${u.mpPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${u.mpPct.toFixed(1)}%</strong>`;
    }, { isBold: true });

    // Attach Event Listeners to Matrix Excel Input fields
    matrixBody.querySelectorAll('.excel-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const modelName = e.target.getAttribute('data-model');
        const field = e.target.getAttribute('data-field');
        const val = parseFloat(e.target.value);

        if (!state.overrides[modelName]) state.overrides[modelName] = {};

        if (field === 'price') {
          state.overrides[modelName].promoPrice = isNaN(val) ? null : val;
        } else if (field === 'deduction') {
          state.overrides[modelName].deductionRate = isNaN(val) ? null : (val / 100);
        } else if (field === 'qty') {
          state.overrides[modelName].qty = isNaN(val) ? null : val;
        } else if (field === 'fmRrp') {
          state.overrides[modelName].fmRrp = isNaN(val) ? null : (val / 100);
        } else if (field === 'fmPromo') {
          state.overrides[modelName].fmPromo = isNaN(val) ? null : (val / 100);
        }

        updateDashboard();
      });
    });
  }

  // Mode 2: Render Model List Table View
  function renderListView(models) {
    listTableBody.innerHTML = '';
    models.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="sticky-col">${m.blu}</td>
        <td class="text-left font-bold">${m.modelName} <span class="text-[10px] text-slate-400 font-normal">(${m.series}/${m.inch}")</span></td>
        <td>${m.simQty.toLocaleString()}</td>
        <td>${Math.round(m.baseGAspLocal).toLocaleString()}</td>
        <td class="bg-amber-50">
          <input type="number" step="1" value="${Math.round(m.simGPriceLocal)}" data-model="${m.modelName}" data-field="price" class="excel-input" />
        </td>
        <td>${(m.baseDeduction * 100).toFixed(1)}%</td>
        <td class="bg-amber-50">
          <input type="number" step="0.1" value="${(m.simDeduction * 100).toFixed(1)}" data-model="${m.modelName}" data-field="deduction" class="excel-input" />
        </td>
        <td>$${(m.simGSalesUSD / 1e3).toFixed(1)}k</td>
        <td class="font-bold">$${(m.simNetSalesUSD / 1e3).toFixed(1)}k</td>
        <td class="font-bold ${m.simCoiUSD >= 0 ? 'text-emerald-700' : 'text-rose-700'}">$${(m.simCoiUSD / 1e3).toFixed(1)}k</td>
        <td class="font-bold ${m.simCoiPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${(m.simCoiPct * 100).toFixed(1)}%</td>
        <td class="font-bold ${m.gapCoiUSD >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${m.gapCoiUSD >= 0 ? '+' : ''}$${(m.gapCoiUSD / 1e3).toFixed(1)}k</td>
      `;
      listTableBody.appendChild(tr);
    });

    listTableBody.querySelectorAll('.excel-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const modelName = e.target.getAttribute('data-model');
        const field = e.target.getAttribute('data-field');
        const val = parseFloat(e.target.value);

        if (!state.overrides[modelName]) state.overrides[modelName] = {};

        if (field === 'price') state.overrides[modelName].promoPrice = isNaN(val) ? null : val;
        else if (field === 'deduction') state.overrides[modelName].deductionRate = isNaN(val) ? null : (val / 100);

        updateDashboard();
      });
    });
  }

  // Render Charts (Sensitivity & BLU Breakdown)
  function renderCharts(summary, models, bluSummary) {
    const elSens = document.getElementById('chartSensitivity');
    const elBlu = document.getElementById('chartBluBreakdown');
    if (!elSens || !elBlu) return;

    const ctxSens = elSens.getContext('2d');

    const priceDeltas = [-0.10, -0.05, 0, 0.05, 0.10];
    const priceCoiValues = priceDeltas.map(d => {
      const tempOvr = {};
      models.forEach(m => {
        tempOvr[m.modelName] = { promoPrice: m.baseGAspLocal * (1 + d) };
      });
      const res = Engine.simulatePnL(DATA, state.subCode, state.quarter, state.selectedModels, tempOvr);
      return Number((res.summary.sim.coi / 1e6).toFixed(2));
    });

    const deductDeltas = [0.03, 0.015, 0, -0.015, -0.03];
    const deductCoiValues = deductDeltas.map(d => {
      const tempOvr = {};
      models.forEach(m => {
        tempOvr[m.modelName] = { deductionRate: m.baseDeduction + d };
      });
      const res = Engine.simulatePnL(DATA, state.subCode, state.quarter, state.selectedModels, tempOvr);
      return Number((res.summary.sim.coi / 1e6).toFixed(2));
    });

    if (state.chartSensitivity) state.chartSensitivity.destroy();

    state.chartSensitivity = new Chart(ctxSens, {
      type: 'line',
      data: {
        labels: ['-10% / +3%p', '-5% / +1.5%p', '기준 (Baseline)', '+5% / -1.5%p', '+10% / -3%p'],
        datasets: [
          {
            label: '가격 변동 민감도 (Price)',
            data: priceCoiValues,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 4,
          },
          {
            label: '차감율 변동 민감도 (Deduction)',
            data: deductCoiValues,
            borderColor: '#0284c7',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            tension: 0.3,
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#475569', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#e2e8f0' } },
          y: { ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => `$${v}M` }, grid: { color: '#e2e8f0' } }
        }
      }
    });

    const ctxBlu = document.getElementById('chartBluBreakdown').getContext('2d');
    const bluLabels = bluSummary.map(b => b.blu);
    const bluNetSales = bluSummary.map(b => Number((b.simNetSales / 1e6).toFixed(2)));
    const bluCoiPcts = bluSummary.map(b => b.simNetSales > 0 ? Number(((b.simCoi / b.simNetSales) * 100).toFixed(1)) : 0);

    if (state.chartBluBreakdown) state.chartBluBreakdown.destroy();

    state.chartBluBreakdown = new Chart(ctxBlu, {
      type: 'bar',
      data: {
        labels: bluLabels,
        datasets: [
          {
            label: 'Net Sales ($M)',
            data: bluNetSales,
            backgroundColor: '#051c2c',
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: '영업이익률 (COI %)',
            data: bluCoiPcts,
            type: 'line',
            borderColor: '#a50034',
            backgroundColor: '#a50034',
            pointRadius: 5,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#475569', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#e2e8f0' } },
          y: { position: 'left', ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => `$${v}M` }, grid: { color: '#e2e8f0' } },
          y1: { position: 'right', ticks: { color: '#a50034', font: { size: 10 }, callback: (v) => `${v}%` }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  // Event Listeners
  subSelector.addEventListener('change', (e) => {
    state.subCode = e.target.value;
    state.overrides = {};
    initSlicerStateForSub();
    updateDashboard();
  });

  if (quarterSelector) {
    quarterSelector.addEventListener('change', (e) => {
      state.quarter = e.target.value;
      initSlicerStateForSub();
      updateDashboard();
    });
  }

  if (btnResetAllSlicers) {
    btnResetAllSlicers.addEventListener('click', () => {
      initSlicerStateForSub();
      updateDashboard();
    });
  }

  // View Mode Switcher (Guarded)
  if (btnViewMatrix) {
    btnViewMatrix.addEventListener('click', () => {
      state.viewMode = 'matrix';
      btnViewMatrix.className = 'px-2 py-1.5 text-[11px] font-bold rounded bg-secondary text-white shadow flex items-center justify-center gap-1';
      if (btnViewList) btnViewList.className = 'px-2 py-1.5 text-[11px] font-medium rounded text-white/60 hover:text-white flex items-center justify-center gap-1';
      if (viewMatrixContainer) viewMatrixContainer.classList.remove('hidden');
      if (viewListContainer) viewListContainer.classList.add('hidden');
      updateDashboard();
    });
  }

  if (btnViewList) {
    btnViewList.addEventListener('click', () => {
      state.viewMode = 'list';
      btnViewList.className = 'px-2 py-1.5 text-[11px] font-bold rounded bg-secondary text-white shadow flex items-center justify-center gap-1';
      if (btnViewMatrix) btnViewMatrix.className = 'px-2 py-1.5 text-[11px] font-medium rounded text-white/60 hover:text-white flex items-center justify-center gap-1';
      if (viewListContainer) viewListContainer.classList.remove('hidden');
      if (viewMatrixContainer) viewMatrixContainer.classList.add('hidden');
      updateDashboard();
    });
  }

  // Presets
  btnPresetPricePlus5.addEventListener('click', () => {
    const result = Engine.simulatePnL(DATA, state.subCode, state.quarter, state.selectedModels, state.overrides);
    result.models.forEach(m => {
      if (!state.overrides[m.modelName]) state.overrides[m.modelName] = {};
      state.overrides[m.modelName].promoPrice = m.simGPriceLocal * 1.05;
    });
    updateDashboard();
  });

  btnPresetPriceMinus5.addEventListener('click', () => {
    const result = Engine.simulatePnL(DATA, state.subCode, state.quarter, state.selectedModels, state.overrides);
    result.models.forEach(m => {
      if (!state.overrides[m.modelName]) state.overrides[m.modelName] = {};
      state.overrides[m.modelName].promoPrice = m.simGPriceLocal * 0.95;
    });
    updateDashboard();
  });

  btnPresetDeductionMinus1.addEventListener('click', () => {
    const result = Engine.simulatePnL(DATA, state.subCode, state.quarter, state.selectedModels, state.overrides);
    result.models.forEach(m => {
      if (!state.overrides[m.modelName]) state.overrides[m.modelName] = {};
      state.overrides[m.modelName].deductionRate = Math.max(0, m.simDeduction - 0.01);
    });
    updateDashboard();
  });

  btnPresetReset.addEventListener('click', () => {
    state.overrides = {};
    initSlicerStateForSub();
    updateDashboard();
  });

  // Export CSV
  btnExportCSV.addEventListener('click', () => {
    const result = Engine.simulatePnL(DATA, state.subCode, state.quarter, state.selectedModels, state.overrides);
    let csv = `LGE Europe TV Profitability Simulation Report\n`;
    csv += `Subsidiary,${result.summary.subCode},Quarter,${result.summary.quarter},Currency,${result.summary.currency},ExRate,${result.summary.exRate}\n\n`;
    csv += `BLU,Model,Series,Inch,Sim Qty,Base Price (Local),Sim Price (Local),Base Deduction %,Sim Deduction %,G.Sales ($),Net Sales ($),COI ($),COI %,COI Gap ($)\n`;

    result.models.forEach(m => {
      csv += `"${m.blu}","${m.modelName}","${m.series}",${m.inch},${m.simQty},${m.baseGAspLocal.toFixed(1)},${m.simGPriceLocal.toFixed(1)},${(m.baseDeduction * 100).toFixed(1)}%,${(m.simDeduction * 100).toFixed(1)}%,${m.simGSalesUSD.toFixed(1)},${m.simNetSalesUSD.toFixed(1)},${m.simCoiUSD.toFixed(1)},${(m.simCoiPct * 100).toFixed(1)}%,${m.gapCoiUSD.toFixed(1)}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LGE_Profitability_Simulator_${state.subCode}_${state.quarter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Initial Load
  initSlicerStateForSub();
  updateDashboard();
});
