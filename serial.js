import { updateWindChart } from './windChart.js';

let serialPort = null;
let serialReader = null;
let serialStreamClosed = null;
let serialWriter = null;

export async function connectSerial() {
  try {
    if (serialPort && serialPort.readable) {
      await disconnectSerial();
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });

    const textDecoder = new TextDecoderStream();
    serialStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    serialReader = textDecoder.readable.getReader();
    serialWriter = serialPort.writable.getWriter();

    let buffer = '';
    let formatChecked = false;
    let formatOk = false;
    let formatCheckTimeout = null;
    let firstLineCheckPending = true;
    let firstLineCheckTimer = null;
    let pendingLines = [];
    let nonHashCount = 0;
    let afterCommandNonHashCount = 0;
    let afterCommandMode = false;

    if (window.Swal) {
      Swal.fire({
        icon: 'success',
        title: 'シリアル接続成功',
        text: 'デバイスと接続しました！',
        timer: 1500,
        showConfirmButton: false
      });
    }
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('disconnectBtn').disabled = false;

    // --- フォーマット自動判定・コマンド送信 ---
    async function sendFormatCommands() {
      afterCommandMode = false; // コマンド送信中は判定しない
      afterCommandNonHashCount = 0;
      const send = async (str) => {
        const encoder = new TextEncoder();
        await serialWriter.write(encoder.encode(str));
        if (window.appendDeviceConsole) window.appendDeviceConsole(str.replace(/\n|\r/g, ''), 'send');
        await new Promise(r => setTimeout(r, 1500)); // ディレイを1500msに変更
      };
      // ポップアップ進捗表示
      let secondsLeft = 9; // 6コマンド×1.5秒=9秒
      let progressSwal = null;
      if (window.Swal) {
        progressSwal = Swal.fire({
          icon: 'info',
          title: '<span style="font-size:1.2em;">ことなる出力フォーマット</span><br><span style="font-size:1em;font-weight:normal;">ULSAの出力フォーマットをSimple CSVに自動変更します</span>',
          html: `<div style="display:flex;align-items:center;justify-content:center;gap:10px;">
            <span class="ulsavis-loader" style="width:22px;height:22px;display:inline-block;border:3px solid #ccc;border-top:3px solid #3085d6;border-radius:50%;animation:ulsaspin 1s linear infinite;"></span>
            <span id="swal-timer">設定完了まであと ${secondsLeft} 秒お待ち下さい</span>
          </div>
          <style>@keyframes ulsaspin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>`,
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            const timerInterval = setInterval(() => {
              secondsLeft--;
              const el = document.getElementById('swal-timer');
              if (el) el.textContent = `設定完了まであと ${secondsLeft} 秒お待ち下さい`;
              if (secondsLeft <= 0) clearInterval(timerInterval);
            }, 1000);
          }
        });
      }
      await send("/");
      await send("config\n");
      await send("B\n");
      await send("1\n");
      await send("S\n");
      await send("R\n");
      if (window.Swal) Swal.close(); // コマンド送信後にポップアップを閉じる
      // R送信後から判定を有効化
      afterCommandMode = true;
      afterCommandNonHashCount = 0;
    }

    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let line of lines) {
          if (window.appendDeviceConsole && line.trim().length > 0) window.appendDeviceConsole(line, 'recv');
          // --- ここから修正: どんな場合もonSerialDataを呼ぶ ---
          let shouldCallOnSerialData = true;
          if (firstLineCheckPending) {
            pendingLines.push(line);
            if (!firstLineCheckTimer) {
              firstLineCheckTimer = setTimeout(async () => {
                for (let l of pendingLines) {
                  if (l.trim().length === 0) continue;
                  if (!formatChecked) {
                    if (l[0] !== '#') {
                      nonHashCount++;
                      if (nonHashCount >= 3) {
                        formatChecked = true;
                        if (window.Swal) {
                          Swal.fire({
                            icon: 'info',
                            title: 'フォーマット自動設定',
                            text: 'デバイスにフォーマット設定コマンドを送信します...',
                            timer: 2000,
                            showConfirmButton: false
                          });
                        }
                        await sendFormatCommands();
                        // コマンド送信後のデータのみ判定するためreturnで抜ける
                        return;
                      }
                    } else {
                      nonHashCount = 0;
                      formatChecked = true;
                      formatOk = true;
                      break;
                    }
                  }
                }
                firstLineCheckPending = false;
                pendingLines = [];
              }, 1000);
            }
            // --- 修正: ここでonSerialDataを呼ぶ ---
            if (line.trim().length > 0) onSerialData(line);
            continue;
          }
          if (!formatChecked) {
            if (line.trim().length === 0) {
              onSerialData(line);
              continue;
            }
            if (line[0] !== '#') {
              nonHashCount++;
              if (nonHashCount >= 3) {
                formatChecked = true;
                if (window.Swal) {
                  Swal.fire({
                    icon: 'info',
                    title: 'フォーマット自動設定',
                    text: 'デバイスにフォーマット設定コマンドを送信します...',
                    timer: 2000,
                    showConfirmButton: false
                  });
                }
                await sendFormatCommands();
                // コマンド送信後はafterCommandModeで監視
                onSerialData(line); // ここで必ず呼ぶ
                continue;
              }
            } else {
              nonHashCount = 0;
              formatChecked = true;
              formatOk = true;
            }
            onSerialData(line); // ここで必ず呼ぶ
          } else if (!formatOk && line[0] === '#') {
            formatOk = true;
            afterCommandMode = false;
            afterCommandNonHashCount = 0;
            if (formatCheckTimeout) clearTimeout(formatCheckTimeout);
            if (window.Swal) {
              Swal.fire({
                icon: 'success',
                title: 'フォーマット自動設定完了',
                text: 'デバイス出力が#で始まりました。',
                timer: 1500,
                showConfirmButton: false
              });
            }
            onSerialData(line);
          } else if (afterCommandMode) {
            if (line.trim().length === 0) {
              onSerialData(line);
              continue;
            }
            if (line[0] !== '#') {
              afterCommandNonHashCount++;
              if (afterCommandNonHashCount >= 3) {
                afterCommandMode = false;
                if (window.Swal) {
                  Swal.fire({
                    icon: 'error',
                    title: 'フォーマット自動設定失敗',
                    text: 'デバイス出力が#で始まりません。手動で設定してください。',
                    showConfirmButton: true
                  });
                }
              }
            } else {
              afterCommandNonHashCount = 0;
              formatOk = true;
              afterCommandMode = false;
              if (window.Swal) {
                Swal.fire({
                  icon: 'success',
                  title: 'フォーマット自動設定完了',
                  text: 'デバイス出力が#で始まりました。',
                  timer: 1500,
                  showConfirmButton: false
                });
              }
            }
            onSerialData(line);
          } else {
            onSerialData(line);
          }
        }
      }
    }
  } catch (err) {
    if (window.Swal) {
      Swal.fire({
        icon: 'error',
        title: '接続エラー',
        text: err.toString()
      });
    }
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;
  }
}

export async function disconnectSerial() {
  try {
    if (serialReader) {
      try { await serialReader.cancel(); } catch (e) {}
      try { await serialStreamClosed; } catch (e) {}
      try { serialReader.releaseLock(); } catch (e) {}
      serialReader = null;
    }
    if (serialWriter) {
      try { serialWriter.releaseLock(); } catch (e) {}
      serialWriter = null;
    }
    if (serialPort && serialPort.readable) {
      try { await serialPort.close(); } catch (e) {}
    }
    serialPort = null;
    serialStreamClosed = null;
    if (window.Swal) {
      Swal.fire({
        icon: 'info',
        title: '切断',
        text: 'シリアルデバイスを切断しました。',
        timer: 1200,
        showConfirmButton: false
      });
    }
  } catch (err) {}
  document.getElementById('connectBtn').disabled = false;
  document.getElementById('disconnectBtn').disabled = true;
}

function onSerialData(data) {
  const parts = data.trim().split(',');
  if (parts.length >= 8 && parts[2] === '1') {
    const dir = parts[3];
    const wind = parts[4];
    const noseWind = parts[5];
    const soundSpeed = parts[6];
    const soundTemp = parts[7];
    
    // バッチ更新システムを使用
    import('./main.js').then(({ queueDataUpdate }) => {
      if (queueDataUpdate) {
        queueDataUpdate(wind, dir, noseWind, soundSpeed, soundTemp);
      } else {
        // フォールバック: 直接更新
        updateWindChart(wind, dir, noseWind, soundSpeed, soundTemp);
      }
    });
  }
}
