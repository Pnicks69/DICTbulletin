// Public schedule viewer – search by employee ID
let currentSearchId = null;

function updateDateTime() {
  const now = new Date();
  const dateElem = document.getElementById("currentDateText");
  if (dateElem) {
    dateElem.innerText = now.toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value.toDate) {
    try {
      const d = value.toDate();
      return d instanceof Date ? d : null;
    } catch { return null; }
  }
  return null;
}

async function searchEmployeeSchedule() {
  const input = document.getElementById("employeeIdInput").value.trim();
  const statusDiv = document.getElementById("searchStatus");
  const resultsDiv = document.getElementById("scheduleResults");
  
  if (!input) {
    statusDiv.innerHTML = '<span class="error">❌ Please enter an Employee ID</span>';
    resultsDiv.innerHTML = '<div class="empty-state">👈 Enter an Employee ID and click Search</div>';
    return;
  }
  
  statusDiv.innerHTML = '<span class="loading">🔍 Searching...</span>';
  resultsDiv.innerHTML = '<div class="empty-state">Loading...</div>';
  
  try {
    // 1. Find user by employeeId
    const usersQuery = await db.collection("users")
      .where("employeeId", "==", input)
      .limit(1)
      .get();
    
    if (usersQuery.empty) {
      statusDiv.innerHTML = `<span class="error">❌ No employee found with ID "${escapeHtml(input)}"</span>`;
      resultsDiv.innerHTML = '<div class="empty-state">😕 No schedule available for this ID.</div>';
      return;
    }
    
    const userDoc = usersQuery.docs[0];
    const userData = userDoc.data();
    const employeeName = userData.username || userData.email || "Employee";
    const employeeId = userData.employeeId || input;
    
    // 2. Fetch all schedules for this employeeId
    const schedulesQuery = await db.collection("schedules")
      .where("employeeId", "==", employeeId)
      .get();
    
    const schedules = [];
    schedulesQuery.forEach(doc => {
      const data = doc.data();
      schedules.push({
        id: doc.id,
        title: data.title || "Untitled",
        description: data.description || "",
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location || ""
      });
    });
    
    // Sort by date (earliest first)
    schedules.sort((a, b) => (toJsDate(a.date) || 0) - (toJsDate(b.date) || 0));
    
    if (schedules.length === 0) {
      statusDiv.innerHTML = `<span class="success">✅ Found employee: ${escapeHtml(employeeName)} (ID: ${escapeHtml(employeeId)}) – No schedules yet.</span>`;
      resultsDiv.innerHTML = `
        <div class="employee-info-card">
          <div class="employee-name">${escapeHtml(employeeName)}</div>
          <div class="employee-id">ID: ${escapeHtml(employeeId)}</div>
        </div>
        <div class="empty-state">📅 No schedules have been assigned.</div>
      `;
      return;
    }
    
    // Build schedule display
    let scheduleHtml = `
      <div class="employee-info-card">
        <div class="employee-name">${escapeHtml(employeeName)}</div>
        <div class="employee-id">ID: ${escapeHtml(employeeId)}</div>
        <div class="schedule-count">📋 ${schedules.length} schedule(s) found</div>
      </div>
    `;
    
    for (const s of schedules) {
      const dateObj = toJsDate(s.date);
      const formattedDate = dateObj ? dateObj.toLocaleDateString(undefined, { 
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
      }) : "Date TBD";
      
      scheduleHtml += `
        <div class="schedule-entry-card">
          <div class="schedule-entry-header">
            <span class="schedule-date">📅 ${escapeHtml(formattedDate)}</span>
            <span class="schedule-time">⏰ ${escapeHtml(s.startTime)} – ${escapeHtml(s.endTime)}</span>
          </div>
          <div class="schedule-title">${escapeHtml(s.title)}</div>
          ${s.description ? `<div class="schedule-desc">${escapeHtml(s.description)}</div>` : ''}
          ${s.location ? `<div class="schedule-location">📍 ${escapeHtml(s.location)}</div>` : ''}
        </div>
      `;
    }
    
    statusDiv.innerHTML = `<span class="success">✅ Showing schedule for ${escapeHtml(employeeName)} (ID: ${escapeHtml(employeeId)})</span>`;
    resultsDiv.innerHTML = scheduleHtml;
    
  } catch (error) {
    console.error("Search error:", error);
    statusDiv.innerHTML = `<span class="error">❌ Error loading schedule. Please try again later.</span>`;
    resultsDiv.innerHTML = '<div class="empty-state">⚠️ Unable to load schedule. Check your connection.</div>';
  }
}

function clearSearch() {
  document.getElementById("employeeIdInput").value = "";
  document.getElementById("searchStatus").innerHTML = "";
  document.getElementById("scheduleResults").innerHTML = '<div class="empty-state">👈 Enter an Employee ID and click Search</div>';
  currentSearchId = null;
}

function initSearch() {
  const searchBtn = document.getElementById("searchBtn");
  const clearBtn = document.getElementById("clearBtn");
  const input = document.getElementById("employeeIdInput");
  
  searchBtn.addEventListener("click", searchEmployeeSchedule);
  clearBtn.addEventListener("click", clearSearch);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchEmployeeSchedule();
  });
}

updateDateTime();
setInterval(updateDateTime, 60000);
initSearch();