import { setupWindChart, setupAxisWheelZoom, windChart, windChartCanvas, resetFollowLatest } from './windChart.js';
import { connectSerial, disconnectSerial } from './serial.js';
import { setupUI } from './ui.js';
import { formatBytes } from './utils.js';
import { initDeviceConsole } from './modules/deviceConsole.js';
import { isDarkMode, initDarkMode, applyDarkMode } from './modules/darkMode.js';
import { initializeFpsMonitor, reportFps } from './modules/fpsMonitor.js';
import { initLogButtonsAndInfo, autoDownloadAndResetLog } from './modules/logging.js';
import { drawWindGauge } from './modules/windGauge.js';
import { 
  currentWindSpeedUnit,
  windSpeedUnits,
  convertWindSpeed,
  getCurrentGaugeMax,
  initGaugeMaxButton,  setupWindSpeedUnitButtons,
  updateRealtimeValuesWithUnit
} from './modules/windUnitManager.js';

// --- Chart.js data management and core functionality ---
// ** Chart.js パフォーマンス最適化実装済み（FPS低下問題解決）**
// 1. メモリ使用量削減: 履歴データを36,000ポイント（1時間分）に制限
// 2. Chart.js更新の重複防止: pendingChartUpdate フラグで連続更新をブロック
// 3. バッチ削除: 古いデータを1000ポイント単位で効率的に削除
// 4. 10分間平均計算の最適化: 時系列逆順検索でbreakによる早期終了
// 5. データ重複チェック: 10ms以内の同一タイムスタンプをスキップ
// 6. Chart.js更新間隔制御の厳密化: 16ms（60fps相当）でのデバウンス処理
// 7. FPS監視の改善: 25FPS閾値、3回連続低FPSでアラート
// 8. リサイズイベントのデバウンス: 100ms間隔での処理制限
export let windHistory = [];
export const MAX_HISTORY_POINTS = 36000; // ** 最適化: 1時間分（10Hz）に制限してメモリ使用量を大幅削減**
export let timeRangeSec = 10; // デフォルト10秒
export let chartDrawingEnabled = true; // グラフ描画ON/OFF

// Chart drawing enabled setter for external modules
export function setChartDrawingEnabled(enabled) {
  chartDrawingEnabled = enabled;
}

// バッチ更新処理のための変数
let updateQueue = [];
let lastUpdateTime = 0;
let currentUpdateInterval = 100; // デフォルト100ms
let lastChartUpdateTime = 0; // チャート専用の更新時間

// ** メモリリーク対策: タイマー管理**
let batchUpdateTimer = null; // バッチ更新タイマーの参照を保持

// ** メモリリーク対策: タイマー管理**
let batchUpdateTimerId = null; // バッチ処理タイマーID

// 10分間平均風速キャッシュ（パフォーマンス最適化）
let cached10MinAvg = '--';
let last10MinCalcTime = 0;
const CALC_10MIN_INTERVAL = 5000; // 5秒間隔で再計算

// タイムスケール別更新間隔の設定
// 注意: この間隔はチャート表示のみに影響し、ログ記録頻度には影響しません
function getChartUpdateInterval(timeRangeSec) {
  // 1日表示以上では更新間隔を制御してパフォーマンスを向上
  if (timeRangeSec >= 86400) return 1000; // 1日表示: 1秒間隔（大幅制限）
  if (timeRangeSec >= 21600) return 800;  // 6時間表示: 800ms間隔（制限）
  if (timeRangeSec >= 3600) return 500;   // 1時間表示: 500ms間隔（制限）
  if (timeRangeSec >= 900) return 300;    // 15分表示: 300ms間隔（軽度制限）
  return 0; // 15分未満: 制限なし
}

function initTimeScaleButtons() {
  const timeBtnsAll = document.querySelectorAll('.time-range-btn');
  timeBtnsAll.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = Number(btn.getAttribute('data-range'));
      timeRangeSec = range;
      timeBtnsAll.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (windChart) {
        // パフォーマンス計測開始
        const startTime = performance.now();
        
        // タイムスケール別最適化を適用
        import('./windChart.js').then(({ optimizeChartForTimeScale }) => {
          optimizeChartForTimeScale(range);
          
          // チャート更新間隔を調整
          currentUpdateInterval = getChartUpdateInterval(range);
          // console.debug(`Chart update interval set to ${currentUpdateInterval}ms for ${range}s range`);
          
          const now = new Date();
          const minTime = new Date(now.getTime() - range * 1000);
          windChart.options.scales.x.min = minTime;
          windChart.options.scales.x.max = now;
          windChart.update('none');
            // パフォーマンス計測終了
          const endTime = performance.now();
          const duration = endTime - startTime;
          if (duration > 100) {
            console.warn(`Heavy time scale update: ${duration.toFixed(1)}ms for ${range}s range`);
          }
        });
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
        resetFollowLatest();
      }
    };
  }
}

function initSerialButtons() {
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  if (connectBtn) {
    connectBtn.classList.add('btn', 'btn-primary', 'mb-3', 'ms-2');
    connectBtn.innerHTML = `<i class="bi bi-usb-symbol"></i> 接続`;
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

function initChartToggleButton() {
  const chartToggleBtn = document.getElementById('chartToggleBtn');
  if (chartToggleBtn) {
    // 初期状態を設定（描画ON）
    chartToggleBtn.checked = chartDrawingEnabled;
    
    chartToggleBtn.addEventListener('change', () => {
      // チェックボックスの状態を取得
      chartDrawingEnabled = chartToggleBtn.checked;
      
      if (chartDrawingEnabled) {
        console.info('Chart drawing enabled by user toggle');
      } else {
        console.info('Chart drawing disabled by user toggle');
      }
    });
  }
}

export function updateToggleButtonState(isEnabled) {
  const chartToggleBtn = document.getElementById('chartToggleBtn');
  if (chartToggleBtn) {
    chartToggleBtn.checked = isEnabled;
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
  initChartToggleButton();
  initDarkMode();
  initializeFpsMonitor();
  setupWindSpeedUnitButtons();
  initGaugeMaxButton();    // 初期背景アークを描画（デフォルト値0でグレー部分表示、風向0°）
  drawWindGauge(0, 0);  // ** パフォーマンス最適化: バッチ処理タイマー間隔調整**
  // バッチ更新処理タイマーを開始（CPU使用率削減のため500ms間隔に変更）
  // 注意: 現在はqueueDataUpdate()で即座更新に変更されているため、このバッチ処理は実質的に無効化状態
  // ** メモリリーク対策: タイマー参照を保持してクリーンアップ可能にする**
  batchUpdateTimer = setInterval(processBatchUpdate, 500); // 50ms → 500ms（CPU使用率削減）
  console.log('Batch update timer started (500ms interval, currently bypassed by real-time updates)');
  console.log('Batch update timer started (500ms interval, currently bypassed by real-time updates)');
  
  console.log('All initialization completed successfully');  
  // ** WebWorker デバッグ機能追加**
  // 開発者コンソールでWebWorkerの状態を確認可能にする
  window.checkWebWorkerStatus = function() {
    import('./windChart.js').then(({ getWebWorkerStatus }) => {
      const status = getWebWorkerStatus();
      console.log('WebWorker Status:', status);
      return status;
    });
  };
    // WebWorkerテスト実行
  window.testWebWorkerLTTB = function() {
    import('./windChart.js').then(({ applyWebWorkerLTTBDecimation }) => {
      console.log('🚀 Testing WebWorker LTTB decimation...');
      applyWebWorkerLTTBDecimation((error, result) => {
        if (error) {
          console.error('❌ WebWorker LTTB test failed:', error);
        } else {
          console.log('✅ WebWorker LTTB test completed:', result);
          if (result.processingTime) {
            console.log(`⚡ Processing time: ${result.processingTime.toFixed(2)}ms`);
            console.log(`📊 Data points: ${result.originalCount} → ${result.decimatedCount}`);
          }
        }
      });
    });
  };
    // WebWorkerエラーデバッグ機能
  window.debugWebWorkerError = function() {
    import('./windChart.js').then(({ getWebWorkerStatus }) => {
      console.log('Debugging WebWorker Error:');
      console.log('1. WebWorker Status:', getWebWorkerStatus());
      
      if (window.windChart) {
        console.log('2. Chart Data Structure:');
        console.log('  - Labels:', window.windChart.data?.labels?.length || 'undefined');
        console.log('  - Datasets:', window.windChart.data?.datasets?.length || 'undefined');
        console.log('  - Decimation Config:', window.windChart.options?.plugins?.decimation);
        
        console.log('3. Chart Data Sample:');
        if (window.windChart.data?.labels) {
          console.log('  - First label:', window.windChart.data.labels[0]);
          console.log('  - Last label:', window.windChart.data.labels[window.windChart.data.labels.length - 1]);
        }
        if (window.windChart.data?.datasets?.[0]?.data) {
          const data = window.windChart.data.datasets[0].data;
          console.log('  - First data point:', data[0]);
          console.log('  - Last data point:', data[data.length - 1]);
        }
      } else {
        console.log('2. Chart not initialized');
      }
    });
  };
    console.log('🚀 WebWorker LTTB debug functions available:');
  console.log('  - window.checkWebWorkerStatus(): Check WebWorker LTTB status');
  console.log('  - window.testWebWorkerLTTB(): Test WebWorker LTTB decimation');
  console.log('  - window.debugWebWorkerError(): Debug WebWorker LTTB errors');
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
    
    // 15分経過チェックと累積時間表示（自動ダウンロード機能）
    const now = new Date();
    // 累積時間計算（logTotalStartTimeから計算）
    const totalDurationSec = window.logTotalStartTime ? Math.floor((now - window.logTotalStartTime) / 1000) : 0;
    // 15分チェック用（logStartTimeから計算）
    const currentPartDuration = window.logStartTime ? Math.floor((now - window.logStartTime) / 1000) : 0;
    const AUTO_SPLIT_INTERVAL = 900; // 15分 = 900秒
    
    if (currentPartDuration >= AUTO_SPLIT_INTERVAL) {
      autoDownloadAndResetLog();
      // 自動分割後、次のパート用にlogStartTimeを更新
      window.logStartTime = new Date();
    }
    
    if (window.logInfoDiv) {
      // 累積時間をhh:mm:ss形式に変換
      const hours = Math.floor(totalDurationSec / 3600);
      const minutes = Math.floor((totalDurationSec % 3600) / 60);
      const seconds = totalDurationSec % 60;
      const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      const partNum = window.logPartNumber ? ` (パート${window.logPartNumber})` : '';
      window.logInfoDiv.textContent = `記録時間: ${formattedTime}　データ容量: ${formatBytes(window.logByteSize)}${partNum}`;
    }
  }
}

// autoDownloadAndResetLog function moved to mainUIFeatures.js

// updateRealtimeValues now delegates to imported function from mainUIFeatures.js
export function updateRealtimeValues(noseWind, soundSpeed, soundTemp, avg10minWind) {
  updateRealtimeValuesWithUnit(noseWind, soundSpeed, soundTemp, avg10minWind);
}

// All wind speed unit management, gauge management, drawWindGauge, and FPS monitoring functions moved to mainUIFeatures.js

// バッチ更新処理関数（現在は無効化状態）
function processBatchUpdate() {
  // ** パフォーマンス最適化: バッチ処理無効化**
  // queueDataUpdate()で即座更新に変更されているため、この関数は無効化
  // CPU使用率削減のため、処理をスキップ
  if (!windChart || updateQueue.length === 0) return;
  
  // ** 最適化: 軽量ログ出力のみ**
  if (updateQueue.length > 0) {
    updateQueue = []; // キューをクリア
  }
  
  // 注意: 実際のチャート更新はqueueDataUpdate()で直接実行されます
}

// 10分間平均風速を計算（キャッシュ最適化版）
function calculate10MinAverage() {
  const now = performance.now();
  
  // 5秒間隔でのみ再計算（パフォーマンス最適化）
  if (now - last10MinCalcTime < CALC_10MIN_INTERVAL) {
    return cached10MinAvg;
  }
  
  try {
    const currentTime = new Date();
    const tenMinAgo = new Date(currentTime.getTime() - 10 * 60 * 1000);
    
    // **🚀 最適化1: より効率的なフィルタリング**
    // windHistoryは時系列順なので、後ろから検索してbreakで最適化
    const validData = [];
    for (let i = windHistory.length - 1; i >= 0; i--) {
      const entry = windHistory[i];
      if (entry.time < tenMinAgo) break; // 時系列順なので、ここで打ち切り
      if (isFinite(entry.speed) && entry.time <= currentTime) {
        validData.push(Number(entry.speed));
      }
    }
    
    if (validData.length > 0) {
      // **🚀 最適化2: reduce最適化**
      const sum = validData.reduce((total, speed) => total + speed, 0);
      cached10MinAvg = sum / validData.length;
    } else {
      cached10MinAvg = '--';
    }
  } catch (e) {
    console.warn('Error calculating 10-min average:', e);
    cached10MinAvg = '--';
  }
  
  last10MinCalcTime = now;
  return cached10MinAvg;
}

// リアルタイム表示更新（ゲージ、数値表示）
function updateRealtimeDisplays(data) {
  // ゲージを即座に更新
  drawWindGauge(Number(data.speed), Number(data.direction));
  
  // 数値表示を即座に更新（キャッシュされた10分間平均を使用）
  const avg10minWind = calculate10MinAverage();
  
  updateRealtimeValues(data.noseWind, data.soundSpeed, data.soundTemp, avg10minWind);
}

// データキューに追加する関数（バッチ処理インターバル一時撤廃版）
export function queueDataUpdate(speed, direction, noseWind, soundSpeed, soundTemp) {
  const timestamp = new Date();
  
  // **🚀 パフォーマンス最適化1: データ重複チェック**
  // 同一タイムスタンプのデータは追加しない
  if (windHistory.length > 0) {
    const lastEntry = windHistory[windHistory.length - 1];
    if (Math.abs(timestamp - lastEntry.time) < 10) { // 10ms以内は重複とみなす
      return; // 重複データはスキップ
    }
  }
  
  const entry = {
    time: timestamp,
    speed: Number(speed),
    direction: Number(direction),
    noseWind: Number(noseWind),
    soundSpeed: Number(soundSpeed),
    soundTemp: Number(soundTemp)
  };
  
  // windHistoryに追加（ログ記録とは独立）
  windHistory.push(entry);  // **🚀 パフォーマンス最適化2: メモリ使用量制限**
  // windHistoryのサイズ制限（メモリ最適化：1時間分に制限）
  const maxHistoryPoints = Math.min(MAX_HISTORY_POINTS, 36000); // 36,000ポイント = 約1時間
  if (windHistory.length > maxHistoryPoints) {    // **🚀 最適化3: バッチ削除**
    // 一度に複数ポイントを削除（パフォーマンス向上）
    const deleteCount = Math.min(1000, windHistory.length - maxHistoryPoints);
    windHistory.splice(0, deleteCount);
  }
  
  // ログ記録は常に実行（チャート更新間隔に依存しない）
  if (typeof addLogData === 'function') addLogData(entry);
  
  // **🚀 パフォーマンス最適化4: Chart更新頻度制御の改善**
  // 【一時的変更】バッチ処理を撤廃し、即座にチャート更新を実行
  if (chartDrawingEnabled) {
    const currentTime = performance.now();
    
    // **🚀 最適化5: 更新間隔制御をより厳密に**
    // currentUpdateIntervalを考慮した更新制御
    if (currentUpdateInterval === 0 || currentTime - lastChartUpdateTime >= currentUpdateInterval) {
      const startTime = performance.now();
      
      import('./windChart.js').then(({ updateWindChart }) => {
        updateWindChart(speed, direction, noseWind, soundSpeed, soundTemp);
          // パフォーマンス計測
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // **🚀 最適化6: 警告しきい値を調整**
        if (duration > 100) { // 100ms以上の場合のみ警告
          console.warn(`Heavy real-time chart update: ${duration.toFixed(1)}ms (optimized)`);
        }
        
        lastChartUpdateTime = currentTime;
      });
    }
  }
  
  // **🚀 パフォーマンス最適化7: リアルタイム表示の最適化**
  // 常にリアルタイム表示を即座に更新（軽量処理のため制限なし）
  const latestData = {
    speed,
    direction,
    noseWind,
    soundSpeed,
    soundTemp
  };
  updateRealtimeDisplays(latestData);
}

// **🚀 メモリリーク対策: タイマークリーンアップ機能**
// アプリケーション終了時やページアンロード時にタイマーをクリアする関数
export function cleanupTimers() {
  if (batchUpdateTimer) {
    clearInterval(batchUpdateTimer);
    batchUpdateTimer = null;
    console.log('✅ Batch update timer cleared');
  }
  
  // ログ関連タイマーもクリーンアップ
  import('./modules/logging.js').then(({ cleanupLoggingTimers }) => {
    cleanupLoggingTimers();
  }).catch(err => console.warn('Failed to cleanup logging timers:', err));
}

// ページアンロード時の自動クリーンアップ
window.addEventListener('beforeunload', () => {
  cleanupTimers();
});

// ページ非表示時の自動クリーンアップ（タブ切り替え、最小化など）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.debug('🔍 Page hidden - maintaining timers (will cleanup on unload)');
  }
});

// Wind speed units and unit management functions moved to mainUIFeatures.js

// updateRealtimeValuesWithUnit function moved to mainUIFeatures.js

// Test functions moved to mainUIFeatures.js