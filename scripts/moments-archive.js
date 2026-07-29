const ROOM_PARAM = "room";
const QUERY_PARAM = "q";

const roomDefinitions = [
  {
    id: "all",
    number: "00",
    name: "全馆",
    englishName: "All rooms"
  },
  {
    id: "cinema",
    number: "01",
    name: "影厅",
    englishName: "Cinema",
    url: "../../data/moments-cinema.json",
    key: "films",
    normalize: (film) => ({
      id: film.id,
      title: film.title,
      subtitle: film.originalTitle,
      creator: film.director,
      meta: film.year,
      description: film.observation,
      tags: film.tags,
      href: `../cinema/?film=${encodeURIComponent(film.id)}`
    })
  },
  {
    id: "reading",
    number: "02",
    name: "阅读室",
    englishName: "Reading",
    url: "../../data/moments-reading.json",
    key: "books",
    normalize: (book) => ({
      id: book.id,
      title: book.title,
      subtitle: book.originalTitle,
      creator: book.author,
      meta: book.firstPublished,
      description: book.observation,
      tags: book.categories,
      href: `../reading/?book=${encodeURIComponent(book.id)}`
    })
  },
  {
    id: "poetry",
    number: "03",
    name: "诗歌室",
    englishName: "Poetry",
    url: "../../data/moments-poetry.json",
    key: "poems",
    normalize: (poem) => ({
      id: poem.id,
      title: poem.title,
      subtitle: poem.subtitle ?? poem.lines.find(Boolean) ?? "",
      creator: `${poem.period} · ${poem.author}`,
      meta: poem.form,
      description: poem.lines.filter(Boolean).join(" "),
      tags: poem.themes,
      href: `../poetry/?poem=${encodeURIComponent(poem.id)}`
    })
  },
  {
    id: "records",
    number: "04",
    name: "唱片室",
    englishName: "Records",
    url: "../../data/moments-records.json",
    key: "records",
    normalize: (record) => ({
      id: record.id,
      title: record.title,
      subtitle: record.artist,
      creator: record.artist,
      meta: record.year,
      description: record.observation,
      tags: record.genres,
      href: `../records/?record=${encodeURIComponent(record.id)}`
    })
  },
  {
    id: "fragments",
    number: "05",
    name: "片语室",
    englishName: "Fragments",
    url: "../../data/moments-fragments.json",
    key: "fragments",
    normalize: (fragment) => ({
      id: fragment.id,
      title: fragment.title,
      subtitle: fragment.text,
      creator: fragment.place,
      meta: fragment.date,
      description: fragment.text,
      tags: [fragment.type],
      href: `../fragments/?fragment=${encodeURIComponent(fragment.id)}`
    })
  }
];

const elements = {
  navTotal: document.querySelector("#archiveNavTotal"),
  heroTotal: document.querySelector("#archiveHeroTotal"),
  totalCount: document.querySelector("#archiveTotalCount"),
  visibleCount: document.querySelector("#archiveVisibleCount"),
  input: document.querySelector("#archiveSearchInput"),
  filters: document.querySelector("#archiveFilters"),
  results: document.querySelector("#archiveResults"),
  empty: document.querySelector("#archiveEmpty"),
  reset: document.querySelector("#archiveReset")
};

const state = {
  items: [],
  room: "all",
  query: ""
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function searchableText(item) {
  return [
    item.roomName,
    item.roomEnglishName,
    item.title,
    item.subtitle,
    item.creator,
    item.meta,
    item.description,
    ...item.tags
  ].join(" ").toLocaleLowerCase("zh-CN");
}

async function loadRoom(room) {
  const response = await fetch(room.url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`${room.name}数据加载失败：${response.status}`);
  }

  const data = await response.json();
  const source = Array.isArray(data[room.key]) ? data[room.key] : [];
  return source.map((entry, index) => ({
    ...room.normalize(entry),
    roomId: room.id,
    roomNumber: room.number,
    roomName: room.name,
    roomEnglishName: room.englishName,
    roomIndex: index + 1
  }));
}

function filteredItems() {
  const query = state.query.trim().toLocaleLowerCase("zh-CN");
  return state.items.filter((item) => {
    const matchesRoom = state.room === "all" || item.roomId === state.room;
    const matchesQuery = !query || searchableText(item).includes(query);
    return matchesRoom && matchesQuery;
  });
}

function updateUrl() {
  const url = new URL(window.location.href);
  if (state.room === "all") {
    url.searchParams.delete(ROOM_PARAM);
  } else {
    url.searchParams.set(ROOM_PARAM, state.room);
  }

  if (state.query) {
    url.searchParams.set(QUERY_PARAM, state.query);
  } else {
    url.searchParams.delete(QUERY_PARAM);
  }

  window.history.replaceState({ room: state.room, query: state.query }, "", url);
}

function createResult(item, visibleIndex) {
  const link = document.createElement("a");
  link.className = "archiveResult";
  link.href = item.href;
  link.setAttribute("aria-label", `打开${item.roomName}馆藏《${item.title}》`);
  link.innerHTML = `
    <span class="archiveResult__index">${String(visibleIndex + 1).padStart(2, "0")}</span>
    <span class="archiveResult__room">
      <small>${escapeHtml(item.roomNumber)}</small>
      <strong>${escapeHtml(item.roomName)}</strong>
    </span>
    <span class="archiveResult__work">
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.subtitle)}</small>
      <em>${escapeHtml(item.description)}</em>
    </span>
    <span class="archiveResult__meta">
      <strong>${escapeHtml(item.creator)}</strong>
      <small>${escapeHtml(item.meta)} · ${escapeHtml(item.tags.join(" / "))}</small>
    </span>
    <span class="archiveResult__arrow" aria-hidden="true">↗</span>
  `;
  return link;
}

function renderResults({ updateHistory = true } = {}) {
  const items = filteredItems();
  elements.results.replaceChildren(...items.map(createResult));
  elements.visibleCount.textContent = String(items.length).padStart(2, "0");
  elements.empty.hidden = items.length > 0;
  elements.results.hidden = items.length === 0;

  for (const button of elements.filters.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.room === state.room));
  }

  if (updateHistory) {
    updateUrl();
  }
}

function renderFilters() {
  elements.filters.replaceChildren(...roomDefinitions.map((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.room = room.id;
    button.setAttribute("aria-pressed", String(room.id === state.room));

    const count = room.id === "all"
      ? state.items.length
      : state.items.filter((item) => item.roomId === room.id).length;

    button.innerHTML = `
      <span>${escapeHtml(room.number)} · ${escapeHtml(room.name)}</span>
      <small>${String(count).padStart(2, "0")}</small>
    `;
    button.addEventListener("click", () => {
      state.room = room.id;
      renderResults();
    });
    return button;
  }));
}

function resetFilters() {
  state.room = "all";
  state.query = "";
  elements.input.value = "";
  renderResults();
  elements.input.focus();
}

function bindInteractions() {
  elements.input.addEventListener("input", () => {
    state.query = elements.input.value.trim();
    renderResults();
  });

  elements.reset.addEventListener("click", resetFilters);

  window.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== elements.input) {
      event.preventDefault();
      elements.input.focus();
    }

    if (event.key === "Escape" && document.activeElement === elements.input && elements.input.value) {
      resetFilters();
    }
  });
}

function readInitialState() {
  const url = new URL(window.location.href);
  const requestedRoom = url.searchParams.get(ROOM_PARAM);
  const requestedQuery = url.searchParams.get(QUERY_PARAM) ?? "";
  const roomExists = roomDefinitions.some((room) => room.id === requestedRoom);

  state.room = roomExists ? requestedRoom : "all";
  state.query = requestedQuery;
  elements.input.value = requestedQuery;
}

async function init() {
  try {
    const rooms = roomDefinitions.filter((room) => room.id !== "all");
    const collections = await Promise.all(rooms.map(loadRoom));
    state.items = collections.flat();
    const total = String(state.items.length).padStart(2, "0");

    elements.navTotal.textContent = total;
    elements.heroTotal.textContent = total;
    elements.totalCount.textContent = total;

    readInitialState();
    renderFilters();
    renderResults({ updateHistory: false });
    bindInteractions();
  } catch (error) {
    console.error(error);
    elements.results.hidden = true;
    elements.empty.hidden = false;
    elements.empty.querySelector("h3").textContent = "馆藏目录暂时无法打开";
    elements.empty.querySelector("p").textContent = "请稍后再来，或返回片刻馆按馆室参观。";
    elements.reset.hidden = true;
  }
}

init();
