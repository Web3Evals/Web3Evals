# claude-final-blog

Publish-ready draft of the system-prompt ablation blog for web3evals.com.

- `blog.md` — the post. Image links point at `figures/light/`; swap to `figures/dark/` for the dark-mode build.
- `figures/light/`, `figures/dark/` — F1–F7 as PNG (220 dpi) and SVG, one theme (based on the original F2 style: Arial/Helvetica, C3 blue, C8 orange, everything else muted).
- `figures/make_figures.py` — regenerates every figure and table from `../pre_live_claude/data.json`. Run `python3 make_figures.py`.
- `tables/` — `table01_condition_design` and `table02_outcomes_and_process` as CSV + Markdown (already embedded in the post).

Figure map (old shortlisted name → new):

| New | Replaces | Note |
|---|---|---|
| F1_leaderboard | F1_leaderboard | unchanged |
| F2_breadth_vs_repeatability | F2_breadth_vs_repeatability | unchanged (style reference) |
| F3_accumulation | F4_accumulation | fig03_discovery_accumulation dropped (duplicate) |
| F4_listed_vs_omitted | F7_listed_vs_omitted | unchanged |
| F5_cost_frontier | fig02_cost_performance_frontier | re-themed; y-axis now "expected groups from one run" to match F1 |
| F6_prompt_length | fig04_prompt_size_vs_performance | re-themed; x-axis uses as-sent tokens everywhere |
| F7_repository_dependence | fig05_repository_dependence | re-themed heatmap |

Post section map (v2): Intro + F1 → Overview (1. breadth vs repeatability: F2, F3 · 2. listed vs omitted: F4 · 3. prompt length + cost: F6, F5) → Methodology (table01, C3 block) → Results (table02) → Qualitative analysis → Limitations and future work → citation.

F7_repository_dependence is generated but not used in the post (repository-dependence section was dropped; one sentence in Limitations covers it).

All token counts in the post are "as sent" (study tokenizer, whole file incl. front matter), which is the column shown in F1.
