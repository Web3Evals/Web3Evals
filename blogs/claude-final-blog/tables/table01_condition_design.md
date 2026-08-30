| Condition | Treatment | What it adds | Taxonomy | Prompt tokens (as sent) |
|---|---|---|---|---|
| C0 | Minimal general | Task framing + shared output contract only | None | 477 |
| C1 | + Role / persona | C0 + 46-word senior-auditor persona | None | 541 |
| C2 | + Methodology | C0 + 7-step review procedure (map, state, arithmetic, symmetry, safety justification) | None | 1176 |
| C3 | + Output schema | C0 + reporting requirements: actionable, precisely located, one root cause per finding, justified severity | None | 650 |
| C4 | + Evidence requirement | C0 + precondition, call trace, missing check, priced impact, self-refutation; do not report without a trace | None | 802 |
| C5 | Lean taxonomy | C0 + 27 vulnerability classes with one-line mechanism + examples | Lean | 1737 |
| C6 | Detailed taxonomy | C0 + 27 classes, each with mechanism, 5 red flags, historical example | Detailed | 6637 |
| C7 | Taxonomy headers only | C0 + 27 class headings (with short parentheticals) | Headers | 838 |
| C8 | Full combined | Role + task + methodology + detailed taxonomy + evidence requirement | Detailed | 7719 |
| C9 | Length-matched generic | C0 + ~6k tokens of secure-development prose, no vulnerability classes (length control for C6) | None | 6338 |
