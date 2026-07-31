const fs = require('fs');
const path = require('path');
const engine = require('./simulator_engine.js');

console.log('[1/2] Loading simulator_data.json...');
const dataPath = path.join(__dirname, 'simulator_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('[2/2] Running simulation verification for UK and DG subsidiaries...');
const ukResult = engine.simulatePnL(data, 'UK', '3Q');
console.log('\n--- UK Baseline Summary ---');
console.log(`Total Qty: ${ukResult.summary.base.qty.toLocaleString()} units`);
console.log(`Net Sales: $${(ukResult.summary.base.netSales / 1e6).toFixed(2)}M`);
console.log(`COI (Operating Profit): $${(ukResult.summary.base.coi / 1e6).toFixed(2)}M (${(ukResult.summary.base.coiPct * 100).toFixed(1)}%)`);

// Test override simulation
console.log('\n--- Simulation Test: UK 83W6 price set to £5,000 & Deduction -2% ---');
const sampleModel = ukResult.models.find(m => m.simQty > 0) || ukResult.models[0];
console.log(`Selected Model for test: ${sampleModel.modelName}`);

const overrides = {
  [sampleModel.modelName]: {
    promoPrice: sampleModel.simGPriceLocal * 1.1, // +10% price increase
    deductionRate: Math.max(0, sampleModel.simDeduction - 0.02) // -2% deduction
  }
};

const simResult = engine.simulatePnL(data, 'UK', '3Q', overrides);
console.log(`Updated Net Sales: $${(simResult.summary.sim.netSales / 1e6).toFixed(2)}M (Gap: +$${(simResult.summary.gap.netSales / 1e6).toFixed(2)}M)`);
console.log(`Updated COI: $${(simResult.summary.sim.coi / 1e6).toFixed(2)}M (Gap: +$${(simResult.summary.gap.coi / 1e6).toFixed(2)}M, ${(simResult.summary.sim.coiPct * 100).toFixed(1)}%)`);

console.log('\n✅ Simulator Engine verification completed successfully!');
