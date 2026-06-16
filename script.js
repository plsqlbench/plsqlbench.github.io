const state = {
  data: null,
  taskId: "overall",
  metricId: "mean_test_pass",
  category: "all"
};

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
  }
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 1
  });
};

const getScore = (entry, taskId, metricId) => {
  const taskScores = entry.scores?.[taskId];
  const value = taskScores?.[metricId];
  return typeof value === "number" ? value : null;
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

const renderTabs = () => {
  const tabs = document.querySelector("#task-tabs");
  tabs.innerHTML = "";

  state.data.tasks.forEach((task) => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.textContent = task.shortLabel;
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

const renderCategorySelect = () => {
  const select = document.querySelector("#category-select");
  select.value = state.category;
  select.addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });
};

const renderTaskSummary = () => {
  const task = state.data.tasks.find((item) => item.id === state.taskId);
  const metric = state.data.metrics.find((item) => item.id === state.metricId);
  const summary = document.querySelector("#task-summary");

  const items = [
    ["Task family", task.label],
    ["Scale", `${formatNumber(task.instances)} ${task.unit}`],
    ["Databases", task.databaseCount === null ? "n/a" : formatNumber(task.databaseCount)],
    ["Metric", metric.shortLabel]
  ];

  if (task.turns) {
    items[1] = ["Scale", `${formatNumber(task.instances)} conversations / ${formatNumber(task.turns)} turns`];
  }

  summary.innerHTML = items
    .map(([label, value]) => (
      `<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`
    ))
    .join("");
};

const renderLeaderboard = () => {
  const task = state.data.tasks.find((item) => item.id === state.taskId);
  const metric = state.data.metrics.find((item) => item.id === state.metricId);
  const body = document.querySelector("#leaderboard-body");
  const caption = document.querySelector("#table-caption");
  const updated = document.querySelector("#updated-label");

  const visibleEntries = state.data.entries.filter((entry) => (
    state.category === "all" || entry.category === state.category
  ));

  const ranked = rankEntries(visibleEntries, state.taskId, state.metricId);
  const scoredCount = ranked.filter((row) => row.score !== null).length;

  caption.textContent = `${task.label} ranked by ${metric.label}`;
  updated.textContent = `Updated ${state.data.updated}`;

  if (!ranked.length) {
    body.innerHTML = '<tr><td colspan="6">No entries match this filter.</td></tr>';
    return;
  }

  body.innerHTML = ranked.map(({ entry, score, rank }) => {
    const method = entry.link
      ? `<a href="${entry.link}" target="_blank" rel="noreferrer">${entry.method}</a>`
      : entry.method;
    const status = score === null
      ? '<span class="pending-pill">Pending validation</span>'
      : '<span class="category-pill">Official</span>';
    const rankLabel = rank === null ? "-" : rank;
    const scoreLabel = score === null ? "Pending" : score.toFixed(2);

    return `
      <tr>
        <td class="rank-cell">${rankLabel}</td>
        <td class="method-cell">
          <strong>${method}</strong>
          <span>${entry.organization}</span>
        </td>
        <td><span class="category-pill">${entry.category}</span></td>
        <td>${entry.date}</td>
        <td class="score-cell">${scoreLabel}</td>
        <td>${status}</td>
      </tr>
    `;
  }).join("");

  if (scoredCount === 0) {
    caption.textContent = `${task.label} ranking is ready; official scores have not been published yet`;
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
        <td class="muted">${task.description}</td>
      </tr>
    `)
    .join("");
};

const render = () => {
  renderTabs();
  renderTaskSummary();
  renderLeaderboard();
};

const init = async () => {
  const response = await fetch("data/leaderboard.json");
  state.data = await response.json();
  state.taskId = state.data.defaultTask;
  state.metricId = state.data.defaultMetric;

  renderMetricSelect();
  renderCategorySelect();
  renderDatasetTable();
  render();

  if (window.lucide) {
    window.lucide.createIcons();
  }
};

init().catch((error) => {
  const body = document.querySelector("#leaderboard-body");
  body.innerHTML = `<tr><td colspan="6">Failed to load leaderboard data: ${error.message}</td></tr>`;
});
