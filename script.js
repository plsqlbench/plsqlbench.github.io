const state = {
  data: null,
  metricId: "mean_test_pass"
};

const leaderboardDataUrl = "data/leaderboard.json?v=20260617";

const loadLeaderboardDataSync = () => {
  if (typeof XMLHttpRequest === "undefined") {
    return null;
  }

  try {
    const request = new XMLHttpRequest();
    request.open("GET", leaderboardDataUrl, false);
    request.send(null);

    if ((request.status >= 200 && request.status < 300) || request.status === 0) {
      return JSON.parse(request.responseText);
    }
  } catch (error) {
    console.warn("Synchronous leaderboard load failed; falling back to fetch.", error);
  }

  return null;
};

const loadLeaderboardData = async () => {
  const response = await fetch(leaderboardDataUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
  }

  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 1
  });
};

const normalizeScore = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue <= 1 ? numericValue * 100 : numericValue;
};

const formatScore = (value) => normalizeScore(value).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[character]));

const getScore = (entry, taskId, metricId) => {
  const taskScores = entry.scores?.[taskId];
  const value = taskScores?.[metricId];
  return typeof value === "number" ? value : null;
};

const getTaskColumns = () => state.data.tasks;

const getSortTaskId = () => (
  state.metricId === "episode_pass" || state.metricId === "turn_suite_pass"
    ? "spider2_mt"
    : state.data.defaultTask
);

const rankEntries = (entries, metricId) => {
  const sortTaskId = getSortTaskId();
  const rows = entries.map((entry, index) => ({
    entry,
    index,
    score: getScore(entry, sortTaskId, metricId),
    rank: null
  }));

  const scored = rows
    .filter((row) => row.score !== null)
    .sort((a, b) => b.score - a.score || a.entry.method.localeCompare(b.entry.method));

  let previousScore = null;
  let previousRank = 0;
  scored.forEach((row, index) => {
    if (previousScore === null || row.score !== previousScore) {
      previousRank = index + 1;
      previousScore = row.score;
    }
    row.rank = previousRank;
  });

  const pending = rows
    .filter((row) => row.score === null)
    .sort((a, b) => a.index - b.index);

  return [...scored, ...pending];
};

const getSelectedMetric = () => state.data.metrics.find((item) => item.id === state.metricId);

const renderMetricSelect = () => {
  const select = document.querySelector("#metric-select");
  select.innerHTML = "";

  state.data.metrics.forEach((metric) => {
    const option = document.createElement("option");
    option.value = metric.id;
    option.textContent = metric.label;
    select.appendChild(option);
  });

  select.value = state.metricId;
  select.addEventListener("change", (event) => {
    state.metricId = event.target.value;
    render();
  });
};

const renderTaskSummary = () => {
  const overall = state.data.tasks.find((item) => item.id === state.data.defaultTask);
  const summary = document.querySelector("#task-summary");
  const note = document.querySelector("#task-note");

  const items = [
    ["Instances", formatNumber(overall.instances), overall.unit],
    ["Datasets", formatNumber(state.data.tasks.length - 1), "reported columns"],
    ["Databases", formatNumber(overall.databaseCount), "schemas"],
    ["Entries", formatNumber(state.data.entries.length), "methods"]
  ];

  summary.innerHTML = items
    .map(([label, value, detail]) => (
      `<div class="summary-item"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`
    ))
    .join("");

  note.textContent = "Scores are percentages from the paper: Table 2 for Mean Test Pass@1, Table 5 for single-turn Suite Pass@1, and Table 6 for Spider2-MT strict metrics.";
};

const renderLeaderboard = () => {
  const metric = getSelectedMetric();
  const columns = getTaskColumns();
  const head = document.querySelector("#leaderboard-head");
  const body = document.querySelector("#leaderboard-body");
  const caption = document.querySelector("#table-caption");
  const updated = document.querySelector("#updated-label");

  const ranked = rankEntries(state.data.entries, state.metricId);
  const scoredCount = ranked.filter((row) => row.score !== null).length;
  const columnBestScores = Object.fromEntries(columns.map((task) => [
    task.id,
    Math.max(...state.data.entries.map((entry) => getScore(entry, task.id, state.metricId) ?? -Infinity))
  ]));

  const rankBasis = columns.find((task) => task.id === getSortTaskId())?.shortLabel ?? "Overall";
  caption.textContent = `${metric.label} by dataset (%)`;
  updated.textContent = `${scoredCount}/${ranked.length} ranked by ${rankBasis}`;

  head.innerHTML = `
    <tr>
      <th scope="col">Rank</th>
      <th scope="col">Model</th>
      ${columns.map((task) => `<th scope="col">${escapeHtml(task.shortLabel)}</th>`).join("")}
    </tr>
  `;

  if (!ranked.length) {
    body.innerHTML = `<tr><td colspan="${columns.length + 2}">No entries yet.</td></tr>`;
    return;
  }

  body.innerHTML = ranked.map(({ entry, score, rank }) => {
    const method = entry.link
      ? `<a href="${escapeHtml(entry.link)}" target="_blank" rel="noreferrer">${escapeHtml(entry.method)}</a>`
      : escapeHtml(entry.method);
    const organization = entry.organization || entry.category || "";
    const rankLabel = rank === null ? "-" : rank;
    const scoreCells = columns.map((task) => {
      const taskScore = getScore(entry, task.id, state.metricId);
      const bestScore = columnBestScores[task.id];
      const isBest = taskScore !== null && Number.isFinite(bestScore) && taskScore === bestScore;
      const className = `score-number${isBest ? " is-best" : ""}`;
      const content = taskScore === null
        ? '<span class="score-missing">n/a</span>'
        : formatScore(taskScore);
      return `<td class="${className}">${content}</td>`;
    }).join("");

    return `
      <tr>
        <td class="rank-cell"><strong>${rankLabel}</strong></td>
        <td class="method-cell">
          <strong>${method}</strong>
          <span>${escapeHtml(organization)}</span>
        </td>
        ${scoreCells}
      </tr>
    `;
  }).join("");

  if (scoredCount === 0) {
    caption.textContent = `${metric.label} is not available for the selected leaderboard rows`;
  }
};

const renderDatasetTable = () => {
  const body = document.querySelector("#dataset-body");
  body.innerHTML = state.data.tasks
    .filter((task) => task.id !== "overall")
    .map((task) => `
      <tr>
        <td><strong>${task.label}</strong></td>
        <td>${formatNumber(task.instances)} ${task.turns ? `conversations / ${formatNumber(task.turns)} turns` : task.unit}</td>
        <td>${task.databaseCount === null ? "n/a" : formatNumber(task.databaseCount)}</td>
        <td>${task.averageTests === null ? "n/a" : formatNumber(task.averageTests)}</td>
        <td>${escapeHtml(task.description)}</td>
      </tr>
    `)
    .join("");
};

const render = () => {
  renderTaskSummary();
  renderLeaderboard();
};

const hydrate = (data) => {
  state.data = data;
  state.metricId = data.defaultMetric;
  renderMetricSelect();
  renderDatasetTable();
  render();

  if (window.lucide) {
    window.lucide.createIcons();
  }
};

const showLoadError = (error) => {
  const body = document.querySelector("#leaderboard-body");
  const updated = document.querySelector("#updated-label");
  updated.textContent = "Load failed";
  body.innerHTML = `<tr><td>Failed to load leaderboard data: ${escapeHtml(error.message)}</td></tr>`;
};

const init = () => {
  const syncData = loadLeaderboardDataSync();
  if (syncData) {
    hydrate(syncData);
    return;
  }

  loadLeaderboardData()
    .then(hydrate)
    .catch(showLoadError);
};

init();
