export let windChart = null;
export const windChartCanvas = document.getElementById('windChart');

import { drawWindGauge } from './modules/windGauge.js';
import { convertWindSpeed, currentWindSpeedUnit } from './modules/windUnitManager.js';
import { 
  setWindChartInstance, 
  resetFollowLatest, 
  getFollowLatestEnabled, 
  setFollowLatestEnabled,
  updateChartTheme,
  optimizeChartForTimeScale,
  updateWindSpeedAxisLabel,
  convertExistingChartData,
  adjustWindSpeedAxisRange,
  applyWebWorkerLTTBDecimation,
  getWebWorkerStatus,
  cleanupWebWorker
} from './windChartUtils.js';

// ユーティリティ関数を再エクスポート
export { 
  resetFollowLatest, 
  updateChartTheme,
  optimizeChartForTimeScale,
  updateWindSpeedAxisLabel,
  convertExistingChartData,
  adjustWindSpeedAxisRange,
  applyWebWorkerLTTBDecimation,
  getWebWorkerStatus,
  cleanupWebWorker
};

export function setupWindChart() {
  if (!windChartCanvas || !window.Chart) return;
  
  // Canvas要素の基本設定のみ - 過度な干渉を避ける
  windChartCanvas.style.display = 'block';
  
  // ダークモード状態を取得
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  const textColor = isDarkMode ? '#cccccc' : '#333333';
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

  // 透明背景プラグイン
  const transparentBackgroundPlugin = {
    id: 'transparentBackground',
    beforeDraw: (chart, args, options) => {
      const ctx = chart.ctx;
      ctx.clearRect(0, 0, chart.width, chart.height);
    }
  };

  // 高精度座標修正プラグイン - デバッグツールの方法を採用
  const coordinateFixPlugin = {
    id: 'coordinateFix',
    beforeInit: (chart) => {
      // Chart.js標準のgetCanvasPosition関数をオーバーライド
      const originalGetPosition = chart.getCanvasPosition || Chart.helpers.getRelativePosition;
      
      chart.getCanvasPosition = function(e) {
        const canvas = this.canvas;
        const rect = canvas.getBoundingClientRect();
        
        // CSS境界とパディングを考慮
        const computedStyle = getComputedStyle(canvas);
        const borderLeft = parseInt(computedStyle.borderLeftWidth) || 0;
        const borderTop = parseInt(computedStyle.borderTopWidth) || 0;
        const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
        const paddingTop = parseInt(computedStyle.paddingTop) || 0;
        
        // スケールファクターを正確に計算
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // 正確な座標計算
        const x = (e.clientX - rect.left - borderLeft - paddingLeft) * scaleX;
        const y = (e.clientY - rect.top - borderTop - paddingTop) * scaleY;
        
        return { x, y };
      };
    }
  };
  // Chart.js設定（高精度座標修正プラグイン適用）
  windChart = new Chart(windChartCanvas, {
    type: 'line',
    plugins: [transparentBackgroundPlugin, coordinateFixPlugin],
    data: {
      labels: [],
      datasets: [
        {
          label: '風速 (m/s)',
          data: [],
          borderColor: datasetColors.wind,
          backgroundColor: datasetColors.wind,
          tension: 0.2,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: datasetColors.wind,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          yAxisID: 'y',
          hidden: false,
          // **🚀 パフォーマンス最適化1: レンダリング最適化**
          fill: false,
          spanGaps: false,
          showLine: true
        },
        {
          label: '風向 (°)',
          data: [],
          borderColor: datasetColors.direction,
          backgroundColor: datasetColors.direction,
          tension: 0.2,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: datasetColors.direction,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          yAxisID: 'y2',
          hidden: false
        },
        {
          label: '機首風速 (m/s)',
          data: [],
          borderColor: datasetColors.noseWind,
          backgroundColor: datasetColors.noseWind,
          tension: 0.2,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: datasetColors.noseWind,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: '音速 (m/s)',
          data: [],
          borderColor: datasetColors.soundSpeed,
          backgroundColor: datasetColors.soundSpeed,
          tension: 0.2,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: datasetColors.soundSpeed,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          yAxisID: 'y3',
          hidden: true
        },
        {
          label: '音仮温度 (℃)',
          data: [],
          borderColor: datasetColors.soundTemp,
          backgroundColor: datasetColors.soundTemp,
          tension: 0.2,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: datasetColors.soundTemp,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          yAxisID: 'yTemp',
          hidden: true
        }
      ]
    },    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      devicePixelRatio: window.devicePixelRatio || 1,
      
      // **🚀 パフォーマンス最適化2: レスポンシブ動作の最適化**
      resizeDelay: 100, // リサイズイベントのデバウンス
      
      parsing: {
        xAxisKey: 'x',
        yAxisKey: 'y'
      },
      
      interaction: {
        intersect: false,
        mode: 'index',
        // **🚀 最適化3: インタラクション軽量化**
        includeInvisible: false // 非表示データセットをインタラクションから除外
      },
      
      elements: {
        point: {
          backgroundColor: 'transparent',
          radius: 0,
          hoverRadius: 6,
          hitRadius: 10
        },
        line: {
          tension: 0.3,
          borderWidth: 3,
          // **🚀 最適化4: ライン描画最適化**
          borderJoinStyle: 'round',
          borderCapStyle: 'round'
        }
      },
        plugins: {
        decimation: {
          enabled: false,  // 初期状態では無効化 - タイムスケール別最適化で制御
          algorithm: 'lttb'  // LTTBアルゴリズムをデフォルトに設定
        },
        legend: {
          display: true,
          labels: {
            font: { size: 14 },
            color: textColor,
            // **🚀 最適化5: 凡例レンダリング最適化**
            usePointStyle: false,
            boxWidth: 40
          },
          position: 'top',
          align: 'center'
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy',
            modifierKey: 'shift',
            threshold: 0,
            onPan: ({chart}) => { setFollowLatestEnabled(false); }
          },
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: null,
              speed: 0.1,
              axis: 'x'
            },
            pinch: {
              enabled: true,
              axis: 'xy'
            },
            mode: 'xy',
            drag: {
              enabled: true,
              backgroundColor: 'rgba(0,123,255,0.15)',
              modifierKey: null
            },
            onZoom: ({chart}) => { setFollowLatestEnabled(false); }
          },
          limits: {
            x: { minRange: 1000 },
            y: { min: 0, max: 60 },
            y2: { min: 0, max: 360 },
            y3: { min: 250, max: 400 },
            yTemp: { min: -20, max: 60 }
          }
        },        tooltip: {
          enabled: true,
          backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
          // **🚀 最適化6: ツールチップパフォーマンス向上**
          displayColors: false, // カラーボックス非表示でレンダリング軽量化
          mode: 'index',
          intersect: false,
          animation: {
            duration: 0 // アニメーション無効化
          },
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}`;
            }
          },
          titleFont: { size: 14 },
          bodyFont: { size: 14 }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'second',
            tooltipFormat: 'HH:mm:ss',
            displayFormats: { second: 'HH:mm:ss' },
            stepSize: 1
          },
          title: { display: true, text: '時刻', font: { size: 12 }, color: textColor },
          min: null,
          max: null,
          ticks: { autoSkip: false, maxTicksLimit: 20, stepSize: 1, source: 'auto', font: { size: 14 }, color: textColor },
          grid: { display: true, drawOnChartArea: true, color: gridColor }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: '風速 (m/s)', font: { size: 12 }, color: textColor },
          min: 0,
          max: 1,
          ticks: { font: { size: 14 }, color: textColor },
          grid: { color: gridColor }
        },
        yTemp: {
          type: 'linear',
          display: true,
          position: 'left',
          min: -20,
          max: 60,
          title: { display: true, text: '温度 (℃)', font: { size: 12 }, color: textColor },
          grid: { drawOnChartArea: false, color: gridColor },
          ticks: { stepSize: 20, font: { size: 14 }, color: textColor }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 360,
          title: { display: true, text: '風向 (°)', font: { size: 12 }, color: textColor },
          grid: { drawOnChartArea: false, color: gridColor },
          ticks: { stepSize: 90, font: { size: 14 }, color: textColor }
        },
        y3: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 250,
          max: 400,
          title: { display: true, text: '音速 (m/s)', font: { size: 12 }, color: textColor },
          grid: { drawOnChartArea: false, color: gridColor },
          ticks: { stepSize: 50, font: { size: 14 }, color: textColor }
        }
      },
      
      layout: { 
        padding: 5
      }
    }
  });

  // windChartUtilsにインスタンスを渡す
  setWindChartInstance(windChart);

  windChartCanvas.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  windChartCanvas.addEventListener('touchmove', e => {
    if (e.touches && e.touches.length > 1) { e.preventDefault(); e.stopPropagation(); }
  }, { passive: false });
  windChartCanvas.addEventListener('dblclick', () => { if (windChart.resetZoom) windChart.resetZoom(); });
  // 座標精度向上: リサイズ時の座標再計算
  if (window.ResizeObserver) {
    let resizeTimeout = null;
    const resizeObserver = new ResizeObserver(() => {
      if (windChart) {
        // **🚀 最適化1: リサイズイベントのデバウンス**
        if (resizeTimeout) clearTimeout(resizeTimeout);
        
        resizeTimeout = setTimeout(() => {
          try {
            windChart.resize();
            // リサイズ時にdecimation設定を再計算（1ピクセル1ポイント維持）
            import('./main.js').then(({ timeRangeSec }) => {
              optimizeChartForTimeScale(timeRangeSec);
              windChart.update('none');
            });
          } catch (error) {
            console.warn('Error during chart resize:', error);
          }
        }, 100); // 100msデバウンス
      }
    });
    resizeObserver.observe(windChartCanvas);
  }
  
  // **🚀 最適化2: フルスクリーンイベントのデバウンス**
  let fullscreenTimeout = null;
  
  // フルスクリーン変更時のChart.js調整
  document.addEventListener('fullscreenchange', () => {
    if (windChart) {
      if (fullscreenTimeout) clearTimeout(fullscreenTimeout);
      
      fullscreenTimeout = setTimeout(() => {
        try {
          windChart.resize();
          // フルスクリーン変更時にdecimation設定を再計算
          import('./main.js').then(({ timeRangeSec }) => {
            optimizeChartForTimeScale(timeRangeSec);
            windChart.update('none');
          });
        } catch (error) {
          console.warn('Error during fullscreen chart resize:', error);
        }
      }, 100);
    }
  });
  
  document.addEventListener('webkitfullscreenchange', () => {
    if (windChart) {
      if (fullscreenTimeout) clearTimeout(fullscreenTimeout);
      
      fullscreenTimeout = setTimeout(() => {
        try {
          windChart.resize();
          // フルスクリーン変更時にdecimation設定を再計算
          import('./main.js').then(({ timeRangeSec }) => {
            optimizeChartForTimeScale(timeRangeSec);
            windChart.update('none');
          });
        } catch (error) {
          console.warn('Error during webkit fullscreen chart resize:', error);
        }
      }, 100);
    }
  });
  
  // 初期タイムスケールに基づく最適化を適用
  setTimeout(() => {
    import('./main.js').then(({ timeRangeSec }) => {
      if (timeRangeSec) {
        optimizeChartForTimeScale(timeRangeSec);
        console.log('Initial chart optimization applied for', timeRangeSec, 'seconds (1 pixel = 1 point)');
      }
    });
  }, 500);
}

export function setupAxisWheelZoom() {
  // ...existing code...
}

// タイムスケールボタンとCSV保存ボタンの機能をwindChart.jsではなくmain.jsで初期化してください。
// windChart.jsからsetupChartUIは削除し、main.jsで下記のように記述してください。

// --- windChart.jsからは下記を削除してください ---
// export function setupChartUI(...) { ... }

// パフォーマンス最適化用の変数
let pendingChartUpdate = false;
let chartUpdateTimeout = null;

export function updateWindChart(speed, direction, noseWind, soundSpeed, soundTemp) {
  // Use static imports for convertWindSpeed and currentWindSpeedUnit
  if (!windChart) return;
  
  import('./main.js').then(({ windHistory, MAX_HISTORY_POINTS, timeRangeSec, chartDrawingEnabled }) => {
    // FPS低下時にはグラフ描画を停止
    if (!chartDrawingEnabled) {
      return;
    }
    
    // **🚀 最適化1: Chart.js更新の重複防止**
    // 既に更新がペンディング中の場合はスキップ
    if (pendingChartUpdate) {
      return;
    }
    
    const now = new Date();
    
    // 注意: データの追加とログ記録はqueueDataUpdate()で既に処理済み
    // ここではチャート表示のみを更新

    if (chartDrawingEnabled) {
      // **🚀 最適化2: 同期化修正**
      // Chart.js更新を同期実行に変更して、main.jsの削除処理と同期を保つ
      pendingChartUpdate = true;
      
      try {
        // --- x軸目盛り幅を伸縮させず、常にスクロール表示 ---      
        // **🚀 最適化3: データ追加の効率化**
        // 最新データのみを取得して追加
        const latestEntry = windHistory[windHistory.length - 1];
        if (latestEntry && (windChart.data.labels.length === 0 || 
            latestEntry.time > windChart.data.labels[windChart.data.labels.length - 1])) {
          
          // 単位変換を適用してからチャートに追加
          const convertedSpeed = convertWindSpeed(Number(latestEntry.speed), currentWindSpeedUnit);
          const convertedNoseWind = convertWindSpeed(Number(latestEntry.noseWind), currentWindSpeedUnit);
          
          windChart.data.labels.push(latestEntry.time);
          windChart.data.datasets[0].data.push(convertedSpeed);
          windChart.data.datasets[1].data.push(Number(latestEntry.direction));
          windChart.data.datasets[2].data.push(convertedNoseWind);
          windChart.data.datasets[3].data.push(Number(latestEntry.soundSpeed));
          windChart.data.datasets[4].data.push(Number(latestEntry.soundTemp));
        }        // **🚀 最適化4: メモリ使用量削減（同期実行）**
        // データ数が多すぎる場合は古いデータを削除（main.jsと同期 - 1時間制限）
        const maxPoints = Math.min(MAX_HISTORY_POINTS, 36000); // 36,000ポイント = 約1時間（メモリ最適化）
        if (windChart.data.labels.length > maxPoints) {
          // **🚀 最適化5: バッチ削除（同期実行）**
          // 一度に複数ポイントを削除（main.jsの削除と同期）
          const deleteCount = Math.min(1000, windChart.data.labels.length - maxPoints);
          windChart.data.labels.splice(0, deleteCount);
          windChart.data.datasets.forEach(ds => ds.data.splice(0, deleteCount));
        }

        // **🚀 最適化6: マーカー設定の最小化**
        // 設定が変更されている場合のみ更新
        if (windChart.data.datasets[0].pointRadius !== 0) {
          windChart.data.datasets.forEach(dataset => {
            dataset.pointRadius = 0;
            dataset.pointHoverRadius = 6;
            dataset.pointHoverBorderWidth = 2;
            dataset.pointHoverBorderColor = '#ffffff';
          });
        }
        
        // **🚀 最適化7: 軸更新の最適化**
        // x軸min/maxは自動フォローが有効な場合のみ適用
        if (getFollowLatestEnabled()) {
          const latestEntry = windHistory[windHistory.length - 1];
          const now = latestEntry ? latestEntry.time : new Date();
          const minTime = new Date(now.getTime() - timeRangeSec * 1000);
          
          // 軸範囲が変更された場合のみ更新
          if (windChart.options.scales.x.min !== minTime || windChart.options.scales.x.max !== now) {
            windChart.options.scales.x.min = minTime;
            windChart.options.scales.x.max = now;
          }
        }
        
        // **🚀 最適化8: アニメーション無効化確保**
        windChart.options.animation = false;
        
        // **🚀 最適化9: 最小限のChart.js更新**
        windChart.update('none');
        
      } finally {
        pendingChartUpdate = false;
      }
    }

    // 注意: ゲージと数値表示の更新はmain.jsのupdateRealtimeDisplays()で行われます
  });
}

