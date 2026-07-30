const DATA_URL = "../../data/moments-records.json";
const RECORD_PARAM = "record";

const elements = {
  statement: document.querySelector("#recordsStatement"),
  introduction: document.querySelector("#recordsIntroduction"),
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
  activeRecordId: null,
  trigger: null
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function applyPalette(element, record) {
  element.style.setProperty("--record-a", record.palette[0]);
  element.style.setProperty("--record-b", record.palette[1]);
  element.style.setProperty("--record-c", record.palette[2]);
}

function applyCover(cover, record) {
  applyPalette(cover, record);
  cover.querySelector(".recordCover__catalogue").textContent = record.catalogue;
  cover.querySelector(".recordCover__mark").textContent = record.mark;
  cover.querySelector(".recordCover__title strong").textContent = record.title;
  cover.querySelector(".recordCover__title span").textContent = record.artist;
}

function createCard(record) {
  const card = document.createElement("article");
  card.className = "recordCard";
  card.innerHTML = `
    <button class="recordCard__button" type="button" aria-label="查看《${escapeHtml(record.title)}》详情">
      <div class="recordCard__object" aria-hidden="true">
        <div class="recordDisc"><span></span></div>
        <div class="recordCover">
          <span class="recordCover__catalogue">${escapeHtml(record.catalogue)}</span>
          <span class="recordCover__mark">${escapeHtml(record.mark)}</span>
          <div class="recordCover__title">
            <strong>${escapeHtml(record.title)}</strong>
            <span>${escapeHtml(record.artist)}</span>
          </div>
        </div>
      </div>
      <div class="recordCard__meta">
        <div class="recordCard__year">
          <strong>${escapeHtml(record.year)}</strong>
        </div>
        <p>${escapeHtml(record.observation)}</p>
        <div class="recordCard__tags">
          ${record.genres.map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}
        </div>
      </div>
    </button>
  `;

  applyPalette(card.querySelector(".recordDisc"), record);
  applyPalette(card.querySelector(".recordCover"), record);

  card.querySelector("button").addEventListener("click", (event) => {
    state.trigger = event.currentTarget;
    openRecord(record.id, { updateHistory: true });
  });

  return card;
}

function visibleRecords() {
  if (state.filter === "全部") {
    return state.records;
  }
  return state.records.filter((record) => record.category === state.filter);
}

function renderRecords() {
  const records = visibleRecords();
  elements.grid.replaceChildren(...records.map(createCard));
  elements.empty.hidden = records.length > 0;
}

function renderFilters() {
  const categories = [...new Set(state.records.map((record) => record.category))];
  const filters = ["全部", ...categories];

  elements.filters.replaceChildren(...filters.map((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = filter;
    button.setAttribute("aria-pressed", String(filter === state.filter));
    button.addEventListener("click", () => {
      state.filter = filter;
      for (const item of elements.filters.querySelectorAll("button")) {
        item.setAttribute("aria-pressed", String(item === button));
      }
      renderRecords();
    });
    return button;
  }));
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
  elements.dialogListenedAt.textContent = record.listenedAt;
  elements.dialogObservation.textContent = record.observation;
  elements.dialogIntroduction.textContent = record.introduction;
  elements.dialogFavorite.textContent = record.favoriteTrack;
  elements.dialogNoteTitle.textContent = record.noteTitle;
  elements.dialogNote.textContent = record.note;
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
    state.records = data.records;
    elements.statement.textContent = data.room.statement;
    elements.introduction.textContent = data.room.introduction;

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
