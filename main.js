import { setupWindChart, setupAxisWheelZoom, windChart, windChartCanvas } from './windChart.js';
import { connectSerial, disconnectSerial } from './serial.js';
import { setupUI } from './ui.js';

// --- Chart.jsで風速履歴グラフ（ズーム・パン対応） ---
export let windHistory = [];
export const MAX_HISTORY_POINTS = 864000; // 24時間分（10Hz）
export let timeRangeSec = 10; // デフォルト10秒
export let chartDrawingEnabled = true; // グラフ描画ON/OFF

function initTimeScaleButtons() {
  const timeBtnsAll = document.querySelectorAll('.time-range-btn');
  timeBtnsAll.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = Number(btn.getAttribute('data-range'));
      timeRangeSec = range;
      timeBtnsAll.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (windChart) {
        const now = new Date();
        const minTime = new Date(now.getTime() - range * 1000);
        windChart.options.scales.x.min = minTime;
        windChart.options.scales.x.max = now;
        windChart.update('none');
      }
    });
  });
  // 初期選択
  let found = false;
  timeBtnsAll.forEach(btn => {
    if (btn.getAttribute('data-range') === String(timeRangeSec)) {
      btn.classList.add('active');
      found = true;
    }
  });
  if (!found && timeBtnsAll.length) timeBtnsAll[0].classList.add('active');
}

function initZoomResetButton() {
  const resetBtn = document.getElementById('zoomResetBtn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (windChart && windChart.resetZoom) {
        windChart.resetZoom();
      }
    };
  }
}

function initSerialButtons() {
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  if (connectBtn) {
    connectBtn.classList.add('btn', 'btn-primary', 'mb-3', 'ms-2');
    connectBtn.innerHTML = `<i class="bi bi-usb"></i> 接続`;
    connectBtn.disabled = false;
    connectBtn.onclick = connectSerial;
  }
  if (disconnectBtn) {
    disconnectBtn.classList.add('btn', 'btn-secondary', 'mb-3', 'ms-2');
    disconnectBtn.innerHTML = `<i class="bi bi-x-circle"></i> 切断`;
    disconnectBtn.disabled = true;
    disconnectBtn.onclick = disconnectSerial;
  }
}

function initLogButtonsAndInfo() {
  let logStartBtn = document.getElementById('logStartBtn');
  if (!logStartBtn) {
    logStartBtn = document.createElement('button');
    logStartBtn.textContent = 'ログ記録開始';
    logStartBtn.className = 'btn btn-primary mb-3 ms-2';
    logStartBtn.id = 'logStartBtn';
    const chartArea = document.getElementById('chartArea');
    if (chartArea && chartArea.parentNode) {
      chartArea.parentNode.insertBefore(logStartBtn, chartArea.nextSibling);
    }
  }
  let logStopBtn = document.getElementById('logStopBtn');
  if (!logStopBtn) {
    logStopBtn = document.createElement('button');
    logStopBtn.textContent = 'ログ記録停止';
    logStopBtn.className = 'btn btn-danger mb-3 ms-2';
    logStopBtn.id = 'logStopBtn';
    logStopBtn.disabled = true;
    logStartBtn.parentNode.insertBefore(logStopBtn, logStartBtn.nextSibling);
  }
  window.logInfoDiv = document.getElementById('logInfoDiv');
  if (!window.logInfoDiv) {
    window.logInfoDiv = document.createElement('div');
    window.logInfoDiv.id = 'logInfoDiv';
    window.logInfoDiv.className = 'mb-3 ms-2 text-secondary small';
    logStartBtn.parentNode.insertBefore(window.logInfoDiv, logStopBtn.nextSibling);
  }
  function updateLogInfo() {
    if (!window.isLogging || !window.logStartTime || !window.logInfoDiv) {
      if (window.logInfoDiv) window.logInfoDiv.textContent = '';
      return;
    }
    const now = new Date();
    const durationSec = Math.floor((now - window.logStartTime) / 1000);
    import('./chart.js').then(mod => {
      const formatBytes = mod.formatBytes || (b => `${b} B`);
      window.logInfoDiv.textContent = `記録時間: ${durationSec} 秒　データ容量: ${formatBytes(window.logByteSize)}`;
    });
  }
  logStartBtn.onclick = () => {
    window.isLogging = true;
    window.logStartTime = new Date();
    window.logData = [];
    window.logByteSize = 0;
    logStartBtn.disabled = true;
    logStopBtn.disabled = false;
    updateLogInfo();
  };
  logStopBtn.onclick = () => {
    window.isLogging = false;
    logStartBtn.disabled = false;
    logStopBtn.disabled = true;
    updateLogInfo();
    if (!window.logData.length) return;
    let csv = '時刻(ms単位),風速(m/s),風向(°),機首風速(m/s),音速(m/s),音仮温度(℃)\n';
    window.logData.forEach(e => {
      let d = e.time instanceof Date ? e.time : new Date(e.time);
      const pad = n => n.toString().padStart(2, '0');
      const pad3 = n => n.toString().padStart(3, '0');
      const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
      csv += `${ts},${e.speed},${e.direction},${e.noseWind},${e.soundSpeed},${e.soundTemp}\n`;
    });
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wind_log.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };
  setInterval(() => {
    if (window.isLogging) updateLogInfo();
  }, 1000);
}

function initDeviceConsole() {
  let deviceConsole = document.getElementById('deviceConsole');
  if (!deviceConsole) {
    deviceConsole = document.createElement('pre');
    deviceConsole.id = 'deviceConsole';
    deviceConsole.style = 'background:#222;color:#b4ffb4;padding:8px;font-size:0.85em;max-height:8.5em;min-height:8.5em;overflow-y:auto;margin:8px 0 0 0;text-align:left;line-height:1.4;';
    deviceConsole.textContent = '';
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.appendChild(deviceConsole);
    else document.body.appendChild(deviceConsole);
  }
  window.appendDeviceConsole = (msg, type = 'recv') => {
    if (!deviceConsole) return;
    const prefix = type === 'send' ? '[SEND] ' : '[RECV] ';
    deviceConsole.textContent += prefix + msg + '\n';
    deviceConsole.scrollTop = deviceConsole.scrollHeight;
  };
}

function initChartStartStopButtons() {
  const chartStartBtn = document.getElementById('chartStartBtn');
  const chartStopBtn = document.getElementById('chartStopBtn');
  if (chartStartBtn && chartStopBtn) {
    chartStartBtn.onclick = () => {
      chartDrawingEnabled = true;
      chartStartBtn.disabled = true;
      chartStopBtn.disabled = false;
    };
    chartStopBtn.onclick = () => {
      chartDrawingEnabled = false;
      chartStartBtn.disabled = false;
      chartStopBtn.disabled = true;
    };
    chartStartBtn.disabled = true;
    chartStopBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupWindChart();
  setupAxisWheelZoom();
  initTimeScaleButtons();
  initZoomResetButton();
  initSerialButtons();
  initLogButtonsAndInfo();
  initDeviceConsole();
  initChartStartStopButtons();
});

// <script type="module" src="main.js"></script>

// updateWindChartからログ記録処理を呼び出すためにexport
export function addLogData(entry) {
  if (window.isLogging) {
    window.logData.push(entry);
    // 1行分のCSV文字列長を加算
    const d = entry.time instanceof Date ? entry.time : new Date(entry.time);
    const pad = n => n.toString().padStart(2, '0');
    const pad3 = n => n.toString().padStart(3, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
    const line = `${ts},${entry.speed},${entry.direction},${entry.noseWind},${entry.soundSpeed},${entry.soundTemp}\n`;
    window.logByteSize += new Blob([line]).size;
    if (window.logInfoDiv) {
      const now = new Date();
      const durationSec = Math.floor((now - window.logStartTime) / 1000);
      import('./chart.js').then(mod => {
        const formatBytes = mod.formatBytes || (b => `${b} B`);
        window.logInfoDiv.textContent = `記録時間: ${durationSec} 秒　データ容量: ${formatBytes(window.logByteSize)}`;
      });
    }
  }
}