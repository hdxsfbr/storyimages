const data = [
  { id: "nature-1", title: "Forest Path", category: "Nature", src: "images/nature-1.svg" },
  { id: "nature-2", title: "Misty Valley", category: "Nature", src: "images/nature-2.svg" },
  { id: "nature-3", title: "Sunset Ridge", category: "Nature", src: "images/nature-3.svg" },
  { id: "city-1", title: "Neon Streets", category: "City", src: "images/city-1.svg" },
  { id: "city-2", title: "Glass Towers", category: "City", src: "images/city-2.svg" },
  { id: "city-3", title: "Rooftop Dawn", category: "City", src: "images/city-3.svg" },
  { id: "people-1", title: "Morning Commute", category: "People", src: "images/people-1.svg" },
  { id: "people-2", title: "Studio Portrait", category: "People", src: "images/people-2.svg" },
  { id: "people-3", title: "Festival Crowd", category: "People", src: "images/people-3.svg" },
  { id: "abstract-1", title: "Color Field", category: "Abstract", src: "images/abstract-1.svg" },
  { id: "abstract-2", title: "Gradient Bloom", category: "Abstract", src: "images/abstract-2.svg" },
  { id: "abstract-3", title: "Electric Pulse", category: "Abstract", src: "images/abstract-3.svg" },
];

const categories = [...new Set(data.map((item) => item.category))];
const categoryColors = {
  Nature: "#22c55e",
  City: "#0ea5e9",
  People: "#f97316",
  Abstract: "#a855f7",
};

const feed = document.getElementById("feed");
const preferenceBars = document.getElementById("preferenceBars");
const cardTemplate = document.getElementById("cardTemplate");

const dwellTotals = Object.fromEntries(categories.map((category) => [category, 0]));
const visibleSince = new Map();
const visibleItems = new Set();
const seenItems = new Set();
let reorderTimeout = null;

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildInitialFeed(items) {
  const buckets = categories.reduce((acc, category) => {
    acc[category] = shuffle(items.filter((item) => item.category === category));
    return acc;
  }, {});
  const order = [];
  let safety = 0;
  while (order.length < items.length && safety < 500) {
    safety += 1;
    const categoryOrder = shuffle(categories);
    categoryOrder.forEach((category) => {
      if (buckets[category].length) {
        order.push(buckets[category].shift());
      }
    });
  }
  return order;
}

function createCard(item) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;
  node.dataset.category = item.category;
  const img = node.querySelector("img");
  img.src = item.src;
  img.alt = `${item.title} (${item.category})`;
  node.querySelector(".card-category").textContent = item.category;
  node.querySelector(".card-title").textContent = item.title;
  return node;
}

function renderFeed(items) {
  feed.innerHTML = "";
  items.forEach((item) => feed.appendChild(createCard(item)));
}

function updatePreferenceUI() {
  const maxValue = Math.max(...Object.values(dwellTotals), 1);
  preferenceBars.innerHTML = "";
  categories.forEach((category) => {
    const bar = document.createElement("div");
    bar.className = "bar";

    const label = document.createElement("span");
    label.textContent = category;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.background = categoryColors[category];
    fill.style.width = `${Math.min((dwellTotals[category] / maxValue) * 100, 100)}%`;

    track.appendChild(fill);
    bar.appendChild(label);
    bar.appendChild(track);
    preferenceBars.appendChild(bar);
  });
}

function weightFor(category) {
  return 1 + dwellTotals[category] / 6000;
}

function reorderUnseen() {
  const cards = [...feed.querySelectorAll(".card")];
  const unseenCards = cards.filter((card) => !seenItems.has(card.dataset.id));
  if (!unseenCards.length) {
    return;
  }

  const anchor = cards.find((card) => card.dataset.id === [...visibleItems][0]);

  unseenCards.forEach((card) => card.remove());

  const unseenItems = unseenCards.map((card) => ({
    id: card.dataset.id,
    category: card.dataset.category,
    node: card,
  }));

  const bucket = categories.reduce((acc, category) => {
    acc[category] = unseenItems.filter((item) => item.category === category);
    return acc;
  }, {});

  const reordered = [];
  let remaining = unseenItems.length;
  while (remaining > 0) {
    const weightedCategories = categories
      .map((category) => ({
        category,
        weight: weightFor(category) * bucket[category].length,
      }))
      .filter((entry) => entry.weight > 0);

    const totalWeight = weightedCategories.reduce((sum, entry) => sum + entry.weight, 0);
    let draw = Math.random() * totalWeight;
    let selectedCategory = weightedCategories[0].category;
    for (const entry of weightedCategories) {
      draw -= entry.weight;
      if (draw <= 0) {
        selectedCategory = entry.category;
        break;
      }
    }

    const selectionIndex = Math.floor(Math.random() * bucket[selectedCategory].length);
    const [picked] = bucket[selectedCategory].splice(selectionIndex, 1);
    reordered.push(picked.node);
    remaining -= 1;
  }

  const fragment = document.createDocumentFragment();
  reordered.forEach((node) => fragment.appendChild(node));
  feed.appendChild(fragment);

  if (anchor) {
    anchor.scrollIntoView({ block: "start" });
  }
}

function scheduleReorder() {
  if (reorderTimeout) {
    window.clearTimeout(reorderTimeout);
  }
  reorderTimeout = window.setTimeout(() => {
    reorderUnseen();
    reorderTimeout = null;
  }, 700);
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const { id, category } = entry.target.dataset;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        if (!seenItems.has(id)) {
          seenItems.add(id);
        }
        if (!visibleSince.has(id)) {
          visibleSince.set(id, performance.now());
        }
        visibleItems.add(id);
      } else if (visibleSince.has(id)) {
        const duration = performance.now() - visibleSince.get(id);
        dwellTotals[category] += duration;
        visibleSince.delete(id);
        visibleItems.delete(id);
        updatePreferenceUI();
        scheduleReorder();
      }
    });
  },
  {
    threshold: [0.6],
  }
);

function startTracking() {
  const cards = feed.querySelectorAll(".card");
  cards.forEach((card) => observer.observe(card));
}

function accumulateVisibleTime() {
  const now = performance.now();
  visibleSince.forEach((start, id) => {
    const card = feed.querySelector(`[data-id="${id}"]`);
    if (!card) {
      return;
    }
    const { category } = card.dataset;
    const elapsed = now - start;
    dwellTotals[category] += elapsed;
    visibleSince.set(id, now);
  });
  updatePreferenceUI();
  scheduleReorder();
}

const initialFeed = buildInitialFeed(data);
renderFeed(initialFeed);
updatePreferenceUI();
startTracking();

window.setInterval(accumulateVisibleTime, 2000);
