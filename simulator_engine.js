/**
 * LGE Europe TV Profitability Simulation Engine (Enhanced for Excel Matrix & Hybrid Views)
 * Supports model-as-column matrix layout & comprehensive cost/price simulation
 */

(function (exports) {
  /**
   * Run simulation for a specific subsidiary, quarter, and selected models
   * @param {Object} data - window.SIMULATOR_DATA
   * @param {String} subCode - Selected subsidiary (e.g. 'UK', 'DG', 'EU')
   * @param {String} quarter - Selected quarter ('1Q', '2Q', '3Q', '4Q', 'Year')
   * @param {Array} selectedModelNames - List of model names to include in simulation matrix
   * @param {Object} overrides - Model overrides { [modelName]: { rrpPrice, promoPrice, deductionRate, qty, materialCostPct, sgnaPct } }
   */
  function simulatePnL(data, subCode = 'UK', quarter = '3Q', selectedModelNames = null, overrides = {}, selectedMonths = null) {
    if (!data || !data.subsidiaries || !data.pnlData) {
      throw new Error('Invalid SIMULATOR_DATA structure');
    }

    const subInfo = data.subsidiaries[subCode] || data.subsidiaries['UK'];
    const monthList = (selectedMonths && (Array.isArray(selectedMonths) ? selectedMonths : Array.from(selectedMonths)));

    const exRate = subInfo.exRates[quarter] || subInfo.exRates['3Q'] || 1;
    const vatRate = subInfo.vat || 0.20;

    const subPnl = data.pnlData[subCode] || {};

    // Filter model list if specified
    const activeModels = (selectedModelNames && selectedModelNames.length > 0)
      ? data.models.filter(m => selectedModelNames.includes(m.modelName))
      : data.models;

    const modelResults = [];
    const bluMap = {};

    let totalBaseQty = 0, totalSimQty = 0;
    let totalBaseGSales = 0, totalSimGSales = 0;
    let totalBaseNetSales = 0, totalSimNetSales = 0;
    let totalBaseMaterial = 0, totalSimMaterial = 0;
    let totalBaseProcessing = 0, totalSimProcessing = 0;
    let totalBaseRoyalty = 0, totalSimRoyalty = 0;
    let totalBaseOtherCogs = 0, totalSimOtherCogs = 0;
    let totalBaseCogs = 0, totalSimCogs = 0;
    let totalBaseSgnaDirect = 0, totalSimSgnaDirect = 0;
    let totalBaseSgnaTotal = 0, totalSimSgnaTotal = 0;
    let totalBaseCoi = 0, totalSimCoi = 0;
    let totalBaseMp = 0, totalSimMp = 0;

    activeModels.forEach(m => {
      const modelName = m.modelName;
      const rawBase = subPnl[modelName];
      let base = rawBase || {
        qty: 0, gSales: 0, netSales: 0, gAsp: 0, netPrice: 0, deductionRate: 0,
        cogs: { materialCost: 0, processingCost: 0, royaltyCost: 0, otherCogs: 0, totalCogs: 0 },
        sgna: { sgnaDirect: 0, sgnaTotal: 0 },
        coi: 0, marginalProfit: 0, guide: { rrpGuide: null, promoGuide: null, fmRrp: 0.15, fmPromo: 0.15 }
      };

      if (rawBase && rawBase.monthlyPnl && monthList && monthList.length > 0 && monthList.length < 6) {
        let mQty = 0, mGSales = 0, mNetSales = 0, mMat = 0, mProc = 0, mRoy = 0, mOth = 0, mSga = 0, mCoi = 0, mMp = 0;
        let foundMonthData = false;

        monthList.forEach(mo => {
          const mData = rawBase.monthlyPnl[mo];
          if (mData) {
            foundMonthData = true;
            mQty += mData.qty || 0;
            mGSales += mData.gSales || 0;
            mNetSales += mData.netSales || 0;
            mMat += mData.materialCost || 0;
            mProc += mData.processingCost || 0;
            mRoy += mData.royaltyCost || 0;
            mOth += mData.otherCogs || 0;
            mSga += mData.sgnaTotal || 0;
            mCoi += mData.coi || 0;
            mMp += mData.marginalProfit || 0;
          }
        });

        if (foundMonthData) {
          const mGAsp = mQty > 0 ? (mGSales / mQty) : 0;
          const mNetPrice = mQty > 0 ? (mNetSales / mQty) : 0;
          const mDeduction = mGSales > 0 ? (1 - (mNetSales / mGSales)) : 0;

          base = {
            ...rawBase,
            qty: mQty,
            gSales: mGSales,
            netSales: mNetSales,
            gAsp: mGAsp,
            netPrice: mNetPrice,
            deductionRate: mDeduction,
            cogs: {
              materialCost: mMat,
              processingCost: mProc,
              royaltyCost: mRoy,
              otherCogs: mOth,
              totalCogs: mMat + mProc + mRoy + mOth
            },
            sgna: {
              sgnaDirect: mSga,
              sgnaTotal: mSga
            },
            coi: mCoi,
            marginalProfit: mMp
          };
        }
      }

      const ovr = overrides[modelName] || {};

      // 1. Quantity (Volume)
      const simQty = (ovr.qty !== undefined && ovr.qty !== null && ovr.qty !== '')
        ? Number(ovr.qty)
        : base.qty;

      const qtyRatio = base.qty > 0 ? (simQty / base.qty) : (simQty > 0 ? 1 : 0);

      // 2. Pricing Elements (Local Currency)
      const baseGAspLocal = base.gAsp / (exRate || 1);
      let simGPriceLocal = baseGAspLocal;

      if (ovr.promoPrice !== undefined && ovr.promoPrice !== null && ovr.promoPrice !== '') {
        simGPriceLocal = Number(ovr.promoPrice);
      } else if (ovr.rrpPrice !== undefined && ovr.rrpPrice !== null && ovr.rrpPrice !== '') {
        simGPriceLocal = Number(ovr.rrpPrice);
      }

      const simGAspUSD = simGPriceLocal * exRate;
      const simGSalesUSD = simGAspUSD * simQty;

      // 3. Deduction Rate (%) & Net Sales ($)
      const simDeduction = (ovr.deductionRate !== undefined && ovr.deductionRate !== null && ovr.deductionRate !== '')
        ? Number(ovr.deductionRate)
        : base.deductionRate;

      const simNetSalesUSD = simGSalesUSD * (1 - simDeduction);
      const simNetPriceUSD = simQty > 0 ? (simNetSalesUSD / simQty) : 0;

      // 4. Cost Elements ($) with optional cost adjustments
      const matAdj = (ovr.materialCostPct !== undefined && ovr.materialCostPct !== null) ? Number(ovr.materialCostPct) : 0;
      const sgnaAdj = (ovr.sgnaPct !== undefined && ovr.sgnaPct !== null) ? Number(ovr.sgnaPct) : 0;

      const simMaterialCostUSD = (base.cogs.materialCost * (1 + matAdj)) * qtyRatio;
      const simProcessingCostUSD = base.cogs.processingCost * qtyRatio;
      const simRoyaltyCostUSD = base.cogs.royaltyCost * qtyRatio;
      const simOtherCogsUSD = base.cogs.otherCogs * qtyRatio;
      const simCogsUSD = simMaterialCostUSD + simProcessingCostUSD + simRoyaltyCostUSD + simOtherCogsUSD;

      const simSgnaDirectUSD = (base.sgna.sgnaDirect * (1 + sgnaAdj)) * qtyRatio;
      const simSgnaTotalUSD = (base.sgna.sgnaTotal * (1 + sgnaAdj)) * qtyRatio;

      // 5. Profitability Metrics (COI & Marginal Profit)
      const simCoiUSD = simNetSalesUSD - simCogsUSD - simSgnaTotalUSD;
      const simCoiPct = simNetSalesUSD > 0 ? (simCoiUSD / simNetSalesUSD) : 0;

      const deltaNetSalesUSD = simNetSalesUSD - (base.netSales * qtyRatio);
      const simMpUSD = (base.marginalProfit * qtyRatio) + deltaNetSalesUSD - (simMaterialCostUSD - base.cogs.materialCost * qtyRatio) - (simSgnaTotalUSD - base.sgna.sgnaTotal * qtyRatio);
      const simMpPct = simNetSalesUSD > 0 ? (simMpUSD / simNetSalesUSD) : 0;

      // Base derivation for comparison
      const baseCoiPct = base.netSales > 0 ? (base.coi / base.netSales) : 0;
      const baseMpPct = base.netSales > 0 ? (base.marginalProfit / base.netSales) : 0;

      // Front Margin / Total Dealer Margin (Default 25% for RRP, 10% for Promo)
      const fmRrp = (ovr.fmRrp !== undefined && ovr.fmRrp !== null && ovr.fmRrp !== '')
        ? Number(ovr.fmRrp)
        : 0.25;
      const fmPromo = (ovr.fmPromo !== undefined && ovr.fmPromo !== null && ovr.fmPromo !== '')
        ? Number(ovr.fmPromo)
        : 0.10;

      // Estimated Retail & Promo prices in Local Currency
      // Formula: (Simul. Price Local * (1 + VAT)) / (1 - Margin%)
      const estRrpLocal = (fmRrp < 1) ? (simGPriceLocal * (1 + vatRate)) / (1 - fmRrp) : 0;
      const estPromoLocal = (fmPromo < 1) ? (simGPriceLocal * (1 + vatRate)) / (1 - fmPromo) : 0;

      const res = {
        modelName,
        blu: m.blu,
        series: m.series,
        inch: m.inch,
        sinModel: m.sinModel,
        chodaeyeong: m.chodaeyeong,
        nanocell: m.nanocell,
        months: m.months,

        // Basic Info
        currency: subInfo.currency,
        exRate,
        vatRate,
        guideRrpEur: base.guide?.rrpGuide || null,
        guidePromoEur: base.guide?.promoGuide || null,
        fmRrp,
        fmPromo,
        estRrpLocal,
        estPromoLocal,

        // Base Metrics
        baseQty: base.qty,
        baseGSales: base.gSales,
        baseNetSales: base.netSales,
        baseGAspLocal,
        baseGAspUSD: base.gAsp,
        baseNetPriceUSD: base.netPrice,
        baseDeduction: base.deductionRate,
        baseMaterial: base.cogs.materialCost,
        baseProcessing: base.cogs.processingCost,
        baseRoyalty: base.cogs.royaltyCost,
        baseOtherCogs: base.cogs.otherCogs,
        baseCogs: base.cogs.totalCogs,
        baseSgnaDirect: base.sgna.sgnaDirect,
        baseSgnaTotal: base.sgna.sgnaTotal,
        baseCoi: base.coi,
        baseCoiPct,
        baseMp: base.marginalProfit,
        baseMpPct,

        // Sim Metrics
        simQty,
        simGPriceLocal,
        simGAspUSD,
        simGSalesUSD,
        simDeduction,
        simNetSalesUSD,
        simNetPriceUSD,
        simMaterialCostUSD,
        simProcessingCostUSD,
        simRoyaltyCostUSD,
        simOtherCogsUSD,
        simCogsUSD,
        simSgnaDirectUSD,
        simSgnaTotalUSD,
        simCoiUSD,
        simCoiPct,
        simMpUSD,
        simMpPct,

        // Gaps (Sim vs Base)
        gapQty: simQty - base.qty,
        gapGSalesUSD: simGSalesUSD - base.gSales,
        gapNetSalesUSD: simNetSalesUSD - base.netSales,
        gapGPriceLocal: simGPriceLocal - baseGAspLocal,
        gapDeduction: simDeduction - base.deductionRate,
        gapNetPriceUSD: simNetPriceUSD - base.netPrice,
        gapCoiUSD: simCoiUSD - base.coi,
        gapCoiPct: simCoiPct - baseCoiPct,
        gapMpUSD: simMpUSD - base.marginalProfit,
        gapMpPct: simMpPct - baseMpPct
      };

      modelResults.push(res);

      // Totals
      totalBaseQty += base.qty;
      totalSimQty += simQty;
      totalBaseGSales += base.gSales;
      totalSimGSales += simGSalesUSD;
      totalBaseNetSales += base.netSales;
      totalSimNetSales += simNetSalesUSD;
      totalBaseMaterial += base.cogs.materialCost;
      totalSimMaterial += simMaterialCostUSD;
      totalBaseProcessing += base.cogs.processingCost;
      totalSimProcessing += simProcessingCostUSD;
      totalBaseRoyalty += base.cogs.royaltyCost;
      totalSimRoyalty += simRoyaltyCostUSD;
      totalBaseOtherCogs += base.cogs.otherCogs;
      totalSimOtherCogs += simOtherCogsUSD;
      totalBaseCogs += base.cogs.totalCogs;
      totalSimCogs += simCogsUSD;
      totalBaseSgnaDirect += base.sgna.sgnaDirect;
      totalSimSgnaDirect += simSgnaDirectUSD;
      totalBaseSgnaTotal += base.sgna.sgnaTotal;
      totalSimSgnaTotal += simSgnaTotalUSD;
      totalBaseCoi += base.coi;
      totalSimCoi += simCoiUSD;
      totalBaseMp += base.marginalProfit;
      totalSimMp += simMpUSD;

      // Group by BLU
      if (!bluMap[m.blu]) {
        bluMap[m.blu] = { blu: m.blu, baseQty: 0, simQty: 0, baseNetSales: 0, simNetSales: 0, baseCoi: 0, simCoi: 0 };
      }
      bluMap[m.blu].baseQty += base.qty;
      bluMap[m.blu].simQty += simQty;
      bluMap[m.blu].baseNetSales += base.netSales;
      bluMap[m.blu].simNetSales += simGSalesUSD;
      bluMap[m.blu].baseCoi += base.coi;
      bluMap[m.blu].simCoi += simCoiUSD;
    });

    const summary = {
      subCode,
      quarter,
      currency: subInfo.currency,
      exRate,
      vatRate,
      base: {
        qty: totalBaseQty,
        gSales: totalBaseGSales,
        netSales: totalBaseNetSales,
        material: totalBaseMaterial,
        processing: totalBaseProcessing,
        royalty: totalBaseRoyalty,
        otherCogs: totalBaseOtherCogs,
        cogs: totalBaseCogs,
        sgnaDirect: totalBaseSgnaDirect,
        sgna: totalBaseSgnaTotal,
        coi: totalBaseCoi,
        coiPct: totalBaseNetSales > 0 ? (totalBaseCoi / totalBaseNetSales) : 0,
        mp: totalBaseMp,
        mpPct: totalBaseNetSales > 0 ? (totalBaseMp / totalBaseNetSales) : 0
      },
      sim: {
        qty: totalSimQty,
        gSales: totalSimGSales,
        netSales: totalSimNetSales,
        material: totalSimMaterial,
        processing: totalSimProcessing,
        royalty: totalSimRoyalty,
        otherCogs: totalSimOtherCogs,
        cogs: totalSimCogs,
        sgnaDirect: totalSimSgnaDirect,
        sgna: totalSimSgnaTotal,
        coi: totalSimCoi,
        coiPct: totalSimNetSales > 0 ? (totalSimCoi / totalSimNetSales) : 0,
        mp: totalSimMp,
        mpPct: totalSimNetSales > 0 ? (totalSimMp / totalSimNetSales) : 0
      },
      gap: {
        qty: totalSimQty - totalBaseQty,
        gSales: totalSimGSales - totalBaseGSales,
        netSales: totalSimNetSales - totalBaseNetSales,
        cogs: totalSimCogs - totalBaseCogs,
        sgna: totalSimSgnaTotal - totalBaseSgnaTotal,
        coi: totalSimCoi - totalBaseCoi,
        coiPct: (totalSimNetSales > 0 ? (totalSimCoi / totalSimNetSales) : 0) - (totalBaseNetSales > 0 ? (totalBaseCoi / totalBaseNetSales) : 0),
        mp: totalSimMp - totalBaseMp,
        mpPct: (totalSimNetSales > 0 ? (totalSimMp / totalSimNetSales) : 0) - (totalBaseNetSales > 0 ? (totalBaseMp / totalBaseNetSales) : 0)
      }
    };

    return {
      summary,
      models: modelResults,
      bluSummary: Object.values(bluMap)
    };
  }

  exports.simulatePnL = simulatePnL;
})(typeof exports === 'undefined' ? (window.SimulatorEngine = {}) : exports);
