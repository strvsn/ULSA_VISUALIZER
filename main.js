const connectBtn = document.getElementById('connectBtn');
const output = document.getElementById('output');
const canvas = document.getElementById('windCanvas');
const ctx = canvas.getContext('2d');

// --- Chart.jsで風速履歴グラフ（ズーム・パン対応） ---
let windHistory = [];
let windChart;
let timeRangeSec = 10; // デフォルト10秒
let chartDrawingEnabled = true; // グラフ描画ON/OFF
let serialPort = null; // シリアルポート管理
let serialReader = null; // リーダー管理
let serialStreamClosed = null; // Stream close promise
const windChartCanvas = document.getElementById('windChart');

// Chart.js zoomプラグインを明示的に登録（重複登録防止）
if (window.Chart && window.ChartZoom && !Chart.registry.plugins.get('zoom')) {
  Chart.register(window.ChartZoom);
}

if (windChartCanvas && window.Chart) {
  // Chart.js v4以降はプラグイン登録が必要
  if (window.ChartZoom && !Chart.registry.plugins.get('zoom')) {
    Chart.register(window.ChartZoom);
  }
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
          yAxisID: 'yTemp', // ← 温度用左軸
          hidden: true
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      plugins: {
        legend: { display: true },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x'
          },
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: null // 修飾キー不要
            },
            pinch: {
              enabled: true
            },
            mode: 'x', // x軸のみズーム
            drag: false // ドラッグズーム不要ならfalse
          }
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}`;
            },
            title: function(context) {
              // Chart.jsのx軸type: 'time'の場合、tooltipFormatやdisplayFormatsはx軸ラベル・ツールチップ両方に影響します。
              // ただし、callbacks.titleで独自に書式化すればミリ秒表示が可能です。
              if (context && context.length > 0) {
                // context[0].rawまたはcontext[0].parsed.xがDate/タイムスタンプ
                let xVal = context[0].parsed && context[0].parsed.x;
                if (!xVal && context[0].raw) xVal = context[0].raw;
                if (xVal) {
                  const d = new Date(xVal);
                  const pad = n => n.toString().padStart(2, '0');
                  const pad3 = n => n.toString().padStart(3, '0');
                  // HH:mm:ss.SSS形式
                  const ts = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
                  return `時刻: ${ts}`;
                }
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'second',
            tooltipFormat: 'HH:mm:ss', // x軸ラベル・ツールチップのデフォルト書式
            displayFormats: {
              second: 'HH:mm:ss'
            },
            stepSize: 1
          },
          title: { display: true, text: '時刻' },
          min: null,
          max: null,
          ticks: {
            autoSkip: false,
            maxTicksLimit: 20,
            stepSize: 1,
            source: 'auto'
          },
          grid: {
            display: true,
            drawOnChartArea: true
          }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: '風速 (m/s)' },
          min: 0,
          max: 1 // 風速レンジボタンで可変
        },
        yTemp: { // 温度用左軸
          type: 'linear',
          display: true,
          position: 'left',
          min: -20,
          max: 60,
          title: { display: true, text: '温度 (℃)' },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            stepSize: 20
          }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 360,
          title: { display: true, text: '風向 (°)' },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            stepSize: 90
          }
        },
        y3: { // 音速用右軸
          type: 'linear',
          display: true,
          position: 'right',
          min: 250,
          max: 400,
          title: { display: true, text: '音速 (m/s)' },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            stepSize: 50
          }
        }
      },
      // --- 追加: y軸の自動スケーリング ---
      // Chart.js v3/v4: plugins.beforeUpdateでy軸スケール調整
      plugins: {
        // ...existing code...
        beforeUpdate: (chart) => {
          // --- y軸(風速/機首風速) ---
          const yScale = chart.options.scales.y;
          let manualMax = yScale.max;
          let manualMin = yScale.min ?? 0;
          let yValues = [];
          chart.data.datasets.forEach(ds => {
            if (!ds.hidden && ds.yAxisID === 'y') {
              yValues = yValues.concat(ds.data.filter(v => typeof v === 'number' && !isNaN(v)));
            }
          });
          if (yValues.length > 0) {
            const dataMax = Math.max(...yValues);
            const dataMin = Math.min(...yValues);
            yScale.max = Math.max(manualMax ?? 1, Math.ceil(dataMax * 1.1));
            yScale.min = Math.min(manualMin, Math.floor(dataMin * 0.9), 0);
          }
          // --- yTemp軸(温度)は固定 ---
          // --- y3軸(音速) ---
          const y3Scale = chart.options.scales.y3;
          if (y3Scale) {
            let y3Values = [];
            chart.data.datasets.forEach(ds => {
              if (!ds.hidden && ds.yAxisID === 'y3') {
                y3Values = y3Values.concat(ds.data.filter(v => typeof v === 'number' && !isNaN(v)));
              }
            });
            if (y3Values.length > 0) {
              const dataMax = Math.max(...y3Values);
              const dataMin = Math.min(...y3Values);
              y3Scale.max = Math.max(400, Math.ceil(dataMax * 1.05));
              y3Scale.min = Math.min(250, Math.floor(dataMin * 0.95));
            } else {
              y3Scale.max = 400;
              y3Scale.min = 250;
            }
          }
        }
      }
    }
  });

  // グラフ上でホイール・ピンチ時にページスクロールを防止
  windChartCanvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
  windChartCanvas.addEventListener('touchmove', function(e) {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false });
  // ダブルクリックでズームリセット
  windChartCanvas.addEventListener('dblclick', () => {
    if (windChart.resetZoom) windChart.resetZoom();
  });
}

function updateWindChart(speed, direction, noseWind, soundSpeed, soundTemp) {
  if (!windChart) return;
  const now = new Date();
  windHistory.push({
    time: now,
    speed: Number(speed),
    direction: Number(direction),
    noseWind: Number(noseWind),
    soundSpeed: Number(soundSpeed),
    soundTemp: Number(soundTemp)
  });
  if (windHistory.length > 50000) windHistory.shift(); // ←ここを拡大

  if (chartDrawingEnabled) {
    const minTime = new Date(now.getTime() - timeRangeSec * 1000);
    const filtered = windHistory.filter(e => e.time >= minTime && e.time <= now);
    windChart.data.labels = filtered.map(e => e.time);
    windChart.data.datasets[0].data = filtered.map(e => e.speed);
    windChart.data.datasets[1].data = filtered.map(e => e.direction);
    windChart.data.datasets[2].data = filtered.map(e => e.noseWind);
    windChart.data.datasets[3].data = filtered.map(e => e.soundSpeed);
    windChart.data.datasets[4].data = filtered.map(e => e.soundTemp);
    windChart.options.scales.x.min = minTime;
    windChart.options.scales.x.max = now;
    windChart.options.animation = false;
    windChart.update('none');
  }
}

// 最大風速レンジ・タイムレンジ切り替え
document.addEventListener('DOMContentLoaded', () => {
  // ボタン
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  connectBtn.classList.add('btn', 'btn-primary', 'mb-3', 'ms-2');
  connectBtn.innerHTML = `<i class="bi bi-usb"></i> 接続`;
  if (disconnectBtn) {
    disconnectBtn.classList.add('btn', 'btn-secondary', 'mb-3', 'ms-2');
    disconnectBtn.innerHTML = `<i class="bi bi-x-circle"></i> 切断`;
    disconnectBtn.disabled = true;
  }
  canvas.classList.add('border', 'rounded', 'shadow', 'mb-3');
  canvas.style.background = "linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)";

  // 最大風速レンジボタン
  const rangeBtns = document.querySelectorAll('.wind-range-btn');
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = Number(btn.getAttribute('data-range'));
      if (windChart) {
        windChart.options.scales.y.max = range;
        // minは0に固定
        windChart.options.scales.y.min = 0;
        windChart.update();
      }
      rangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // デフォルトで1m/sをactive
  rangeBtns.forEach(btn => {
    if (btn.getAttribute('data-range') === "1") btn.classList.add('active');
  });

  // タイムレンジボタン
  const timeBtns = document.querySelectorAll('.time-range-btn');
  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timeRangeSec = Number(btn.getAttribute('data-range'));
      timeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // グラフ再描画（履歴から再抽出）
      if (windChart) {
        const now = new Date();
        const minTime = new Date(now.getTime() - timeRangeSec * 1000);
        const filtered = windHistory.filter(e => e.time >= minTime && e.time <= now);
        windChart.data.labels = filtered.map(e => e.time);
        windChart.data.datasets[0].data = filtered.map(e => e.speed);
        windChart.options.scales.x.min = minTime;
        windChart.options.scales.x.max = now;
        windChart.update('none');
      }
    });
  });
  timeBtns.forEach(btn => {
    if (btn.getAttribute('data-range') === "10") btn.classList.add('active');
  });

  // グラフスタート・ストップボタン
  const chartStartBtn = document.getElementById('chartStartBtn');
  const chartStopBtn = document.getElementById('chartStopBtn');
  if (chartStartBtn && chartStopBtn) {
    chartStartBtn.addEventListener('click', () => {
      chartDrawingEnabled = true;
      chartStartBtn.disabled = true;
      chartStopBtn.disabled = false;
    });
    chartStopBtn.addEventListener('click', () => {
      chartDrawingEnabled = false;
      chartStartBtn.disabled = false;
      chartStopBtn.disabled = true;
    });
    // 初期状態: スタート無効・ストップ有効
    chartStartBtn.disabled = true;
    chartStopBtn.disabled = false;
  }
  // ページ中程の「シリアル接続」ボタンを削除
  const midBtn = document.querySelector('#connectBtn:not(.btn-primary)');
  if (midBtn && midBtn.parentElement) {
    midBtn.parentElement.removeChild(midBtn);
  }
  // Chart.jsのzoom/panリセットをサポートする場合は以下を追加
  // 例: ダブルクリックでリセット
  if (windChartCanvas && windChart && windChart.resetZoom) {
    windChartCanvas.addEventListener('dblclick', () => {
      windChart.resetZoom();
    });
  }

  // --- CSV保存ボタン追加 ---
  const csvBtn = document.createElement('button');
  csvBtn.textContent = 'CSV保存';
  csvBtn.className = 'btn btn-success mb-3 ms-2';
  csvBtn.id = 'csvSaveBtn';
  // windChartCanvasの直後に挿入
  if (windChartCanvas && windChartCanvas.parentNode) {
    windChartCanvas.parentNode.insertBefore(csvBtn, windChartCanvas.nextSibling);
  }
  csvBtn.addEventListener('click', () => {
    if (!windHistory.length) return;
    // ヘッダ
    let csv = '時刻(ms単位),風速(m/s),風向(°),機首風速(m/s),音速(m/s),音仮温度(℃)\n';
    windHistory.forEach(e => {
      // ms単位のタイムスタンプ
      let d = e.time instanceof Date ? e.time : new Date(e.time);
      const pad = n => n.toString().padStart(2, '0');
      const pad3 = n => n.toString().padStart(3, '0');
      const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
      csv += `${ts},${e.speed},${e.direction},${e.noseWind},${e.soundSpeed},${e.soundTemp}\n`;
    });
    // BOM付与で日本語文字化け防止
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
  });
});

// 最初に初期状態（0,0）で描画
drawWindMeter(0, 0);

// --- 風向計のデザインをさらにリッチに ---
function drawWindMeter(direction, speed) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // グラデーション円
  const grad = ctx.createRadialGradient(150, 150, 60, 150, 150, 100);
  grad.addColorStop(0, "#e0e7ef");
  grad.addColorStop(1, "#0d6efd22");
  ctx.save();
  ctx.shadowColor = "#b6c7e3";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(150, 150, 100, 0, 2 * Math.PI);
  ctx.strokeStyle = "#0d6efd";
  ctx.lineWidth = 7;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 風向矢印
  let angle = (direction - 90) * Math.PI / 180;
  let arrowLength = 80 + speed * 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(150, 150);
  ctx.lineTo(150 + arrowLength * Math.cos(angle), 150 + arrowLength * Math.sin(angle));
  ctx.strokeStyle = "#dc3545";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.shadowColor = "#dc3545";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();

  // 矢印先端
  ctx.save();
  ctx.beginPath();
  ctx.arc(150 + arrowLength * Math.cos(angle), 150 + arrowLength * Math.sin(angle), 13, 0, 2 * Math.PI);
  ctx.fillStyle = "#dc3545";
  ctx.shadowColor = "#dc3545";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.restore();

  // テキスト表示
  ctx.save();
  ctx.fillStyle = "#212529";
  ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(`風向: ${direction}°`, 20, 40);
  ctx.fillText(`風速: ${speed} m/s`, 20, 70);
  ctx.restore();
}

// 1行の生データをパースして数値を返す
function parseWindLine(line) {
  // 行頭の空白や改行削除
  line = line.trim();
  if (!line.startsWith('#')) return null;
  const items = line.split(',');
  if (items.length < 8) return null;
  if (items[2] !== "1") return null;
  const direction = Number(items[3]);
  const speed = Number(items[4]);
  if (isNaN(direction) || isNaN(speed)) return null;
  return { direction, speed };
}

function updateMetrics(dir, wind, noseWind, soundSpeed, soundTemp) {
  document.getElementById('dirValue').textContent = dir ?? '--';
  document.getElementById('windValue').textContent = wind ?? '--';
  document.getElementById('noseWindValue').textContent = noseWind ?? '--';
  document.getElementById('soundSpeedValue').textContent = soundSpeed ?? '--';
  document.getElementById('soundTempValue').textContent = soundTemp ?? '--';
}

function onSerialData(data) {
  // 例: "#,0,1,359,12.12,24.13,340.13,21.12\r\n"
  const parts = data.trim().split(',');
  if (parts.length >= 8 && parts[2] === '1') {
    const dir = parts[3];
    const wind = parts[4];
    const noseWind = parts[5];
    const soundSpeed = parts[6];
    const soundTemp = parts[7];
    updateMetrics(dir, wind, noseWind, soundSpeed, soundTemp);
    drawWindMeter(Number(dir), Number(wind));
    // 風向・風速・機首風速・音速・音仮温度をグラフに渡す
    updateWindChart(wind, dir, noseWind, soundSpeed, soundTemp);
  } else {
    updateMetrics('--', '--', '--', '--', '--');
  }
}

// --- SweetAlert2で接続通知 ---
async function connectSerial() {
  try {
    // 既に開いている場合は切断してから再接続
    if (serialPort && serialPort.readable) {
      await disconnectSerial();
      // ポートが閉じるまで待機
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });

    const textDecoder = new TextDecoderStream();
    serialStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    serialReader = textDecoder.readable.getReader();

    let buffer = '';
    if (window.Swal) {
      Swal.fire({
        icon: 'success',
        title: 'シリアル接続成功',
        text: 'デバイスと接続しました！',
        timer: 1500,
        showConfirmButton: false
      });
    }
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('disconnectBtn').disabled = false;

    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let line of lines) {
          onSerialData(line);
        }
      }
    }
  } catch (err) {
    if (window.Swal) {
      Swal.fire({
        icon: 'error',
        title: '接続エラー',
        text: err.toString()
      });
    }
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;
  }
}

async function disconnectSerial() {
  try {
    // リーダーのキャンセル
    if (serialReader) {
      try {
        await serialReader.cancel();
      } catch (e) {}
      try {
        await serialStreamClosed;
      } catch (e) {}
      try {
        serialReader.releaseLock();
      } catch (e) {}
      serialReader = null;
    }
    // ポートのクローズ
    if (serialPort && serialPort.readable) {
      try {
        await serialPort.close();
      } catch (e) {}
    }
    // navigator.serialのポートリストからも参照を消す
    serialPort = null;
    serialStreamClosed = null;
    if (window.Swal) {
      Swal.fire({
        icon: 'info',
        title: '切断',
        text: 'シリアルデバイスを切断しました。',
        timer: 1200,
        showConfirmButton: false
      });
    }
  } catch (err) {
  }
  document.getElementById('connectBtn').disabled = false;
  document.getElementById('disconnectBtn').disabled = true;
}

connectBtn.onclick = connectSerial;
if (document.getElementById('disconnectBtn')) {
  document.getElementById('disconnectBtn').onclick = disconnectSerial;
}