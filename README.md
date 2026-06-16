# PLSQLBENCH GitHub Pages Site

This repository is ready to publish at:

```text
https://plsqlbench.github.io/
```

Create or use the GitHub organization/user `plsqlbench`, create a repository named
`plsqlbench.github.io`, and push these root-level files to the default branch.
GitHub Pages will publish the site automatically for an organization/user Pages repo.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Updating results

Edit `data/leaderboard.json`. Numeric scores are ranked automatically; missing scores
remain visible as pending validation.
