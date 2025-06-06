export function formatBytes(bytes) {
  if (isNaN(bytes)) return '-';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let num = bytes;
  while (num >= 1000 && idx < units.length - 1) {
    num /= 1000;
    idx++;
  }
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[idx]}`;
}
