// lttbWorkerManager.js - WebWorker管理とタスクキューイング
// メインスレッドのブロッキングを防ぐための並列処理制御

class LTTBWorkerManager {
  constructor() {
    this.worker = null;
    this.taskQueue = [];
    this.pendingTasks = new Map();
    this.taskIdCounter = 0;
    this.isWorkerReady = false;
    this.maxRetries = 3;
    
    this.initWorker();
  }
  
  /**
   * WebWorker初期化
   */
  initWorker() {
    try {
      this.worker = new Worker('./workers/lttbWorker.js');
      
      this.worker.addEventListener('message', (e) => {
        this.handleWorkerMessage(e.data);
      });
      
      this.worker.addEventListener('error', (error) => {
        console.error('WebWorker error:', error);
        this.handleWorkerError(error);
      });
      
      console.log('LTTB WebWorker initializing...');
      
    } catch (error) {
      console.error('Failed to initialize WebWorker:', error);
      this.isWorkerReady = false;
    }
  }
  
  /**
   * WebWorkerメッセージハンドラ
   */
  handleWorkerMessage(message) {
    const { type, taskId, payload } = message;
    
    switch (type) {
      case 'WORKER_READY':
        this.isWorkerReady = true;
        console.log('LTTB WebWorker ready:', payload.message);
        this.processTaskQueue();
        break;
        
      case 'LTTB_DECIMATION_RESULT':
        this.handleDecimationResult(taskId, payload);
        break;
        
      case 'ERROR':
        this.handleTaskError(taskId, payload);
        break;
        
      case 'PONG':
        console.log('WebWorker health check OK');
        break;
        
      default:
        console.warn('Unknown WebWorker message type:', type);
    }
  }
  
  /**
   * デシメーション結果処理
   */
  handleDecimationResult(taskId, result) {
    const task = this.pendingTasks.get(taskId);
    if (!task) {
      console.warn('Received result for unknown task:', taskId);
      return;
    }
    
    this.pendingTasks.delete(taskId);
    
    // コールバック実行
    if (task.callback) {
      task.callback(null, result);
    }
  }
  
  /**
   * タスクエラー処理
   */
  handleTaskError(taskId, error) {
    const task = this.pendingTasks.get(taskId);
    if (!task) {
      console.warn('Received error for unknown task:', taskId);
      return;
    }
    
    this.pendingTasks.delete(taskId);
    
    // リトライ処理
    if (task.retryCount < this.maxRetries) {
      task.retryCount++;
      console.warn(`LTTB task failed, retrying (${task.retryCount}/${this.maxRetries}):`, error.message);
      this.taskQueue.unshift(task); // 優先的に再実行
      this.processTaskQueue();
    } else {
      console.error('LTTB task failed after max retries:', error);
      if (task.callback) {
        task.callback(new Error(error.message), null);
      }
    }
  }
  
  /**
   * WebWorkerエラー処理
   */
  handleWorkerError(error) {
    console.error('WebWorker error:', error);
    this.isWorkerReady = false;
    
    // 待機中のタスクにエラーを通知
    this.pendingTasks.forEach((task, taskId) => {
      if (task.callback) {
        task.callback(new Error('WebWorker crashed'), null);
      }
    });
    this.pendingTasks.clear();
    
    // Worker再初期化
    setTimeout(() => {
      console.log('Attempting WebWorker restart...');
      this.initWorker();
    }, 1000);
  }
  
  /**
   * タスクキュー処理
   */
  processTaskQueue() {
    if (!this.isWorkerReady || this.taskQueue.length === 0) {
      return;
    }
    
    const task = this.taskQueue.shift();
    const taskId = ++this.taskIdCounter;
    
    task.taskId = taskId;
    task.retryCount = task.retryCount || 0;
    
    this.pendingTasks.set(taskId, task);
    
    // WebWorkerにタスクを送信
    this.worker.postMessage({
      type: 'LTTB_DECIMATION',
      taskId,
      payload: task.payload
    });
  }
  
  /**
   * LTTBデシメーション実行
   * @param {Array} labels - チャートラベル（時刻）
   * @param {Array} datasets - チャートデータセット
   * @param {number} samples - デシメーション後のサンプル数
   * @param {number} timeRangeSec - タイムレンジ（秒）
   * @param {Function} callback - 完了コールバック(error, result)
   */
  decimateData(labels, datasets, samples, timeRangeSec, callback) {
    // 入力データの基本検証
    if (!labels || !Array.isArray(labels)) {
      if (callback) callback(new Error('Invalid labels: must be an array'), null);
      return;
    }
    
    if (!datasets || !Array.isArray(datasets)) {
      if (callback) callback(new Error('Invalid datasets: must be an array'), null);
      return;
    }
    
    if (!samples || samples <= 0 || !Number.isInteger(samples)) {
      if (callback) callback(new Error('Invalid samples: must be a positive integer'), null);
      return;
    }
    
    // データが少ない場合は処理をスキップ
    if (labels.length <= samples) {
      if (callback) {
        callback(null, {
          labels: labels || [],
          datasets: datasets ? datasets.map(ds => ds.data || []) : [],
          originalCount: labels ? labels.length : 0,
          decimatedCount: labels ? labels.length : 0,
          processingTime: 0,
          samples,
          timeRangeSec,
          skipped: true,
          reason: 'Insufficient data points'
        });
      }
      return;
    }
    
    // データセットの基本検証
    const validDatasets = datasets.filter(ds => ds && ds.data && Array.isArray(ds.data));
    if (validDatasets.length === 0) {
      if (callback) callback(new Error('No valid datasets found'), null);
      return;
    }
    
    const task = {
      payload: {
        labels,
        datasets: validDatasets.map(ds => ({ data: ds.data || [] })),
        samples,
        timeRangeSec
      },
      callback
    };
    
    this.taskQueue.push(task);
    this.processTaskQueue();
  }
  
  /**
   * WebWorker生存確認
   */
  healthCheck() {
    if (this.isWorkerReady && this.worker) {
      this.worker.postMessage({
        type: 'PING',
        taskId: ++this.taskIdCounter
      });
    }
  }
  
  /**
   * WebWorker終了
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isWorkerReady = false;
    this.pendingTasks.clear();
    this.taskQueue.length = 0;
  }
  
  /**
   * 現在の状態を取得
   */
  getStatus() {
    return {
      isReady: this.isWorkerReady,
      queueLength: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
      workerExists: !!this.worker
    };
  }
}

// シングルトンインスタンス
let workerManagerInstance = null;

/**
 * WebWorkerManager取得
 */
export function getLTTBWorkerManager() {
  if (!workerManagerInstance) {
    workerManagerInstance = new LTTBWorkerManager();
  }
  return workerManagerInstance;
}

/**
 * WebWorkerManager終了
 */
export function terminateLTTBWorkerManager() {
  if (workerManagerInstance) {
    workerManagerInstance.terminate();
    workerManagerInstance = null;
  }
}

export default LTTBWorkerManager;
