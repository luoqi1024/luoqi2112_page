import { isRealEntry, resolveAssetUrl, showField } from "./moments-shared.js?v=20261122-atlas-scs";

const DATA_URL = "../../data/moments-reading.json";
const BOOK_PARAM = "book";

const elements = {
  statement: document.querySelector("#readingStatement"),
  introduction: document.querySelector("#readingIntroduction"),
  filters: document.querySelector("#readingFilters"),
  grid: document.querySelector("#readingGrid"),
  empty: document.querySelector("#readingEmpty"),
  dialog: document.querySelector("#bookDialog"),
  dialogClose: document.querySelector("#bookDialogClose"),
  dialogCatalogue: document.querySelector("#bookDialogCatalogue"),
  dialogCover: document.querySelector("#bookDialogCover"),
  dialogOriginal: document.querySelector("#bookDialogOriginal"),
  dialogTitle: document.querySelector("#bookDialogTitle"),
  dialogAuthor: document.querySelector("#bookDialogAuthor"),
  dialogSample: document.querySelector("#bookDialogSample"),
  dialogPublished: document.querySelector("#bookDialogPublished"),
  dialogRegion: document.querySelector("#bookDialogRegion"),
  dialogEdition: document.querySelector("#bookDialogEdition"),
  dialogReadAt: document.querySelector("#bookDialogReadAt"),
  dialogObservation: document.querySelector("#bookDialogObservation"),
  dialogIntroduction: document.querySelector("#bookDialogIntroduction"),
  dialogNoteTitle: document.querySelector("#bookDialogNoteTitle"),
  dialogNote: document.querySelector("#bookDialogNote"),
  dialogPrevious: document.querySelector("#bookDialogPrevious"),
  dialogNext: document.querySelector("#bookDialogNext"),
  dialogShare: document.querySelector("#bookDialogShare"),
  dialogPosition: document.querySelector("#bookDialogPosition")
};

const state = {
  books: [],
  filter: "全部",
  activeBookId: null,
  trigger: null
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function applyCover(cover, book) {
  const image = cover.querySelector(".bookCover__image");
  const src = resolveAssetUrl(book.cover?.src);
  cover.classList.toggle("bookCover--image", Boolean(src));
  image.hidden = !src;
  if (src) image.src = src;
  else image.removeAttribute("src");
  image.alt = book.cover?.alt || "";
  cover.style.setProperty("--cover-a", book.palette[0]);
  cover.style.setProperty("--cover-b", book.palette[1]);
  cover.style.setProperty("--cover-c", book.palette[2]);
  cover.querySelector(".bookCover__catalogue").textContent = book.catalogue;
  cover.querySelector(".bookCover__mark").textContent = book.mark;
  cover.querySelector(".bookCover__title strong").textContent = book.title;
  cover.querySelector(".bookCover__title span").textContent = book.author;
}

function createCard(book) {
  const card = document.createElement("article");
  card.className = "bookCard";
  card.innerHTML = `
    <button class="bookCard__button" type="button" aria-label="查看《${escapeHtml(book.title)}》详情">
      <div class="bookCover" aria-hidden="true">
        <img class="bookCover__image" alt="" loading="lazy" decoding="async" hidden />
        <span class="bookCover__catalogue">${escapeHtml(book.catalogue)}</span>
        <span class="bookCover__mark">${escapeHtml(book.mark)}</span>
        <div class="bookCover__title">
          <strong>${escapeHtml(book.title)}</strong>
          <span>${escapeHtml(book.author)}</span>
        </div>
      </div>
      <div class="bookCard__meta">
        <h3>${escapeHtml(book.title)}</h3>
        <div class="bookCard__year">
          <span>${escapeHtml(book.author)}</span>
          ${book.note?.trim() ? '<span class="bookBadge">附手记</span>' : ""}
          <strong>${escapeHtml(book.firstPublished)}</strong>
        </div>
        <p>${escapeHtml(book.observation)}</p>
        <div class="bookCard__tags">
          ${book.categories.map((category) => `<span>${escapeHtml(category)}</span>`).join("")}
        </div>
      </div>
    </button>
  `;

  applyCover(card.querySelector(".bookCover"), book);

  card.querySelector("button").addEventListener("click", (event) => {
    state.trigger = event.currentTarget;
    openBook(book.id, { updateHistory: true });
  });

  return card;
}

function visibleBooks() {
  if (state.filter === "全部") {
    return state.books;
  }
  return state.books.filter((book) => book.categories.includes(state.filter));
}

function renderBooks() {
  const books = visibleBooks();
  elements.grid.replaceChildren(...books.map(createCard));
  elements.empty.hidden = books.length > 0;
}

function renderFilters() {
  const categories = [...new Set(state.books.flatMap((book) => book.categories))];
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
      renderBooks();
    });
    return button;
  }));
}

function bookFromId(id) {
  return state.books.find((book) => book.id === id) ?? null;
}

function updateBookUrl(id, mode = "push") {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(BOOK_PARAM, id);
  } else {
    url.searchParams.delete(BOOK_PARAM);
  }
  window.history[`${mode}State`]({ book: id }, "", url);
}

function fillDialog(book) {
  const activeIndex = state.books.findIndex((item) => item.id === book.id);

  elements.dialogCatalogue.textContent = book.catalogue;
  applyCover(elements.dialogCover, book);
  showField(elements.dialogOriginal, book.originalTitle);
  elements.dialogTitle.textContent = book.title;
  elements.dialogAuthor.textContent = book.author;
  elements.dialogSample.hidden = !book.sample;
  showField(elements.dialogPublished, book.firstPublished, elements.dialogPublished.parentElement);
  showField(elements.dialogRegion, book.region, elements.dialogRegion.parentElement);
  showField(elements.dialogEdition, book.edition, elements.dialogEdition.parentElement);
  showField(elements.dialogReadAt, book.readAt, elements.dialogReadAt.parentElement);
  elements.dialogObservation.textContent = book.observation;
  showField(elements.dialogIntroduction, book.introduction, elements.dialogIntroduction.parentElement);
  elements.dialogNoteTitle.textContent = book.noteTitle;
  showField(elements.dialogNote, book.note, elements.dialogNote.closest(".bookDialog__note"));
  elements.dialogPosition.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(state.books.length).padStart(2, "0")}`;
}

function openBook(id, { updateHistory = false } = {}) {
  const book = bookFromId(id);
  if (!book) {
    if (updateHistory) {
      updateBookUrl(null, "replace");
    }
    return;
  }

  state.activeBookId = book.id;
  fillDialog(book);

  if (!elements.dialog.open) {
    elements.dialog.showModal();
  }

  if (updateHistory) {
    updateBookUrl(book.id);
  }
}

function closeBook({ updateHistory = false, restoreFocus = true } = {}) {
  if (elements.dialog.open) {
    elements.dialog.close();
  }
  state.activeBookId = null;

  if (updateHistory) {
    updateBookUrl(null);
  }

  if (restoreFocus && state.trigger?.isConnected) {
    state.trigger.focus();
  }
}

function moveBook(direction) {
  const currentIndex = state.books.findIndex((book) => book.id === state.activeBookId);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = (currentIndex + direction + state.books.length) % state.books.length;
  const book = state.books[nextIndex];
  state.activeBookId = book.id;
  fillDialog(book);
  updateBookUrl(book.id, "replace");
}

async function copyBookLink() {
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
  elements.dialogClose.addEventListener("click", () => closeBook({ updateHistory: true }));
  elements.dialogPrevious.addEventListener("click", () => moveBook(-1));
  elements.dialogNext.addEventListener("click", () => moveBook(1));
  elements.dialogShare.addEventListener("click", copyBookLink);

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeBook({ updateHistory: true });
    }
  });

  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeBook({ updateHistory: true });
  });

  window.addEventListener("keydown", (event) => {
    if (!elements.dialog.open) {
      return;
    }
    if (event.key === "ArrowLeft") {
      moveBook(-1);
    } else if (event.key === "ArrowRight") {
      moveBook(1);
    }
  });

  window.addEventListener("popstate", () => {
    const id = new URL(window.location.href).searchParams.get(BOOK_PARAM);
    if (id && bookFromId(id)) {
      openBook(id);
    } else {
      closeBook({ restoreFocus: false });
    }
  });
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`阅读室数据加载失败：${response.status}`);
    }

    const data = await response.json();
    state.books = data.books.filter(isRealEntry);
    elements.statement.textContent = data.room.statement;
    elements.introduction.textContent = data.room.introduction;

    renderFilters();
    renderBooks();
    bindDialog();

    const initialBookId = new URL(window.location.href).searchParams.get(BOOK_PARAM);
    if (initialBookId) {
      openBook(initialBookId);
    }
  } catch (error) {
    console.error(error);
    elements.grid.innerHTML = '<p class="readingEmpty">阅读室暂时无法开门，请稍后再来。</p>';
  }
}

init();
