// logging.js - Data logging and CSV export functionality

import { formatBytes } from '../utils.js';

// **🚀 メモリリーク対策: タイマー管理**
let logInfoUpdateTimerId = null; // ログ情報更新タイマーID

// =====================================================
// LOGGING SYSTEM
// =====================================================

export function initLogButtonsAndInfo() {
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
    if (!window.isLogging || !window.logTotalStartTime || !window.logInfoDiv) {
      if (window.logInfoDiv) window.logInfoDiv.textContent = '';
      return;
    }
    const now = new Date();
    const durationSec = Math.floor((now - window.logTotalStartTime) / 1000);
    
    // 時間をhh:mm:ss形式に変換
    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor((durationSec % 3600) / 60);
    const seconds = durationSec % 60;
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const partNum = window.logPartNumber ? ` (パート${window.logPartNumber})` : '';
    window.logInfoDiv.textContent = `記録時間: ${formattedTime}　データ容量: ${formatBytes(window.logByteSize)}${partNum}`;
  }
    logStartBtn.onclick = () => {
    window.isLogging = true;
    window.logStartTime = new Date();
    window.logTotalStartTime = new Date(); // 累計記録時間用の開始時間
    window.logData = [];
    window.logByteSize = 0;
    window.logPartNumber = 1; // パート番号をリセット
    logStartBtn.disabled = true;
    logStopBtn.disabled = false;
    updateLogInfo();
    
    // **🚀 メモリリーク対策: 既存タイマーをクリアしてから新規作成**
    if (logInfoUpdateTimerId !== null) {
      clearInterval(logInfoUpdateTimerId);
    }
    logInfoUpdateTimerId = setInterval(() => {
      if (window.isLogging) updateLogInfo();
    }, 1000);
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
    
    // ファイル名をYYMMDD_hhmmss_ulsavis_log.csv形式で生成
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const hh = now.getHours().toString().padStart(2, '0');
    const min = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    const partSuffix = window.logPartNumber && window.logPartNumber > 1 ? `_part${window.logPartNumber}` : '';
    a.download = `${yy}${mm}${dd}_${hh}${min}${ss}_ulsavis_log${partSuffix}.csv`;
    
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);  };
  
  // **🚀 メモリリーク対策: タイマー参照を保持してクリーンアップ可能にする**
  logInfoUpdateTimerId = setInterval(() => {
    if (window.isLogging) updateLogInfo();
  }, 1000);
  console.log('✅ Log info update timer started (1000ms interval)');
}

// 自動ダウンロード機能：15分経過時にCSVファイルを自動保存してバッファをクリア
export function autoDownloadAndResetLog() {
  if (!window.logData.length || !window.isLogging) return;
  
  // パート番号を管理（初回は1、以降は増加）
  if (!window.logPartNumber) window.logPartNumber = 1;
  
  // CSVデータを生成
  let csv = '時刻(ms単位),風速(m/s),風向(°),機首風速(m/s),音速(m/s),音仮温度(℃)\n';
  window.logData.forEach(e => {
    let d = e.time instanceof Date ? e.time : new Date(e.time);
    const pad = n => n.toString().padStart(2, '0');
    const pad3 = n => n.toString().padStart(3, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
    csv += `${ts},${e.speed},${e.direction},${e.noseWind},${e.soundSpeed},${e.soundTemp}\n`;
  });
  
  // ファイル名を生成（パート番号付き）
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  const partSuffix = window.logPartNumber > 1 ? `_part${window.logPartNumber}` : '';
  const filename = `${yy}${mm}${dd}_${hh}${min}${ss}_ulsavis_log${partSuffix}.csv`;
  
  // ダウンロードを実行
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  
  // バッファをクリアして次のログ記録を開始
  window.logData = [];
  window.logByteSize = 0;
  window.logPartNumber++;
  
  // 通知表示（SweetAlert2があれば使用）
  if (window.Swal) {
    Swal.fire({
      icon: 'info',
      title: '自動保存完了',
      text: `ログファイル「${filename}」を保存しました。記録を継続中...（累積時間は継続されます）`,
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  } else {
    console.log(`自動保存: ${filename} (15分経過のため自動分割、累積時間は継続)`);
  }
}

// **🚀 メモリリーク対策: ログ関連タイマークリーンアップ機能**
export function cleanupLoggingTimers() {
  if (logInfoUpdateTimerId) {
    clearInterval(logInfoUpdateTimerId);
    logInfoUpdateTimerId = null;
    console.log('✅ Log info update timer cleared');
  }
}
