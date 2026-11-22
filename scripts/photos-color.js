import { responsivePhotoUrl } from './photos-data.js?v=20261122-atlas-scs';

const analysis = new Map();
const averages = new Map();
export const distance = (a, b) => a.reduce((total, v, i) => total + (v - b[i]) ** 2, 0);
export const rgb = (color) => 'rgb(' + color.join(' ') + ')';

function colors(pixels) {
  let boxes = [pixels];
  while (boxes.length < 6) {
    const candidates = boxes.map((box, index) => {
      const ranges = [0, 1, 2].map((c) => {
        const values = box.map((pixel) => pixel[c]);
        return Math.max(...values) - Math.min(...values);
      });
      const span = Math.max(...ranges);
      return { index, channel: ranges.indexOf(span), score: box.length > 1 ? span * box.length : -1 };
    });
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    const box = boxes[best.index].sort((a, b) => a[best.channel] - b[best.channel]);
    const middle = Math.floor(box.length / 2);
    boxes.splice(best.index, 1, box.slice(0, middle), box.slice(middle));
  }
  return boxes.map(mean).sort((a, b) => a.reduce((x, y) => x + y) - b.reduce((x, y) => x + y));
}
function mean(pixels) {
  return [0, 1, 2].map((c) => Math.round(pixels.reduce((sum, pixel) => sum + pixel[c], 0) / pixels.length));
}

// Locate the printed area from white paper margins before placing composition guides.
function paperBounds(image) {
  const w = 160,
    h = Math.round((w * image.naturalHeight) / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const ink = (x, y) => {
    const i = 4 * (y * w + x);
    return Math.min(data[i], data[i + 1], data[i + 2]) < 240;
  };
  const lineInk = (y) => {
    let count = 0;
    for (let x = 2; x < w - 2; x++) if (ink(x, y)) count++;
    return count / w;
  };
  let left = 0,
    top = 0,
    bottom = h;
  while (top < h * 0.12 && lineInk(top) < 0.08) top++;
  for (let y = Math.floor(h * 0.7); y < h; y++) {
    if (lineInk(y) < 0.045 && lineInk(Math.min(h - 1, y + 1)) < 0.045) {
      bottom = y;
      break;
    }
  }
  while (left < w * 0.09) {
    let count = 0;
    for (let y = top; y < bottom; y++) if (ink(left, y)) count++;
    if (count > (bottom - top) * 0.12) break;
    left++;
  }
  return { x: left / w, y: top / h, w: 1 - (2 * left) / w, h: (bottom - top) / h };
}
async function sample(photo, full) {
  const image = new Image();
  image.src = responsivePhotoUrl(photo.src, 640);
  await image.decode();
  const bounds = full ? paperBounds(image) : { y: 0.025, h: 0.825 };
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  const top = Math.max(bounds.y, 0.025),
    bottom = Math.min(0.85, bounds.y + bounds.h);
  ctx.drawImage(
    image,
    image.naturalWidth * 0.05,
    image.naturalHeight * top,
    image.naturalWidth * 0.9,
    image.naturalHeight * (bottom - top),
    0,
    0,
    64,
    48
  );
  const { data } = ctx.getImageData(0, 0, 64, 48);
  const bins = full ? Array.from({ length: 3 }, () => Array(64).fill(0)) : null;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
    if (full) for (let c = 0; c < 3; c++) if (data[i + c] < 255) bins[c][data[i + c] >> 2]++;
  }
  const average = mean(pixels);
  return full ? { bins, palette: colors(pixels), mean: average, bounds } : average;
}
export function analyze(photo) {
  if (!analysis.has(photo.id))
    analysis.set(
      photo.id,
      sample(photo, true).catch(() => null)
    );
  return analysis.get(photo.id);
}

export function averageColor(photo) {
  if (analysis.has(photo.id)) return analysis.get(photo.id).then((result) => result?.mean);
  if (!averages.has(photo.id))
    averages.set(
      photo.id,
      sample(photo, false).catch(() => null)
    );
  return averages.get(photo.id);
}
