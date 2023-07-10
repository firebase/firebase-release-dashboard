/**
 * Load the Google Sans font.
 */
export function loadGoogleFont() {
  const link = document.createElement("link");
  link.href = "https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap";
  link.rel = "stylesheet";

  document.head.appendChild(link);
}

