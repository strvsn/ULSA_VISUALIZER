// modules/deviceConsole.js - デバイスコンソール機能

// =====================================================
// DEVICE CONSOLE
// =====================================================

export function initDeviceConsole() {
  // Create console container as a div to hold individual lines
  let deviceConsole = document.getElementById('deviceConsole');
  if (!deviceConsole) {
    deviceConsole = document.createElement('div');
    deviceConsole.id = 'deviceConsole';
    // 初期状態をライトモードで設定（ダークモード時は後でapplyDarkModeで変更）
    deviceConsole.style = 'background:#f8f9fa;color:#60797F;padding:8px;font-size:0.85em;max-height:8.5em;min-height:8.5em;overflow-y:auto;margin:8px 0 0 0;text-align:left;line-height:1.4;font-family:monospace;border:1px solid #dee2e6;';
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.appendChild(deviceConsole);
    else document.body.appendChild(deviceConsole);
  }
  
  window.appendDeviceConsole = (msg, type = 'recv') => {
    const container = document.getElementById('deviceConsole');
    if (!container) return;
    const prefix = type === 'send' ? '[SEND] ' : '[RECV] ';
    const line = msg.trim();
    if (!line) return;
    
    // メッセージ行を追加
    const msgDiv = document.createElement('div');
    msgDiv.textContent = prefix + line;
    container.appendChild(msgDiv);
    
    // 100行を超えた場合は古い行を削除（メモリ最適化）
    const maxLines = 100;
    const lines = container.children;
    while (lines.length > maxLines) {
      container.removeChild(lines[0]);
    }
    
    container.scrollTop = container.scrollHeight;
  };
}