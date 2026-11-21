import { bindRandomVisit, entryCover, isRealEntry } from "./moments-shared.js?v=20261121-moments-art-r2";

const collections = [
  ["cinema", "film", "Cinema"], ["reading", "book", "Reading"], ["poetry", "poem", "Poetry"],
  ["records", "record", "Records"], ["fragments", "fragment", "Fragments"]
];

async function loadRoom([slug, key, counter]) {
  const response = await fetch(`../data/moments-${slug}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`馆藏数据加载失败：${response.status}`);
  const data = await response.json();
  const entries = data[key + "s"].filter(isRealEntry);
  const count = String(entries.length).padStart(2, "0");
  document.getElementById("momentsCount" + counter).textContent = count;
  const door = document.querySelector(`.roomDoor[href="./${slug}/"]`);
  door.querySelector(".roomDoor__status").textContent = entries.length ? count + " 件馆藏" : "CURATING · 静候入藏";
  door.classList.toggle("roomDoor--curating", !entries.length);
  const covers = entries.map(entryCover).filter(Boolean).slice(0, 3);
  const fan = door.querySelector(".roomDoor__fan");
  for (const src of covers) {
    const img = new Image();
    img.alt = "";
    img.loading = "lazy";
    img.src = src;
    fan.append(img);
  }
  door.querySelector(".roomDoor__symbol").hidden = covers.length > 0;
  return entries.map(item => ({ href: `./${slug}/?${key}=${encodeURIComponent(item.id)}` }));
}

async function init() {
  const entries = (await Promise.all(collections.map(loadRoom))).flat();
  const count = String(entries.length).padStart(2, "0");
  document.querySelector("#momentsNavTotal").textContent = count;
  document.querySelector("#momentsArchiveTotal").textContent = count;
  bindRandomVisit(document.querySelector("#momentsRandomBtn"), entries);
}

init().catch(console.error);
