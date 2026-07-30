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
        <span class="bookCover__catalogue">${escapeHtml(book.catalogue)}</span>
        <span class="bookCover__mark">${escapeHtml(book.mark)}</span>
        <div class="bookCover__title">
          <strong>${escapeHtml(book.title)}</strong>
          <span>${escapeHtml(book.author)}</span>
        </div>
      </div>
      <div class="bookCard__meta">
        <div class="bookCard__year">
          <strong>${escapeHtml(book.firstPublished)}</strong>
        </div>
        <p>${escapeHtml(book.observation)}</p>
        <div class="bookCard__tags">
          ${book.categories.map((category) => `<span>${escapeHtml(category)}</span>`).join("")}
        </div>
      </div>
    </button>
  `;

  const cover = card.querySelector(".bookCover");
  cover.style.setProperty("--cover-a", book.palette[0]);
  cover.style.setProperty("--cover-b", book.palette[1]);
  cover.style.setProperty("--cover-c", book.palette[2]);

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
  elements.dialogOriginal.textContent = book.originalTitle;
  elements.dialogTitle.textContent = book.title;
  elements.dialogAuthor.textContent = book.author;
  elements.dialogSample.hidden = !book.sample;
  elements.dialogPublished.textContent = book.firstPublished;
  elements.dialogRegion.textContent = book.region;
  elements.dialogEdition.textContent = book.edition;
  elements.dialogReadAt.textContent = book.readAt;
  elements.dialogObservation.textContent = book.observation;
  elements.dialogIntroduction.textContent = book.introduction;
  elements.dialogNoteTitle.textContent = book.noteTitle;
  elements.dialogNote.textContent = book.note;
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
    state.books = data.books;
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
