// windGauge.js - Wind gauge drawing and management functionality

import { isDarkMode } from './darkMode.js';
import { 
  currentWindSpeedUnit, 
  convertWindSpeed, 
  getCurrentGaugeMax, 
  updateLastWindValues
} from './windUnitManager.js';

// =====================================================
// WIND GAUGE DRAWING
// =====================================================

export function drawWindGauge(value, direction = 0, min = 0, max = null) {
  // Use getCurrentGaugeMax if max is not provided
  if (max === null) {
    max = getCurrentGaugeMax();
  }
  
  // Save wind direction and speed values
  updateLastWindValues(value, direction);
  
  const canvas = document.getElementById('gaugeCanvas');
  const valueDiv = document.getElementById('gaugeValue');
  if (!canvas || !canvas.getContext) return;
  
  // ==== 高DPI対応: ぼやけ防止 ====
  const dpr = window.devicePixelRatio || 1;
  const cssW = 340;
  const cssH = 340;
  
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
  }
  
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); // リセット
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  // キャンバス背景を透明に設定（ダークモード対応）
  canvas.style.background = 'transparent';

  // ==== アーク描画パラメータ ====
  const centerX = cssW / 2;
  const centerY = cssH / 2;
  const arcRadius = 96;
  const arcWidth = 18;
  // 半円を描画（開始=左, 終了=右, 開口部下）
  const startDeg = 120;
  const sweepDeg = 300;
  const startRad = (startDeg * Math.PI) / 180;
  const sweepRad = (sweepDeg * Math.PI) / 180;
  const endRad = startRad + sweepRad;

  // ==== グレー背景アーク ====
  ctx.save();
  ctx.lineWidth = arcWidth;
  ctx.strokeStyle = isDarkMode ? '#495057' : '#eee';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(centerX, centerY, arcRadius, startRad, endRad, false);
  ctx.stroke();
  ctx.restore();

  // ==== 青い値アーク ====
  if (isFinite(value) && value >= min) {
    const percent = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const valueEndRad = startRad + sweepRad * percent;
    ctx.save();
    ctx.lineWidth = arcWidth;
    ctx.strokeStyle = '#0d6efd';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(centerX, centerY, arcRadius, startRad, valueEndRad, false);
    ctx.stroke();
    ctx.restore();
  }

  // ==== 風向計の描画 ====
  if (isFinite(direction)) {
    const windDirRadius = 120; // 風向計の円の半径を120に戻す
    
    // 方位目盛り線を描画（10度間隔で全周）
    ctx.save();
    ctx.setLineDash([]); // 実線
    
    // 0度から350度まで10度間隔で目盛りを描画
    for (let deg = 0; deg < 360; deg += 10) {
      const radian = (deg - 90) * Math.PI / 180; // -90度で北を上に調整
      const lineLength = (deg % 90 === 0) ? 20 : 10; // 主要方位は長めの線
      
      // 線の色と太さを設定
      if (deg === 0) {
        // 0度（北）の線は太い赤
        ctx.strokeStyle = '#dc3545'; // 赤色（Bootstrap danger色）
        ctx.lineWidth = 4; // 太い線
      } else if (deg % 90 === 0) {
        // 90, 180, 270度の主要方位はグレーで通常の太さ
        ctx.strokeStyle = isDarkMode ? '#ccc' : '#666'; // ダークモードではより明るいグレー
        ctx.lineWidth = 2; // 通常の太さ
      } else {
        // その他の補助目盛りはグレーで細い線
        ctx.strokeStyle = isDarkMode ? '#aaa' : '#999'; // ダークモードではより明るいグレー
        ctx.lineWidth = 1; // 細い線
      }
      
      // 内側の点
      const innerX = centerX + (windDirRadius - lineLength/2) * Math.cos(radian);
      const innerY = centerY + (windDirRadius - lineLength/2) * Math.sin(radian);
      
      // 外側の点
      const outerX = centerX + (windDirRadius + lineLength/2) * Math.cos(radian);
      const outerY = centerY + (windDirRadius + lineLength/2) * Math.sin(radian);
      
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();
    }
    
    ctx.restore();

    // 方位目盛り（0°, 90°, 180°, 270°）
    ctx.save();
    ctx.fillStyle = isDarkMode ? '#ddd' : '#555';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 0° (北) - 上
    ctx.fillText('0°', centerX, centerY - windDirRadius - 25);
    // 90° (東) - 右
    ctx.fillText('90°', centerX + windDirRadius + 35, centerY);
    // 180° (南) - 下
    ctx.fillText('180°', centerX, centerY + windDirRadius + 25);
    // 270° (西) - 左
    ctx.fillText('270°', centerX - windDirRadius - 35, centerY);

    ctx.restore();

    // 風向を角度に変換（0°=北=上、時計回り）
    // directionは気象学的風向（風の吹いてくる方向）
    const windAngleRad = ((direction - 90) * Math.PI) / 180; // -90°で北を上に調整
    
    // 風向計のオレンジ色の丸の位置
    const windX = centerX + windDirRadius * Math.cos(windAngleRad);
    const windY = centerY + windDirRadius * Math.sin(windAngleRad);
    
    // オレンジ色の丸を描画（枠線なし）
    ctx.save();
    ctx.fillStyle = '#dc3545'; // 赤色（Bootstrap danger色、ストップボタンと同じ）
    ctx.beginPath();
    ctx.arc(windX, windY, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  // 値と単位のHTML表示
  if (valueDiv) {
    const convertedValue = convertWindSpeed(value, currentWindSpeedUnit);
    // 単位に応じて適切な小数点桁数を設定
    let precision = 2;
    if (currentWindSpeedUnit === 'cm/s') {
      precision = 0; // cm/sは整数表示
    } else if (currentWindSpeedUnit === 'km/h') {
      precision = 1; // km/hは小数点1桁
    }
    valueDiv.innerHTML =
      (isFinite(convertedValue) && typeof convertedValue === 'number') 
        ? convertedValue.toFixed(precision) 
        : '--';
  }
}

// Re-export getLastWindData from windUnitManager for compatibility
export { getLastWindData } from './windUnitManager.js';