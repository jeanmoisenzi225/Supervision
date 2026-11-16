/** Thème clair ou sombre (v0.38.0) : choix mémorisé sur l'appareil ; sombre par défaut. */
export type Theme = "dark" | "light";
const KEY = "supervision.theme";

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // Stockage indisponible (navigation privée) : thème par défaut.
  }
  return "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f1efe9" : "#0d0e10");
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Pas de mémorisation possible : le thème reste valable jusqu'à la fermeture.
  }
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}
