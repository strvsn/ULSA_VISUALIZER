import { updateWindChart } from './windChart.js';

let serialPort = null;
let serialReader = null;
let serialStreamClosed = null;

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

    let buffer = '';
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

    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let line of lines) {
          onSerialData(line);
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
    updateWindChart(wind, dir, noseWind, soundSpeed, soundTemp);
  }
}
