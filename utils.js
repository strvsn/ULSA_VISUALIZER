export function formatBytes(bytes) {
  if (isNaN(bytes)) return '  -.-- -';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let num = bytes;
  while (num >= 1000 && idx < units.length - 1) {
    num /= 1000;
    idx++;
  }
  // 整数部3桁、小数部2桁で固定表示
  const integerPart = Math.floor(num).toString().padStart(3, ' ');
  const decimalPart = (num % 1).toFixed(2).substring(1); // ".XX"部分を取得
  return `${integerPart}${decimalPart} ${units[idx]}`;
}
