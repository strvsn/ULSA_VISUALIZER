// modules/dataOptimizer.js - データ処理とアルゴリズムの最適化

/**
 * Data Processing Optimization for ULSA VISUALIZER
 * データ構造とアルゴリズムの最適化
 */

class DataOptimizer {
  constructor() {
    this.dataCache = new Map(); // LRU キャッシュ
    this.indexedData = new Map(); // インデックス化されたデータ
    this.compressionEnabled = true;
    this.maxCacheSize = 1000; // キャッシュサイズ制限
    
    this.initDataOptimization();
  }

  /**
   * データ最適化の初期化
   */
  initDataOptimization() {
    console.log('📊 Data optimizer initialized');
  }

  /**
   * LRU キャッシュの実装
   */
  setCache(key, value) {
    // キャッシュサイズ制限
    if (this.dataCache.size >= this.maxCacheSize) {
      const firstKey = this.dataCache.keys().next().value;
      this.dataCache.delete(firstKey);
    }
    
    // 既存のキーを削除してから再追加（LRU順序維持）
    if (this.dataCache.has(key)) {
      this.dataCache.delete(key);
    }
    
    this.dataCache.set(key, {
      value,
      timestamp: performance.now(),
      accessCount: 1
    });
  }

  /**
   * キャッシュからデータを取得
   */
  getCache(key) {
    const cached = this.dataCache.get(key);
    if (cached) {
      cached.accessCount++;
      cached.lastAccess = performance.now();
      
      // アクセスされたアイテムを最後に移動（LRU）
      this.dataCache.delete(key);
      this.dataCache.set(key, cached);
      
      return cached.value;
    }
    return null;
  }

  /**
   * 高速な10分間平均計算（インデックス最適化版）
   */
  calculateOptimized10MinAverage(windHistory) {
    const cacheKey = `10min_avg_${windHistory.length}`;
    const cached = this.getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    const currentTime = new Date();
    const tenMinAgo = new Date(currentTime.getTime() - 10 * 60 * 1000);
    
    // 🚀 最適化: バイナリサーチで開始インデックスを高速特定
    const startIndex = this.binarySearchTimeIndex(windHistory, tenMinAgo);
    
    if (startIndex === -1) {
      return '--';
    }

    // 🚀 最適化: 有効なデータのみを高速処理
    let sum = 0;
    let count = 0;
    
    for (let i = startIndex; i < windHistory.length; i++) {
      const entry = windHistory[i];
      if (entry.time <= currentTime && isFinite(entry.speed)) {
        sum += Number(entry.speed);
        count++;
      }
    }

    const result = count > 0 ? sum / count : '--';
    this.setCache(cacheKey, result);
    
    return result;
  }

  /**
   * バイナリサーチによる時刻インデックス検索
   */
  binarySearchTimeIndex(windHistory, targetTime) {
    let left = 0;
    let right = windHistory.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = windHistory[mid].time;

      if (midTime >= targetTime) {
        result = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return result;
  }

  /**
   * データ圧縮（重複除去とデルタ圧縮）
   */
  compressWindData(data, tolerance = 0.1) {
    if (!this.compressionEnabled || data.length < 2) {
      return data;
    }

    const compressed = [data[0]]; // 最初のデータは必ず保持
    let lastSignificantPoint = data[0];

    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      
      // 🚀 最適化: Douglas-Peucker アルゴリズムの簡易版
      if (this.isSignificantPoint(lastSignificantPoint, current, tolerance)) {
        compressed.push(current);
        lastSignificantPoint = current;
      }
    }

    // 最後のポイントは必ず保持
    if (compressed[compressed.length - 1] !== data[data.length - 1]) {
      compressed.push(data[data.length - 1]);
    }

    console.log(`📊 Data compression: ${data.length} → ${compressed.length} points (${((1 - compressed.length / data.length) * 100).toFixed(1)}% reduction)`);
    
    return compressed;
  }

  /**
   * 重要なポイントかどうかを判定
   */
  isSignificantPoint(lastPoint, currentPoint, tolerance) {
    const speedDiff = Math.abs(currentPoint.speed - lastPoint.speed);
    const directionDiff = Math.abs(currentPoint.direction - lastPoint.direction);
    const timeDiff = currentPoint.time - lastPoint.time;

    // 変化が大きい場合や時間が経過した場合は重要
    return speedDiff > tolerance || 
           directionDiff > 5 || // 5度以上の風向変化
           timeDiff > 5000; // 5秒以上の時間経過
  }

  /**
   * 効率的なデータフィルタリング
   */
  filterDataOptimized(data, timeRangeMs) {
    const cutoffTime = new Date(Date.now() - timeRangeMs);
    
    // 🚀 最適化: バイナリサーチで開始点を特定
    const startIndex = this.binarySearchTimeIndex(data, cutoffTime);
    
    if (startIndex === -1) {
      return [];
    }

    return data.slice(startIndex);
  }

  /**
   * データのバッチ処理
   */
  processBatch(dataArray, processor, batchSize = 1000) {
    const results = [];
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const batchResult = processor(batch);
      results.push(...batchResult);
    }
    
    return results;
  }

  /**
   * メモリ使用量の最適化
   */
  optimizeMemoryUsage() {
    // 古いキャッシュエントリを削除
    const now = performance.now();
    const maxAge = 5 * 60 * 1000; // 5分

    for (const [key, value] of this.dataCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.dataCache.delete(key);
      }
    }

    // インデックスの再構築
    this.rebuildIndexes();
  }

  /**
   * インデックスの再構築
   */
  rebuildIndexes() {
    // 必要に応じてインデックスを再構築
    console.log('📊 Rebuilding data indexes');
  }

  /**
   * 統計情報の取得
   */
  getStatistics() {
    return {
      cacheSize: this.dataCache.size,
      maxCacheSize: this.maxCacheSize,
      compressionEnabled: this.compressionEnabled,
      indexedDataCount: this.indexedData.size
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    this.dataCache.clear();
    this.indexedData.clear();
    console.log('📊 Data optimizer cleaned up');
  }
}

// シングルトンインスタンス
const dataOptimizer = new DataOptimizer();

export default dataOptimizer;

// 便利関数のエクスポート
export const {
  calculateOptimized10MinAverage,
  compressWindData,
  filterDataOptimized,
  processBatch,
  optimizeMemoryUsage: optimizeDataMemory,
  getStatistics: getDataOptimizerStats,
  cleanup: cleanupDataOptimizer
} = dataOptimizer;
