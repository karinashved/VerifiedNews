/*
  VeriNews frontend
  - Works with the provided FastAPI backend endpoints:
      GET /news/everything
      GET /news/top-headlines
  - You can override API base with:
      ?api=http://localhost:8000
*/

const el = (id) => document.getElementById(id);

const els = {
  articles: el("articles"),
  status: el("status"),
  resultsMeta: el("resultsMeta"),
  pageIndicator: el("pageIndicator"),
  prevPage: el("prevPage"),
  nextPage: el("nextPage"),
  searchBtn: el("searchBtn"),
  clearBtn: el("clearBtn"),
  themeToggle: el("themeToggle"),

  tabEverything: el("tabEverything"),
  tabTop: el("tabTop"),

  query: el("query"),
  language: el("language"),
  sortBy: el("sort_by"),
  dateFrom: el("from"),
  dateTo: el("to"),
  country: el("country"),
  category: el("category"),
  pageSize: el("page_size"),
  pageSizeOut: el("pageSizeOut"),
};

const API_BASE = (() => {
  const u = new URL(window.location.href);
  return u.searchParams.get("api") || "http://localhost:8000";
})();

const state = {
  endpoint: "everything",
  page: 1,
  pageSize: 20,
  lastTotal: 0,
  lastUrl: "",
  isLoading: false,
};

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("vn_theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("vn_theme");
  if (saved) return setTheme(saved);
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  setTheme(prefersLight ? "light" : "dark");
}

function toast(message, kind = "info") {
  els.status.className = `status is-${kind}`;
  els.status.textContent = message;
}

function clearToast() {
  els.status.className = "status";
  els.status.textContent = "";
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(ms)) return "";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (days > 0) return `${days}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function setEndpoint(endpoint) {
  state.endpoint = endpoint;
  state.page = 1;

  const isEverything = endpoint === "everything";
  els.tabEverything.classList.toggle("is-active", isEverything);
  els.tabTop.classList.toggle("is-active", !isEverything);
  els.tabEverything.setAttribute("aria-selected", String(isEverything));
  els.tabTop.setAttribute("aria-selected", String(!isEverything));

  // Show/hide scoped fields
  document.querySelectorAll("[data-scope]").forEach((node) => {
    node.hidden = node.getAttribute("data-scope") !== endpoint;
  });

  // Clear fields that are invalid for the endpoint
  if (!isEverything) {
    els.language.value = "";
    els.sortBy.value = "publishedAt";
    els.dateFrom.value = "";
    els.dateTo.value = "";
  } else {
    els.country.value = "";
    els.category.value = "";
  }

  renderMeta();
  clearToast();
}

function renderSkeleton(count = 6) {
  els.articles.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "card is-skeleton";
    card.innerHTML = `
      <div class="card__media sk"></div>
      <div class="card__body">
        <div class="sk sk-line"></div>
        <div class="sk sk-line" style="width: 70%"></div>
        <div class="sk sk-line" style="width: 55%"></div>
        <div class="sk sk-chip"></div>
      </div>
    `;
    els.articles.appendChild(card);
  }
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderArticles(data) {
  const articles = data?.articles || [];
  if (!articles.length) {
    els.articles.innerHTML = `
      <div class="empty">
        <div class="empty__title">No results</div>
        <div class="muted">Try different keywords or loosen the filters.</div>
      </div>
    `;
    return;
  }

  els.articles.innerHTML = "";
  for (const a of articles) {
    const source = a?.source?.name || "Unknown source";
    const title = a?.title || "Untitled";
    const desc = a?.description || "";
    const url = a?.url || "#";
    const img = a?.urlToImage || "";
    const published = a?.publishedAt || "";

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <a class="card__media" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open article">
        ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" />` : `<div class="card__placeholder" aria-hidden="true"></div>`}
      </a>
      <div class="card__body">
        <div class="card__meta">
          <span class="chip">${escapeHtml(source)}</span>
          ${published ? `<span class="muted">${escapeHtml(timeAgo(published))}</span>` : ""}
        </div>
        <a class="card__title" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
        ${desc ? `<p class="card__desc">${escapeHtml(desc)}</p>` : ""}
        <div class="card__footer">
          ${published ? `<span class="muted" title="${escapeHtml(formatDateTime(published))}">${escapeHtml(formatDateTime(published))}</span>` : ""}
          <a class="card__cta" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Read →</a>
        </div>
      </div>
    `;
    els.articles.appendChild(card);
  }
}

function buildUrl() {
  const endpoint = state.endpoint;
  const pageSize = state.pageSize;

  const q = els.query.value.trim();
  const language = els.language.value;
  const sort_by = els.sortBy.value;
  const from = els.dateFrom.value;
  const to = els.dateTo.value;
  const country = els.country.value;
  const category = els.category.value;

  const u = new URL(`${API_BASE}/news/${endpoint}`);
  u.searchParams.set("page_size", String(pageSize));
  u.searchParams.set("page", String(state.page));

  // endpoint-specific params
  if (endpoint === "everything") {
    if (q) u.searchParams.set("q", q);
    if (language) u.searchParams.set("language", language);
    if (sort_by) u.searchParams.set("sort_by", sort_by);
    if (from) u.searchParams.set("from", from);
    if (to) u.searchParams.set("to", to);
  } else {
    if (q) u.searchParams.set("q", q);
    if (country) u.searchParams.set("country", country);
    if (category) u.searchParams.set("category", category);
  }
  return u.toString();
}

function validate() {
  clearToast();
  const q = els.query.value.trim();

  if (state.endpoint === "everything" && !q) {
    toast("For ‘Everything’, please enter keywords.", "error");
    els.query.focus();
    return false;
  }

  if (state.endpoint === "top-headlines") {
    const country = els.country.value;
    const category = els.category.value;
    if (!q && !country && !category) {
      toast("For ‘Top headlines’, set a country/category or type a query.", "error");
      return false;
    }
  }

  const from = els.dateFrom.value;
  const to = els.dateTo.value;
  if (from && to && from > to) {
    toast("‘From’ date can’t be after ‘To’ date.", "error");
    return false;
  }

  return true;
}

function maxAccessibleTotal(total) {
  // NewsAPI limits accessible results (commonly 100). We cap pagination to avoid confusing UX.
  return Math.min(total || 0, 100);
}

function renderMeta() {
  const total = maxAccessibleTotal(state.lastTotal);
  const pageSize = state.pageSize;
  const maxPage = total ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  els.pageIndicator.textContent = `Page ${state.page}${total ? ` / ${maxPage}` : ""}`;
  els.prevPage.disabled = state.page <= 1 || state.isLoading;
  els.nextPage.disabled = state.page >= maxPage || state.isLoading || !total;

  if (!state.lastUrl) {
    els.resultsMeta.textContent = "";
    return;
  }

  if (!state.lastTotal) {
    els.resultsMeta.textContent = "";
    return;
  }

  const shownFrom = (state.page - 1) * pageSize + 1;
  const shownTo = Math.min(state.page * pageSize, total);
  els.resultsMeta.textContent = `${shownFrom}–${shownTo} of ${total} results`;
}

async function runSearch({ resetPage = false } = {}) {
  if (resetPage) state.page = 1;
  if (!validate()) return;

  const url = buildUrl();
  state.lastUrl = url;
  state.isLoading = true;
  renderMeta();
  renderSkeleton();
  toast("Loading…", "info");

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data?.status === "error") {
      const msg = data?.message || data?.error || `Request failed (${response.status})`;
      state.lastTotal = 0;
      renderMeta();
      els.articles.innerHTML = "";
      toast(msg, "error");
      return;
    }

    state.lastTotal = data?.totalResults || 0;
    renderMeta();
    clearToast();
    renderArticles(data);
  } catch (err) {
    state.lastTotal = 0;
    renderMeta();
    els.articles.innerHTML = "";
    toast(err?.message || "Network error", "error");
  } finally {
    state.isLoading = false;
    renderMeta();
  }
}

function bind() {
  // Endpoint tabs
  els.tabEverything.addEventListener("click", () => setEndpoint("everything"));
  els.tabTop.addEventListener("click", () => setEndpoint("top-headlines"));

  // Theme
  els.themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  });

  // Search
  els.searchBtn.addEventListener("click", () => runSearch({ resetPage: true }));
  els.query.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch({ resetPage: true });
  });
  els.clearBtn.addEventListener("click", () => {
    els.query.value = "";
    els.query.focus();
  });

  // Page size
  els.pageSize.addEventListener("input", () => {
    state.pageSize = Number(els.pageSize.value) || 20;
    els.pageSizeOut.textContent = String(state.pageSize);
    renderMeta();
  });
  els.pageSize.addEventListener("change", () => runSearch({ resetPage: true }));
  els.pageSizeOut.textContent = String(state.pageSize);

  // Filters
  [els.language, els.sortBy, els.dateFrom, els.dateTo, els.country, els.category].forEach((node) => {
    node.addEventListener("change", () => runSearch({ resetPage: true }));
  });

  // Pagination
  els.prevPage.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    runSearch();
  });
  els.nextPage.addEventListener("click", () => {
    state.page += 1;
    runSearch();
  });
}

initTheme();
bind();
setEndpoint("everything");
