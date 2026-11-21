export const isRealEntry = item => Boolean(item) && item.sample !== true;

export function resolveAssetUrl(src) {
  if (!src) return "";
  return new URL(String(src).replace(/^(?:\.\.\/)+/, ""), new URL("../", import.meta.url)).href;
}

export function entryCover(entry) {
  return resolveAssetUrl(entry.poster?.src || (typeof entry.cover === "string" ? entry.cover : entry.cover?.src));
}

export function bindRandomVisit(button, entries) {
  button.disabled = !entries.length;
  button.onclick = () => {
    if (entries.length) location.assign(entries[Math.floor(Math.random() * entries.length)].href);
  };
}

export function showField(node, value, container = node) {
  node.textContent = value ?? "";
  container.hidden = !String(value ?? "").trim();
}
