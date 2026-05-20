// Bulletin Board – public read-only (Firestore compat)

let posts = [];
let selectedDay = null;
let currentFilter = "all";
let currentSearch = "";
let currentSort = "latest";

const _today = new Date();
let currentDisplayYear = _today.getFullYear();
let currentDisplayMonth = _today.getMonth();

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
    } catch {
      return null;
    }
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
    preview: preview
  };
}

function getScheduledPosts() {
  return posts.filter(function (p) {
    return p.hasSchedule && p.start;
  });
}

function getEventDaysForMonth(year, month) {
  const days = new Set();
  getScheduledPosts().forEach(function (p) {
    if (p.start.getFullYear() === year && p.start.getMonth() === month) {
      days.add(p.start.getDate());
    }
  });
  return days;
}

function getEventsOnDay(year, month, day) {
  return getScheduledPosts()
    .filter(function (p) {
      return (
        p.start.getFullYear() === year &&
        p.start.getMonth() === month &&
        p.start.getDate() === day
      );
    })
    .sort(function (a, b) {
      return a.start - b.start;
    });
}

function closeEventModal() {
  const el = document.getElementById("eventDayModal");
  if (el) el.remove();
}

function showDayEvents(year, month, day) {
  closeEventModal();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const events = getEventsOnDay(year, month, day);

  const overlay = document.createElement("div");
  overlay.className = "event-modal-overlay";
  overlay.id = "eventDayModal";
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeEventModal();
  });

  const modal = document.createElement("div");
  modal.className = "event-modal";

  const h3 = document.createElement("h3");
  h3.textContent = monthNames[month] + " " + day + ", " + year;
  modal.appendChild(h3);

  if (events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "event-modal-empty";
    empty.textContent = "No events scheduled";
    modal.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "event-modal-list";
    events.forEach(function (ev) {
      const item = document.createElement("div");
      item.className = "event-modal-item";
      const title = document.createElement("strong");
      title.textContent = ev.title;
      item.appendChild(title);
      const time = document.createElement("div");
      time.className = "event-modal-meta";
      time.textContent = formatTimeRange(ev.start, ev.end);
      item.appendChild(time);
      if (ev.location) {
        const loc = document.createElement("div");
        loc.className = "event-modal-meta";
        loc.textContent = "Location: " + ev.location;
        item.appendChild(loc);
      }
      if (ev.priority) {
        const pri = document.createElement("div");
        pri.className = "event-modal-meta";
        pri.textContent = "Priority: " + ev.priority;
        item.appendChild(pri);
      }
      list.appendChild(item);
    });
    modal.appendChild(list);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", closeEventModal);
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function ensurePostDetailStyles() {
  if (document.getElementById("postDetailModalStyles")) return;
  const style = document.createElement("style");
  style.id = "postDetailModalStyles";
  style.textContent =
    ".post-detail-modal{width:520px;max-width:92%}" +
    ".post-detail-title{font-size:1.35rem;font-weight:700;margin:0 0 0.75rem;color:#0f2b3d;line-height:1.3}" +
    ".post-detail-badges{display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.75rem}" +
    ".post-detail-meta{font-size:0.8rem;color:#475569;margin-bottom:0.75rem}" +
    ".post-detail-schedule{font-size:0.8rem;color:#475569;margin-bottom:1rem;padding:0.5rem 0.75rem;background:#f1f5f9;border-radius:0.5rem;border:1px solid #e2e8f0}" +
    ".post-detail-content{font-size:0.9rem;color:#1e293b;line-height:1.55;white-space:pre-wrap;margin-bottom:1.25rem;padding:0.75rem 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}" +
    ".post-detail-content.is-empty{color:#64748b;font-style:italic}" +
    ".post-detail-author{font-size:0.7rem;color:#64748b;margin-top:0.25rem}" +
    "@media (prefers-color-scheme:dark){" +
    ".post-detail-modal.event-modal{background:#1e293b;color:#f1f5f9;box-shadow:0 8px 32px rgba(0,0,0,0.45)}" +
    ".post-detail-title{color:#f8fafc}" +
    ".post-detail-meta,.post-detail-schedule{color:#cbd5e1}" +
    ".post-detail-schedule{background:#334155;border-color:#475569}" +
    ".post-detail-content{color:#e2e8f0;border-color:#475569}" +
    ".post-detail-content.is-empty{color:#94a3b8}" +
    ".post-detail-author{color:#94a3b8}" +
    ".post-detail-modal .btn{background:#334155;border-color:#475569;color:#f1f5f9}" +
    "}";
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
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closePostDetailModal();
  });

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
  const locText = post.location ? post.location : "No location";
  const priText = post.priority ? post.priority : "normal";
  meta.textContent = locText + " · " + priText;
  modal.appendChild(meta);

  if (post.hasSchedule && post.start) {
    const schedule = document.createElement("div");
    schedule.className = "post-detail-schedule";
    const scheduleText =
      post.start.toLocaleString() +
      (post.end ? " → " + post.end.toLocaleString() : "");
    schedule.textContent = "Schedule: " + scheduleText;
    modal.appendChild(schedule);
  }

  const contentBlock = document.createElement("div");
  contentBlock.className = "post-detail-content";
  if (post.content) {
    contentBlock.textContent = post.content;
  } else {
    contentBlock.classList.add("is-empty");
    contentBlock.textContent = "No additional details provided.";
  }
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

function updateDateTime() {
  const now = new Date();
  document.getElementById("currentDateText").innerText = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
updateDateTime();
setInterval(updateDateTime, 60000);

function changeDisplayMonth(delta) {
  currentDisplayMonth += delta;
  if (currentDisplayMonth < 0) {
    currentDisplayMonth = 11;
    currentDisplayYear -= 1;
  } else if (currentDisplayMonth > 11) {
    currentDisplayMonth = 0;
    currentDisplayYear += 1;
  }
  selectedDay = null;
  renderCalendar();
}

function renderCalendar() {
  const today = new Date();
  const year = currentDisplayYear;
  const month = currentDisplayMonth;
  const isViewingCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const eventDays = getEventDaysForMonth(year, month);

  let html =
    '<div class="cal-nav">' +
    '<button type="button" class="cal-nav-btn" id="calPrevBtn">Prev</button>' +
    '<span class="cal-month-title">' +
    escapeHtml(monthNames[month] + " " + year) +
    "</span>" +
    '<button type="button" class="cal-nav-btn" id="calNextBtn">Next</button>' +
    "</div>";
  html +=
    '<div class="cal-weekdays"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div><div class="cal-days">';

  let dayCounter = 1;
  for (let i = 0; i < 42; i++) {
    let cell = "";
    let isToday = false;
    let hasEvent = false;
    let isSelected = false;
    if (i >= firstDay && dayCounter <= daysInMonth) {
      cell = dayCounter;
      if (isViewingCurrentMonth && dayCounter === today.getDate()) isToday = true;
      if (selectedDay === dayCounter && !isToday) isSelected = true;
      if (eventDays.has(dayCounter)) hasEvent = true;
      dayCounter++;
    }
    let classes = "cal-day";
    if (isToday) classes += " today";
    if (isSelected) classes += " selected";
    if (hasEvent) classes += " event-dot";
    html +=
      '<div class="' +
      classes +
      '" data-day="' +
      cell +
      '">' +
      (cell !== "" ? cell : "") +
      "</div>";
  }
  html += "</div>";

  const widget = document.getElementById("miniCalendarWidget");
  widget.innerHTML = html;

  document.getElementById("calPrevBtn").addEventListener("click", function () {
    changeDisplayMonth(-1);
  });
  document.getElementById("calNextBtn").addEventListener("click", function () {
    changeDisplayMonth(1);
  });

  widget.querySelectorAll(".cal-day[data-day]").forEach(function (el) {
    el.addEventListener("click", function () {
      const dayVal = parseInt(el.getAttribute("data-day"), 10);
      if (isNaN(dayVal) || !dayVal) return;
      widget.querySelectorAll(".cal-day").forEach(function (d) {
        if (!d.classList.contains("today")) d.classList.remove("selected");
      });
      if (!el.classList.contains("today")) el.classList.add("selected");
      selectedDay = dayVal;
      showDayEvents(currentDisplayYear, currentDisplayMonth, dayVal);
    });
  });
}

function renderSchedule() {
  const container = document.getElementById("scheduleList");
  const items = getScheduledPosts().slice().sort(function (a, b) {
    return a.start - b.start;
  });

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state"><div>No scheduled events</div></div>';
    return;
  }

  container.innerHTML = items
    .map(function (item) {
      const timeRaw = item.start.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      });
      const dateTime =
        item.start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        ", " +
        formatTimeRange(item.start, item.end);
      const priorityBadge =
        item.priority === "high"
          ? '<span class="priority-badge">High Priority</span>'
          : item.priority === "low"
          ? '<span class="priority-badge">Low Priority</span>'
          : "";
      return (
        '<div class="schedule-item"><div class="schedule-info">' +
        '<div class="schedule-title">' +
        escapeHtml(item.title) +
        '<span class="time-badge">' +
        escapeHtml(timeRaw) +
        "</span>" +
        priorityBadge +
        "</div>" +
        '<div class="schedule-datetime"><span>' +
        escapeHtml(dateTime) +
        "</span>" +
        (item.location ? "<span>" + escapeHtml(item.location) + "</span>" : "") +
        "</div></div></div>"
      );
    })
    .join("");
}

function getTypeClass(type) {
  if (type === "memo") return "memo";
  if (type === "order") return "order";
  if (type === "travel") return "travel";
  return "announcement";
}

function getTypeLabel(type) {
  if (type === "announcement") return "Announcement";
  if (type === "memo") return "Memo";
  if (type === "order") return "Office Order";
  if (type === "travel") return "Travel Order";
  return "Notice";
}

function getCardBorderClass(type) {
  if (type === "announcement") return "announcement-card";
  if (type === "memo") return "memo-card";
  if (type === "order") return "order-card";
  if (type === "travel") return "travel-card";
  return "announcement-card";
}

function updateUrgentCounter() {
  document.getElementById("urgentCount").innerText = posts.filter(function (p) {
    return p.urgent;
  }).length;
}

function renderFeed() {
  let filtered = posts.filter(function (item) {
    if (currentFilter !== "all" && item.type !== currentFilter) return false;
    if (currentSearch.trim() !== "") {
      const s = currentSearch.toLowerCase();
      return (
        item.title.toLowerCase().includes(s) ||
        (item.preview && item.preview.toLowerCase().includes(s))
      );
    }
    return true;
  });

  if (currentSort === "latest") {
    filtered.sort(function (a, b) {
      return b.date - a.date;
    });
  } else if (currentSort === "urgent") {
    filtered.sort(function (a, b) {
      return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || b.date - a.date;
    });
  } else if (currentSort === "pinned") {
    filtered.sort(function (a, b) {
      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date - a.date;
    });
  }

  const container = document.getElementById("feedStream");
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div>No matching posts</div></div>';
    return;
  }

  container.innerHTML = filtered
    .map(function (item) {
      return (
        '<div class="feed-item ' +
        getCardBorderClass(item.type) +
        " " +
        (item.pinned ? "pinned-feed" : "") +
        '" data-post-id="' +
        escapeHtml(item.id) +
        '" style="cursor:pointer;" role="button" tabindex="0">' +
        '<div class="feed-header">' +
        '<span class="feed-type ' +
        getTypeClass(item.type) +
        '">' +
        escapeHtml(getTypeLabel(item.type)) +
        "</span>" +
        (item.pinned ? '<span class="pin-label">Pinned</span>' : "") +
        "</div>" +
        '<div class="feed-title">' +
        escapeHtml(item.title) +
        (item.urgent ? '<span class="urgent-tag">URGENT</span>' : "") +
        "</div>" +
        (item.preview
          ? '<div class="feed-preview">' + escapeHtml(item.preview) + "</div>"
          : "") +
        "</div>"
      );
    })
    .join("");
}

function refreshAll() {
  renderCalendar();
  renderSchedule();
  updateUrgentCounter();
  renderFeed();
}

function initFeedClicks() {
  const container = document.getElementById("feedStream");
  container.addEventListener("click", function (e) {
    const card = e.target.closest(".feed-item[data-post-id]");
    if (!card) return;
    const post = posts.find(function (p) {
      return p.id === card.getAttribute("data-post-id");
    });
    if (post) showPostDetail(post);
  });
  container.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".feed-item[data-post-id]");
    if (!card) return;
    e.preventDefault();
    const post = posts.find(function (p) {
      return p.id === card.getAttribute("data-post-id");
    });
    if (post) showPostDetail(post);
  });
}

function initEvents() {
  initFeedClicks();
  document.querySelectorAll(".filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderFeed();
    });
  });
  document.getElementById("searchInput").addEventListener("input", function (e) {
    currentSearch = e.target.value;
    renderFeed();
  });
  document.getElementById("sortSelect").addEventListener("change", function (e) {
    currentSort = e.target.value;
    renderFeed();
  });
}

function initFirestore() {
  const feedStream = document.getElementById("feedStream");
  feedStream.innerHTML = '<div class="empty-state"><div>Loading posts...</div></div>';

  db.collection("posts").onSnapshot(
    function (snapshot) {
      posts = snapshot.docs.map(docToPost);
      refreshAll();
    },
    function (err) {
      console.error("Firestore error:", err);
      feedStream.innerHTML =
        '<div class="empty-state"><div>Unable to load posts. Check Firestore rules and connection.</div></div>';
    }
  );
}

initEvents();
initFirestore();


