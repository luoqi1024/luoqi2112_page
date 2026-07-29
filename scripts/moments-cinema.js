const DATA_URL = "../../data/moments-cinema.json";
const FILM_PARAM = "film";

const elements = {
  count: document.querySelector("#collectionCount"),
  statement: document.querySelector("#cinemaStatement"),
  introduction: document.querySelector("#cinemaIntroduction"),
  filters: document.querySelector("#cinemaFilters"),
  grid: document.querySelector("#cinemaGrid"),
  empty: document.querySelector("#cinemaEmpty"),
  dialog: document.querySelector("#filmDialog"),
  dialogClose: document.querySelector("#filmDialogClose"),
  dialogCatalogue: document.querySelector("#filmDialogCatalogue"),
  dialogPoster: document.querySelector("#filmDialogPoster"),
  dialogOriginal: document.querySelector("#filmDialogOriginal"),
  dialogTitle: document.querySelector("#filmDialogTitle"),
  dialogSample: document.querySelector("#filmDialogSample"),
  dialogYear: document.querySelector("#filmDialogYear"),
  dialogDirector: document.querySelector("#filmDialogDirector"),
  dialogRegion: document.querySelector("#filmDialogRegion"),
  dialogViewed: document.querySelector("#filmDialogViewed"),
  dialogObservation: document.querySelector("#filmDialogObservation"),
  dialogSynopsis: document.querySelector("#filmDialogSynopsis"),
  dialogNoteTitle: document.querySelector("#filmDialogNoteTitle"),
  dialogNote: document.querySelector("#filmDialogNote"),
  dialogPrevious: document.querySelector("#filmDialogPrevious"),
  dialogNext: document.querySelector("#filmDialogNext"),
  dialogShare: document.querySelector("#filmDialogShare"),
  dialogPosition: document.querySelector("#filmDialogPosition")
};

const state = {
  films: [],
  filter: "全部",
  activeFilmId: null,
  trigger: null
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function setPoster(poster, film) {
  poster.style.setProperty("--poster-a", film.palette[0]);
  poster.style.setProperty("--poster-b", film.palette[1]);
  poster.style.setProperty("--poster-c", film.palette[2]);
  poster.querySelector(".filmPoster__catalogue").textContent = film.catalogue;
  poster.querySelector(".filmPoster__mark").textContent = film.mark;
  poster.querySelector(".filmPoster__title span").textContent = film.originalTitle;
  poster.querySelector(".filmPoster__title strong").textContent = film.title;
}

function createCard(film) {
  const card = document.createElement("article");
  card.className = "filmCard";
  card.dataset.tags = film.tags.join(",");
  card.innerHTML = `
    <button class="filmCard__button" type="button" aria-label="查看《${escapeHtml(film.title)}》详情">
      <div class="filmPoster" aria-hidden="true">
        <span class="filmPoster__catalogue">${escapeHtml(film.catalogue)}</span>
        <span class="filmPoster__mark">${escapeHtml(film.mark)}</span>
        <div class="filmPoster__title">
          <span>${escapeHtml(film.originalTitle)}</span>
          <strong>${escapeHtml(film.title)}</strong>
        </div>
      </div>
      <div class="filmCard__meta">
        <h3>${escapeHtml(film.title)}</h3>
        <span>${escapeHtml(film.year)}</span>
        <p>${escapeHtml(film.observation)}</p>
        <div class="filmCard__tags">
          ${film.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
    </button>
  `;

  const poster = card.querySelector(".filmPoster");
  poster.style.setProperty("--poster-a", film.palette[0]);
  poster.style.setProperty("--poster-b", film.palette[1]);
  poster.style.setProperty("--poster-c", film.palette[2]);

  card.querySelector("button").addEventListener("click", (event) => {
    state.trigger = event.currentTarget;
    openFilm(film.id, { updateHistory: true });
  });

  return card;
}

function visibleFilms() {
  if (state.filter === "全部") {
    return state.films;
  }
  return state.films.filter((film) => film.tags.includes(state.filter));
}

function renderFilms() {
  const films = visibleFilms();
  elements.grid.replaceChildren(...films.map(createCard));
  elements.empty.hidden = films.length > 0;
  elements.count.textContent = String(films.length).padStart(2, "0");
}

function renderFilters() {
  const tags = [...new Set(state.films.flatMap((film) => film.tags))];
  const filters = ["全部", ...tags];

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
      renderFilms();
    });
    return button;
  }));
}

function filmFromId(id) {
  return state.films.find((film) => film.id === id) ?? null;
}

function updateFilmUrl(id, mode = "push") {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(FILM_PARAM, id);
  } else {
    url.searchParams.delete(FILM_PARAM);
  }
  window.history[`${mode}State`]({ film: id }, "", url);
}

function fillDialog(film) {
  const activeIndex = state.films.findIndex((item) => item.id === film.id);

  elements.dialogCatalogue.textContent = film.catalogue;
  setPoster(elements.dialogPoster, film);
  elements.dialogOriginal.textContent = film.originalTitle;
  elements.dialogTitle.textContent = film.title;
  elements.dialogSample.hidden = !film.sample;
  elements.dialogYear.textContent = film.year;
  elements.dialogDirector.textContent = film.director;
  elements.dialogRegion.textContent = film.region;
  elements.dialogViewed.textContent = film.viewed;
  elements.dialogObservation.textContent = film.observation;
  elements.dialogSynopsis.textContent = film.synopsis;
  elements.dialogNoteTitle.textContent = film.noteTitle;
  elements.dialogNote.textContent = film.note;
  elements.dialogPosition.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(state.films.length).padStart(2, "0")}`;
}

function openFilm(id, { updateHistory = false } = {}) {
  const film = filmFromId(id);
  if (!film) {
    if (updateHistory) {
      updateFilmUrl(null, "replace");
    }
    return;
  }

  state.activeFilmId = film.id;
  fillDialog(film);

  if (!elements.dialog.open) {
    elements.dialog.showModal();
  }

  if (updateHistory) {
    updateFilmUrl(film.id);
  }
}

function closeFilm({ updateHistory = false, restoreFocus = true } = {}) {
  if (elements.dialog.open) {
    elements.dialog.close();
  }
  state.activeFilmId = null;

  if (updateHistory) {
    updateFilmUrl(null);
  }

  if (restoreFocus && state.trigger?.isConnected) {
    state.trigger.focus();
  }
}

function moveFilm(direction) {
  const currentIndex = state.films.findIndex((film) => film.id === state.activeFilmId);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = (currentIndex + direction + state.films.length) % state.films.length;
  const film = state.films[nextIndex];
  state.activeFilmId = film.id;
  fillDialog(film);
  updateFilmUrl(film.id, "replace");
}

async function copyFilmLink() {
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
  elements.dialogClose.addEventListener("click", () => closeFilm({ updateHistory: true }));
  elements.dialogPrevious.addEventListener("click", () => moveFilm(-1));
  elements.dialogNext.addEventListener("click", () => moveFilm(1));
  elements.dialogShare.addEventListener("click", copyFilmLink);

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeFilm({ updateHistory: true });
    }
  });

  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeFilm({ updateHistory: true });
  });

  window.addEventListener("keydown", (event) => {
    if (!elements.dialog.open) {
      return;
    }
    if (event.key === "ArrowLeft") {
      moveFilm(-1);
    } else if (event.key === "ArrowRight") {
      moveFilm(1);
    }
  });

  window.addEventListener("popstate", () => {
    const id = new URL(window.location.href).searchParams.get(FILM_PARAM);
    if (id && filmFromId(id)) {
      openFilm(id);
    } else {
      closeFilm({ restoreFocus: false });
    }
  });
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`影厅数据加载失败：${response.status}`);
    }

    const data = await response.json();
    state.films = data.films;
    elements.statement.textContent = data.room.statement;
    elements.introduction.textContent = data.room.introduction;

    renderFilters();
    renderFilms();
    bindDialog();

    const initialFilmId = new URL(window.location.href).searchParams.get(FILM_PARAM);
    if (initialFilmId) {
      openFilm(initialFilmId);
    }
  } catch (error) {
    console.error(error);
    elements.grid.innerHTML = '<p class="cinemaEmpty">影厅暂时无法开门，请稍后再来。</p>';
    elements.count.textContent = "00";
  }
}

init();
