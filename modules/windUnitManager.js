// windUnitManager.js - Wind speed unit management and conversion functions

import { isDarkMode } from './darkMode.js';

// **🚀 メモリリーク対策: イベントリスナー管理**
let windUnitEventListeners = []; // 登録されたイベントリスナーの追跡
let gaugeMaxEventListener = null; // ゲージ最大値ボタンのイベントリスナー

// Wind speed unit management
export let currentWindSpeedUnit = 'm/s'; // Default is m/s
export const windSpeedUnits = ['m/s', 'cm/s', 'km/h'];

// Last wind direction and speed values for gauge redrawing
let lastWindDirection = 0;
let lastWindSpeed = 0;

// Gauge maximum values by unit
const gaugeMaxValuesByUnit = {
  'm/s': [1, 5, 10, 25, 60],
  'cm/s': [10, 50, 100, 250, 500],
  'km/h': [5, 25, 50, 100, 200]
};
let currentMaxIndex = 0; // Initial value is first index
let currentGaugeMax = gaugeMaxValuesByUnit[currentWindSpeedUnit][currentMaxIndex];

// Wind speed conversion function
export function convertWindSpeed(valueInMps, targetUnit) {
  // Return as number if value is not finite or not a number (NaN/undefined converted to Number)
  const numValue = Number(valueInMps);
  if (!isFinite(numValue)) return numValue;
  
  switch(targetUnit) {
    case 'cm/s':
      return numValue * 100; // m/s to cm/s
    case 'km/h':
      return numValue * 3.6; // m/s to km/h
    case 'm/s':
    default:
      return numValue; // As is
  }
}

// Get current gauge maximum value (in m/s unit)
export function getCurrentGaugeMax() {
  // Return gauge maximum in current unit converted to m/s
  const currentMaxInCurrentUnit = gaugeMaxValuesByUnit[currentWindSpeedUnit][currentMaxIndex];
  
  // If current unit is not m/s, convert back to m/s
  switch(currentWindSpeedUnit) {
    case 'cm/s':
      return currentMaxInCurrentUnit / 100; // cm/s → m/s
    case 'km/h':
      return currentMaxInCurrentUnit / 3.6; // km/h → m/s
    case 'm/s':
    default:
      return currentMaxInCurrentUnit; // As is
  }
}

// Initialize gauge maximum value change button
export function initGaugeMaxButton() {
  console.log('🔧 initGaugeMaxButton called');
  const gaugeMaxBtn = document.getElementById('gaugeMaxBtn');
  
  if (!gaugeMaxBtn) {
    console.error('❌ gaugeMaxBtn element not found');
    return;
  }
  
  console.log('✅ gaugeMaxBtn element found:', gaugeMaxBtn);
    // Set initial button display
  updateGaugeMaxButtonDisplay();
  console.log('📝 Initial button display updated');
  
  // **🚀 メモリリーク対策: 既存のイベントリスナーをクリア**
  if (gaugeMaxEventListener) {
    gaugeMaxBtn.removeEventListener('click', gaugeMaxEventListener);
    console.log('🧹 Removed existing gaugeMaxBtn event listener');
  }
  
  // イベントリスナー関数を定義
  gaugeMaxEventListener = () => {
    console.log('🖱️ gaugeMaxBtn clicked!');
    
    // Get maximum value array for current unit
    const currentMaxValues = gaugeMaxValuesByUnit[currentWindSpeedUnit];
    console.log('📊 Current max values:', currentMaxValues);
    console.log('📍 Current index before:', currentMaxIndex);
    
    // Change to next maximum value (cycle)
    currentMaxIndex = (currentMaxIndex + 1) % currentMaxValues.length;
    currentGaugeMax = currentMaxValues[currentMaxIndex];
    
    console.log('📍 New index:', currentMaxIndex);
    console.log('📈 New max value:', currentGaugeMax);
    
    // Update button display
    updateGaugeMaxButtonDisplay();
    console.log('📝 Button display updated');
    
    // Redraw gauge (use last actual value)
    // Note: lastWindSpeed is in original unit (m/s), so accurate redrawing is possible
    import('./windGauge.js').then(({ drawWindGauge }) => {
      drawWindGauge(lastWindSpeed, lastWindDirection, 0, currentGaugeMax);
      console.log('🎨 Gauge redrawn with new max:', currentGaugeMax);
    });
    
    // Also update Chart.js wind speed axis range to sync with gauge maximum
    import('../windChartUtils.js').then(({ adjustWindSpeedAxisRange }) => {
      adjustWindSpeedAxisRange();
      console.log('📊 Chart axis range adjusted');
    });
  };
  
  // イベントリスナーを登録
  gaugeMaxBtn.addEventListener('click', gaugeMaxEventListener);
  
  console.log('✅ gaugeMaxBtn event listener attached');
}

// Update gauge maximum button display according to current unit
function updateGaugeMaxButtonDisplay() {
  const gaugeMaxBtn = document.getElementById('gaugeMaxBtn');
  
  if (!gaugeMaxBtn) {
    console.error('❌ gaugeMaxBtn element not found in updateGaugeMaxButtonDisplay');
    return;
  }
  
  const currentMaxValues = gaugeMaxValuesByUnit[currentWindSpeedUnit];
  currentGaugeMax = currentMaxValues[currentMaxIndex];
  const newText = `${currentGaugeMax} ${currentWindSpeedUnit}`;
  
  gaugeMaxBtn.textContent = newText;
}

// Set up wind speed unit button click handlers
export function setupWindSpeedUnitButtons() {
  const gaugeUnitBtn = document.getElementById('gaugeUnitBtn');
  const noseWindUnitBtn = document.getElementById('noseWindUnitBtn');
  const avg10minWindUnitBtn = document.getElementById('avg10minWindUnitBtn');

  function cycleUnit() {
    const currentIndex = windSpeedUnits.indexOf(currentWindSpeedUnit);
    const nextIndex = (currentIndex + 1) % windSpeedUnits.length;
    currentWindSpeedUnit = windSpeedUnits[nextIndex];
    
    // Update all unit button texts
    if (gaugeUnitBtn) gaugeUnitBtn.textContent = currentWindSpeedUnit;
    if (noseWindUnitBtn) noseWindUnitBtn.textContent = currentWindSpeedUnit;
    if (avg10minWindUnitBtn) avg10minWindUnitBtn.textContent = currentWindSpeedUnit;
    
    // Recalculate and display currently shown values with new unit
    updateAllWindDisplaysWithNewUnit();
  }

  // Set click events on each button
  if (gaugeUnitBtn) gaugeUnitBtn.addEventListener('click', cycleUnit);
  if (noseWindUnitBtn) noseWindUnitBtn.addEventListener('click', cycleUnit);
  if (avg10minWindUnitBtn) avg10minWindUnitBtn.addEventListener('click', cycleUnit);
}

// Update all wind speed displays with current unit
function updateAllWindDisplaysWithNewUnit() {
  // Update gauge maximum button display with new unit
  updateGaugeMaxButtonDisplay();
  
  // Redraw gauge value
  if (typeof lastWindSpeed !== 'undefined' && typeof lastWindDirection !== 'undefined') {
    import('./windGauge.js').then(({ drawWindGauge }) => {
      drawWindGauge(lastWindSpeed, lastWindDirection);
    });
  }
  
  // Update Chart.js axis labels and reconvert existing data
  import('../windChart.js').then(({ updateWindSpeedAxisLabel, convertExistingChartData, adjustWindSpeedAxisRange }) => {
    updateWindSpeedAxisLabel();
    adjustWindSpeedAxisRange();
    convertExistingChartData();
  });
  
  // Re-update numerical displays (from latest history data)
  import('../main.js').then(({ windHistory }) => {
    if (windHistory.length > 0) {
      const latest = windHistory[windHistory.length - 1];
      
      // Calculate 10-minute average wind speed
      let avg10minWind = 0;
      try {
        const now = new Date();
        const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const arr = windHistory.filter(e => e.time >= tenMinAgo && e.time <= now && isFinite(e.speed));
        if (arr.length > 0) {
          avg10minWind = arr.reduce((sum, e) => sum + Number(e.speed), 0) / arr.length;
        }
      } catch (e) {
        // Use default value on error
      }
      
      updateRealtimeValuesWithUnit(latest.noseWind, latest.soundSpeed, latest.soundTemp, avg10minWind);
    }
  });
}

// Numerical display update function considering unit conversion
export function updateRealtimeValuesWithUnit(noseWind, soundSpeed, soundTemp, avg10minWind) {
  // Set appropriate decimal places according to unit
  let precision = 2;
  if (currentWindSpeedUnit === 'cm/s') {
    precision = 0; // cm/s displays as integer
  } else if (currentWindSpeedUnit === 'km/h') {
    precision = 1; // km/h displays with 1 decimal place
  }

  const noseWindSpan = document.getElementById('noseWindValue');
  const avg10minWindSpan = document.getElementById('avg10minWindValue'); // Fixed: correct ID
  
  if (noseWindSpan) {
    const convertedNoseWind = convertWindSpeed(noseWind, currentWindSpeedUnit);
    noseWindSpan.textContent = (isFinite(convertedNoseWind) && typeof convertedNoseWind === 'number') 
      ? convertedNoseWind.toFixed(precision) 
      : '--';
  }
  
  // Sound speed and sound temperature don't have unit conversion
  const soundSpeedSpan = document.getElementById('soundSpeedValue');
  const soundTempSpan = document.getElementById('soundTempValue');
  if (soundSpeedSpan) soundSpeedSpan.textContent = isFinite(soundSpeed) ? Number(soundSpeed).toFixed(2) : '--';
  if (soundTempSpan) soundTempSpan.textContent = isFinite(soundTemp) ? Number(soundTemp).toFixed(2) : '--';
  
  // Display 10-minute average wind speed (use value received as argument)
  if (avg10minWindSpan) {
    if (isFinite(avg10minWind) && typeof avg10minWind === 'number') {
      const convertedAvg = convertWindSpeed(avg10minWind, currentWindSpeedUnit);
      avg10minWindSpan.textContent = convertedAvg.toFixed(precision);
    } else {
      avg10minWindSpan.textContent = '--';
    }
  }
}

// Internal function to update last wind values for gauge redrawing
export function updateLastWindValues(speed, direction) {
  lastWindSpeed = speed;
  lastWindDirection = direction;
}

// Function to get last wind data for other modules
export function getLastWindData() {
  return {
    lastWindSpeed: lastWindSpeed,
    lastWindDirection: lastWindDirection
  };
}