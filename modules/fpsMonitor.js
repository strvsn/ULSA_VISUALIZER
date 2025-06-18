// modules/fpsMonitor.js - FPS監視機能

// =====================================================
// FPS MONITORING SYSTEM WITH PAGE VISIBILITY API
// =====================================================

// 10秒間平均FPS計算と10FPS割り込み検出機能（Page Visibility API対応）
export function initializeFpsMonitor() {
  const FPS_SAMPLE_INTERVAL = 1000; // 1秒ごとにFPSサンプルを記録
  const FPS_AVERAGE_PERIOD = 10000; // 10秒間の平均FPS計算
  const FPS_THRESHOLD = 10; // **🚀 最適化: 10FPS以下でアラート（25→10に調整）**
  
  let lastTs = performance.now();
  let frames = 0;
  let fpsHistory = []; // 過去10秒のFPS履歴
  let averageFps = 60; // 初期値
  let lowFpsPopupShown = false; // ポップアップ表示状態
    // Page Visibility API関連の変数
  let isTabVisible = !document.hidden; // タブの可視性状態
  let lastVisibilityChange = performance.now(); // 最後の可視性変更時刻
  let wasHiddenRecently = false; // 最近タブが非表示だったかのフラグ
  // **🚀 最適化: FPS低下検知の感度調整**
  const FPS_STABLE_THRESHOLD = 30; // 30FPS以上で安定とみなす
  let consecutiveLowFpsCount = 0; // 連続低FPS回数
  const LOW_FPS_TRIGGER_COUNT = 3; // 3回連続で低FPSの場合にアラート
  
  // Page Visibility APIイベントリスナーを設定
  function handleVisibilityChange() {
    const now = performance.now();
    const previousVisibility = isTabVisible;
    isTabVisible = !document.hidden;
    lastVisibilityChange = now;
    
    if (previousVisibility !== isTabVisible) {
      if (isTabVisible) {
        console.info('🔍 Tab became visible - FPS monitoring resumed');
        wasHiddenRecently = true;
        // タブが再表示されたら、5秒間はFPS低下警告を無効化
        setTimeout(() => {
          wasHiddenRecently = false;
          console.debug('🔍 Tab visibility stabilized - normal FPS monitoring resumed');
        }, 5000);
        
        // FPS履歴をリセットして正確な測定を開始
        fpsHistory = [];
        frames = 0;
        lastTs = now;
      } else {
        console.info('🔍 Tab became hidden - FPS monitoring paused');
        // タブが非表示になったらFPS履歴をクリア
        fpsHistory = [];
      }
    }
  }
  
  // Page Visibility APIのイベントリスナーを登録
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  function loop() {
    frames++;
    const now = performance.now();
      // 1秒ごとにFPSサンプルを記録
    if (now - lastTs >= FPS_SAMPLE_INTERVAL) {
      const currentFps = frames;
      
      // タブが可視状態の場合のみFPS履歴に記録
      if (isTabVisible) {
        fpsHistory.push({
          fps: currentFps,
          timestamp: now
        });
        
        // 10秒以上前のデータを削除
        const cutoffTime = now - FPS_AVERAGE_PERIOD;
        fpsHistory = fpsHistory.filter(sample => sample.timestamp > cutoffTime);
        
        // 10秒間の平均FPS計算
        if (fpsHistory.length > 0) {
          const totalFps = fpsHistory.reduce((sum, sample) => sum + sample.fps, 0);
          averageFps = totalFps / fpsHistory.length;
          
          console.debug(`Average FPS (10s): ${averageFps.toFixed(1)} | Current: ${currentFps} | Tab: ${isTabVisible ? 'visible' : 'hidden'}`);
            // **🚀 最適化: FPS低下検出の改善**
          // 連続低FPSカウンタを更新
          if (averageFps <= FPS_THRESHOLD) {
            consecutiveLowFpsCount++;
          } else if (averageFps > FPS_STABLE_THRESHOLD) {
            consecutiveLowFpsCount = 0; // 安定FPSで連続カウンタリセット
          }
          
          // FPS低下検出の条件を強化
          const shouldCheckFps = isTabVisible && !wasHiddenRecently && !lowFpsPopupShown;
          const timeSinceVisibilityChange = now - lastVisibilityChange;
          const isStableAfterVisibilityChange = timeSinceVisibilityChange > 5000; // 5秒間の安定期間
            // **🚀 改善: 連続低FPSの場合のみアラート**
          // 10FPS以下が3回連続の検出とグラフ更新停止（タブが可視状態で安定している場合のみ）
          if (shouldCheckFps && isStableAfterVisibilityChange && 
              consecutiveLowFpsCount >= LOW_FPS_TRIGGER_COUNT && 
              averageFps <= FPS_THRESHOLD) {
            console.warn(`🐌 Persistent performance issue detected - Average FPS: ${averageFps.toFixed(1)} (${consecutiveLowFpsCount} consecutive low FPS samples)`);
            handleLowFpsDetected(averageFps);
          }
          // FPS回復の自動検出（15FPS以上で回復とみなす）
          else if (averageFps > FPS_STABLE_THRESHOLD && lowFpsPopupShown) {
            console.info(`⚡ FPS recovered: ${averageFps.toFixed(1)} FPS - Chart drawing can be resumed`);
            consecutiveLowFpsCount = 0; // 回復時にカウンタリセット
            // 自動復旧はせず、ユーザーに通知のみ
          }
        }
      } else {
        // タブが非可視の場合はFPSカウントのみ実行（履歴には追加しない）
        console.debug(`FPS monitoring paused - Tab hidden | Current: ${currentFps}`);
      }
      
      frames = 0;
      lastTs = now;
    }
    
    requestAnimationFrame(loop);
  }
    function handleLowFpsDetected(avgFps) {
    const timeSinceVisibilityChange = performance.now() - lastVisibilityChange;
    console.warn(`🐌 Genuine low FPS detected: ${avgFps.toFixed(1)} FPS (threshold: ${FPS_THRESHOLD})`);
    console.warn(`📊 Context - Tab visible: ${isTabVisible}, Time since visibility change: ${(timeSinceVisibilityChange/1000).toFixed(1)}s`);
    
    // グラフ描画を停止
    import('../main.js').then(({ setChartDrawingEnabled, updateToggleButtonState }) => {
      setChartDrawingEnabled(false);
      lowFpsPopupShown = true;
      
      // トグルボタンの状態を更新
      const chartToggleBtn = document.getElementById('chartToggleBtn');
      if (chartToggleBtn) {
        updateToggleButtonState(false);
      }
      
      // ポップアップ表示
      showLowFpsPopup(avgFps);
    });
  }
  
  function showLowFpsPopup(avgFps) {
    // ポップアップダイアログを作成
    const popup = document.createElement('div');
    popup.id = 'low-fps-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #ff4444;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      max-width: 400px;
      text-align: center;
    `;
    
    popup.innerHTML = `      <h3 style="color: #ff4444; margin-top: 0; margin-bottom: 15px;">⚠️ グラフ更新停止</h3>
      <p style="margin-bottom: 20px; line-height: 1.5;">
        平均FPSが<strong>${avgFps.toFixed(1)}</strong>に低下したため、<br>
        グラフの描画を停止しました。<br><br>
        記録中のCSVログは継続しています。
      </p>
      <button id="resume-chart-btn" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        transition: background-color 0.3s;
      ">OK</button>
    `;
    
    // オーバーレイ背景
    const overlay = document.createElement('div');
    overlay.id = 'low-fps-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // ポップアップ内のFPS表示を定期更新
    const fpsUpdateInterval = setInterval(() => {
      if (document.getElementById('current-fps-display')) {
        const currentFpsSpan = document.getElementById('current-fps-display');
        const averageFpsSpan = document.getElementById('average-fps-display');
        if (currentFpsSpan && averageFpsSpan) {
          // 最新のFPS値を取得（フレームカウントから）
          currentFpsSpan.textContent = frames.toString();
          averageFpsSpan.textContent = averageFps.toFixed(1);
        }
      } else {
        clearInterval(fpsUpdateInterval);
      }
    }, 1000);
      // OKボタンのクリックイベント
    const resumeBtn = document.getElementById('resume-chart-btn');
    
    if (!resumeBtn) {
      console.error('❌ Resume button not found in popup!');
      return;
    }
    
    console.log('✅ Setting up resume button event listeners');
    
    // ホバー効果を追加
    resumeBtn.addEventListener('mouseenter', function() {
      console.log('🖱️ Mouse enter resume button');
      this.style.backgroundColor = '#45a049';
    });
    resumeBtn.addEventListener('mouseleave', function() {
      console.log('🖱️ Mouse leave resume button');
      this.style.backgroundColor = '#4CAF50';
    });
    
    resumeBtn.addEventListener('click', function(event) {
      console.log('🔘 Resume button clicked!');
      event.preventDefault();
      event.stopPropagation();
      
      try {
        // 描画は自動再開しない - ユーザーがトグルボタンで明示的に操作する必要がある
        lowFpsPopupShown = false;
        
        // FPS更新インターバルをクリア
        clearInterval(fpsUpdateInterval);
        
        // ポップアップを削除
        if (popup.parentNode) {
          document.body.removeChild(popup);
        }
        if (overlay.parentNode) {
          document.body.removeChild(overlay);
        }
        
        console.info('✅ FPS popup closed - chart drawing remains stopped (user must manually enable via toggle button)');
      } catch (error) {
        console.error('❌ Error closing FPS popup:', error);
      }
    });
  }
  
  // 外部からアクセス可能なFPS情報
  window.getFpsInfo = function() {
    return {
      averageFps: averageFps,
      lowFpsPopupShown: lowFpsPopupShown
    };
  };
    // デバッグ用: FPS低下をシミュレートする関数
  window.simulateLowFps = function(targetFps = 8) {
    console.warn(`Simulating low FPS (${targetFps} FPS) for testing...`);
    handleLowFpsDetected(targetFps);
  };
  
  // デバッグ用: FPS監視をリセットする関数
  window.resetFpsMonitor = function() {
    import('../main.js').then(({ setChartDrawingEnabled }) => {
      setChartDrawingEnabled(true);
      lowFpsPopupShown = false;
      averageFps = 60;
      console.info('FPS monitor reset to normal state');
    });
  };
  
  // デバッグ用: ポップアップの状態を確認する関数
  window.debugFpsPopup = function() {
    const popup = document.getElementById('low-fps-popup');
    const overlay = document.getElementById('low-fps-overlay');
    const button = document.getElementById('resume-chart-btn');
    
    console.log('🔍 FPS Popup Debug Info:');
    console.log('- Popup exists:', !!popup);
    console.log('- Overlay exists:', !!overlay);
    console.log('- Button exists:', !!button);
    
    if (button) {
      console.log('- Button style:', button.style.cssText);
      console.log('- Button parent:', button.parentNode);
      console.log('- Button click listeners:', button.onclick);
    }
    
    return { popup, overlay, button };
  };
  
  requestAnimationFrame(loop);
}

// =====================================================
// FPS REPORTING
// =====================================================

// FPS計測・表示
let lastFpsTime = performance.now();
let frameCount = 0;

export function reportFps() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fps = frameCount / ((now - lastFpsTime) / 1000);
    if (window.appendDeviceConsole) {
      window.appendDeviceConsole(`Chart FPS: ${fps.toFixed(1)}`, 'debug');
    } else {
      console.debug(`Chart FPS: ${fps.toFixed(1)}`);
    }
    frameCount = 0;
    lastFpsTime = now;
  }
}