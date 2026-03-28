(() => {
	const DB_URL = "dril.db";
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
			els.progressBar.style.width = `${pct}%`;
			els.loadingText.textContent = `Downloading archive... ${(
				received / 1024 / 1024
			).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`;
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
			els.loadingText.textContent = `Failed to load: ${err.message}`;
			els.progressBar.style.background = "#ff4444";
			console.error(err);
		}
	}

	function escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	function formatDate(isoString) {
		const d = new Date(isoString);
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	function buildQuery(input) {
		const terms = input
			.trim()
			.split(/\s+/)
			.filter((t) => t.length > 0)
			.map((t) => t.replace(/["*^()]/g, ""))
			.filter((t) => t.length > 0)
			.map((t) => `"${t}"*`);
		return terms.join(" ");
	}

	function buildLikePattern(input) {
		return `%${input.trim().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
	}

	function searchFts(input) {
		const query = buildQuery(input);
		const stmt = db.prepare(
			`SELECT t.id, t.text, t.created_at, t.is_reply, t.reply_to_user
                 FROM posts_fts f
                 JOIN posts t ON t.rowid = f.rowid
                 WHERE posts_fts MATCH ?
                 ORDER BY rank
                 LIMIT 50`,
		);
		stmt.bind([query]);
		const rows = [];
		while (stmt.step()) {
			rows.push(stmt.get());
		}
		stmt.free();
		return rows;
	}

	function searchLike(input) {
		const pattern = buildLikePattern(input);
		const stmt = db.prepare(
			`SELECT id, text, created_at, is_reply, reply_to_user
                 FROM posts
                 WHERE text LIKE ? ESCAPE '\\'
                 ORDER BY id
                 LIMIT 50`,
		);
		stmt.bind([pattern]);
		const rows = [];
		while (stmt.step()) {
			rows.push(stmt.get());
		}
		stmt.free();
		return rows;
	}

	function renderRows(rows) {
		let html = "";
		for (const [id, text, created_at, is_reply, reply_to_user] of rows) {
			const url = `https://x.com/dril/status/${id}`;
			html += `<div class="post">`;
			if (is_reply && reply_to_user) {
				html += `<div class="post-reply-to">replying to @${escapeHtml(
					reply_to_user,
				)}</div>`;
			}
			html += `<div class="post-text">${escapeHtml(text)}</div>`;
			html += `<div class="post-meta">`;
			html += `${formatDate(
				created_at,
			)} · <a href="${url}" target="_blank" rel="noopener">view on X</a>`;
			html += `</div></div>`;
		}
		return html;
	}

	function search(input) {
		if (!db) return;
		const trimmed = input.trim();
		if (!trimmed) {
			els.results.innerHTML = "";
			return;
		}

		try {
			let rows;
			try {
				rows = searchFts(trimmed);
			} catch (_ftsErr) {
				rows = searchLike(trimmed);
			}
			const html = renderRows(rows);
			els.results.innerHTML =
				html || `<p style="color:#666;margin-top:20px;">no results</p>`;
		} catch (err) {
			console.error("Search error:", err);
			els.results.innerHTML = "";
		}
	}

	let debounceTimer = null;
	function onInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => search(els.searchInput.value), 120);
	}

	els.searchInput.addEventListener("input", onInput);

	init();
})();
