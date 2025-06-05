let windChart;
let windHistory = [];
let timeRangeSec = 10;
let chartDrawingEnabled = true;
let followLatestEnabled = true;

export function initWindChart() {
  const windChartCanvas = document.getElementById('windChart');
  // ...Chart.jsプラグイン登録・グラフ初期化...
  // ...existing Chart.js setup code from main.js...
  // (凡例onClickカスタマイズは削除)
  return windChart;
}

export function updateWindChart(speed, direction, noseWind, soundSpeed, soundTemp) {
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
  if (windHistory.length > 50000) windHistory.shift();

  if (chartDrawingEnabled) {
    const minTime = new Date(now.getTime() - timeRangeSec * 1000);
    const filtered = windHistory.filter(e => e.time >= minTime && e.time <= now);
    windChart.data.labels = filtered.map(e => e.time);
    windChart.data.datasets[0].data = filtered.map(e => e.speed);
    windChart.data.datasets[1].data = filtered.map(e => e.direction);
    windChart.data.datasets[2].data = filtered.map(e => e.noseWind);
    windChart.data.datasets[3].data = filtered.map(e => e.soundSpeed);
    windChart.data.datasets[4].data = filtered.map(e => e.soundTemp);

    if (followLatestEnabled) {
      windChart.options.scales.x.min = minTime;
      windChart.options.scales.x.max = now;
    }
    windChart.options.animation = false;
    windChart.update('none');
  }
}

export function setFollowLatestEnabled(enabled) {
  followLatestEnabled = enabled;
  if (enabled && windChart) {
    const now = new Date();
    const minTime = new Date(now.getTime() - timeRangeSec * 1000);
    windChart.options.scales.x.min = minTime;
    windChart.options.scales.x.max = now;
    windChart.update('none');
  }
}

/**
 * バイト数をカンマ区切り＋適切な単位でフォーマットする
 * 例: 1,234 B / 12,345 kB / 1,234.6 MB
 */
export function formatBytes(bytes) {
  if (isNaN(bytes)) return '-';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let num = bytes;
  while (num >= 1000 && idx < units.length - 1) {
    num /= 1000;
    idx++;
  }
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[idx]}`;
}

// 必要に応じて他のエクスポートも追加
