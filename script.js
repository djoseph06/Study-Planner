const calendarGrid = document.querySelector("#calendar-grid");
const calendarHeading = document.querySelector("#calendar-heading");
const calendarView = document.querySelector("#calendar-view");
const previousButton = document.querySelector("#previous-week");
const nextButton = document.querySelector("#next-week");
const todayButton = document.querySelector("#today-button");

let selectedDate = new Date();
selectedDate.setHours(12, 0, 0, 0);

// Start with a daily view on smaller screens.
if (window.matchMedia("(max-width: 760px)").matches) {
  calendarView.value = "day";
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getVisibleDates() {
  const start = new Date(selectedDate);

  if (calendarView.value === "week") {
    // JavaScript counts Sunday as 0; our week starts on Monday.
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  }

  const numberOfDays = calendarView.value === "week" ? 7 : 1;

  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function renderCalendar() {
  calendarGrid.replaceChildren();

  const dates = getVisibleDates();
  const isWeek = calendarView.value === "week";
  const todayKey = dateKey(new Date());

  calendarGrid.dataset.view = calendarView.value;
  calendarGrid.style.setProperty("--day-count", dates.length);

  const headingFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  calendarHeading.textContent = isWeek
    ? `${headingFormat.format(dates[0])} – ${headingFormat.format(dates[6])}`
    : headingFormat.format(dates[0]);

  previousButton.setAttribute(
    "aria-label",
    isWeek ? "Previous week" : "Previous day"
  );

  nextButton.setAttribute(
    "aria-label",
    isWeek ? "Next week" : "Next day"
  );

  // Top-left corner of the timetable.
  const corner = document.createElement("div");
  corner.className = "calendar-corner";
  corner.textContent = "Time";
  calendarGrid.append(corner);

  // One heading for each visible date.
  for (const date of dates) {
    const header = document.createElement("div");
    header.className = "day-header";

    const weekday = document.createElement("span");
    weekday.textContent = date.toLocaleDateString("en-GB", {
      weekday: "short",
    });

    const dayNumber = document.createElement("strong");
    dayNumber.textContent = date.getDate();

    if (dateKey(date) === todayKey) {
      header.classList.add("is-today");
      header.setAttribute("aria-current", "date");
    }

    header.append(weekday, dayNumber);
    calendarGrid.append(header);
  }

  // Build all 24 hours, so early or late events can be shown later.
  for (let hour = 0; hour < 24; hour++) {
    const timeLabel = document.createElement("div");
    timeLabel.className = "hour-label";
    timeLabel.textContent = `${String(hour).padStart(2, "0")}:00`;
    calendarGrid.append(timeLabel);

    for (const date of dates) {
      const slot = document.createElement("div");
      slot.className = "calendar-slot";
      slot.dataset.date = dateKey(date);
      slot.dataset.hour = String(hour);

      if (dateKey(date) === todayKey) {
        slot.classList.add("today-slot");
      }

      calendarGrid.append(slot);
    }
  }

  renderEvents();
}

previousButton.addEventListener("click", () => {
  const days = calendarView.value === "week" ? 7 : 1;
  selectedDate.setDate(selectedDate.getDate() - days);
  renderCalendar();
});

nextButton.addEventListener("click", () => {
  const days = calendarView.value === "week" ? 7 : 1;
  selectedDate.setDate(selectedDate.getDate() + days);
  renderCalendar();
});

todayButton.addEventListener("click", () => {
  selectedDate = new Date();
  selectedDate.setHours(12, 0, 0, 0);
  renderCalendar();
});

calendarView.addEventListener("change", renderCalendar);



// Initially scroll to 08:00 while keeping earlier hours accessible.
requestAnimationFrame(() => {
  const morningSlot = calendarGrid.querySelector('[data-hour="8"]');
  const scrollArea = document.querySelector("#calendar-scroll");
  const header = calendarGrid.querySelector(".day-header");

  if (morningSlot && header) {
    scrollArea.scrollTop =
      morningSlot.offsetTop - header.offsetHeight;
  }
});

const eventDialog = document.querySelector("#event-dialog");
const eventForm = document.querySelector("#event-form");
const eventError = document.querySelector("#event-error");
const repeatSelect = document.querySelector("#event-repeat");
const repeatUntil = document.querySelector("#event-repeat-until");
const plannerMessage = document.querySelector("#planner-message");

const EVENTS_KEY = "orbit-calendar-events-v1";
const eventCategories = [
  "lecture",
  "study",
  "personal",
  "extracurricular",
];

let events = [];

function parseDate(value) {
  return new Date(`${value}T12:00:00`);
}

function isValidDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = parseDate(value);
  return !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value;
}

function isValidTime(value) {
  return typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeInMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidEvent(event) {
  return event &&
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    event.title.trim().length > 0 &&
    event.title.length <= 100 &&
    eventCategories.includes(event.category) &&
    isValidDate(event.date) &&
    isValidTime(event.start) &&
    isValidTime(event.end) &&
    event.start < event.end &&
    typeof event.location === "string" &&
    typeof event.notes === "string" &&
    (
      event.repeat === "none" ||
      (
        event.repeat === "weekly" &&
        isValidDate(event.until) &&
        event.until >= event.date
      )
    );
}

function occursOn(event, date) {
  const key = dateKey(date);

  if (event.repeat === "none") {
    return event.date === key;
  }

  return key >= event.date &&
    key <= event.until &&
    date.getDay() === parseDate(event.date).getDay();
}

// Check whether two events share any occurrence date.
function shareDate(first, second) {
  if (first.repeat === "none") {
    return occursOn(second, parseDate(first.date));
  }

  if (second.repeat === "none") {
    return occursOn(first, parseDate(second.date));
  }

  const firstWeekday = parseDate(first.date).getDay();
  const secondWeekday = parseDate(second.date).getDay();

  if (firstWeekday !== secondWeekday) return false;

  const start = first.date > second.date ? first.date : second.date;
  const end = first.until < second.until ? first.until : second.until;

  if (start > end) return false;

  const nextOccurrence = parseDate(start);
  const daysAhead = (firstWeekday - nextOccurrence.getDay() + 7) % 7;
  nextOccurrence.setDate(nextOccurrence.getDate() + daysAhead);

  return dateKey(nextOccurrence) <= end;
}

function saveEvents() {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    return true;
  } catch {
    plannerMessage.textContent =
      "The event is visible but couldn't be saved. Keep this tab open.";
    return false;
  }
}

function updateRepeatField() {
  const repeating = repeatSelect.value === "weekly";

  document.querySelector("#repeat-until-field").hidden = !repeating;
  repeatUntil.required = repeating;
  repeatUntil.disabled = !repeating;
  repeatUntil.min = document.querySelector("#event-date").value;
}

function openEventForm(date = dateKey(selectedDate), hour = 9) {
  eventForm.reset();
  eventError.textContent = "";

  document.querySelector("#event-date").value = date;
  document.querySelector("#event-start").value =
    `${String(hour).padStart(2, "0")}:00`;

  document.querySelector("#event-end").value =
    hour === 23
      ? "23:59"
      : `${String(hour + 1).padStart(2, "0")}:00`;

  updateRepeatField();
  eventDialog.showModal();
  document.querySelector("#event-title").focus();
}

document.querySelector("#add-event").addEventListener("click", () => {
  openEventForm();
});

document.querySelectorAll(
  '[data-close-dialog="event-dialog"]'
).forEach((button) => {
  button.addEventListener("click", () => eventDialog.close());
});

repeatSelect.addEventListener("change", updateRepeatField);

document.querySelector("#event-date").addEventListener(
  "change",
  updateRepeatField
);

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  eventError.textContent = "";

  const entry = {
    id: crypto.randomUUID(),
    title: document.querySelector("#event-title").value.trim(),
    category: document.querySelector("#event-category").value,
    date: document.querySelector("#event-date").value,
    start: document.querySelector("#event-start").value,
    end: document.querySelector("#event-end").value,
    location: document.querySelector("#event-location").value.trim(),
    notes: document.querySelector("#event-notes").value.trim(),
    repeat: repeatSelect.value,
    until: repeatSelect.value === "weekly" ? repeatUntil.value : "",
  };

  if (!isValidEvent(entry)) {
    eventError.textContent =
      "Check the title and dates. End time must be after start time.";
    return;
  }

  const conflict = events.find((existing) =>
    entry.start < existing.end &&
    entry.end > existing.start &&
    shareDate(entry, existing)
  );

  if (conflict) {
    eventError.textContent =
      `This overlaps with "${conflict.title}". Choose another time.`;
    return;
  }

  events.push(entry);

  if (saveEvents()) {
    plannerMessage.textContent = "Event saved.";
  }

  // Show the date containing the new event.
  selectedDate = parseDate(entry.date);
  eventDialog.close();
  renderCalendar();

  const slot = calendarGrid.querySelector(
    `[data-date="${entry.date}"]` +
    `[data-hour="${Number(entry.start.split(":")[0])}"]`
  );

  if (slot) {
    const scrollArea = document.querySelector("#calendar-scroll");
    const header = calendarGrid.querySelector(".day-header");
    scrollArea.scrollTop = slot.offsetTop - header.offsetHeight;
  }
});

function renderEvents() {
  calendarGrid.querySelectorAll(".calendar-event").forEach(
    (block) => block.remove()
  );

  const enabledCategories = [
    ...document.querySelectorAll(".calendar-filter input:checked"),
  ].map((input) => input.value);

  for (const date of getVisibleDates()) {
    for (const event of events) {
      if (!occursOn(event, date) ||
          !enabledCategories.includes(event.category)) {
        continue;
      }

      const startMinutes = timeInMinutes(event.start);
      const duration = timeInMinutes(event.end) - startMinutes;
      const hour = Math.floor(startMinutes / 60);

      const slot = calendarGrid.querySelector(
        `[data-date="${dateKey(date)}"][data-hour="${hour}"]`
      );

      if (!slot) continue;

      const block = document.createElement("div");
      block.className = "calendar-event";
      block.dataset.category = event.category;
      block.tabIndex = 0;

      // Each hour occupies 64 pixels in our calendar.
      block.style.top = `${(startMinutes % 60) / 60 * 64}px`;
      block.style.height = `${duration / 60 * 64}px`;

      const title = document.createElement("strong");
      title.textContent = event.title;

      const time = document.createElement("span");
      time.textContent = `${event.start}–${event.end}`;

      const category = document.createElement("span");
      category.textContent =
        event.category.charAt(0).toUpperCase() + event.category.slice(1);

      const details = [
        event.title,
        time.textContent,
        category.textContent,
        event.location,
        event.notes,
      ].filter(Boolean).join(" · ");

      block.title = details;
      block.setAttribute("aria-label", details);

      block.append(title, time, category);
      slot.append(block);
    }
  }
}

// Click an empty time slot to prepare an event.
calendarGrid.addEventListener("click", (event) => {
  if (event.target.closest(".calendar-event")) return;

  const slot = event.target.closest(".calendar-slot");

  if (slot) {
    openEventForm(slot.dataset.date, Number(slot.dataset.hour));
  }
});

document.querySelectorAll(".calendar-filter input").forEach((input) => {
  input.addEventListener("change", renderEvents);
});

try {
  const saved = localStorage.getItem(EVENTS_KEY);

  if (saved !== null) {
    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed) || !parsed.every(isValidEvent)) {
      throw new Error("Invalid saved events");
    }

    events = parsed;
  }
} catch {
  plannerMessage.textContent =
    "Saved events couldn't be loaded. New events will start a fresh list.";
}

renderCalendar();