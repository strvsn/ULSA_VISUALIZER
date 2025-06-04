const connectBtn = document.getElementById('connectBtn');
const output = document.getElementById('output');
const canvas = document.getElementById('windCanvas');
const ctx = canvas.getContext('2d');

function drawWindMeter(direction, speed) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 円
  ctx.beginPath();
  ctx.arc(150, 150, 100, 0, 2 * Math.PI);
  ctx.stroke();

  // 風向矢印
  let angle = (direction - 90) * Math.PI / 180; // 0度は上
  let arrowLength = 80 + speed * 2;

  ctx.beginPath();
  ctx.moveTo(150, 150);
  ctx.lineTo(150 + arrowLength * Math.cos(angle), 150 + arrowLength * Math.sin(angle));
  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;
  ctx.stroke();

  // 矢印先端
  ctx.beginPath();
  ctx.arc(150 + arrowLength * Math.cos(angle), 150 + arrowLength * Math.sin(angle), 6, 0, 2 * Math.PI);
  ctx.fillStyle = "red";
  ctx.fill();

  // テキスト表示
  ctx.fillStyle = "#333";
  ctx.font = "16px Arial";
  ctx.fillText(`風向: ${direction}°`, 10, 20);
  ctx.fillText(`風速: ${speed} m/s`, 10, 40);
}

// 1行の生データをパースして数値を返す
function parseWindLine(line) {
  // 行頭の空白や改行削除
  line = line.trim();
  if (!line.startsWith('#')) return null;

  const items = line.split(',');
  if (items.length < 8) return null;
  // items[2] = 1（正常）以外は無効
  if (items[2] !== "1") return null;

  // D: 風向, E: 風速
  const direction = Number(items[3]);
  const speed = Number(items[4]);
  if (isNaN(direction) || isNaN(speed)) return null;

  return { direction, speed };
}

async function connectSerial() {
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = '';
    output.textContent = "接続しました。\n";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += value;
        // 複数行がまとめて届く場合もあるのでsplit
        const lines = buffer.split('\n');
        // 最後の要素はまだ未完了の行なので除外
        buffer = lines.pop();
        for (let line of lines) {
          output.textContent += line + "\n";
          output.scrollTop = output.scrollHeight;
          const windData = parseWindLine(line);
          if (windData) {
            drawWindMeter(windData.direction, windData.speed);
          }
        }
      }
    }
  } catch (err) {
    output.textContent += `エラー: ${err}\n`;
  }
}

connectBtn.onclick = connectSerial;

// 最初に初期状態（0,0）で描画
drawWindMeter(0, 0);