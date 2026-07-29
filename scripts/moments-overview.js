const collections = [
  {
    url: "../data/moments-cinema.json",
    key: "films",
    target: "#momentsCountCinema"
  },
  {
    url: "../data/moments-reading.json",
    key: "books",
    target: "#momentsCountReading"
  },
  {
    url: "../data/moments-poetry.json",
    key: "poems",
    target: "#momentsCountPoetry"
  },
  {
    url: "../data/moments-records.json",
    key: "records",
    target: "#momentsCountRecords"
  },
  {
    url: "../data/moments-fragments.json",
    key: "fragments",
    target: "#momentsCountFragments"
  }
];

async function loadCount(collection) {
  const response = await fetch(collection.url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`馆藏数量加载失败：${response.status}`);
  }

  const data = await response.json();
  const count = Array.isArray(data[collection.key]) ? data[collection.key].length : 0;
  document.querySelector(collection.target).textContent = String(count).padStart(2, "0");
  return count;
}

async function init() {
  try {
    const counts = await Promise.all(collections.map(loadCount));
    const total = counts.reduce((sum, count) => sum + count, 0);
    const formatted = String(total).padStart(2, "0");
    document.querySelector("#momentsNavTotal").textContent = formatted;
    document.querySelector("#momentsArchiveTotal").textContent = formatted;
  } catch (error) {
    console.error(error);
  }
}

init();
