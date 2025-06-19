// modules/canvasOptimizer.js - Canvas レンダリング最適化

/**
 * Canvas Rendering Optimization for ULSA VISUALIZER
 * 高性能なCanvas描画とレンダリング最適化
 */

class CanvasOptimizer {
  constructor() {
    this.canvasPool = new Map(); // Canvas要素のオブジェクトプール
    this.offscreenCanvases = new Map(); // OffscreenCanvas のプール
    this.renderingContexts = new Map(); // レンダリングコンテキストのキャッシュ
    this.animationFrameQueue = new Set(); // アニメーションフレームの管理
    this.renderingLayers = new Map(); // レンダリング階層の管理
    
    this.initCanvasOptimization();
  }

  /**
   * Canvas最適化の初期化
   */
  initCanvasOptimization() {
    // OffscreenCanvas対応チェック
    this.offscreenSupported = 'OffscreenCanvas' in window;
    console.log(`🎨 OffscreenCanvas support: ${this.offscreenSupported}`);

    // Canvas Pool の事前作成
    this.preCreateCanvasPool();
  }

  /**
   * Canvas Pool の事前作成
   */
  preCreateCanvasPool() {
    const poolSize = 3; // 事前に3つのCanvasを用意
    for (let i = 0; i < poolSize; i++) {
      const canvas = this.createOptimizedCanvas();
      this.canvasPool.set(`pool_${i}`, canvas);
    }
  }

  /**
   * 最適化されたCanvasを作成
   */
  createOptimizedCanvas(width = 800, height = 400) {
    const canvas = document.createElement('canvas');
    
    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // GPU加速の有効化
    const ctx = canvas.getContext('2d', {
      alpha: false, // 透明度が不要な場合は無効化
      desynchronized: true, // 低遅延モード
      willReadFrequently: false // 読み取り頻度の最適化
    });

    // スケーリング調整
    ctx.scale(dpr, dpr);

    // アンチエイリアシングの最適化
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium'; // high/medium/low

    return { canvas, ctx, dpr };
  }

  /**
   * OffscreenCanvasを作成（対応ブラウザのみ）
   */
  createOffscreenCanvas(width = 800, height = 400) {
    if (!this.offscreenSupported) {
      return this.createOptimizedCanvas(width, height);
    }

    const dpr = window.devicePixelRatio || 1;
    const offscreenCanvas = new OffscreenCanvas(width * dpr, height * dpr);
    const ctx = offscreenCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });

    ctx.scale(dpr, dpr);

    return { canvas: offscreenCanvas, ctx, dpr, isOffscreen: true };
  }

  /**
   * Canvas Pool からCanvasを取得
   */
  getCanvasFromPool(key = null) {
    if (key && this.canvasPool.has(key)) {
      return this.canvasPool.get(key);
    }

    // 使用可能なCanvasを検索
    for (const [poolKey, canvas] of this.canvasPool.entries()) {
      if (!canvas.inUse) {
        canvas.inUse = true;
        return canvas;
      }
    }

    // プールが空の場合は新規作成
    const newCanvas = this.createOptimizedCanvas();
    newCanvas.inUse = true;
    const newKey = `dynamic_${Date.now()}`;
    this.canvasPool.set(newKey, newCanvas);
    return newCanvas;
  }

  /**
   * Canvas を プールに返却
   */
  returnCanvasToPool(canvasObj) {
    if (canvasObj) {
      canvasObj.inUse = false;
      // キャンバスをクリア
      if (canvasObj.ctx) {
        canvasObj.ctx.clearRect(0, 0, canvasObj.canvas.width, canvasObj.canvas.height);
      }
    }
  }

  /**
   * レンダリング階層の管理
   */
  createRenderingLayer(layerId, zIndex = 0) {
    const layer = this.createOptimizedCanvas();
    layer.zIndex = zIndex;
    this.renderingLayers.set(layerId, layer);
    return layer;
  }

  /**
   * 階層化レンダリングの実行
   */
  compositeRenderingLayers(targetCanvas) {
    const sortedLayers = Array.from(this.renderingLayers.entries())
      .sort(([, a], [, b]) => a.zIndex - b.zIndex);

    const targetCtx = targetCanvas.getContext('2d');
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    for (const [layerId, layer] of sortedLayers) {
      if (layer.visible !== false) {
        targetCtx.globalAlpha = layer.alpha || 1.0;
        targetCtx.drawImage(layer.canvas, 0, 0);
      }
    }
    targetCtx.globalAlpha = 1.0;
  }

  /**
   * フレームレート制御付きアニメーション
   */
  requestOptimizedAnimationFrame(callback, targetFPS = 60) {
    const frameInterval = 1000 / targetFPS;
    let lastTime = 0;

    const animateFrame = (currentTime) => {
      if (currentTime - lastTime >= frameInterval) {
        callback(currentTime);
        lastTime = currentTime;
      }
      
      const frameId = requestAnimationFrame(animateFrame);
      this.animationFrameQueue.add(frameId);
    };

    const frameId = requestAnimationFrame(animateFrame);
    this.animationFrameQueue.add(frameId);
    return frameId;
  }

  /**
   * バッチレンダリング（複数の描画命令をまとめて実行）
   */
  batchRender(ctx, renderCommands) {
    ctx.save();
    
    // バッチ描画開始
    ctx.beginPath();
    
    for (const command of renderCommands) {
      try {
        switch (command.type) {
          case 'line':
            this.drawLineOptimized(ctx, command.data);
            break;
          case 'circle':
            this.drawCircleOptimized(ctx, command.data);
            break;
          case 'text':
            this.drawTextOptimized(ctx, command.data);
            break;
          default:
            console.warn(`Unknown render command: ${command.type}`);
        }
      } catch (error) {
        console.error(`Error executing render command:`, error);
      }
    }
    
    ctx.restore();
  }

  /**
   * 最適化されたライン描画
   */
  drawLineOptimized(ctx, { points, color = '#000000', lineWidth = 1 }) {
    if (points.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.stroke();
  }

  /**
   * 最適化された円描画
   */
  drawCircleOptimized(ctx, { x, y, radius, fillColor, strokeColor, lineWidth = 1 }) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * 最適化されたテキスト描画
   */
  drawTextOptimized(ctx, { text, x, y, font, color = '#000000', textAlign = 'left' }) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign;
    ctx.fillText(text, x, y);
  }

  /**
   * メモリ使用量の監視
   */
  getMemoryUsage() {
    const canvasCount = this.canvasPool.size;
    const layerCount = this.renderingLayers.size;
    const animationFrameCount = this.animationFrameQueue.size;

    return {
      canvasCount,
      layerCount,
      animationFrameCount,
      offscreenSupported: this.offscreenSupported
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    // すべてのアニメーションフレームをキャンセル
    for (const frameId of this.animationFrameQueue) {
      cancelAnimationFrame(frameId);
    }
    this.animationFrameQueue.clear();

    // Canvas Pool をクリア
    this.canvasPool.clear();
    this.offscreenCanvases.clear();
    this.renderingContexts.clear();
    this.renderingLayers.clear();

    console.log('🎨 Canvas optimizer cleaned up');
  }
}

// シングルトンインスタンス
const canvasOptimizer = new CanvasOptimizer();

export default canvasOptimizer;

// 便利関数のエクスポート
export const {
  createOptimizedCanvas,
  createOffscreenCanvas,
  getCanvasFromPool,
  returnCanvasToPool,
  createRenderingLayer,
  compositeRenderingLayers,
  requestOptimizedAnimationFrame,
  batchRender,
  getMemoryUsage: getCanvasMemoryUsage,
  cleanup: cleanupCanvasOptimizer
} = canvasOptimizer;
