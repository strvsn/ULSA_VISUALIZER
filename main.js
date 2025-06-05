import { setupWindChart, setupAxisWheelZoom, windChart, windChartCanvas } from './windChart.js';
import { connectSerial, disconnectSerial } from './serial.js';
import { setupUI } from './ui.js';

// --- Chart.jsで風速履歴グラフ（ズーム・パン対応） ---
export let windHistory = [];
export const MAX_HISTORY_POINTS = 864000; // 24時間分（10Hz）
export let timeRangeSec = 10; // デフォルト10秒
export let chartDrawingEnabled = true; // グラフ描画ON/OFF

// グラフ・UI初期化
document.addEventListener('DOMContentLoaded', () => {
  setupWindChart();
  setupAxisWheelZoom();

  // --- タイムスケールボタンに1時間・1日を追加 ---
  const timeBtns = document.querySelectorAll('.time-range-btn');
  const btnGroup = timeBtns.length ? timeBtns[0].parentElement : null;
  if (btnGroup) {
    // 1時間（3600秒）
    const btn1h = document.createElement('button');
    btn1h.type = 'button';
    btn1h.className = 'btn btn-outline-secondary time-range-btn';
    btn1h.setAttribute('data-range', '3600');
    btn1h.textContent = '1時間';
    btnGroup.appendChild(btn1h);

    // 1日（86400秒）
    const btn1d = document.createElement('button');
    btn1d.type = 'button';
    btn1d.className = 'btn btn-outline-secondary time-range-btn';
    btn1d.setAttribute('data-range', '86400');
    btn1d.textContent = '1日';
    btnGroup.appendChild(btn1d);
  }

  // --- タイムスケールボタン機能 ---
  // ここで再取得し、変数名が重複しないように修正
  const timeBtnsAll = document.querySelectorAll('.time-range-btn');
  timeBtnsAll.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = Number(btn.getAttribute('data-range'));
      timeRangeSec = range;
      timeBtnsAll.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // 横軸のみmin/maxを変更し、常に最新データが右端に来るようにする
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
  timeBtns.forEach(btn => {
    if (btn.getAttribute('data-range') === String(timeRangeSec)) btn.classList.add('active');
  });

  // --- CSV保存ボタンとズームリセットボタン ---
  let csvBtn = document.getElementById('csvSaveBtn');
  if (!csvBtn) {
    csvBtn = document.createElement('button');
    csvBtn.textContent = 'CSV保存';
    csvBtn.className = 'btn btn-success mb-3 ms-2';
    csvBtn.id = 'csvSaveBtn';
    const chartArea = document.getElementById('chartArea');
    if (chartArea && chartArea.parentNode) {
      chartArea.parentNode.insertBefore(csvBtn, chartArea.nextSibling);
    }
  }
  csvBtn.onclick = () => {
    if (!windHistory.length) return;
    let csv = '時刻(ms単位),風速(m/s),風向(°),機首風速(m/s),音速(m/s),音仮温度(℃)\n';
    windHistory.forEach(e => {
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
    a.download = 'wind_history.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // --- グラフズームリセットボタンをCSV保存ボタンの横に追加 ---
  let resetBtn = document.getElementById('zoomResetBtn');
  if (!resetBtn) {
    resetBtn = document.createElement('button');
    resetBtn.textContent = 'ズームリセット';
    resetBtn.className = 'btn btn-outline-secondary mb-3 ms-2';
    resetBtn.id = 'zoomResetBtn';
    csvBtn.parentNode.insertBefore(resetBtn, csvBtn.nextSibling);
  }
  resetBtn.onclick = () => {
    if (windChart && windChart.resetZoom) {
      windChart.resetZoom();
    }
  };

  // --- ここで接続・切断ボタンの初期化を追加 ---
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

  // --- ログ記録開始・停止ボタン追加 ---
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

  // ログ情報表示用div
  window.logInfoDiv = document.getElementById('logInfoDiv');
  if (!window.logInfoDiv) {
    window.logInfoDiv = document.createElement('div');
    window.logInfoDiv.id = 'logInfoDiv';
    window.logInfoDiv.className = 'mb-3 ms-2 text-secondary small';
    logStartBtn.parentNode.insertBefore(window.logInfoDiv, logStopBtn.nextSibling);
  }

  // ログ情報更新関数
  function updateLogInfo() {
    if (!window.isLogging || !window.logStartTime || !window.logInfoDiv) {
      if (window.logInfoDiv) window.logInfoDiv.textContent = '';
      return;
    }
    const now = new Date();
    const durationSec = Math.floor((now - window.logStartTime) / 1000);
    // データ容量の表示をカンマ区切り＋単位付きに変更
    import('./chart.js').then(mod => {
      const formatBytes = mod.formatBytes || (b => `${b} B`);
      window.logInfoDiv.textContent = `記録時間: ${durationSec} 秒　データ容量: ${formatBytes(window.logByteSize)}`;
    });
  }

  // ログ記録開始
  logStartBtn.onclick = () => {
    window.isLogging = true;
    window.logStartTime = new Date();
    window.logData = [];
    window.logByteSize = 0;
    logStartBtn.disabled = true;
    logStopBtn.disabled = false;
    updateLogInfo();
  };

  // ログ記録停止＆CSV保存
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

  // 記録中は1秒ごとに情報更新
  setInterval(() => {
    if (window.isLogging) updateLogInfo();
  }, 1000);

  // --- 既存のタイムスケールボタンやズームリセットボタン等の初期化 ---
  const allTimeBtns = document.querySelectorAll('.time-range-btn');
  allTimeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = Number(btn.getAttribute('data-range'));
      timeRangeSec = range;
      allTimeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // 横軸のみmin/maxを変更し、常に最新データが右端に来るようにする
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
  timeBtns.forEach(btn => {
    if (btn.getAttribute('data-range') === String(timeRangeSec)) btn.classList.add('active');
  });
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