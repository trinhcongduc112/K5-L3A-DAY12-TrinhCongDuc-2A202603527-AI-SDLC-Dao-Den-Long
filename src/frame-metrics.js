export function frameMetrics(samples) {
  if (!samples.length) throw new Error('No frame intervals in the measurement window');
  const rounded = number => Math.round(number * 1000) / 1000;
  const sorted = samples.toSorted((a, b) => a - b);
  const count = sorted.length;
  const slow = sorted.slice(-Math.max(1, Math.ceil(count * 0.01)));
  const sum = values => values.reduce((total, value) => total + value, 0);
  return {
    avg_fps: rounded(1000 * count / sum(sorted)),
    p1_low_fps: rounded(1000 * slow.length / sum(slow)),
    frame_ms_p95: rounded(sorted[Math.ceil(count * 0.95) - 1]),
    frames: count,
  };
}
