const state = { data: null, trackId: null, metricId: null };
const leaderboardDataUrl = "data/leaderboard.json?v=20260826comparison";

const formatNumber = (value) => Number(value).toLocaleString("en-US", {
  maximumFractionDigits: 1
});
const formatScore = (score) => score === null ? "—" : Number(score).toFixed(2);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

const getTrack = () => state.data.tracks.find((track) => track.id === state.trackId)
  ?? state.data.tracks[0];
const getScore = (entry, taskId) => (
  taskId && typeof entry.scores?.[taskId] === "number" ? entry.scores[taskId] : null
);

const rankEntries = (entries, taskId) => entries
  .map((entry, index) => ({ entry, index, score: getScore(entry, taskId), rank: null }))
  .sort((a, b) => {
    if (a.score === null && b.score === null) return a.index - b.index;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score || a.entry.method.localeCompare(b.entry.method);
  })
  .map((row, index, rows) => {
    if (row.score === null) return row;
    const previous = rows[index - 1];
    row.rank = previous?.score === row.score ? previous.rank : index + 1;
    return row;
  });

const renderTabs = () => {
  const tabs = document.querySelector("#task-tabs");
  tabs.innerHTML = "";
  state.data.tracks.forEach((track) => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.textContent = track.label;
    button.setAttribute("aria-selected", String(track.id === state.trackId));
    button.addEventListener("click", () => {
      state.trackId = track.id;
      render();
    });
    tabs.appendChild(button);
  });
};

const formatSetting = (setting) => {
  if (!setting.taskId) return "Not reported";
  const scale = setting.turns
    ? formatNumber(setting.instances) + " conv. · " + formatNumber(setting.turns) + " turns"
    : formatNumber(setting.instances) + " instances";
  return setting.databases ? scale + " · " + formatNumber(setting.databases) + " DBs" : scale;
};

const renderTaskSummary = () => {
  const track = getTrack();
  const summary = document.querySelector("#task-summary");
  const note = document.querySelector("#task-note");
  summary.innerHTML = [
    ["Development", formatSetting(track.development)],
    ["Test", formatSetting(track.test)]
  ].map(([label, value]) => (
    '<div class="summary-item"><span>' + label + '</span><strong>' + value + "</strong></div>"
  )).join("");
  note.textContent = track.description
    + " Scores are Mean Test Pass@1 (%); rows are ranked by the test column.";
};

const renderLeaderboard = () => {
  const track = getTrack();
  const head = document.querySelector("#leaderboard-head");
  const body = document.querySelector("#leaderboard-body");
  const caption = document.querySelector("#table-caption");
  const rows = rankEntries(state.data.entries, track.test.taskId);
  const bestDev = Math.max(...rows.map((row) => getScore(row.entry, track.development.taskId) ?? -Infinity));
  const bestTest = Math.max(...rows.map((row) => getScore(row.entry, track.test.taskId) ?? -Infinity));
  const metric = state.data.metrics.find((item) => item.id === state.metricId);

  caption.textContent = track.label + " · " + metric.label + " (%)";
  head.innerHTML = '<tr><th scope="col">Rank</th><th scope="col">System</th>'
    + '<th scope="col" class="comparison-head">Development</th>'
    + '<th scope="col" class="comparison-head">Test</th></tr>';
  body.innerHTML = rows.map(({ entry, rank }) => {
    const devScore = getScore(entry, track.development.taskId);
    const testScore = getScore(entry, track.test.taskId);
    const devClass = devScore !== null && devScore === bestDev ? " is-best" : "";
    const testClass = testScore !== null && testScore === bestTest ? " is-best" : "";
    return '<tr><td class="rank-cell"><strong>' + (rank ?? "—") + "</strong></td>"
      + '<td class="method-cell"><strong>' + escapeHtml(entry.method) + "</strong>"
      + "<span>" + escapeHtml(entry.organization) + "</span></td>"
      + '<td class="score-cell' + devClass + '">' + formatScore(devScore) + "</td>"
      + '<td class="score-cell comparison-test' + testClass + '">' + formatScore(testScore) + "</td></tr>";
  }).join("");
};

const renderDatasetTable = () => {
  document.querySelector("#dataset-body").innerHTML = state.data.benchmarkComposition.map((task) => (
    "<tr><td><strong>" + task.label + "</strong></td><td>" + task.instances + "</td><td>"
      + (task.databaseCount === null ? "n/a" : formatNumber(task.databaseCount)) + "</td><td>"
      + task.averageTests + "</td><td>" + escapeHtml(task.description) + "</td></tr>"
  )).join("");
};

const render = () => {
  renderTabs();
  renderTaskSummary();
  renderLeaderboard();
};

const init = async () => {
  const response = await fetch(leaderboardDataUrl);
  if (!response.ok) throw new Error("HTTP " + response.status);
  state.data = await response.json();
  state.trackId = state.data.defaultTrack;
  state.metricId = state.data.defaultMetric;
  renderDatasetTable();
  render();
  if (window.lucide) window.lucide.createIcons();
};

init().catch((error) => {
  document.querySelector("#leaderboard-body").innerHTML =
    '<tr><td colspan="4">Failed to load leaderboard data: ' + escapeHtml(error.message) + "</td></tr>";
});
