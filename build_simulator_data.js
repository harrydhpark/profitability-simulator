const XLSX = require('d:/TV 유럽영업/15. AX Task/2026 AX 실행과제/09. 선행수익성/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, 'Simulator', '★손익 Simulator_26년 7월차 선행_1차.xlsx');
console.log(`[1/4] Reading Excel workbook: ${excelPath}`);
const wb = XLSX.readFile(excelPath, { cellDates: true, cellFormulas: true });

// 1. Master Sheet - Subsidiaries, Currencies, Exchange Rates, VAT
console.log(`[2/4] Parsing Master Sheet...`);
const wsMaster = wb.Sheets['Master'];
const subsidiaries = {};

// Build VAT mapping from Columns O (Sub) & P (VAT)
const vatMap = {};
for (let r = 4; r <= 20; r++) {
  const subCode = wsMaster[`O${r}`] ? String(wsMaster[`O${r}`].v).trim() : null;
  const vatVal = wsMaster[`P${r}`] ? Number(wsMaster[`P${r}`].v) : 0.20;
  if (subCode) vatMap[subCode] = vatVal;
}

// Subsidiary codes on B4:B20
for (let r = 4; r <= 20; r++) {
  const code = wsMaster[`B${r}`] ? String(wsMaster[`B${r}`].v).trim() : null;
  if (!code) continue;

  const currency = wsMaster[`C${r}`] ? String(wsMaster[`C${r}`].v).trim() : 'EUR.';
  
  // Exchange rates for quarters/months
  const exRate1Q = wsMaster[`D${r}`] ? Number(wsMaster[`D${r}`].v) : 1;
  const exRate2Q = wsMaster[`E${r}`] ? Number(wsMaster[`E${r}`].v) : 1;
  const exRate3Q = wsMaster[`F${r}`] ? Number(wsMaster[`F${r}`].v) : 1;
  const exRate4Q = wsMaster[`G${r}`] ? Number(wsMaster[`G${r}`].v) : 1;

  // Exact lookup table from Master!L3:N25 (Cell E14 formula in Simulator sheet)
  const lEx = wsMaster[`L${r}`] ? Number(wsMaster[`L${r}`].v) : exRate3Q; // 7월
  const mEx = wsMaster[`M${r}`] ? Number(wsMaster[`M${r}`].v) : exRate3Q; // 3Q
  const nEx = wsMaster[`N${r}`] ? Number(wsMaster[`N${r}`].v) : exRate4Q; // 4Q

  const vat = vatMap[code] !== undefined ? vatMap[code] : 0.20;

  subsidiaries[code] = {
    code,
    currency,
    exRates: {
      '1Q': exRate1Q,
      '2Q': exRate2Q,
      '3Q': mEx,
      '4Q': nEx,
      '7월': lEx,
      'Year': mEx
    },
    vat
  };
}

// 2. Comprehensive Model Extraction from '가공Raw' Sheet & 'Pivot' Sheet
console.log(`[3/4] Parsing '가공Raw' & 'Pivot' Sheets for All Models (신모델 / 구모델 / 가모델)...`);
const wsRaw = wb.Sheets['가공Raw'];
const wsPivot = wb.Sheets['Pivot'];

// Extract Pivot sheet model columns to map colLetter and guide prices
const pivotColMap = {};
if (wsPivot) {
  for (let c = 4; c <= 200; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const bluCell = wsPivot[`${colLetter}8`];
    const seriesCell = wsPivot[`${colLetter}10`];
    const inchCell = wsPivot[`${colLetter}11`];

    if (seriesCell && seriesCell.v !== undefined && inchCell && inchCell.v !== undefined) {
      const blu = bluCell ? String(bluCell.v).trim() : 'OTHER';
      const series = String(seriesCell.v).trim();
      const inch = String(inchCell.v).trim();
      let modelName = `${inch}${series}`;
      if (/^\d+$/.test(series)) modelName = `${series}${inch}`;

      pivotColMap[modelName] = { colLetter, blu, series, inch };
    }
  }
}

// Build Pivot Key Map for row lookups
const pivotRowMap = {};
if (wsPivot) {
  for (let r = 11; r <= 3000; r++) {
    const keyCell = wsPivot[`B${r}`];
    if (keyCell && keyCell.v) {
      pivotRowMap[String(keyCell.v).trim()] = r;
    }
  }
}

// Parse '가공Raw' sheet to discover ALL models and aggregate PnL by sub and month
const allModelsMap = {};
const subPnlRawMap = {};
const subCodeList = Object.keys(subsidiaries);
subCodeList.forEach(s => subPnlRawMap[s] = {});

if (wsRaw) {
  const range = XLSX.utils.decode_range(wsRaw['!ref'] || 'A1:AA35000');
  for (let r = 1; r <= range.e.r; r++) {
    const sub = wsRaw[XLSX.utils.encode_cell({r: r, c: 0})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 0})].v).trim() : '';
    const sinModel = wsRaw[XLSX.utils.encode_cell({r: r, c: 2})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 2})].v).trim() : '';
    const blu = wsRaw[XLSX.utils.encode_cell({r: r, c: 3})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 3})].v).trim() : '';
    const chodaeyeong = wsRaw[XLSX.utils.encode_cell({r: r, c: 4})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 4})].v).trim() : '';
    const nanocell = wsRaw[XLSX.utils.encode_cell({r: r, c: 5})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 5})].v).trim() : '';
    const inch = wsRaw[XLSX.utils.encode_cell({r: r, c: 6})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 6})].v).trim() : '';
    const series = wsRaw[XLSX.utils.encode_cell({r: r, c: 7})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 7})].v).trim() : '';
    const month = wsRaw[XLSX.utils.encode_cell({r: r, c: 11})]? String(wsRaw[XLSX.utils.encode_cell({r: r, c: 11})].v).trim() : '';

    if (!series || !inch) continue;

    let modelName = `${inch}${series}`;
    if (/^\d+$/.test(series)) modelName = `${series}${inch}`;

    if (!allModelsMap[modelName]) {
      allModelsMap[modelName] = {
        modelName,
        blu: blu || (pivotColMap[modelName]?.blu || 'OTHER'),
        series,
        inch,
        sinModel: sinModel || '신모델',
        chodaeyeong: chodaeyeong || (Number(inch) >= 75 ? '초대형' : 'X'),
        nanocell: nanocell || 'X',
        months: new Set(),
        colLetter: pivotColMap[modelName]?.colLetter || null
      };
    }

    if (month) allModelsMap[modelName].months.add(month);

    if (subCodeList.includes(sub)) {
      if (!subPnlRawMap[sub][modelName]) {
        subPnlRawMap[sub][modelName] = {
          total: { qty: 0, gSales: 0, netSales: 0, materialCost: 0, processingCost: 0, royaltyCost: 0, otherCogs: 0, sgnaDirect: 0, sgnaTotal: 0, coi: 0, marginalProfit: 0 },
          monthly: {}
        };
      }
      const p = subPnlRawMap[sub][modelName];
      const q = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 12})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 12})].v : 0);
      const g = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 13})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 13})].v : 0);
      const n = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 14})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 14})].v : 0);
      const mat = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 15})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 15})].v : 0);
      const proc = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 16})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 16})].v : 0);
      const gCost = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 17})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 17})].v : 0);
      const roy = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 18})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 18})].v : 0);
      const cogsVal = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 20})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 20})].v : 0);
      const oth = (cogsVal !== 0) ? (cogsVal - mat - proc - roy) : (Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 19})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 19})].v : 0) + gCost);
      const sga = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 21})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 21})].v : 0);
      const coiVal = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 26})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 26})].v : 0);
      const mpVal = Number(wsRaw[XLSX.utils.encode_cell({r: r, c: 27})]? wsRaw[XLSX.utils.encode_cell({r: r, c: 27})].v : 0);

      p.total.qty += q;
      p.total.gSales += g;
      p.total.netSales += n;
      p.total.materialCost += mat;
      p.total.processingCost += proc;
      p.total.royaltyCost += roy;
      p.total.otherCogs += oth;
      p.total.sgnaTotal += sga;
      p.total.coi += coiVal;
      p.total.marginalProfit += mpVal;

      if (month) {
        if (!p.monthly[month]) {
          p.monthly[month] = { qty: 0, gSales: 0, netSales: 0, materialCost: 0, processingCost: 0, royaltyCost: 0, otherCogs: 0, sgnaDirect: 0, sgnaTotal: 0, coi: 0, marginalProfit: 0 };
        }
        const mObj = p.monthly[month];
        mObj.qty += q;
        mObj.gSales += g;
        mObj.netSales += n;
        mObj.materialCost += mat;
        mObj.processingCost += proc;
        mObj.royaltyCost += roy;
        mObj.otherCogs += oth;
        mObj.sgnaTotal += sga;
        mObj.coi += coiVal;
        mObj.marginalProfit += mpVal;
      }
    }
  }
}

// 3. Simulator Sheet - Guide prices & Baseline inputs
const wsSim = wb.Sheets['Simulator'];
const simModelColMap = {};
if (wsSim) {
  for (let c = 6; c <= 100; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const nameCell = wsSim[`${colLetter}11`];
    if (nameCell && nameCell.v) {
      const nameStr = String(nameCell.v).trim();
      const rrpGuideCell = wsSim[`${colLetter}15`];
      const promoGuideCell = wsSim[`${colLetter}16`];
      const rrpSimulCell = wsSim[`${colLetter}17`];
      const promoSimulCell = wsSim[`${colLetter}18`];
      const fmRrpCell = wsSim[`${colLetter}22`];
      const fmPromoCell = wsSim[`${colLetter}23`];

      simModelColMap[colLetter] = {
        colLetter,
        modelName: nameStr,
        rrpGuide: rrpGuideCell && typeof rrpGuideCell.v === 'number' ? rrpGuideCell.v : null,
        promoGuide: promoGuideCell && typeof promoGuideCell.v === 'number' ? promoGuideCell.v : null,
        rrpSimul: rrpSimulCell && typeof rrpSimulCell.v === 'number' ? rrpSimulCell.v : null,
        promoSimul: promoSimulCell && typeof promoSimulCell.v === 'number' ? promoSimulCell.v : null,
        fmRrp: fmRrpCell && typeof fmRrpCell.v === 'number' ? fmRrpCell.v : 0.25,
        fmPromo: fmPromoCell && typeof fmPromoCell.v === 'number' ? fmPromoCell.v : 0.10,
      };
    }
  }
}

// 4. Assemble Baseline Dataset
console.log(`[4/4] Assembling Subsidiary & Model baseline datasets...`);
const modelsList = Object.values(allModelsMap).map(m => ({
  modelName: m.modelName,
  blu: m.blu,
  series: m.series,
  inch: m.inch,
  colLetter: m.colLetter,
  sinModel: m.sinModel,
  chodaeyeong: m.chodaeyeong,
  nanocell: m.nanocell,
  months: m.months.size > 0 ? Array.from(m.months) : ['7월', '8월', '9월', '10월', '11월', '12월']
}));

console.log(`Discovered ${modelsList.length} total models across all sinModel categories.`);

const dataset = {
  metadata: {
    generatedAt: new Date().toISOString(),
    sourceFile: '★손익 Simulator_26년 7월차 선행_1차.xlsx',
    defaultQuarter: '3Q'
  },
  subsidiaries,
  models: modelsList,
  pnlData: {} // subCode -> modelName -> metrics
};

subCodeList.forEach(subCode => {
  dataset.pnlData[subCode] = {};

  modelsList.forEach(m => {
    let qty = 0, gSales = 0, netSales = 0, materialCost = 0, processingCost = 0, royaltyCost = 0, otherCogs = 0, sgnaTotal = 0, coi = 0, marginalProfit = 0;

    const rawData = subPnlRawMap[subCode]?.[m.modelName];
    const raw = rawData?.total;

    if (raw) {
      qty = raw.qty;
      gSales = raw.gSales;
      netSales = raw.netSales;
      materialCost = raw.materialCost;
      processingCost = raw.processingCost;
      royaltyCost = raw.royaltyCost;
      otherCogs = raw.otherCogs;
      sgnaTotal = raw.sgnaTotal;
      coi = raw.coi;
      marginalProfit = raw.marginalProfit;
    } else if (m.colLetter && wsPivot) {
      const colL = m.colLetter;
      const getVal = (prefix) => {
        const rowNum = pivotRowMap[`${subCode}${prefix}`];
        if (!rowNum) return 0;
        const cell = wsPivot[`${colL}${rowNum}`];
        if (!cell || cell.v === undefined || cell.v === null) return 0;
        return typeof cell.v === 'number' ? cell.v : (parseFloat(cell.v) || 0);
      };
      qty = getVal('합계 : 수량');
      gSales = getVal('합계 : G.매출액');
      netSales = getVal('합계 : Net매출액');
      materialCost = getVal('합계 : 재료비');
      processingCost = getVal('합계 : 가공비');
      royaltyCost = getVal('합계 : 로열티');
      otherCogs = getVal('합계 : COGS기타');
      sgnaTotal = getVal('합계 : 판관비');
      coi = getVal('합계 : 영업이익');
      marginalProfit = getVal('합계 : 한계이익');
    }

    const gAsp = qty > 0 ? (gSales / qty) : 0;
    const netPrice = qty > 0 ? (netSales / qty) : 0;
    const deductionRate = gSales > 0 ? (1 - (netSales / gSales)) : 0;

    const simInfo = Object.values(simModelColMap).find(s => s.modelName === m.modelName || s.modelName === `${m.series}${m.inch}`);

    dataset.pnlData[subCode][m.modelName] = {
      subCode,
      modelName: m.modelName,
      blu: m.blu,
      series: m.series,
      inch: m.inch,
      qty,
      gSales,
      netSales,
      gAsp,
      netPrice,
      deductionRate,
      monthlyPnl: rawData?.monthly || {},
      cogs: {
        materialCost,
        processingCost,
        royaltyCost,
        otherCogs,
        totalCogs: materialCost + processingCost + royaltyCost + otherCogs
      },
      sgna: {
        sgnaDirect: sgnaTotal,
        sgnaTotal
      },
      coi,
      marginalProfit,
      guide: simInfo ? {
        rrpGuide: simInfo.rrpGuide,
        promoGuide: simInfo.promoGuide,
        rrpSimul: simInfo.rrpSimul,
        promoSimul: simInfo.promoSimul,
        fmRrp: simInfo.fmRrp,
        fmPromo: simInfo.fmPromo
      } : {
        rrpGuide: null,
        promoGuide: null,
        rrpSimul: null,
        promoSimul: null,
        fmRrp: 0.25,
        fmPromo: 0.10
      }
    };
  });
});

// Output files
const jsonStr = JSON.stringify(dataset, null, 2);
const jsonPath = path.join(__dirname, 'simulator_data.json');
fs.writeFileSync(jsonPath, jsonStr, 'utf8');

const jsPath = path.join(__dirname, 'simulator_data.js');
fs.writeFileSync(jsPath, `window.SIMULATOR_DATA = ${jsonStr};`, 'utf8');

console.log(`✅ Prebuilding complete! Created simulator_data.json (${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB) and simulator_data.js.`);
