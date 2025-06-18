// windChartUtils.js - Chart.jsユーティリティ・最適化・単位変換機能
// **🚀 WebWorker並列LTTB処理による高速デシメーション**

import { getLTTBWorkerManager } from './modules/lttbWorkerManager.js';

export let windChart = null;

// **🚀 WebWorker並列処理追加**
let workerManager = null;
let webWorkerEnabled = true; // WebWorker使用可否フラグ

// WebWorkerManager初期化
function initWebWorkerManager() {
  if (!workerManager && webWorkerEnabled) {
    try {
      workerManager = getLTTBWorkerManager();
      console.log('LTTB WebWorker manager initialized');
    } catch (error) {
      console.warn('WebWorker not supported, falling back to main thread:', error);
      webWorkerEnabled = false;
    }
  }
}

// windChart.jsから windChart インスタンスを取得する関数
export function setWindChartInstance(chartInstance) {
  windChart = chartInstance;
  // WebWorkerManagerも同時に初期化
  initWebWorkerManager();
}

// リセット後に自動追従を再度有効化する関数
let followLatestEnabled = true;
export function resetFollowLatest() { 
  followLatestEnabled = true; 
}

export function getFollowLatestEnabled() {
  return followLatestEnabled;
}

export function setFollowLatestEnabled(enabled) {
  followLatestEnabled = enabled;
}

// ダークモード切り替え時にチャートテーマを更新する関数
export function updateChartTheme() {
  if (!windChart) return;
  
  // **🚀 最適化1: 不要な更新防止**
  // 既に適用済みの場合はスキップ
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  const currentTextColor = windChart.options.plugins.legend.labels.color;
  const expectedTextColor = isDarkMode ? '#cccccc' : '#333333';
    if (currentTextColor === expectedTextColor) {
    return;
  }
  
  const textColor = expectedTextColor;
  const gridColor = isDarkMode ? '#cccccc' : '#e0e0e0';
  
  // データセットの色をダークモードに対応
  const datasetColors = isDarkMode ? {
    wind: '#5ba7ff',      // 風速: より明るい青
    direction: '#ffcc5c', // 風向: より明るいオレンジ  
    noseWind: '#5ce1c6',  // 機首風速: より明るいティール
    soundSpeed: '#a855f7', // 音速: より明るい紫
    soundTemp: '#ff8c42'   // 音仮温度: より明るいオレンジ
  } : {
    wind: '#0d6efd',      // 風速: 標準の青
    direction: '#f39c12', // 風向: 標準のオレンジ
    noseWind: '#20c997',  // 機首風速: 標準のティール
    soundSpeed: '#6610f2', // 音速: 標準の紫
    soundTemp: '#fd7e14'   // 音仮温度: 標準のオレンジ
  };
  
  // **🚀 最適化2: バッチ更新**
  // 複数の設定変更をまとめて実行
  try {
    // データセットの色を更新
    windChart.data.datasets[0].borderColor = datasetColors.wind;
    windChart.data.datasets[1].borderColor = datasetColors.direction;
    windChart.data.datasets[2].borderColor = datasetColors.noseWind;
    windChart.data.datasets[3].borderColor = datasetColors.soundSpeed;
    windChart.data.datasets[4].borderColor = datasetColors.soundTemp;
    
    // 凡例の色を更新
    windChart.options.plugins.legend.labels.color = textColor;
    
    // 軸とグリッドの色を更新
    const scales = windChart.options.scales;
    
    // X軸の色設定
    if (scales.x) {
      scales.x.title.color = textColor;
      scales.x.ticks.color = textColor;
      scales.x.grid.color = gridColor;
    }
    
    // Y軸の色設定
    if (scales.y) {
      scales.y.title.color = textColor;
      scales.y.ticks.color = textColor;
      scales.y.grid.color = gridColor;
    }
    
    // yTemp軸の色設定
    if (scales.yTemp) {
      scales.yTemp.title.color = textColor;
      scales.yTemp.ticks.color = textColor;
      scales.yTemp.grid.color = gridColor;
    }
    
    // y2軸の色設定
    if (scales.y2) {
      scales.y2.title.color = textColor;
      scales.y2.ticks.color = textColor;
      scales.y2.grid.color = gridColor;
    }
    
    // y3軸の色設定
    if (scales.y3) {
      scales.y3.title.color = textColor;
      scales.y3.ticks.color = textColor;
      scales.y3.grid.color = gridColor;
    }
    
    // ツールチップの色を更新
    windChart.options.plugins.tooltip.backgroundColor = isDarkMode ? '#2d2d2d' : '#ffffff';
    windChart.options.plugins.tooltip.titleColor = textColor;
    windChart.options.plugins.tooltip.bodyColor = textColor;
    windChart.options.plugins.tooltip.borderColor = gridColor;
      // **🚀 最適化3: 単一更新**
    // 最後に一度だけupdateを呼び出し
    windChart.update('none');
  } catch (error) {
    console.warn('Error updating chart theme:', error);
  }
}

// タイムスケール別パフォーマンス最適化
export function optimizeChartForTimeScale(timeRangeSec) {
  if (!windChart) return;
  
  // キャンバス幅を取得（1ピクセル1ポイント用）
  const canvasWidth = windChart.canvas ? windChart.canvas.width : 800; // デフォルト800px
  const actualWidth = Math.floor(canvasWidth / (window.devicePixelRatio || 1)); // DPIを考慮した実際の表示幅
  
  // タイムスケール別デシメーション設定
  let decimationSettings;
  let chartSettings = {};  if (timeRangeSec >= 86400) { // 1日以上
    // **🚀 LTTBアルゴリズムによるWebWorker並列処理**
    decimationSettings = {
      enabled: true,
      algorithm: 'lttb',  // LTTBアルゴリズムを使用
      samples: actualWidth,  // 1ピクセル1ポイント（キャンバス幅に合わせる）
      // **🚀 最適化1: より積極的なデシメーション**
      threshold: actualWidth * 2 // しきい値を2倍に設定して、より積極的にデシメーション
    };
    
    chartSettings = {
      responsive: true,  // レスポンシブ有効化（統一設定）
      devicePixelRatio: window.devicePixelRatio || 1,  // DPI自動検出（統一設定）
      interaction: { 
        mode: 'index', 
        intersect: false,
        // **🚀 最適化2: 長時間表示時のインタラクション軽量化**
        includeInvisible: false
      },
      // **🚀 最適化3: レンダリング頻度制御**
      animation: false,
      maintainAspectRatio: false
    };  } else if (timeRangeSec >= 21600) { // 6時間以上
    decimationSettings = {
      enabled: true,
      algorithm: 'lttb',  // LTTBアルゴリズムを使用
      samples: actualWidth,  // 1ピクセル1ポイント（キャンバス幅に合わせる）
      threshold: actualWidth * 2
    };
    chartSettings = {
      responsive: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      interaction: { mode: 'index', intersect: false }
    };  } else if (timeRangeSec >= 3600) { // 1時間以上
    decimationSettings = {
      enabled: true,
      algorithm: 'lttb',  // LTTBアルゴリズムを使用
      samples: actualWidth,  // 1ピクセル1ポイント（キャンバス幅に合わせる）
      threshold: actualWidth * 1.5
    };
    chartSettings = {
      responsive: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      interaction: { mode: 'index', intersect: false }
    };  } else if (timeRangeSec >= 900) { // 15分以上1時間未満
    decimationSettings = {
      enabled: true,
      algorithm: 'lttb',  // LTTBアルゴリズムを使用
      samples: actualWidth,  // 1ピクセル1ポイント（キャンバス幅に合わせる）
      threshold: actualWidth * 1.2
    };
    chartSettings = {
      responsive: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      interaction: { mode: 'index', intersect: false }
    };
  } else if (timeRangeSec >= 60) { // 1分以上30分未満
    decimationSettings = {
      enabled: false  // 60秒表示ではデシメーションを無効化してスムーズに
    };
    chartSettings = {
      responsive: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      interaction: { mode: 'index', intersect: false }
    };
  } else { // 1分未満（10秒など）
    decimationSettings = {
      enabled: false  // 短時間表示ではデシメーションを完全に無効化
    };
    chartSettings = {
      responsive: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      interaction: { mode: 'index', intersect: false }
    };
  }
  
  // **🚀 最適化4: 設定変更の最小化**
  // 現在の設定と異なる場合のみ更新
  const currentDeciSetting = windChart.options.plugins.decimation;
  const needsDecimationUpdate = !currentDeciSetting || 
    currentDeciSetting.enabled !== decimationSettings.enabled ||
    currentDeciSetting.algorithm !== decimationSettings.algorithm ||
    currentDeciSetting.samples !== decimationSettings.samples;
    if (needsDecimationUpdate) {
    // デシメーション設定を更新
    windChart.options.plugins.decimation = decimationSettings;
    
    // **🚀 長時間表示時のWebWorker並列LTTB処理**
    // 1時間以上の表示でLTTBが有効な場合、WebWorkerによる並列処理を適用
    if (decimationSettings.enabled && decimationSettings.algorithm === 'lttb' && timeRangeSec >= 3600) {
      setTimeout(() => {
        applyWebWorkerLTTBDecimation((error, result) => {
          if (error) {
            console.warn('WebWorker LTTB failed, using Chart.js built-in LTTB:', error.message);
          } else if (!result.skipped) {
            console.log(`🚀 WebWorker LTTB optimization completed for ${timeRangeSec}s timespan`);
            // WebWorker処理完了後にチャートを更新
            windChart.update('none');
          }
        });
      }, 100); // 100ms後に非同期実行
    }
  }
  
  // チャート設定を更新
  Object.assign(windChart.options, chartSettings);
  
  // 全てのタイムスケールで時刻ラベルを斜め表示
  windChart.options.scales.x.ticks.maxRotation = 45;
  windChart.options.scales.x.ticks.minRotation = 45;
  
  // パフォーマンス最適化のため、アニメーションを無効化
  windChart.options.animation = false;
    // **🚀 最適化5: ログ出力の効率化**
  if (needsDecimationUpdate) {
    // Chart optimization applied silently
  }
}

// 風速軸のラベルを現在の単位に合わせて更新する関数
export function updateWindSpeedAxisLabel() {
  if (!windChart) return;
  
  import('./modules/windUnitManager.js').then(({ currentWindSpeedUnit }) => {
    // Y軸のラベルを更新
    windChart.options.scales.y.title.text = `風速 (${currentWindSpeedUnit})`;
    
    // 機首風速の軸ラベルも更新（データセットのラベル）
    windChart.data.datasets[0].label = `風速 (${currentWindSpeedUnit})`;
    windChart.data.datasets[2].label = `機首風速 (${currentWindSpeedUnit})`;
    
    // チャートを更新
    windChart.update('none');
  });
}

// 既存のChart.jsデータを新しい単位で再変換する関数
export function convertExistingChartData() {
  if (!windChart) return;
  
  Promise.all([
    import('./main.js'),
    import('./modules/windUnitManager.js')
  ]).then(([{ windHistory }, { currentWindSpeedUnit, convertWindSpeed }]) => {
    // 既存のChart.jsデータをクリアして再構築
    windChart.data.labels = [];
    windChart.data.datasets[0].data = []; // 風速
    windChart.data.datasets[1].data = []; // 風向
    windChart.data.datasets[2].data = []; // 機首風速
    windChart.data.datasets[3].data = []; // 音速
    windChart.data.datasets[4].data = []; // 音仮温度
    
    // windHistoryから全データを新しい単位で再追加
    windHistory.forEach(entry => {
      const convertedSpeed = convertWindSpeed(Number(entry.speed), currentWindSpeedUnit);
      const convertedNoseWind = convertWindSpeed(Number(entry.noseWind), currentWindSpeedUnit);
      
      windChart.data.labels.push(entry.time);
      windChart.data.datasets[0].data.push(convertedSpeed);
      windChart.data.datasets[1].data.push(Number(entry.direction));
      windChart.data.datasets[2].data.push(convertedNoseWind);
      windChart.data.datasets[3].data.push(Number(entry.soundSpeed));
      windChart.data.datasets[4].data.push(Number(entry.soundTemp));
    });
    
    // チャートを更新
    windChart.update('none');
  });
}

// 風速単位に応じてY軸の最大値を調整する関数
export function adjustWindSpeedAxisRange() {
  if (!windChart) return;
  
  import('./modules/windUnitManager.js').then(({ currentWindSpeedUnit, getCurrentGaugeMax, convertWindSpeed }) => {
    // 現在のゲージ最大値（m/s）を現在の単位に変換してChart.jsの軸に設定
    const gaugeMaxInMps = getCurrentGaugeMax(); // m/s単位でのゲージ最大値を取得
    const maxValue = convertWindSpeed(gaugeMaxInMps, currentWindSpeedUnit);
    
    windChart.options.scales.y.max = maxValue;
    windChart.update('none');
  });
}

// **🚀 WebWorker並列LTTB デシメーション処理**
/**
 * WebWorkerを使用してLTTBデシメーション処理を並列実行
 * @param {Function} callback - 完了時のコールバック(error, result)
 */
export function applyWebWorkerLTTBDecimation(callback) {
  if (!windChart || !workerManager) {
    if (callback) callback(new Error('Chart instance or WorkerManager not available'), null);
    return;
  }

  // 現在のチャートデータを取得
  const labels = windChart.data.labels || [];
  const datasets = windChart.data.datasets || [];
  
  // データが不足している場合はスキップ
  if (labels.length === 0 || datasets.length === 0) {
    if (callback) callback(null, { skipped: true, reason: 'Insufficient data' });
    return;
  }

  // デシメーション設定を取得
  const decimationConfig = windChart.options.plugins.decimation;
  if (!decimationConfig || !decimationConfig.enabled) {
    // デシメーション無効の場合はスキップ
    if (callback) callback(null, { skipped: true, reason: 'Decimation disabled' });
    return;
  }

  const samples = decimationConfig.samples || 800;
  
  // データが既に十分小さい場合はスキップ
  if (labels.length <= samples) {
    if (callback) callback(null, { skipped: true, reason: 'Data already small' });
    return;
  }
  
  // 現在のタイムレンジを取得（外部モジュールから）
  import('./main.js').then(({ timeRangeSec }) => {
    // WebWorkerでLTTBデシメーション実行
    workerManager.decimateData(
      labels,
      datasets,
      samples,
      timeRangeSec,
      (error, result) => {
        if (error) {
          console.error('WebWorker LTTB decimation failed:', error);
          // エラー時はChart.js内蔵のLTTBにフォールバック
          console.log('Falling back to Chart.js built-in LTTB decimation');
          if (callback) callback(error, null);
          return;
        }
        
        if (result.skipped) {
          if (callback) callback(null, result);
          return;        
        }
        
        // デシメーション結果の検証
        if (!result.labels || !Array.isArray(result.labels) || 
            !result.datasets || !Array.isArray(result.datasets)) {
          console.error('Invalid WebWorker decimation result structure:', result);
          if (callback) callback(new Error('Invalid result structure'), null);
          return;
        }
        
        // デシメーション結果をチャートに適用
        try {
          // ラベルの検証と適用
          if (result.labels.length > 0) {
            windChart.data.labels = result.labels;
          } else {
            console.warn('WebWorker returned empty labels, keeping original');
          }
          
          // 各データセットのデータを更新
          result.datasets.forEach((decimatedData, index) => {
            if (windChart.data.datasets[index] && Array.isArray(decimatedData)) {
              windChart.data.datasets[index].data = decimatedData;
            } else {
              console.warn(`Skipping dataset ${index}: invalid data or missing dataset`);
            }
          });
          
          // Chart.jsのデシメーションを無効化（WebWorkerで処理済み）
          windChart.options.plugins.decimation.enabled = false;
          
          console.log(`✅ WebWorker LTTB decimation applied: ${result.originalCount} → ${result.decimatedCount} points (${result.processingTime.toFixed(2)}ms)`);
          
          if (callback) callback(null, result);
          
        } catch (applyError) {
          console.error('Error applying WebWorker decimation result:', applyError);
          if (callback) callback(applyError, null);
        }
      }
    );
  }).catch(error => {
    console.error('Error importing main.js for timeRangeSec:', error);
    if (callback) callback(error, null);
  });
}

// **🚀 WebWorker状態監視**
export function getWebWorkerStatus() {
  if (!workerManager) return { enabled: false, status: 'Not initialized' };
  return {
    enabled: webWorkerEnabled,
    status: workerManager.getStatus()
  };
}

// WebWorkerのクリーンアップ
export function cleanupWebWorker() {
  if (workerManager) {
    workerManager.terminate();
    workerManager = null;
    webWorkerEnabled = false;
    console.log('LTTB WebWorker terminated');
  }
}
