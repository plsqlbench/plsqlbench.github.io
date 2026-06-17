# PLSQLBENCH Website

This directory contains a static benchmark website for GitHub Pages.

## Local preview

From the repository root:

```bash
python3 -m http.server 4173 --directory docs
```

Then open `http://127.0.0.1:4173/`.

## Updating leaderboard results

Edit `docs/data/leaderboard.json`. Add numeric percentages under each entry's `scores` object:

```json
{
  "method": "Example Agent",
  "organization": "Example Lab",
  "category": "Proprietary",
  "date": "2026-06-16",
  "setting": "Agent",
  "link": "https://example.com",
  "scores": {
    "overall": { "mean_test_pass": 42.5 },
    "spider2_st": { "mean_test_pass": 51.2, "suite_pass": 34.0 },
    "spider2_mt": { "mean_test_pass": 24.1, "episode_pass": 8.2, "turn_suite_pass": 18.7 }
  }
}
```

Rows with numeric scores are ranked automatically. Missing task/metric pairs are displayed as `n/a`.
