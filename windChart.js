export let windChart = null;
export const windChartCanvas = document.getElementById('windChart');
let followLatestEnabled = true;

import { drawWindGauge } from './main.js';

export function setupWindChart() {
  if (!windChartCanvas || !window.Chart) return;
  // Chart.jsプラグイン登録（autoScalePluginは省略可）
  windChart = new Chart(windChartCanvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: '風速 (m/s)',
          data: [],
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,0.1)',
          tension: 0.3,
          pointRadius: 2,
          yAxisID: 'y',
          hidden: false
        },
        {
          label: '風向 (°)',
          data: [],
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243,156,18,0.1)',
          tension: 0.3,
          pointRadius: 2,
          yAxisID: 'y2',
          hidden: false
        },
        {
          label: '機首風速 (m/s)',
          data: [],
          borderColor: '#20c997',
          backgroundColor: 'rgba(32,201,151,0.1)',
          tension: 0.3,
          pointRadius: 2,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: '音速 (m/s)',
          data: [],
          borderColor: '#6610f2',
          backgroundColor: 'rgba(102,16,242,0.1)',
          tension: 0.3,
          pointRadius: 2,
          yAxisID: 'y3',
          hidden: true
        },
        {
          label: '音仮温度 (℃)',
          data: [],
          borderColor: '#fd7e14',
          backgroundColor: 'rgba(253,126,20,0.1)',
          tension: 0.3,
          pointRadius: 2,
          yAxisID: 'yTemp',
          hidden: true
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy',
            modifierKey: 'ctrl',
            threshold: 0
          },
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: null,
              speed: 0.1,
              axis: 'x' // ホイールはx軸のみ
            },
            pinch: {
              enabled: true,
              axis: 'xy' // ピンチは縦横ズーム
            },
            // --- ここを修正: ドラッグズームもxyに ---
            mode: 'xy', // ホイールはxのみ、ドラッグ/ピンチはxy
            drag: {
              enabled: true,
              backgroundColor: 'rgba(0,123,255,0.15)',
              modifierKey: null
            }
          },
          limits: {
            x: { minRange: 1000 },
            y: { min: 0, max: 60 },
            y2: { min: 0, max: 360 },
            y3: { min: 250, max: 400 },
            yTemp: { min: -20, max: 60 }
          }
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}`;
            }
          }
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
          title: { display: true, text: '時刻' },
          min: null,
          max: null,
          ticks: { autoSkip: false, maxTicksLimit: 20, stepSize: 1, source: 'auto' },
          grid: { display: true, drawOnChartArea: true }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: '風速 (m/s)' },
          min: 0,
          max: 1
        },
        yTemp: {
          type: 'linear',
          display: true,
          position: 'left',
          min: -20,
          max: 60,
          title: { display: true, text: '温度 (℃)' },
          grid: { drawOnChartArea: false },
          ticks: { stepSize: 20 }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 360,
          title: { display: true, text: '風向 (°)' },
          grid: { drawOnChartArea: false },
          ticks: { stepSize: 90 }
        },
        y3: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 250,
          max: 400,
          title: { display: true, text: '音速 (m/s)' },
          grid: { drawOnChartArea: false },
          ticks: { stepSize: 50 }
        }
      },
      layout: { padding: 0 }
    }
  });

  windChartCanvas.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  windChartCanvas.addEventListener('touchmove', e => {
    if (e.touches && e.touches.length > 1) { e.preventDefault(); e.stopPropagation(); }
  }, { passive: false });
  windChartCanvas.addEventListener('dblclick', () => { if (windChart.resetZoom) windChart.resetZoom(); });
}

export function setupAxisWheelZoom() {
  // ...existing code...
}

// タイムスケールボタンとCSV保存ボタンの機能をwindChart.jsではなくmain.jsで初期化してください。
// windChart.jsからsetupChartUIは削除し、main.jsで下記のように記述してください。

// --- windChart.jsからは下記を削除してください ---
// export function setupChartUI(...) { ... }

export function updateWindChart(speed, direction, noseWind, soundSpeed, soundTemp) {
  import('./main.js').then(({ windHistory, MAX_HISTORY_POINTS, timeRangeSec, chartDrawingEnabled, addLogData, updateRealtimeValues }) => {
    if (!windChart) return;
    const now = new Date();
    const entry = {
      time: now,
      speed: Number(speed),
      direction: Number(direction),
      noseWind: Number(noseWind),
      soundSpeed: Number(soundSpeed),
      soundTemp: Number(soundTemp)
    };
    windHistory.push(entry);
    if (typeof addLogData === 'function') addLogData(entry);
    if (windHistory.length > MAX_HISTORY_POINTS) windHistory.shift();

    if (chartDrawingEnabled) {
      // --- x軸目盛り幅を伸縮させず、常にスクロール表示 ---
      windChart.data.labels.push(now);
      windChart.data.datasets[0].data.push(Number(speed));
      windChart.data.datasets[1].data.push(Number(direction));
      windChart.data.datasets[2].data.push(Number(noseWind));
      windChart.data.datasets[3].data.push(Number(soundSpeed));
      windChart.data.datasets[4].data.push(Number(soundTemp));

      // データ数が多すぎる場合は古いデータを削除
      const maxPoints = MAX_HISTORY_POINTS;
      if (windChart.data.labels.length > maxPoints) {
        windChart.data.labels.shift();
        windChart.data.datasets.forEach(ds => ds.data.shift());
      }

      // x軸min/maxを固定し、常に最新データが右端に来るようにスクロール
      const minTime = new Date(now.getTime() - timeRangeSec * 1000);
      windChart.options.scales.x.min = minTime;
      windChart.options.scales.x.max = now;

      windChart.options.animation = false;
      windChart.update('none');
    }

    // 追加: 数値表示枠の値を更新
    import('./main.js').then(({ updateRealtimeValues }) => {
      // 10分間平均風速を計算
      let avg10minWind = '--';
      try {
        const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const arr = windHistory.filter(e => e.time >= tenMinAgo && e.time <= now && isFinite(e.speed));
        if (arr.length > 0) {
          avg10minWind = arr.reduce((sum, e) => sum + Number(e.speed), 0) / arr.length;
        }
        updateRealtimeValues(noseWind, soundSpeed, soundTemp, avg10minWind);
        // 風速ゲージの描画（最新の風速値）
        drawWindGauge(Number(speed));
      } catch {
        updateRealtimeValues(noseWind, soundSpeed, soundTemp, avg10minWind);
        drawWindGauge(Number(speed));
      }
    });
  });
}