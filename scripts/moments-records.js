import { isRealEntry, resolveAssetUrl, showField } from "./moments-shared.js?v=20261122-atlas-scs";

const DATA_URL = "../../data/moments-records.json";
const RECORD_PARAM = "record";

const elements = {
  statement: document.querySelector("#recordsStatement"),
  stage: document.querySelector("#recordsTurntableStage"),
  title: document.querySelector("#turntableTitle"),
  artist: document.querySelector("#turntableArtist"),
  meta: document.querySelector("#turntableMeta"),
  observation: document.querySelector("#turntableObservation"),
  shuffle: document.querySelector("#turntableShuffleBtn"),
  open: document.querySelector("#turntableOpenBtn"),
  filters: document.querySelector("#recordsFilters"),
  grid: document.querySelector("#recordsGrid"),
  empty: document.querySelector("#recordsEmpty"),
  dialog: document.querySelector("#recordDialog"),
  dialogStage: document.querySelector("#recordDialogStage"),
  dialogClose: document.querySelector("#recordDialogClose"),
  dialogCatalogue: document.querySelector("#recordDialogCatalogue"),
  dialogDisc: document.querySelector("#recordDialogDisc"),
  dialogCover: document.querySelector("#recordDialogCover"),
  dialogArtist: document.querySelector("#recordDialogArtist"),
  dialogTitle: document.querySelector("#recordDialogTitle"),
  dialogSample: document.querySelector("#recordDialogSample"),
  dialogYear: document.querySelector("#recordDialogYear"),
  dialogRegion: document.querySelector("#recordDialogRegion"),
  dialogFormat: document.querySelector("#recordDialogFormat"),
  dialogListenedAt: document.querySelector("#recordDialogListenedAt"),
  dialogObservation: document.querySelector("#recordDialogObservation"),
  dialogIntroduction: document.querySelector("#recordDialogIntroduction"),
  dialogFavorite: document.querySelector("#recordDialogFavorite"),
  dialogNoteTitle: document.querySelector("#recordDialogNoteTitle"),
  dialogNote: document.querySelector("#recordDialogNote"),
  dialogPrevious: document.querySelector("#recordDialogPrevious"),
  dialogNext: document.querySelector("#recordDialogNext"),
  dialogShare: document.querySelector("#recordDialogShare"),
  dialogPosition: document.querySelector("#recordDialogPosition")
};

const state = {
  records: [],
  filter: "全部",
  artist: "",
  notesOnly: false,
  onStageId: null,
  activeRecordId: null,
  trigger: null
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function catalogueFor(index) {
  return `REC ${String(index + 1).padStart(2, "0")}`;
}

function applyPalette(element, record) {
  element.style.setProperty("--record-a", record.palette[0]);
  element.style.setProperty("--record-b", record.palette[1]);
  element.style.setProperty("--record-c", record.palette[2]);
}

function applyCover(cover, record) {
  applyPalette(cover, record);
  const image = cover.querySelector(".recordCover__image");
  const hasImage = Boolean(record.cover);

  cover.classList.toggle("recordCover--image", hasImage);
  image.hidden = !hasImage;
  if (hasImage) {
    image.src = resolveAssetUrl(record.cover);
  } else {
    image.removeAttribute("src");
  }

  cover.querySelector(".recordCover__catalogue").textContent = record.catalogue;
  cover.querySelector(".recordCover__mark").textContent = record.mark;
  cover.querySelector(".recordCover__title strong").textContent = record.title;
  cover.querySelector(".recordCover__title span").textContent = record.artist;
}

function updateMusicLinks(container, record) {
  container.querySelector('[data-platform="apple"]').href =
    "https://music.apple.com/search?term=" + encodeURIComponent(record.artist + " " + record.title);
  container.querySelector('[data-platform="netease"]').href =
    "https://music.163.com/#/search/m/?s=" + encodeURIComponent(record.title + " " + record.artist);
}

function syncCueButtons() {
  for (const button of elements.grid.querySelectorAll(".recordCue")) {
    const isOnStage = button.dataset.record === state.onStageId;
    button.setAttribute("aria-pressed", String(isOnStage));
    button.textContent = isOnStage ? "唱盘播放中 · 查看唱台 ↑" : "送上唱盘 ◉";
    button.setAttribute("aria-label", button.textContent + "：《" + button.dataset.title + "》");
  }
}

function setTurntable(record) {
  state.onStageId = record.id;
  applyPalette(elements.stage, record);
  elements.title.textContent = record.title;
  elements.artist.textContent = record.artist;
  elements.meta.textContent = [record.catalogue, record.year, record.category].filter(Boolean).join(" · ");
  showField(elements.observation, record.observation);
  for (const image of elements.stage.querySelectorAll("img")) {
    image.hidden = !record.cover;
    if (record.cover) image.src = resolveAssetUrl(record.cover);
    else image.removeAttribute("src");
  }
  syncCueButtons();
  updateMusicLinks(elements.stage, record);
}

function initTurntable() {
  const count = state.records.length;
  if (!count) {
    elements.stage.querySelector(".turntablePanel").hidden = true;
    return;
  }
  const now = new Date();
  const day = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
  setTurntable(state.records[day % count]);
  elements.open.disabled = false;
  elements.shuffle.disabled = count < 2;
  elements.shuffle.addEventListener("click", () => {
    const index = state.records.findIndex(record => record.id === state.onStageId);
    const step = 1 + Math.floor(Math.random() * (count - 1));
    setTurntable(state.records[(index + step) % count]);
  });
  elements.open.addEventListener("click", () => {
    state.trigger = elements.open;
    openRecord(state.onStageId, { updateHistory: true });
  });
}

function createCard(record) {
  const card = document.createElement("article");
  card.className = "recordCard";
  card.innerHTML = `
    <button class="recordCard__button" type="button" aria-label="查看《${escapeHtml(record.title)}》详情">
      <div class="recordCard__object" aria-hidden="true">
        <div class="recordDisc"><span></span></div>
        <div class="recordCover">
          <img class="recordCover__image" alt="" loading="lazy" decoding="async" hidden />
          <span class="recordCover__catalogue">${escapeHtml(record.catalogue)}</span>
          <span class="recordCover__mark">${escapeHtml(record.mark)}</span>
          <div class="recordCover__title">
            <strong>${escapeHtml(record.title)}</strong>
            <span>${escapeHtml(record.artist)}</span>
          </div>
        </div>
      </div>
      <div class="recordCard__meta">
        <h3>${escapeHtml(record.title)}</h3>
        <div class="recordCard__year">
          <span>${escapeHtml(record.artist)}</span>
          <strong>${escapeHtml(record.year)}</strong>
        </div>
        <p>${escapeHtml(record.observation)}</p>
        <div class="recordCard__tags">
          ${record.genres.map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}
        </div>
      </div>
    </button>
    <button class="recordCue" type="button">送上唱盘 ◉</button>
  `;

  applyPalette(card.querySelector(".recordDisc"), record);
  applyCover(card.querySelector(".recordCover"), record);

  card.querySelector("button").addEventListener("click", (event) => {
    state.trigger = event.currentTarget;
    openRecord(record.id, { updateHistory: true });
  });

  const cue = card.querySelector(".recordCue");
  cue.dataset.record = record.id;
  cue.dataset.title = record.title;
  cue.addEventListener("click", () => {
    if (state.onStageId === record.id) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      elements.stage.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
      elements.open.focus({ preventScroll: true });
    } else {
      setTurntable(record);
    }
  });
  return card;
}

function visibleRecords() {
  return state.records.filter(record =>
    (state.filter === "全部" || record.category === state.filter) &&
    (!state.artist || record.artists.includes(state.artist)) &&
    (!state.notesOnly || record.note?.trim())
  );
}

function renderRecords() {
  const records = visibleRecords();
  elements.grid.replaceChildren(...records.map(createCard));
  syncCueButtons();
  elements.empty.hidden = records.length > 0;
}

function renderFilters() {
  const counts = new Map();
  for (const record of state.records) {
    for (const artist of record.artists) counts.set(artist, (counts.get(artist) || 0) + 1);
  }
  const buttons = [];
  function addFilter(label, isActive, select) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    const sync = () => button.setAttribute("aria-pressed", String(isActive()));
    sync();
    buttons.push(sync);
    button.addEventListener("click", () => {
      select();
      buttons.forEach(update => update());
      renderRecords();
    });
    elements.filters.append(button);
  }
  for (const category of ["全部", ...new Set(state.records.map(record => record.category))]) {
    addFilter(category, () => state.filter === category, () => {
      state.filter = category;
      if (category === "全部") {
        state.artist = "";
        state.notesOnly = false;
      }
    });
  }
  for (const [artist, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (count >= 2) addFilter(`${artist} (${count})`, () => state.artist === artist, () => {
      state.artist = state.artist === artist ? "" : artist;
    });
  }
  if (state.records.some(record => record.note?.trim())) {
    addFilter("附个人手记", () => state.notesOnly, () => { state.notesOnly = !state.notesOnly; });
  }
}

function recordFromId(id) {
  return state.records.find((record) => record.id === id) ?? null;
}

function updateRecordUrl(id, mode = "push") {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(RECORD_PARAM, id);
  } else {
    url.searchParams.delete(RECORD_PARAM);
  }
  window.history[`${mode}State`]({ record: id }, "", url);
}

function fillDialog(record) {
  const activeIndex = state.records.findIndex((item) => item.id === record.id);

  setTurntable(record);
  updateMusicLinks(elements.dialog, record);
  applyPalette(elements.dialogStage, record);
  applyPalette(elements.dialogDisc, record);
  applyCover(elements.dialogCover, record);
  elements.dialogCatalogue.textContent = record.catalogue;
  elements.dialogArtist.textContent = record.artist;
  elements.dialogTitle.textContent = record.title;
  elements.dialogSample.hidden = !record.sample;
  elements.dialogYear.textContent = record.year;
  elements.dialogRegion.textContent = record.region;
  elements.dialogFormat.textContent = record.format;
  showField(elements.dialogListenedAt, record.listenedAt, elements.dialogListenedAt.parentElement);
  elements.dialogObservation.textContent = record.observation;
  showField(elements.dialogIntroduction, record.introduction, elements.dialogIntroduction.parentElement);
  showField(elements.dialogFavorite, record.favoriteTrack, elements.dialogFavorite.parentElement);
  elements.dialogNoteTitle.textContent = record.noteTitle;
  showField(elements.dialogNote, record.note, elements.dialogNote.parentElement);
  elements.dialogPosition.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(state.records.length).padStart(2, "0")}`;
}

function openRecord(id, { updateHistory = false } = {}) {
  const record = recordFromId(id);
  if (!record) {
    if (updateHistory) {
      updateRecordUrl(null, "replace");
    }
    return;
  }

  state.activeRecordId = record.id;
  fillDialog(record);

  if (!elements.dialog.open) {
    elements.dialog.showModal();
  }

  if (updateHistory) {
    updateRecordUrl(record.id);
  }
}

function closeRecord({ updateHistory = false, restoreFocus = true } = {}) {
  if (elements.dialog.open) {
    elements.dialog.close();
  }
  state.activeRecordId = null;

  if (updateHistory) {
    updateRecordUrl(null);
  }

  if (restoreFocus && state.trigger?.isConnected) {
    state.trigger.focus();
  }
}

function moveRecord(direction) {
  const currentIndex = state.records.findIndex((record) => record.id === state.activeRecordId);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = (currentIndex + direction + state.records.length) % state.records.length;
  const record = state.records[nextIndex];
  state.activeRecordId = record.id;
  fillDialog(record);
  updateRecordUrl(record.id, "replace");
}

async function copyRecordLink() {
  const label = elements.dialogShare.textContent;
  try {
    await navigator.clipboard.writeText(window.location.href);
    elements.dialogShare.textContent = "链接已复制";
  } catch {
    const input = document.createElement("textarea");
    input.value = window.location.href;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    elements.dialogShare.textContent = "链接已复制";
  }

  window.setTimeout(() => {
    elements.dialogShare.textContent = label;
  }, 1600);
}

function bindDialog() {
  elements.dialogClose.addEventListener("click", () => closeRecord({ updateHistory: true }));
  elements.dialogPrevious.addEventListener("click", () => moveRecord(-1));
  elements.dialogNext.addEventListener("click", () => moveRecord(1));
  elements.dialogShare.addEventListener("click", copyRecordLink);

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeRecord({ updateHistory: true });
    }
  });

  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeRecord({ updateHistory: true });
  });

  window.addEventListener("keydown", (event) => {
    if (!elements.dialog.open) {
      return;
    }
    if (event.key === "ArrowLeft") {
      moveRecord(-1);
    } else if (event.key === "ArrowRight") {
      moveRecord(1);
    }
  });

  window.addEventListener("popstate", () => {
    const id = new URL(window.location.href).searchParams.get(RECORD_PARAM);
    if (id && recordFromId(id)) {
      openRecord(id);
    } else {
      closeRecord({ restoreFocus: false });
    }
  });
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`唱片室数据加载失败：${response.status}`);
    }

    const data = await response.json();
    state.records = data.records.filter(isRealEntry).map((record, index) => ({
      ...record,
      artists: record.artist.split(/\s*\/\s*/).filter(Boolean),
      catalogue: catalogueFor(index)
    }));
    elements.statement.textContent = data.room.statement;
    initTurntable();

    renderFilters();
    renderRecords();
    bindDialog();

    const initialRecordId = new URL(window.location.href).searchParams.get(RECORD_PARAM);
    if (initialRecordId) {
      openRecord(initialRecordId);
    }
  } catch (error) {
    console.error(error);
    elements.grid.innerHTML = '<p class="recordsEmpty">唱片室暂时无法开门，请稍后再来。</p>';
  }
}

init();
