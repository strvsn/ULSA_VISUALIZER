// modules/darkMode.js - ダークモード機能

// =====================================================
// DARK MODE SYSTEM
// =====================================================

export let isDarkMode = localStorage.getItem('darkMode') === 'true';

export function initDarkMode() {
  const darkModeBtn = document.getElementById('darkModeBtn');
  const body = document.getElementById('bodyRoot');
  const logoImg = document.getElementById('logoImg');
  
  if (!darkModeBtn || !body || !logoImg) return;
  
  // 初期状態を設定
  applyDarkMode();
  
  // 初期状態でChart.jsのテーマも更新
  setTimeout(() => {
    import('../windChart.js').then(({ updateChartTheme }) => {
      if (updateChartTheme) updateChartTheme();
    });
  }, 100);
  
  darkModeBtn.onclick = () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    applyDarkMode();
    
    // 風向ゲージを再描画（最新の値で）
    import('./windGauge.js').then(({ drawWindGauge, getLastWindData }) => {
      const { lastWindSpeed, lastWindDirection } = getLastWindData();
      if (typeof lastWindSpeed !== 'undefined' && typeof lastWindDirection !== 'undefined') {
        drawWindGauge(lastWindSpeed, lastWindDirection);
      }
    });
    
    // Chart.jsのテーマも更新
    setTimeout(() => {
      import('../windChart.js').then(({ updateChartTheme }) => {
        if (updateChartTheme) updateChartTheme();
      });
    }, 50);
  };
}

export function applyDarkMode() {
  const body = document.getElementById('bodyRoot');
  const logoImg = document.getElementById('logoImg');
  const darkModeBtn = document.getElementById('darkModeBtn');
  
  if (!body || !logoImg || !darkModeBtn) return;
  
  if (isDarkMode) {
    // ダークモード適用
    body.classList.remove('bg-light');
    body.classList.add('bg-dark', 'text-light');
    body.setAttribute('data-bs-theme', 'dark');
    
    // ロゴを白に変更
    logoImg.src = 'images/ulsavis_strvsn_logo_white.png';
    
    // ダークモードボタンのアイコンを太陽に変更
    darkModeBtn.innerHTML = '<i class="bi bi-sun"></i>';
    darkModeBtn.className = 'btn btn-outline-light btn-lg';
    
    // 全ての白い背景要素をダークに変更
    const whiteElements = document.querySelectorAll('.bg-white');
    whiteElements.forEach(el => {
      el.classList.remove('bg-white');
      el.classList.add('bg-secondary', 'text-light');
    });
    
    // コンソール背景をダークに変更
    const deviceConsole = document.getElementById('deviceConsole');
    if (deviceConsole) {
      deviceConsole.style.background = '#495057';
      deviceConsole.style.color = '#F8F9FA';
      deviceConsole.style.border = '1px solid #333';
    }
    
    // 風向キャンバス背景を#343A3Fに変更
    const gaugeCanvasContainer = document.querySelector('#gaugeCanvas').closest('div');
    if (gaugeCanvasContainer) {
      gaugeCanvasContainer.classList.remove('bg-secondary');
      gaugeCanvasContainer.style.backgroundColor = '#343A3F';
    }
    
    // 下段4カラムの背景を#343A3F に変更
    const bottomColumns = document.querySelectorAll('.row.g-4.align-items-start.mb-3 .col-md-3');
    bottomColumns.forEach(col => {
      // カラム内の背景要素を取得
      const bgElement = col.querySelector('.bg-white, .bg-secondary, .bg-light');
      if (bgElement) {
        // 既存のBootstrap背景クラスを削除
        bgElement.classList.remove('bg-white', 'bg-secondary', 'bg-light');
        // ダークモード背景色を設定
        bgElement.style.backgroundColor = '#343A3F';
        bgElement.style.color = '#ffffff';
      }
    });
    
    // 記録時間・データ量表示をライトグレーに変更
    const logInfoDiv = document.getElementById('logInfoDiv');
    if (logInfoDiv) {
      logInfoDiv.style.color = '#adb5bd'; // ライトグレー
    }
    
  } else {
    // ライトモード適用
    body.classList.remove('bg-dark', 'text-light');
    body.classList.add('bg-light');
    body.setAttribute('data-bs-theme', 'light');
    
    // ロゴをグレーに変更
    logoImg.src = 'images/ulsavis_strvsn_logo_gray.png';
    
    // ダークモードボタンのアイコンを月に変更
    darkModeBtn.innerHTML = '<i class="bi bi-moon"></i>';
    darkModeBtn.className = 'btn btn-outline-dark btn-lg';
    
    // 全てのダーク背景要素を白に戻す
    const darkElements = document.querySelectorAll('.bg-secondary');
    darkElements.forEach(el => {
      el.classList.remove('bg-secondary', 'text-light');
      el.classList.add('bg-white');
    });
    
    // コンソール背景をライトに変更
    const deviceConsole = document.getElementById('deviceConsole');
    if (deviceConsole) {
      deviceConsole.style.background = '#f8f9fa';
      deviceConsole.style.color = '#60797F';
      deviceConsole.style.border = '1px solid #dee2e6';
    }
    
    // 風向キャンバス背景をデフォルトに戻す
    const gaugeCanvasContainer = document.querySelector('#gaugeCanvas').closest('div');
    if (gaugeCanvasContainer) {
      gaugeCanvasContainer.style.backgroundColor = '';
      gaugeCanvasContainer.classList.remove('bg-secondary', 'text-light');
      gaugeCanvasContainer.classList.add('bg-white');
    }
    
    // 下段4カラムの背景をデフォルトに戻す
    const bottomColumns = document.querySelectorAll('.row.g-4.align-items-start.mb-3 .col-md-3');
    bottomColumns.forEach(col => {
      // カラム内の背景要素を取得
      const bgElement = col.querySelector('div');
      if (bgElement) {
        // インラインスタイルをリセット
        bgElement.style.backgroundColor = '';
        bgElement.style.color = '';
        // 既存のBootstrap背景クラスを削除
        bgElement.classList.remove('bg-secondary', 'text-light');
        // ライトモード背景クラスを追加
        bgElement.classList.add('bg-white');
      }
    });
    
    // 記録時間・データ量表示を元の色に戻す
    const logInfoDiv = document.getElementById('logInfoDiv');
    if (logInfoDiv) {
      logInfoDiv.style.color = ''; // インラインスタイルをリセットしてBootstrapクラスに戻す
    }
  }
  
  // 風向ゲージを再描画（最新の値で）
  import('./windGauge.js').then(({ drawWindGauge, getLastWindData }) => {
    const { lastWindSpeed, lastWindDirection } = getLastWindData();
    if (typeof lastWindSpeed !== 'undefined' && typeof lastWindDirection !== 'undefined') {
      drawWindGauge(lastWindSpeed, lastWindDirection);
    }
  });
}