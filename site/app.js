(function () {
  "use strict";

  const DB_URL = "dril.db";
  // deno-lint-ignore no-unused-vars
  let db = null;

  const els = {
    loading: document.getElementById("loading"),
    progressBar: document.getElementById("progress-bar"),
    loadingText: document.getElementById("loading-text"),
    searchContainer: document.getElementById("search-container"),
    searchInput: document.getElementById("search-input"),
    results: document.getElementById("results"),
  };

  async function fetchWithProgress(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const contentLength = response.headers.get("Content-Length");
    if (!contentLength || !response.body) {
      els.loadingText.textContent = "Downloading archive...";
      const buf = await response.arrayBuffer();
      return new Uint8Array(buf);
    }

    const total = parseInt(contentLength, 10);
    let received = 0;
    const chunks = [];
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const pct = Math.round((received / total) * 100);
      els.progressBar.style.width = pct + "%";
      els.loadingText.textContent = `Downloading archive... ${
        (received / 1024 / 1024).toFixed(1)
      } / ${(total / 1024 / 1024).toFixed(1)} MB`;
    }

    const result = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  async function init() {
    try {
      const dbData = await fetchWithProgress(DB_URL);

      els.progressBar.style.width = "100%";
      els.loadingText.textContent = "Preparing search...";

      const SQL = await initSqlJs({
        locateFile: (file) =>
          `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`,
      });

      db = new SQL.Database(dbData);

      els.loading.classList.add("hidden");
      els.searchContainer.classList.remove("hidden");
      els.searchInput.focus();
    } catch (err) {
      els.loadingText.textContent = "Failed to load: " + err.message;
      els.progressBar.style.background = "#ff4444";
      console.error(err);
    }
  }

  init();
})();
