const THEME_KEY = "orbit-theme";
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

let preferredTheme = null;

try {
  const savedTheme = localStorage.getItem(THEME_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    preferredTheme = savedTheme;
  }
} catch {
  // The switch still works if browser storage is unavailable.
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const button = document.querySelector("#theme-toggle");

  if (button) {
    const isDark = theme === "dark";
    button.textContent = `Dark mode: ${isDark ? "on" : "off"}`;
    button.setAttribute("aria-pressed", String(isDark));
  }
}

// Apply the theme before the page appears.
applyTheme(
  preferredTheme || (systemTheme.matches ? "dark" : "light")
);

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(document.documentElement.dataset.theme);

  document.querySelector("#theme-toggle").addEventListener("click", () => {
    preferredTheme =
      document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark";

    applyTheme(preferredTheme);

    try {
      localStorage.setItem(THEME_KEY, preferredTheme);
    } catch {
      // Keep the selected theme active for this visit.
    }
  });
});

// Follow device settings until the user chooses a theme.
systemTheme.addEventListener("change", (event) => {
  if (!preferredTheme) {
    applyTheme(event.matches ? "dark" : "light");
  }
});