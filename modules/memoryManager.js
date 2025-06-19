// modules/memoryManager.js - メモリ管理とパフォーマンス最適化

/**
 * Memory Management System for ULSA VISUALIZER
 * メモリリークの防止とパフォーマンスの最適化
 */

class MemoryManager {
  constructor() {
    this.eventListeners = new Map(); // イベントリスナーの追跡
    this.intervals = new Set(); // setIntervalの追跡
    this.timeouts = new Set(); // setTimeoutの追跡
    this.observers = new Set(); // Observer系の追跡
    this.weakRefs = new Map(); // WeakRefによる弱参照管理
    
    this.initMemoryMonitoring();
  }

  /**
   * メモリ監視の初期化
   */
  initMemoryMonitoring() {
    // Page Visibility API でタブ非表示時のクリーンアップ
    this.addEventListenerTracked(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.performLightCleanup();
      }
    });

    // ページアンロード時の完全クリーンアップ
    this.addEventListenerTracked(window, 'beforeunload', () => {
      this.performFullCleanup();
    });

    // 定期的なメモリ使用量チェック（5分間隔）
    this.setIntervalTracked(() => {
      this.checkMemoryUsage();
    }, 5 * 60 * 1000);
  }

  /**
   * イベントリスナーを追跡しながら追加
   */
  addEventListenerTracked(target, type, listener, options = {}) {
    target.addEventListener(type, listener, options);
    
    // クリーンアップ用に記録
    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, new Map());
    }
    this.eventListeners.get(target).set(type, { listener, options });
  }

  /**
   * setIntervalを追跡しながら実行
   */
  setIntervalTracked(callback, interval) {
    const id = setInterval(callback, interval);
    this.intervals.add(id);
    return id;
  }

  /**
   * setTimeoutを追跡しながら実行
   */
  setTimeoutTracked(callback, timeout) {
    const id = setTimeout(() => {
      callback();
      this.timeouts.delete(id); // 自動削除
    }, timeout);
    this.timeouts.add(id);
    return id;
  }

  /**
   * オブザーバーを追跡しながら追加
   */
  addObserverTracked(observer) {
    this.observers.add(observer);
    return observer;
  }

  /**
   * WeakRefによる弱参照の管理
   */
  addWeakRef(key, object) {
    this.weakRefs.set(key, new WeakRef(object));
  }

  /**
   * WeakRefから値を取得
   */
  getWeakRef(key) {
    const ref = this.weakRefs.get(key);
    if (ref) {
      const value = ref.deref();
      if (value === undefined) {
        // ガベージコレクションされた場合は削除
        this.weakRefs.delete(key);
      }
      return value;
    }
    return undefined;
  }

  /**
   * 軽量クリーンアップ（タブ非表示時）
   */
  performLightCleanup() {
    console.log('🧹 Performing light cleanup...');
    
    // WeakRefのクリーンアップ
    for (const [key, ref] of this.weakRefs.entries()) {
      if (ref.deref() === undefined) {
        this.weakRefs.delete(key);
      }
    }

    // 明示的なガベージコレクション（可能な場合）
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }
  }

  /**
   * 完全クリーンアップ（ページアンロード時）
   */
  performFullCleanup() {
    console.log('🧹 Performing full cleanup...');

    // すべてのイベントリスナーを削除
    for (const [target, listeners] of this.eventListeners.entries()) {
      for (const [type, { listener, options }] of listeners.entries()) {
        try {
          target.removeEventListener(type, listener, options);
        } catch (error) {
          console.warn('Failed to remove event listener:', error);
        }
      }
    }
    this.eventListeners.clear();

    // すべてのインターバルをクリア
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals.clear();

    // すべてのタイムアウトをクリア
    for (const id of this.timeouts) {
      clearTimeout(id);
    }
    this.timeouts.clear();

    // すべてのオブザーバーを停止
    for (const observer of this.observers) {
      try {
        if (observer.disconnect) observer.disconnect();
        if (observer.unobserve) observer.unobserve();
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }
    }
    this.observers.clear();

    // WeakRefをクリア
    this.weakRefs.clear();
  }

  /**
   * メモリ使用量のチェック
   */
  checkMemoryUsage() {
    if ('memory' in performance) {
      const memory = performance.memory;
      const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
      
      console.log(`📊 Memory Usage: ${usedMB}MB / ${totalMB}MB (Limit: ${limitMB}MB)`);
      
      // メモリ使用量が80%を超えた場合の警告
      if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
        console.warn('⚠️ High memory usage detected. Performing cleanup...');
        this.performLightCleanup();
      }
    }
  }

  /**
   * 現在の追跡状況を取得
   */
  getTrackingInfo() {
    return {
      eventListeners: this.eventListeners.size,
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      observers: this.observers.size,
      weakRefs: this.weakRefs.size
    };
  }
}

// シングルトンインスタンス
const memoryManager = new MemoryManager();

// エクスポート
export default memoryManager;

/**
 * 便利関数のエクスポート
 */
export const {
  addEventListenerTracked,
  setIntervalTracked,
  setTimeoutTracked,
  addObserverTracked,
  addWeakRef,
  getWeakRef,
  performLightCleanup,
  performFullCleanup,
  checkMemoryUsage,
  getTrackingInfo
} = memoryManager;
