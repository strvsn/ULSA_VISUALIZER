// lttbWorker.js - LTTBデシメーション処理用WebWorker
// 1日タイムスケールでのメインスレッドブロッキング解決

/**
 * LTTB (Largest Triangle Three Buckets) アルゴリズム実装
 * Chart.jsの実装と互換性を保ちつつ、WebWorkerで並列実行
 */
function lttbDecimation(data, samples) {
  if (!data || data.length <= samples) {
    return data; // データが少ない場合はそのまま返す
  }

  const result = [];
  const dataLength = data.length;
  
  // バケットサイズを計算
  const bucketSize = (dataLength - 2) / (samples - 2);
  
  // 最初のポイントは必ず含める
  result.push(data[0]);
  
  let bucketIndex = 0;
  
  for (let i = 1; i < samples - 1; i++) {
    // 現在のバケットの開始と終了位置を計算
    const avgStart = Math.floor(bucketIndex * bucketSize) + 1;
    const avgEnd = Math.floor((bucketIndex + 1) * bucketSize) + 1;
    
    // 次のバケットの平均ポイントを計算
    const nextBucketStart = Math.floor((bucketIndex + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.floor((bucketIndex + 2) * bucketSize) + 1;
    
    let avgX = 0, avgY = 0;
    let avgLength = 0;
    
    for (let j = nextBucketStart; j < nextBucketEnd && j < dataLength; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
      avgLength++;
    }
    
    if (avgLength > 0) {
      avgX /= avgLength;
      avgY /= avgLength;
    }
    
    // 前のポイント
    const prevPoint = result[result.length - 1];
    
    // 現在のバケット内で最大の三角形面積を持つポイントを探す
    let maxArea = -1;
    let maxAreaIndex = avgStart;
    
    for (let j = avgStart; j < avgEnd && j < dataLength; j++) {
      const point = data[j];
      
      // 三角形の面積を計算
      const area = Math.abs(
        (prevPoint.x - avgX) * (point.y - prevPoint.y) - 
        (prevPoint.x - point.x) * (avgY - prevPoint.y)
      ) * 0.5;
      
      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }
    
    result.push(data[maxAreaIndex]);
    bucketIndex++;
  }
  
  // 最後のポイントは必ず含める
  result.push(data[dataLength - 1]);
  
  return result;
}

/**
 * Chart.jsデータを{x, y}形式に変換
 */
function convertChartDataToPoints(labels, dataset) {
  if (!labels || !Array.isArray(labels) || !dataset || !Array.isArray(dataset)) {
    console.warn('Invalid input data for convertChartDataToPoints');
    return [];
  }
  
  return labels.map((label, index) => {
    const xValue = label instanceof Date ? label.getTime() : new Date(label).getTime();
    const yValue = dataset[index];
    
    return {
      x: isNaN(xValue) ? Date.now() : xValue,
      y: isFinite(yValue) ? Number(yValue) : 0
    };
  }).filter(point => !isNaN(point.x) && isFinite(point.y));
}

/**
 * デシメーション結果をChart.js形式に変換
 */
function convertPointsToChartData(points) {
  if (!points || !Array.isArray(points) || points.length === 0) {
    return {
      labels: [],
      data: []
    };
  }
  
  return {
    labels: points.map(p => new Date(p.x)),
    data: points.map(p => p.y)
  };
}

/**
 * WebWorkerメインメッセージハンドラ
 */
self.addEventListener('message', function(e) {
  const { type, payload, taskId } = e.data;
  
  try {
    if (type === 'LTTB_DECIMATION') {
      const { labels, datasets, samples, timeRangeSec } = payload;
      
      // 入力データの検証
      if (!labels || !Array.isArray(labels) || labels.length === 0) {
        throw new Error('Invalid or empty labels array');
      }
      
      if (!datasets || !Array.isArray(datasets) || datasets.length === 0) {
        throw new Error('Invalid or empty datasets array');
      }
      
      if (!samples || samples <= 0) {
        throw new Error('Invalid samples value');
      }
      
      // パフォーマンス計測開始
      const startTime = performance.now();
      
      // 各データセットに対してLTTBデシメーション実行
      const decimatedDatasets = datasets.map((dataset, index) => {
        try {
          if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
            console.warn(`Dataset ${index} has invalid data, skipping`);
            return { labels: [], data: [] };
          }
          
          const points = convertChartDataToPoints(labels, dataset.data);
          if (points.length === 0) {
            console.warn(`Dataset ${index} converted to empty points array`);
            return { labels: [], data: [] };
          }
          
          const decimatedPoints = lttbDecimation(points, samples);
          return convertPointsToChartData(decimatedPoints);
        } catch (datasetError) {
          console.error(`Error processing dataset ${index}:`, datasetError);
          return { labels: [], data: [] };
        }
      });
      
      // 有効なデータセットが存在するかチェック
      const validDatasets = decimatedDatasets.filter(ds => ds.labels.length > 0);
      if (validDatasets.length === 0) {
        throw new Error('No valid datasets after decimation');
      }
      
      // 共通のラベル（時刻）を取得（最初の有効なデータセットから）
      const decimatedLabels = validDatasets[0].labels;
      
      // 各データセットのデータ部分のみを取得
      const decimatedData = decimatedDatasets.map(ds => ds.data);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // メインスレッドに結果を送信
      self.postMessage({
        type: 'LTTB_DECIMATION_RESULT',
        taskId,
        payload: {
          labels: decimatedLabels,
          datasets: decimatedData,
          originalCount: labels.length,
          decimatedCount: decimatedLabels.length,
          processingTime,
          samples,
          timeRangeSec
        }
      });
      
      console.log(`WebWorker LTTB processing completed: ${processingTime.toFixed(2)}ms`);
      
    } else if (type === 'PING') {
      // WebWorker生存確認
      self.postMessage({
        type: 'PONG',
        taskId,
        payload: { timestamp: Date.now() }
      });
    }
    
  } catch (error) {
    // エラーをメインスレッドに送信
    self.postMessage({
      type: 'ERROR',
      taskId,
      payload: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// WebWorker初期化完了通知
self.postMessage({
  type: 'WORKER_READY',
  payload: { 
    timestamp: Date.now(),
    message: 'LTTB WebWorker initialized successfully'
  }
});
