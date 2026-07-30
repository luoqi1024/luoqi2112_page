const DATA_URL = "../../data/moments-poetry.json";
const POEM_PARAM = "poem";

const elements = {
  statement: document.querySelector("#poetryStatement"),
  introduction: document.querySelector("#poetryIntroduction"),
  filters: document.querySelector("#poetryFilters"),
  grid: document.querySelector("#poetryGrid"),
  empty: document.querySelector("#poetryEmpty"),
  dialog: document.querySelector("#poemDialog"),
  dialogStage: document.querySelector("#poemDialogStage"),
  dialogClose: document.querySelector("#poemDialogClose"),
  dialogCatalogue: document.querySelector("#poemDialogCatalogue"),
  dialogMark: document.querySelector("#poemDialogMark"),
  dialogPositionSide: document.querySelector("#poemDialogPositionSide"),
  dialogForm: document.querySelector("#poemDialogForm"),
  dialogTitle: document.querySelector("#poemDialogTitle"),
  dialogSubtitle: document.querySelector("#poemDialogSubtitle"),
  dialogLines: document.querySelector("#poemDialogLines"),
  dialogPeriod: document.querySelector("#poemDialogPeriod"),
  dialogAuthor: document.querySelector("#poemDialogAuthor"),
  dialogAfterword: document.querySelector("#poemDialogAfterword"),
  dialogSample: document.querySelector("#poemDialogSample"),
  dialogPrevious: document.querySelector("#poemDialogPrevious"),
  dialogNext: document.querySelector("#poemDialogNext"),
  dialogShare: document.querySelector("#poemDialogShare"),
  dialogPosition: document.querySelector("#poemDialogPosition")
};

const state = {
  poems: [],
  filter: "全部",
  activePoemId: null,
  trigger: null
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function createCard(poem) {
  const card = document.createElement("article");
  card.className = "poemCard";
  card.style.setProperty("--poem-a", poem.palette[0]);
  card.style.setProperty("--poem-b", poem.palette[1]);
  card.style.setProperty("--poem-c", poem.palette[2]);

  const excerpt = poem.lines.filter(Boolean).slice(0, 4).join("\n");
  card.innerHTML = `
    <button class="poemCard__button" type="button" aria-label="阅读《${escapeHtml(poem.title)}》">
      <div class="poemCard__top">
        <span>${escapeHtml(poem.catalogue)}</span>
        <span>${escapeHtml(poem.form)}</span>
      </div>
      <span class="poemCard__mark" aria-hidden="true">${escapeHtml(poem.mark)}</span>
      <div class="poemCard__excerpt">${escapeHtml(excerpt)}</div>
      <div class="poemCard__meta">
        <h3>${escapeHtml(poem.title)}</h3>
        <span>${escapeHtml(poem.period)}</span>
        <p>${escapeHtml(poem.author)}${poem.subtitle ? ` · ${escapeHtml(poem.subtitle)}` : ""}</p>
      </div>
    </button>
  `;

  card.querySelector("button").addEventListener("click", (event) => {
    state.trigger = event.currentTarget;
    openPoem(poem.id, { updateHistory: true });
  });

  return card;
}

function visiblePoems() {
  if (state.filter === "全部") {
    return state.poems;
  }
  return state.poems.filter((poem) => poem.form === state.filter);
}

function renderPoems() {
  const poems = visiblePoems();
  elements.grid.replaceChildren(...poems.map(createCard));
  elements.empty.hidden = poems.length > 0;
}

function renderFilters() {
  const forms = [...new Set(state.poems.map((poem) => poem.form))];
  const filters = ["全部", ...forms];

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
      renderPoems();
    });
    return button;
  }));
}

function poemFromId(id) {
  return state.poems.find((poem) => poem.id === id) ?? null;
}

function updatePoemUrl(id, mode = "push") {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(POEM_PARAM, id);
  } else {
    url.searchParams.delete(POEM_PARAM);
  }
  window.history[`${mode}State`]({ poem: id }, "", url);
}

function fillDialog(poem) {
  const activeIndex = state.poems.findIndex((item) => item.id === poem.id);
  const position = `${String(activeIndex + 1).padStart(2, "0")} / ${String(state.poems.length).padStart(2, "0")}`;

  elements.dialogStage.style.setProperty("--poem-a", poem.palette[0]);
  elements.dialogStage.style.setProperty("--poem-b", poem.palette[1]);
  elements.dialogStage.style.setProperty("--poem-c", poem.palette[2]);
  elements.dialogCatalogue.textContent = poem.catalogue;
  elements.dialogMark.textContent = poem.mark;
  elements.dialogPositionSide.textContent = position;
  elements.dialogForm.textContent = poem.form;
  elements.dialogTitle.textContent = poem.title;
  elements.dialogSubtitle.textContent = poem.subtitle ?? "";
  elements.dialogLines.replaceChildren(...poem.lines.map((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line || "\u00a0";
    return paragraph;
  }));
  elements.dialogPeriod.textContent = poem.period;
  elements.dialogAuthor.textContent = poem.author;
  elements.dialogAfterword.textContent = poem.afterword;
  elements.dialogSample.hidden = !poem.sample;
  elements.dialogPosition.textContent = position;
}

function openPoem(id, { updateHistory = false } = {}) {
  const poem = poemFromId(id);
  if (!poem) {
    if (updateHistory) {
      updatePoemUrl(null, "replace");
    }
    return;
  }

  state.activePoemId = poem.id;
  fillDialog(poem);

  if (!elements.dialog.open) {
    elements.dialog.showModal();
  }

  if (updateHistory) {
    updatePoemUrl(poem.id);
  }
}

function closePoem({ updateHistory = false, restoreFocus = true } = {}) {
  if (elements.dialog.open) {
    elements.dialog.close();
  }
  state.activePoemId = null;

  if (updateHistory) {
    updatePoemUrl(null);
  }

  if (restoreFocus && state.trigger?.isConnected) {
    state.trigger.focus();
  }
}

function movePoem(direction) {
  const currentIndex = state.poems.findIndex((poem) => poem.id === state.activePoemId);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = (currentIndex + direction + state.poems.length) % state.poems.length;
  const poem = state.poems[nextIndex];
  state.activePoemId = poem.id;
  fillDialog(poem);
  updatePoemUrl(poem.id, "replace");
}

async function copyPoemLink() {
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
  elements.dialogClose.addEventListener("click", () => closePoem({ updateHistory: true }));
  elements.dialogPrevious.addEventListener("click", () => movePoem(-1));
  elements.dialogNext.addEventListener("click", () => movePoem(1));
  elements.dialogShare.addEventListener("click", copyPoemLink);

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closePoem({ updateHistory: true });
    }
  });

  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePoem({ updateHistory: true });
  });

  window.addEventListener("keydown", (event) => {
    if (!elements.dialog.open) {
      return;
    }
    if (event.key === "ArrowLeft") {
      movePoem(-1);
    } else if (event.key === "ArrowRight") {
      movePoem(1);
    }
  });

  window.addEventListener("popstate", () => {
    const id = new URL(window.location.href).searchParams.get(POEM_PARAM);
    if (id && poemFromId(id)) {
      openPoem(id);
    } else {
      closePoem({ restoreFocus: false });
    }
  });
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`诗歌室数据加载失败：${response.status}`);
    }

    const data = await response.json();
    state.poems = data.poems;
    elements.statement.textContent = data.room.statement;
    elements.introduction.textContent = data.room.introduction;

    renderFilters();
    renderPoems();
    bindDialog();

    const initialPoemId = new URL(window.location.href).searchParams.get(POEM_PARAM);
    if (initialPoemId) {
      openPoem(initialPoemId);
    }
  } catch (error) {
    console.error(error);
    elements.grid.innerHTML = '<p class="poetryEmpty">诗歌室暂时无法开门，请稍后再来。</p>';
  }
}

init();
