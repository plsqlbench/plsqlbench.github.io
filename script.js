const state = {
  data: null,
  splitId: "development",
  taskId: "development_overall",
  metricId: "mean_test_pass"
};

const leaderboardDataUrl = "data/leaderboard.json?v=20260617noscored";

const splitOptions = [
  { id: "development", label: "Development" },
  { id: "test", label: "Test" }
];

const taskPresentation = {
  development_overall: { splitId: "development", datasetLabel: "Overall" },
  mbpp: { splitId: "development", datasetLabel: "MBPP" },
  spider: { splitId: "development", datasetLabel: "Spider1" },
  stack: { splitId: "development", datasetLabel: "Stack" },
  spider2_st_dev: { splitId: "development", datasetLabel: "Spider2-ST" },
  spider2_mt_dev: { splitId: "development", datasetLabel: "Spider2-MT" },
  test_overall: { splitId: "test", datasetLabel: "Overall" },
  spider2_st_test: { splitId: "test", datasetLabel: "Spider2-ST" },
  spider2_mt_test: { splitId: "test", datasetLabel: "Spider2-MT" }
};

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

const getTaskPresentation = (task) => taskPresentation[task.id] ?? {
  splitId: null,
  datasetLabel: task.shortLabel
};

const getLeaderboardTasks = () => state.data.tasks.filter((task) => task.id !== "overall");

const getTasksForSelectedSplit = () => getLeaderboardTasks()
  .filter((task) => getTaskPresentation(task).splitId === state.splitId);

const getSelectedSplit = () => splitOptions.find((item) => item.id === state.splitId) ?? splitOptions[0];

const getSelectedTask = () => (
  state.data.tasks.find((item) => item.id === state.taskId) ?? getTasksForSelectedSplit()[0]
);

const ensureTaskForSplit = () => {
  const tasks = getTasksForSelectedSplit();
  if (!tasks.some((task) => task.id === state.taskId)) {
    state.taskId = tasks[0]?.id ?? state.taskId;
  }
};

const rankEntries = (entries, taskId, metricId) => {
  const rows = entries.map((entry, index) => ({
    entry,
    index,
    score: getScore(entry, taskId, metricId),
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

const renderSplitTabs = () => {
  const tabs = document.querySelector("#split-tabs");
  tabs.innerHTML = "";

  splitOptions.forEach((split) => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.textContent = split.label;
    button.setAttribute("aria-selected", String(split.id === state.splitId));
    button.addEventListener("click", () => {
      state.splitId = split.id;
      ensureTaskForSplit();
      render();
    });
    tabs.appendChild(button);
  });
};

const renderTabs = () => {
  const tabs = document.querySelector("#task-tabs");
  tabs.innerHTML = "";

  getTasksForSelectedSplit().forEach((task) => {
    const presentation = getTaskPresentation(task);
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.textContent = presentation.datasetLabel;
    button.setAttribute("aria-selected", String(task.id === state.taskId));
    button.addEventListener("click", () => {
      state.taskId = task.id;
      render();
    });
    tabs.appendChild(button);
  });
};

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
  const task = getSelectedTask();
  const split = getSelectedSplit();
  const summary = document.querySelector("#task-summary");
  const note = document.querySelector("#task-note");

  const items = [
    [task.unit === "conversations" ? "Conversations" : "Instances", formatNumber(task.instances), task.unit],
    ["Databases", task.databaseCount === null ? "n/a" : formatNumber(task.databaseCount), "schemas"],
    ["Avg. Tests", task.averageTests === null ? "n/a" : formatNumber(task.averageTests), "per task"],
    ["Split", split.label, "Table 1"]
  ];

  summary.innerHTML = items
    .map(([label, value, detail]) => (
      `<div class="summary-item"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`
    ))
    .join("");

  note.textContent = `${task.description} Scores are percentages from the paper: Table 2 for Mean Test Pass@1, Table 5 for single-turn Suite Pass@1, and Table 6 for Spider2-MT strict metrics.`;
};

const renderLeaderboard = () => {
  const task = getSelectedTask();
  const metric = getSelectedMetric();
  const head = document.querySelector("#leaderboard-head");
  const body = document.querySelector("#leaderboard-body");
  const caption = document.querySelector("#table-caption");

  const ranked = rankEntries(state.data.entries, state.taskId, state.metricId);
  const scoredCount = ranked.filter((row) => row.score !== null).length;
  const bestScore = Math.max(...state.data.entries.map((entry) => getScore(entry, state.taskId, state.metricId) ?? -Infinity));

  caption.textContent = `${task.label} ranked by ${metric.label} (%)`;

  head.innerHTML = `
    <tr>
      <th scope="col">Rank</th>
      <th scope="col">Model</th>
      <th scope="col">Score</th>
    </tr>
  `;

  if (!ranked.length) {
    body.innerHTML = '<tr><td colspan="3">No entries yet.</td></tr>';
    return;
  }

  body.innerHTML = ranked.map(({ entry, score, rank }) => {
    const method = entry.link
      ? `<a href="${escapeHtml(entry.link)}" target="_blank" rel="noreferrer">${escapeHtml(entry.method)}</a>`
      : escapeHtml(entry.method);
    const organization = entry.organization || entry.category || "";
    const rankLabel = rank === null ? "-" : rank;
    const isBest = score !== null && Number.isFinite(bestScore) && score === bestScore;
    const scoreMarkup = score === null
      ? '<span class="score-missing">n/a</span>'
      : `<strong>${formatScore(score)}</strong>`;

    return `
      <tr>
        <td class="rank-cell"><strong>${rankLabel}</strong></td>
        <td class="method-cell">
          <strong>${method}</strong>
          <span>${escapeHtml(organization)}</span>
        </td>
        <td class="score-cell${isBest ? " is-best" : ""}">${scoreMarkup}</td>
      </tr>
    `;
  }).join("");

  if (scoredCount === 0) {
    caption.textContent = `${metric.label} is not reported for ${task.label}`;
  }
};

const renderDatasetTable = () => {
  const body = document.querySelector("#dataset-body");
  body.innerHTML = state.data.tasks
    .filter((task) => !["overall", "development_overall", "test_overall"].includes(task.id))
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
  renderSplitTabs();
  renderTabs();
  renderTaskSummary();
  renderLeaderboard();
};

const hydrate = (data) => {
  state.data = data;
  state.splitId = data.defaultSplit ?? "development";
  state.taskId = data.defaultTask;
  state.metricId = data.defaultMetric;
  ensureTaskForSplit();
  renderMetricSelect();
  renderDatasetTable();
  render();

  if (window.lucide) {
    window.lucide.createIcons();
  }
};

const showLoadError = (error) => {
  const body = document.querySelector("#leaderboard-body");
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
