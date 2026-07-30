const tourStops = [
  {
    id: "lobby",
    number: "00",
    name: "序厅",
    english: "Entrance hall",
    href: new URL("../moments/", import.meta.url).href
  },
  {
    id: "cinema",
    number: "01",
    name: "影厅",
    english: "Cinema",
    href: new URL("../moments/cinema/", import.meta.url).href
  },
  {
    id: "reading",
    number: "02",
    name: "阅读室",
    english: "Reading room",
    href: new URL("../moments/reading/", import.meta.url).href
  },
  {
    id: "poetry",
    number: "03",
    name: "诗歌室",
    english: "Poetry room",
    href: new URL("../moments/poetry/", import.meta.url).href
  },
  {
    id: "records",
    number: "04",
    name: "唱片室",
    english: "Record room",
    href: new URL("../moments/records/", import.meta.url).href
  },
  {
    id: "fragments",
    number: "05",
    name: "片语室",
    english: "Fragments",
    href: new URL("../moments/fragments/", import.meta.url).href
  },
  {
    id: "archive",
    number: "06",
    name: "全馆索引",
    english: "Catalogue",
    href: new URL("../moments/archive/", import.meta.url).href
  }
];

const visitedStorageKey = "moments-tour-visited-v1";

function getCurrentStopId() {
  const segments = window.location.pathname
    .replace(/index\.html$/i, "")
    .split("/")
    .filter(Boolean);
  const momentsIndex = segments.lastIndexOf("moments");
  const room = momentsIndex >= 0 ? segments[momentsIndex + 1] : "";
  return tourStops.some((stop) => stop.id === room) ? room : "lobby";
}

function readVisitedStops() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(visitedStorageKey) ?? "[]");
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function rememberVisitedStops(visited) {
  try {
    window.sessionStorage.setItem(visitedStorageKey, JSON.stringify([...visited]));
  } catch {
    // The tour remains fully usable when storage is unavailable.
  }
}

function makeStopItem(stop, currentId, visited) {
  const item = document.createElement("li");
  item.className = "museumTour__stop";
  item.dataset.visited = String(visited.has(stop.id));

  const link = document.createElement("a");
  link.href = stop.href;
  if (stop.id === currentId) {
    link.setAttribute("aria-current", "page");
  }

  const number = document.createElement("span");
  number.className = "museumTour__stopNumber";
  number.innerHTML = `<span>${stop.number}</span><span class="museumTour__visitedMark" aria-hidden="true"></span>`;

  const name = document.createElement("span");
  name.className = "museumTour__stopName";
  name.innerHTML = `<strong>${stop.name}</strong><small>${stop.english}</small>`;

  link.append(number, name);
  item.append(link);
  return item;
}

function makeDirection(stop, direction) {
  const link = document.createElement("a");
  link.className = `museumTour__direction museumTour__direction--${direction}`;
  link.href = stop.href;
  link.setAttribute("aria-label", `${direction === "previous" ? "上一站" : "下一站"}：${stop.name}`);

  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = direction === "previous" ? "←" : "→";

  const text = document.createElement("span");
  text.className = "museumTour__directionText";
  text.innerHTML = `
    <small>${direction === "previous" ? "Previous room" : "Next room"}</small>
    <strong>${stop.number} · ${stop.name}</strong>
  `;

  if (direction === "previous") {
    link.append(arrow, text);
  } else {
    link.append(text, arrow);
  }
  return link;
}

function mountSkipLink(main) {
  if (!main.id) {
    main.id = "momentsMain";
  }

  const link = document.createElement("a");
  link.className = "momentsSkipLink";
  link.href = `#${main.id}`;
  link.textContent = "跳至主要内容";
  document.body.prepend(link);
}

function mountMuseumTour() {
  const main = document.querySelector("main");
  const pageFooter = document.querySelector("body > footer");
  if (!main || !pageFooter) {
    return;
  }

  mountSkipLink(main);

  const currentId = getCurrentStopId();
  const currentIndex = Math.max(0, tourStops.findIndex((stop) => stop.id === currentId));
  const previous = tourStops[(currentIndex - 1 + tourStops.length) % tourStops.length];
  const next = tourStops[(currentIndex + 1) % tourStops.length];
  const visited = readVisitedStops();
  visited.add(currentId);
  rememberVisitedStops(visited);

  const section = document.createElement("section");
  section.id = "museumTour";
  section.className = "museumTour";
  section.setAttribute("aria-labelledby", "museumTourTitle");

  const head = document.createElement("header");
  head.className = "museumTour__head";
  head.innerHTML = `
    <div>
      <div class="museumTour__eyebrow">Visitor route · Seven stops</div>
      <h2 id="museumTourTitle">继续参观</h2>
    </div>
    <div class="museumTour__progress" aria-live="polite">
      <span>本次到访</span>
      <strong>${String(visited.size).padStart(2, "0")} / ${String(tourStops.length).padStart(2, "0")}</strong>
    </div>
  `;

  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "片刻馆馆内导览");
  const list = document.createElement("ol");
  list.className = "museumTour__stops";
  list.append(...tourStops.map((stop) => makeStopItem(stop, currentId, visited)));
  nav.append(list);

  const actions = document.createElement("div");
  actions.className = "museumTour__actions";
  actions.append(makeDirection(previous, "previous"));

  const catalogue = document.createElement("a");
  catalogue.className = "museumTour__catalogue";
  catalogue.href = tourStops.find((stop) => stop.id === "archive").href;
  catalogue.textContent = "检索全部馆藏";
  actions.append(catalogue, makeDirection(next, "next"));

  section.append(head, nav, actions);
  pageFooter.before(section);
}

mountMuseumTour();
