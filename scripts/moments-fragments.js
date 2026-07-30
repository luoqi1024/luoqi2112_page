const DATA_URL = "../../data/moments-fragments.json";
const FRAGMENT_PARAM = "fragment";

const elements = {
  statement: document.querySelector("#fragmentsStatement"),
  introduction: document.querySelector("#fragmentsIntroduction"),
  heroStart: document.querySelector("#fragmentsHeroStart"),
  filters: document.querySelector("#fragmentsFilters"),
  grid: document.querySelector("#fragmentsGrid"),
  empty: document.querySelector("#fragmentsEmpty"),
  dialog: document.querySelector("#fragmentDialog"),
  dialogStage: document.querySelector("#fragmentDialogStage"),
  dialogClose: document.querySelector("#fragmentDialogClose"),
  dialogAdvance: document.querySelector("#fragmentDialogAdvance"),
  dialogCatalogue: document.querySelector("#fragmentDialogCatalogue"),
  dialogMark: document.querySelector("#fragmentDialogMark"),
  dialogType: document.querySelector("#fragmentDialogType"),
  dialogTitle: document.querySelector("#fragmentDialogTitle"),
  dialogText: document.querySelector("#fragmentDialogText"),
  dialogDate: document.querySelector("#fragmentDialogDate"),
  dialogPlace: document.querySelector("#fragmentDialogPlace"),
  dialogSample: document.querySelector("#fragmentDialogSample"),
  dialogHint: document.querySelector("#fragmentDialogHint"),
  dialogPrevious: document.querySelector("#fragmentDialogPrevious"),
  dialogNext: document.querySelector("#fragmentDialogNext"),
  dialogNextLabel: document.querySelector("#fragmentDialogNextLabel"),
  dialogShare: document.querySelector("#fragmentDialogShare"),
  dialogPosition: document.querySelector("#fragmentDialogPosition"),
  dialogProgress: document.querySelector("#fragmentDialogProgress")
};

const state = {
  fragments: [],
  filter: "全部",
  activeFragmentId: null,
  trigger: null
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function applyPalette(element, fragment) {
  element.style.setProperty("--fragment-a", fragment.palette[0]);
  element.style.setProperty("--fragment-b", fragment.palette[1]);
  element.style.setProperty("--fragment-c", fragment.palette[2]);
}

function createCard(fragment) {
  const card = document.createElement("article");
  card.className = "fragmentCard";
  applyPalette(card, fragment);
  card.innerHTML = `
    <button class="fragmentCard__button" type="button" aria-label="阅读《${escapeHtml(fragment.title)}》">
      <div class="fragmentCard__top">
        <span>${escapeHtml(fragment.catalogue)}</span>
        <span>${escapeHtml(fragment.type)}</span>
      </div>
      <span class="fragmentCard__mark" aria-hidden="true">${escapeHtml(fragment.mark)}</span>
      <blockquote>${escapeHtml(fragment.text)}</blockquote>
      <div class="fragmentCard__meta">
        <span>${escapeHtml(fragment.date)}</span>
        <span aria-hidden="true">·</span>
        <span>${escapeHtml(fragment.place)}</span>
      </div>
    </button>
  `;

  card.querySelector("button").addEventListener("click", (event) => {
    state.trigger = event.currentTarget;
    openFragment(fragment.id, { updateHistory: true });
  });

  return card;
}

function visibleFragments() {
  if (state.filter === "全部") {
    return state.fragments;
  }
  return state.fragments.filter((fragment) => fragment.type === state.filter);
}

function renderFragments() {
  const fragments = visibleFragments();
  elements.grid.replaceChildren(...fragments.map(createCard));
  elements.empty.hidden = fragments.length > 0;
}

function renderFilters() {
  const types = [...new Set(state.fragments.map((fragment) => fragment.type))];
  const filters = ["全部", ...types];

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
      renderFragments();
    });
    return button;
  }));
}

function fragmentFromId(id) {
  return state.fragments.find((fragment) => fragment.id === id) ?? null;
}

function updateFragmentUrl(id, mode = "push") {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(FRAGMENT_PARAM, id);
  } else {
    url.searchParams.delete(FRAGMENT_PARAM);
  }
  window.history[`${mode}State`]({ fragment: id }, "", url);
}

function renderProgress(activeIndex) {
  elements.dialogProgress.replaceChildren(...state.fragments.map((_, index) => {
    const marker = document.createElement("span");
    marker.classList.toggle("is-active", index === activeIndex);
    return marker;
  }));
}

function fillDialog(fragment) {
  const activeIndex = state.fragments.findIndex((item) => item.id === fragment.id);
  const isLast = activeIndex === state.fragments.length - 1;

  applyPalette(elements.dialogStage, fragment);
  elements.dialogCatalogue.textContent = fragment.catalogue;
  elements.dialogMark.textContent = fragment.mark;
  elements.dialogType.textContent = fragment.type;
  elements.dialogTitle.textContent = fragment.title;
  elements.dialogText.textContent = fragment.text;
  elements.dialogDate.textContent = fragment.date;
  elements.dialogPlace.textContent = fragment.place;
  elements.dialogSample.hidden = !fragment.sample;
  elements.dialogPrevious.disabled = activeIndex === 0;
  elements.dialogNextLabel.textContent = isLast ? "回到文字墙" : "下一篇";
  elements.dialogHint.textContent = isLast ? "点击画面，回到文字墙" : "点击画面继续";
  elements.dialogPosition.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(state.fragments.length).padStart(2, "0")}`;
  renderProgress(activeIndex);
}

function openFragment(id, { updateHistory = false } = {}) {
  const fragment = fragmentFromId(id);
  if (!fragment) {
    if (updateHistory) {
      updateFragmentUrl(null, "replace");
    }
    return;
  }

  state.activeFragmentId = fragment.id;
  fillDialog(fragment);

  if (!elements.dialog.open) {
    elements.dialog.showModal();
  }

  if (updateHistory) {
    updateFragmentUrl(fragment.id);
  }

  window.requestAnimationFrame(() => elements.dialogAdvance.focus());
}

function closeFragment({ historyMode = false, restoreFocus = true } = {}) {
  if (elements.dialog.open) {
    elements.dialog.close();
  }
  state.activeFragmentId = null;

  if (historyMode) {
    updateFragmentUrl(null, historyMode);
  }

  if (restoreFocus && state.trigger?.isConnected) {
    state.trigger.focus();
  }
}

function moveFragment(direction) {
  const currentIndex = state.fragments.findIndex((fragment) => fragment.id === state.activeFragmentId);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex >= state.fragments.length) {
    closeFragment({ historyMode: "replace", restoreFocus: false });
    document.querySelector("#fragmentWall")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (nextIndex < 0) {
    return;
  }

  const fragment = state.fragments[nextIndex];
  state.activeFragmentId = fragment.id;
  fillDialog(fragment);
  updateFragmentUrl(fragment.id, "replace");
  elements.dialogAdvance.focus();
}

async function copyFragmentLink() {
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

function bindInteractions() {
  const startFromBeginning = (event) => {
    state.trigger = event.currentTarget;
    openFragment(state.fragments[0]?.id, { updateHistory: true });
  };

  elements.heroStart.addEventListener("click", startFromBeginning);
  elements.dialogAdvance.addEventListener("click", () => moveFragment(1));
  elements.dialogClose.addEventListener("click", () => closeFragment({ historyMode: "push" }));
  elements.dialogPrevious.addEventListener("click", () => moveFragment(-1));
  elements.dialogNext.addEventListener("click", () => moveFragment(1));
  elements.dialogShare.addEventListener("click", copyFragmentLink);

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeFragment({ historyMode: "push" });
    }
  });

  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeFragment({ historyMode: "push" });
  });

  window.addEventListener("keydown", (event) => {
    if (!elements.dialog.open) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFragment(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFragment(1);
    }
  });

  window.addEventListener("popstate", () => {
    const id = new URL(window.location.href).searchParams.get(FRAGMENT_PARAM);
    if (id && fragmentFromId(id)) {
      openFragment(id);
    } else {
      closeFragment({ restoreFocus: false });
    }
  });
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`片语室数据加载失败：${response.status}`);
    }

    const data = await response.json();
    state.fragments = data.fragments;
    elements.statement.textContent = data.room.statement;
    elements.introduction.textContent = data.room.introduction;

    renderFilters();
    renderFragments();
    bindInteractions();

    const initialFragmentId = new URL(window.location.href).searchParams.get(FRAGMENT_PARAM);
    if (initialFragmentId) {
      openFragment(initialFragmentId);
    }
  } catch (error) {
    console.error(error);
    elements.grid.innerHTML = '<p class="fragmentsEmpty">片语室暂时无法开门，请稍后再来。</p>';
    elements.heroStart.disabled = true;
  }
}

init();
