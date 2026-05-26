﻿// Bulletin Board – public read-only with schedules from 'schedules' collection
let posts = [];
let allSchedules = [];
let selectedDay = null;
let selectedDateFilter = null;
let currentFilter = "all";
let currentSearch = "";
let currentSort = "latest";

const _today = new Date();
let currentDisplayYear = _today.getFullYear();
let currentDisplayMonth = _today.getMonth();

// ========== WHITELIST MAPPINGS ==========
const TYPE_CLASS_MAP = {
  announcement: 'announcement-card',
  memo: 'memo-card',
  order: 'order-card',
  travel: 'travel-card'
};
const TYPE_BADGE_CLASS_MAP = {
  announcement: 'announcement',
  memo: 'memo',
  order: 'order',
  travel: 'travel'
};
const TYPE_LABEL_MAP = {
  announcement: 'Announcement',
  memo: 'Memo',
  order: 'Office Order',
  travel: 'Travel Order'
};

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toJsDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      const d = value.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch { return null; }
  }
  if (typeof value === "number" || typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDateLabel(date) {
  const d = toJsDate(date);
  if (!d) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return diffDays + " days ago";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimeRange(start, end) {
  const s = toJsDate(start);
  const e = toJsDate(end);
  if (!s) return "";
  const t1 = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (e) {
    return t1 + " - " + e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return t1;
}

// Convert schedule document (match Firestore field names)
function docToSchedule(docSnap) {
  const d = docSnap.data();
  const dateObj = toJsDate(d.date);
  return {
    id: docSnap.id,
    title: d.title || "Untitled",
    description: d.description || "",
    date: dateObj,
    startTime: d.startTime || "",
    endTime: d.endTime || "",
    location: d.location || "",
    userId: d.userID || "",      // note: your field is "userID"
    employeeId: d.employeeId || ""
  };
}

function docToPost(docSnap) {
  const d = docSnap.data();
  const createdAt = toJsDate(d.createdAt) || new Date(0);
  const start = toJsDate(d.start);
  const end = toJsDate(d.end);
  const location = d.location || "";
  const priority = d.priority || "";
  let preview = "";
  if (location) preview = "Location: " + location;
  else if (priority) preview = "Priority: " + priority;
  
  let scheduleDisplay = "";
  if (start) {
    const timeStr = formatTimeRange(start, end);
    const dateStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    scheduleDisplay = `📅 ${dateStr} ${timeStr}`;
  }

  return {
    id: docSnap.id,
    type: d.postType || "announcement",
    title: d.title || "",
    content: (d.content || "").trim(),
    urgent: !!d.urgent,
    pinned: !!d.pinned,
    hasSchedule: !!d.hasSchedule,
    start: start,
    end: end,
    location: location,
    priority: priority,
    createdBy: d.createdBy || "",
    date: createdAt,
    dateLabel: formatDateLabel(createdAt),
    preview: preview,
    scheduleDisplay: scheduleDisplay
  };
}

// ---------- SCHEDULE FILTERING (left panel) ----------
function getFilteredSchedules() {
  let filtered = allSchedules.filter(s => s.date);
  if (selectedDateFilter) {
    const { year, month, day } = selectedDateFilter;
    filtered = filtered.filter(s => {
      if (!s.date) return false;
      return s.date.getFullYear() === year && s.date.getMonth() === month && s.date.getDate() === day;
    });
  }
  filtered.sort((a, b) => a.date - b.date);
  return filtered;
}

function getEventDaysForMonth(year, month) {
  const days = new Set();
  allSchedules.forEach(s => {
    if (s.date && s.date.getFullYear() === year && s.date.getMonth() === month) {
      days.add(s.date.getDate());
    }
  });
  return days;
}

// ---------- DATE FILTER UI ----------
function clearDateFilter() {
  selectedDateFilter = null;
  selectedDay = null;
  renderCalendar();
  renderSchedule();
  renderFeed();
  const btn = document.getElementById("clearFilterBtn");
  if (btn) btn.remove();
}

function addClearFilterButton() {
  let btn = document.getElementById("clearFilterBtn");
  if (btn) return;
  const container = document.querySelector(".card:first-child .card-header");
  if (container) {
    btn = document.createElement("button");
    btn.id = "clearFilterBtn";
    btn.className = "btn";
    btn.textContent = "✖ Show All";
    btn.style.marginLeft = "auto";
    btn.style.padding = "4px 10px";
    btn.addEventListener("click", clearDateFilter);
    container.appendChild(btn);
  }
}

function selectDateFilter(year, month, day) {
  selectedDateFilter = { year, month, day };
  selectedDay = day;
  addClearFilterButton();
  renderCalendar();
  renderSchedule();
  renderFeed();
}

function showDayEvents(year, month, day) {
  selectDateFilter(year, month, day);
}

// ---------- POST DETAIL MODAL ----------
function ensurePostDetailStyles() {
  if (document.getElementById("postDetailModalStyles")) return;
  const style = document.createElement("style");
  style.id = "postDetailModalStyles";
  style.textContent = `
    .post-detail-modal{width:520px;max-width:92%}
    .post-detail-title{font-size:1.35rem;font-weight:700;margin:0 0 0.75rem;color:#0f2b3d;line-height:1.3}
    .post-detail-badges{display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.75rem}
    .post-detail-meta{font-size:0.8rem;color:#475569;margin-bottom:0.75rem}
    .post-detail-schedule{font-size:0.8rem;color:#475569;margin-bottom:1rem;padding:0.5rem 0.75rem;background:#f1f5f9;border-radius:0.5rem;border:1px solid #e2e8f0}
    .post-detail-content{font-size:0.9rem;color:#1e293b;line-height:1.55;white-space:pre-wrap;margin-bottom:1.25rem;padding:0.75rem 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}
    .post-detail-content.is-empty{color:#64748b;font-style:italic}
    .post-detail-author{font-size:0.7rem;color:#64748b;margin-top:0.25rem}
    @media (prefers-color-scheme:dark){
      .post-detail-modal.event-modal{background:#1e293b;color:#f1f5f9;box-shadow:0 8px 32px rgba(0,0,0,0.45)}
      .post-detail-title{color:#f8fafc}
      .post-detail-meta,.post-detail-schedule{color:#cbd5e1}
      .post-detail-schedule{background:#334155;border-color:#475569}
      .post-detail-content{color:#e2e8f0;border-color:#475569}
      .post-detail-content.is-empty{color:#94a3b8}
      .post-detail-author{color:#94a3b8}
      .post-detail-modal .btn{background:#334155;border-color:#475569;color:#f1f5f9}
    }
  `;
  document.head.appendChild(style);
}

function closePostDetailModal() {
  const el = document.getElementById("postDetailModal");
  if (el) el.remove();
}

function showPostDetail(post) {
  ensurePostDetailStyles();
  closePostDetailModal();

  const overlay = document.createElement("div");
  overlay.className = "event-modal-overlay";
  overlay.id = "postDetailModal";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePostDetailModal(); });

  const modal = document.createElement("div");
  modal.className = "event-modal post-detail-modal";

  const titleEl = document.createElement("h2");
  titleEl.className = "post-detail-title";
  titleEl.textContent = post.title;
  modal.appendChild(titleEl);

  const badges = document.createElement("div");
  badges.className = "post-detail-badges";
  const typeBadge = document.createElement("span");
  typeBadge.className = "feed-type " + getTypeClass(post.type);
  typeBadge.textContent = getTypeLabel(post.type);
  badges.appendChild(typeBadge);
  if (post.urgent) {
    const urgentBadge = document.createElement("span");
    urgentBadge.className = "urgent-tag";
    urgentBadge.textContent = "URGENT";
    badges.appendChild(urgentBadge);
  }
  if (post.pinned) {
    const pinnedBadge = document.createElement("span");
    pinnedBadge.className = "pin-label";
    pinnedBadge.textContent = "Pinned";
    badges.appendChild(pinnedBadge);
  }
  modal.appendChild(badges);

  const meta = document.createElement("div");
  meta.className = "post-detail-meta";
  meta.textContent = (post.location || "No location") + " · " + (post.priority || "normal");
  modal.appendChild(meta);

  if (post.hasSchedule && post.start) {
    const schedule = document.createElement("div");
    schedule.className = "post-detail-schedule";
    schedule.textContent = "Schedule: " + post.start.toLocaleString() + (post.end ? " → " + post.end.toLocaleString() : "");
    modal.appendChild(schedule);
  }

  const contentBlock = document.createElement("div");
  contentBlock.className = "post-detail-content";
  contentBlock.textContent = post.content || "No additional details provided.";
  if (!post.content) contentBlock.classList.add("is-empty");
  modal.appendChild(contentBlock);

  const author = document.createElement("div");
  author.className = "post-detail-author";
  author.textContent = "Created by " + (post.createdBy || "Unknown");
  modal.appendChild(author);

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn";
  closeBtn.textContent = "Close";
  closeBtn.style.marginTop = "1rem";
  closeBtn.addEventListener("click", closePostDetailModal);
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ---------- DATE & TIME ----------
function updateDateTime() {
  const now = new Date();
  document.getElementById("currentDateText").innerText = now.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}
updateDateTime();
setInterval(updateDateTime, 60000);

// ---------- CALENDAR ----------
function changeDisplayMonth(delta) {
  currentDisplayMonth += delta;
  if (currentDisplayMonth < 0) {
    currentDisplayMonth = 11;
    currentDisplayYear -= 1;
  } else if (currentDisplayMonth > 11) {
    currentDisplayMonth = 0;
    currentDisplayYear += 1;
  }
  if (selectedDateFilter) clearDateFilter();
  selectedDay = null;
  renderCalendar();
}

function renderCalendar() {
  const today = new Date();
  const year = currentDisplayYear;
  const month = currentDisplayMonth;
  const isViewingCurrentMonth = (year === today.getFullYear() && month === today.getMonth());
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const eventDays = getEventDaysForMonth(year, month);

  let html = `<div class="cal-nav">
    <button type="button" class="cal-nav-btn" id="calPrevBtn">Prev</button>
    <span class="cal-month-title">${escapeHtml(monthNames[month] + " " + year)}</span>
    <button type="button" class="cal-nav-btn" id="calNextBtn">Next</button>
  </div>
  <div class="cal-weekdays"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
  <div class="cal-days">`;

  let dayCounter = 1;
  for (let i = 0; i < 42; i++) {
    let cell = "", isToday = false, hasEvent = false, isSelected = false;
    if (i >= firstDay && dayCounter <= daysInMonth) {
      cell = dayCounter;
      if (isViewingCurrentMonth && dayCounter === today.getDate()) isToday = true;
      if (selectedDateFilter && selectedDateFilter.year === year && selectedDateFilter.month === month && selectedDateFilter.day === dayCounter) isSelected = true;
      if (eventDays.has(dayCounter)) hasEvent = true;
      dayCounter++;
    }
    let classes = "cal-day";
    if (isToday) classes += " today";
    if (isSelected) classes += " selected";
    if (hasEvent) classes += " event-dot";
    html += `<div class="${classes}" data-day="${cell}">${cell !== "" ? cell : ""}</div>`;
  }
  html += "</div>";
  document.getElementById("miniCalendarWidget").innerHTML = html;

  document.getElementById("calPrevBtn").onclick = () => changeDisplayMonth(-1);
  document.getElementById("calNextBtn").onclick = () => changeDisplayMonth(1);
  document.querySelectorAll(".cal-day[data-day]").forEach(el => {
    el.addEventListener("click", () => {
      const dayVal = parseInt(el.dataset.day, 10);
      if (dayVal) showDayEvents(currentDisplayYear, currentDisplayMonth, dayVal);
    });
  });
}

// ---------- LEFT PANEL (SCHEDULE LIST) ----------
function renderSchedule() {
  const container = document.getElementById("scheduleList");
  const items = getFilteredSchedules();
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state"><div>No scheduled events</div></div>';
    return;
  }
  container.innerHTML = items.map(item => {
    const dateStr = item.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = `${item.startTime} – ${item.endTime}`;
    return `
      <div class="schedule-item">
        <div class="schedule-title">
          ${escapeHtml(item.title)}
          <span class="time-badge">${escapeHtml(timeStr)}</span>
        </div>
        <div class="schedule-datetime">
          <span>📅 ${escapeHtml(dateStr)}</span>
          ${item.location ? `<span>📍 ${escapeHtml(item.location)}</span>` : ''}
        </div>
        ${item.description ? `<div class="schedule-desc">${escapeHtml(item.description)}</div>` : ''}
      </div>
    `;
  }).join("");
}

// ---------- FEED (posts) ----------
function getCardBorderClass(type) { return TYPE_CLASS_MAP[type] || 'announcement-card'; }
function getTypeClass(type) { return TYPE_BADGE_CLASS_MAP[type] || 'announcement'; }
function getTypeLabel(type) { return TYPE_LABEL_MAP[type] || 'Notice'; }

function updateUrgentCounter() {
  document.getElementById("urgentCount").innerText = posts.filter(p => p.urgent).length;
}

function renderFeed() {
  let filtered = posts.filter(item => {
    if (currentFilter !== "all" && item.type !== currentFilter) return false;
    if (currentSearch.trim()) {
      const s = currentSearch.toLowerCase();
      return item.title.toLowerCase().includes(s) || (item.preview && item.preview.toLowerCase().includes(s));
    }
    return true;
  });
  if (currentSort === "latest") filtered.sort((a,b) => b.date - a.date);
  else if (currentSort === "urgent") filtered.sort((a,b) => (b.urgent?1:0) - (a.urgent?1:0) || b.date - a.date);
  else if (currentSort === "pinned") filtered.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || b.date - a.date);

  const container = document.getElementById("feedStream");
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><div>No matching posts</div></div>';
    return;
  }
  container.innerHTML = filtered.map(item => {
    const scheduleLine = item.hasSchedule && item.scheduleDisplay ? `<div class="feed-schedule">${escapeHtml(item.scheduleDisplay)}</div>` : "";
    return `
      <div class="feed-item ${getCardBorderClass(item.type)} ${item.pinned ? 'pinned-feed' : ''}" data-post-id="${escapeHtml(item.id)}" style="cursor:pointer;" role="button" tabindex="0">
        <div class="feed-header">
          <span class="feed-type ${getTypeClass(item.type)}">${escapeHtml(getTypeLabel(item.type))}</span>
          ${item.pinned ? '<span class="pin-label">Pinned</span>' : ''}
        </div>
        <div class="feed-title">
          ${escapeHtml(item.title)}
          ${item.urgent ? '<span class="urgent-tag">URGENT</span>' : ''}
        </div>
        ${scheduleLine}
        ${item.preview ? `<div class="feed-preview">${escapeHtml(item.preview)}</div>` : ''}
      </div>
    `;
  }).join("");
}

function initFeedClicks() {
  const container = document.getElementById("feedStream");
  container.addEventListener("click", e => {
    const card = e.target.closest(".feed-item[data-post-id]");
    if (card) {
      const post = posts.find(p => p.id === card.dataset.postId);
      if (post) showPostDetail(post);
    }
  });
  container.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".feed-item[data-post-id]");
    if (card) {
      e.preventDefault();
      const post = posts.find(p => p.id === card.dataset.postId);
      if (post) showPostDetail(post);
    }
  });
}

function initEvents() {
  initFeedClicks();
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderFeed();
    });
  });
  document.getElementById("searchInput").addEventListener("input", e => {
    currentSearch = e.target.value;
    renderFeed();
  });
  document.getElementById("sortSelect").addEventListener("change", e => {
    currentSort = e.target.value;
    renderFeed();
  });
}

// ---------- FIRESTORE INIT ----------
function initFirestore() {
  document.getElementById("feedStream").innerHTML = '<div class="empty-state"><div>Loading posts...</div></div>';
  document.getElementById("scheduleList").innerHTML = '<div class="empty-state"><div>Loading schedules...</div></div>';

  db.collection("posts").onSnapshot(snapshot => {
    posts = snapshot.docs.map(docToPost);
    updateUrgentCounter();
    renderFeed();
  }, err => {
    console.error("Posts error:", err);
    document.getElementById("feedStream").innerHTML = '<div class="empty-state"><div>Unable to load posts.</div></div>';
  });

  db.collection("schedules").onSnapshot(snapshot => {
    allSchedules = snapshot.docs.map(docToSchedule);
    renderCalendar();
    renderSchedule();
  }, err => {
    console.error("Schedules error:", err);
    document.getElementById("scheduleList").innerHTML = '<div class="empty-state"><div>Unable to load schedules.</div></div>';
  });
}

initEvents();
initFirestore();