const { SingleBar, Presets } = require('cli-progress');

function parseS3Uri(uri) {
  const match = uri.match(/^s3:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error(`Invalid S3 URI: ${uri}`);
  return { bucket: match[1], key: match[2] };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function createProgressBar(label, total) {
  const bar = new SingleBar({
    format: `${label} [{bar}] {percentage}%  {value}/{total}`,
    formatValue: (v, _, type) => (type === 'value' || type === 'total') ? formatBytes(v) : v,
  }, Presets.shades_classic);
  bar.start(total, 0);
  return bar;
}

module.exports = { parseS3Uri, formatBytes, createProgressBar };
