"use client";

/** The only client-side JavaScript in the app. */
export function ThemeToggle() {
  return (
    <button
      className="theme-toggle"
      onClick={() => {
        const html = document.documentElement;
        const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
        html.setAttribute("data-theme", next);
        try {
          localStorage.setItem("rasti-theme", next);
        } catch {
          // localStorage can throw in private-browsing / storage-restricted contexts.
        }
      }}
    >
      Theme
    </button>
  );
}
