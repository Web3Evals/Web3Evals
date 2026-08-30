"""Blog figures for the system-prompt study, one theme (F2 style), light + dark.
Reads ../../pre_live_claude/data.json. Usage: python make_figures.py
"""
import json, os, csv
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "..", "..", "pre_live_claude", "data.json")))
CONDS = [f"C{i}" for i in range(10)]
R, PR, C = D["recall"], D["process"], D["conditions"]
FOOTER = "deepseek-v4-flash-0731 · 3 repositories × 3 replicates per condition · 27 consolidated golden bug groups · readjudication full-text + recovery arm"

THEMES = {
 "light": dict(surface="#fcfcfb", text="#0b0b0b", text2="#52514e", muted="#8a8985", grid="#e6e5e1",
               bar_muted="#c9c8c3", c3="#2a78d6", c8="#eb6834", blue="#2a78d6", orange="#eb6834", ext="#e3e2de",
               seq=["#f0efec", "#bcd6f5", "#7fb0ec", "#3f86dc", "#1c5cab"], seq_text=["#52514e", "#0b0b0b", "#0b0b0b", "#ffffff", "#ffffff"]),
 "dark":  dict(surface="#1a1a19", text="#ffffff", text2="#c3c2b7", muted="#8f8e88", grid="#33332f",
               bar_muted="#4a4946", c3="#3987e5", c8="#d95926", blue="#3987e5", orange="#d95926", ext="#2e2e2b",
               seq=["#262624", "#1f3f66", "#1c5cab", "#3987e5", "#9ec5f4"], seq_text=["#8f8e88", "#c3c2b7", "#ffffff", "#ffffff", "#0b0b0b"]),
}

def cc(c, T): return T["c3"] if c == "C3" else T["c8"] if c == "C8" else T["bar_muted"]
def bold(c): return "bold" if c in ("C3", "C8") else "normal"
def label(c): return f"{c}  {C[c]['treatment']}"

def setup(T):
    plt.rcParams.update({
        "figure.facecolor": T["surface"], "axes.facecolor": T["surface"], "savefig.facecolor": T["surface"],
        "text.color": T["text"], "axes.labelcolor": T["text2"], "xtick.color": T["text2"], "ytick.color": T["text2"],
        "axes.edgecolor": T["grid"], "axes.linewidth": 0.8, "grid.color": T["grid"], "grid.linewidth": 0.8,
        "font.family": ["Arial", "Helvetica Neue", "Helvetica", "DejaVu Sans"], "font.size": 10.5,
        "axes.titlesize": 13, "axes.titleweight": "bold", "axes.titlelocation": "left", "axes.titlepad": 10,
        "axes.spines.top": False, "axes.spines.right": False, "legend.frameon": False, "svg.fonttype": "none",
    })

def finish(fig, name, T, out):
    fig.text(0.01, 0.012, FOOTER, fontsize=8, color=T["muted"], ha="left", va="bottom")
    fig.savefig(os.path.join(out, f"{name}.png"), dpi=220, bbox_inches="tight", pad_inches=0.35)
    fig.savefig(os.path.join(out, f"{name}.svg"), bbox_inches="tight", pad_inches=0.35)
    plt.close(fig)

def heading(fig, T, title, subtitle, y=0.955, gap=0.05):
    fig.text(0.02, y, title, fontsize=16, fontweight="bold", color=T["text"], ha="left", va="top")
    fig.text(0.02, y - gap, subtitle, fontsize=10, color=T["text2"], ha="left", va="top", linespacing=1.4)

# ------------------------------------------------ F1 leaderboard
def f1(T, out):
    order = sorted(CONDS, key=lambda c: (-R[c]["exp_1run"], -R[c]["majority27"], -R[c]["union27"]))
    fig, ax = plt.subplots(figsize=(13, 7.2)); fig.subplots_adjust(left=0.24, right=0.62, top=0.78, bottom=0.12)
    y = np.arange(len(order))[::-1]
    for yi, c in zip(y, order):
        ax.barh(yi, R[c]["union_3runs"], height=0.58, color=T["ext"], edgecolor="none")
        ax.barh(yi, R[c]["exp_1run"], height=0.58, color=cc(c, T), edgecolor=T["surface"], linewidth=1)
        ax.text(R[c]["exp_1run"] + 0.15, yi, f"{R[c]['exp_1run']:.1f}", va="center", ha="left", fontsize=10.5, fontweight="bold", color=T["text"])
        ax.text(R[c]["union_3runs"] + 0.15, yi, f"{R[c]['union_3runs']}", va="center", ha="left", fontsize=9.5, color=T["muted"])
    ax.set_yticks(y); ax.set_yticklabels([label(c) for c in order], fontsize=11)
    for tl, c in zip(ax.get_yticklabels(), order): tl.set_color(T["text"]); tl.set_fontweight(bold(c))
    ax.set_xlim(0, 11.5); ax.set_xticks(range(0, 12, 2)); ax.grid(axis="x"); ax.set_axisbelow(True)
    ax.spines["left"].set_visible(False); ax.tick_params(axis="y", length=0)
    ax.set_xlabel("Golden bug groups recovered (of 27)")
    heading(fig, T, "Expected golden bug groups from a single audit run",
            "Solid bar = mean groups found by one run per repository, summed over the 3 repositories.\nFaint bar = ceiling after unioning all 3 replicates.")
    cols = [("Union\n/27", lambda c: str(R[c]["union27"])), ("Majority\n/27", lambda c: str(R[c]["majority27"])),
            ("Findings\n/run", lambda c: f"{PR[c]['findings_per_run']:.1f}"), ("Cost\n/run", lambda c: f"${PR[c]['cost_mean']:.3f}"),
            ("Prompt tok\n(as sent)", lambda c: f"{C[c]['as_sent_tokens']:,}")]
    xs = [0.665, 0.735, 0.81, 0.885, 0.965]; fig.canvas.draw()
    for x, (h, fn) in zip(xs, cols):
        fig.text(x, 0.80, h, fontsize=8.5, color=T["muted"], ha="right", va="bottom")
        for yi, c in zip(y, order):
            yy = ax.transData.transform((0, yi))[1] / fig.bbox.height
            b = (h.startswith("Union") and c == "C8") or (h.startswith("Majority") and c == "C3")
            fig.text(x, yy, fn(c), fontsize=10.5, color=T["text"] if b else T["text2"], ha="right", va="center", fontweight="bold" if b else "normal")
    finish(fig, "F1_leaderboard", T, out)

# ------------------------------------------------ F2 breadth vs repeatability
def f2(T, out):
    fig, ax = plt.subplots(figsize=(9.5, 7)); fig.subplots_adjust(left=0.1, right=0.97, top=0.8, bottom=0.12)
    pts = {}
    for c in CONDS: pts.setdefault((R[c]["union27"], R[c]["majority27"]), []).append(c)
    front = [c for c in CONDS if not any(o != c and R[o]["union27"] >= R[c]["union27"] and R[o]["majority27"] >= R[c]["majority27"]
             and (R[o]["union27"] > R[c]["union27"] or R[o]["majority27"] > R[c]["majority27"]) for o in CONDS)]
    front = sorted(front, key=lambda c: R[c]["union27"])
    ax.plot([R[c]["union27"] for c in front], [R[c]["majority27"] for c in front], color=T["muted"], lw=1.2, ls="--", zorder=1)
    ax.text(R[front[-1]]["union27"] - 0.1, R[front[-1]]["majority27"] + 0.35, "Pareto frontier", fontsize=9, color=T["muted"], ha="right")
    for (u, m), cs in pts.items():
        size = 60 + 0.055 * max(C[c]["as_sent_tokens"] for c in cs)
        col = cc(cs[0], T) if len(cs) == 1 else T["bar_muted"]
        ax.scatter(u, m, s=size, color=col, edgecolor=T["surface"], linewidth=1.5, zorder=3)
        txt = ", ".join(cs) if len(cs) > 1 else f"{cs[0]}  {C[cs[0]]['treatment']}"
        dx, dy = 0.14, 0.22
        if cs[0] == "C7": dy = -0.42
        ax.annotate(txt, (u, m), xytext=(u + dx, m + dy), fontsize=10.5, color=T["text"], fontweight=bold(cs[0]))
    ax.set_xlim(5.2, 10.8); ax.set_ylim(1.2, 6.9); ax.grid(True); ax.set_axisbelow(True)
    ax.set_xlabel("Breadth — distinct groups found in any of 9 runs (union, of 27)")
    ax.set_ylabel("Repeatability — groups found in ≥2 of 3 replicates (majority, of 27)")
    heading(fig, T, "Breadth and repeatability have different winners",
            "C8 finds the most distinct bugs but rarely the same one twice; C3 finds fewer, and finds them again.\n"
            "Marker size ∝ as-sent prompt tokens. Co-located conditions share a marker.", gap=0.045)
    finish(fig, "F2_breadth_vs_repeatability", T, out)

# ------------------------------------------------ F3 accumulation
def f3(T, out):
    fig, ax = plt.subplots(figsize=(9.5, 6.5)); fig.subplots_adjust(left=0.09, right=0.76, top=0.8, bottom=0.12)
    x = [1, 2, 3]; ends = {}
    for c in CONDS:
        ys = [R[c]["exp_1run"], R[c]["exp_2runs"], R[c]["union_3runs"]]; acc = c in ("C3", "C8")
        ax.plot(x, ys, color=cc(c, T), lw=2.6 if acc else 1.4, marker="o", ms=7 if acc else 5, mec=T["surface"], mew=1.2, zorder=3 if acc else 2)
        ends.setdefault(ys[-1], []).append(c)
    pretty = {"C3": "C3 (6.0 → 7.3 → 8)", "C8": "C8 (4.3 → 7.3 → 10)"}
    for yv, cs in ends.items():
        acc = any(c in ("C3", "C8") for c in cs)
        ax.text(3.08, yv, ", ".join(pretty.get(c, c) for c in cs), va="center", fontsize=10.5, color=T["text"] if acc else T["text2"], fontweight="bold" if acc else "normal")
    ax.set_xticks(x); ax.set_xticklabels(["1 run", "2 runs", "3 runs"]); ax.set_xlim(0.85, 3.5)
    ax.set_ylim(2, 10.6); ax.grid(axis="y"); ax.set_axisbelow(True)
    ax.set_xlabel("Independent runs per repository (union of findings)"); ax.set_ylabel("Expected golden bug groups (of 27)")
    heading(fig, T, "C8 overtakes C3 only when three runs are unioned",
            "Mean over all subsets of the three observed replicates per repository, summed over the three repositories.\n"
            "Descriptive re-use of the same 3 replicates — not a forecast for fresh runs.", gap=0.045)
    finish(fig, "F3_accumulation", T, out)

# ------------------------------------------------ F4 listed vs omitted
def f4(T, out):
    fig, ax = plt.subplots(figsize=(11, 5.8)); fig.subplots_adjust(left=0.08, right=0.98, top=0.74, bottom=0.14)
    x = np.arange(10); w = 0.38
    li = [100 * R[c]["listed11"] / 11 for c in CONDS]; om = [100 * R[c]["omitted16"] / 16 for c in CONDS]
    ax.bar(x - w / 2, li, w, color=T["orange"], label="Listed classes (11 groups) — named in the C5–C8 taxonomy", edgecolor=T["surface"], linewidth=1)
    ax.bar(x + w / 2, om, w, color=T["blue"], label="Omitted classes (16 groups) — state-machine, input validation, other logic", edgecolor=T["surface"], linewidth=1)
    for xi, (a, b) in enumerate(zip(li, om)):
        ax.text(xi - w / 2, a + 1, f"{R[CONDS[xi]]['listed11']}", ha="center", va="bottom", fontsize=9, color=T["text2"])
        ax.text(xi + w / 2, b + 1, f"{R[CONDS[xi]]['omitted16']}", ha="center", va="bottom", fontsize=9, color=T["text2"])
    ax.set_xticks(x); ax.set_xticklabels(CONDS, fontsize=11)
    for tl, c in zip(ax.get_xticklabels(), CONDS): tl.set_fontweight(bold(c))
    ax.set_ylim(0, 60); ax.grid(axis="y"); ax.set_axisbelow(True); ax.set_ylabel("Union recall within class partition (%)")
    ax.axvspan(4.5, 8.5, color=T["grid"], alpha=0.45, zorder=0)
    ax.text(6.5, 57, "taxonomy in prompt (C5–C8)", ha="center", va="top", fontsize=9.5, color=T["muted"])
    ax.legend(loc="upper left", fontsize=9.5, bbox_to_anchor=(0, 1.0))
    heading(fig, T, "Naming vulnerability classes did not raise recall on those classes",
            "Bars = fraction of each partition recovered (labels = group counts). Only the full combined prompt C8 lifts listed-class recall;\n"
            "every other taxonomy prompt does as well or better on the classes it never mentioned.", gap=0.055)
    finish(fig, "F4_listed_vs_omitted", T, out)

# ------------------------------------------------ F5 cost frontier
def f5(T, out):
    fig, ax = plt.subplots(figsize=(9.5, 6.5)); fig.subplots_adjust(left=0.1, right=0.97, top=0.8, bottom=0.12)
    xs = {c: PR[c]["cost_mean"] for c in CONDS}; ys = {c: R[c]["exp_1run"] for c in CONDS}
    front = [c for c in CONDS if not any(o != c and xs[o] <= xs[c] and ys[o] >= ys[c] and (xs[o] < xs[c] or ys[o] > ys[c]) for o in CONDS)]
    front = sorted(front, key=lambda c: xs[c])
    ax.plot([xs[c] for c in front], [ys[c] for c in front], color=T["muted"], lw=1.2, ls="--", zorder=1)
    ax.text(xs[front[0]] + 0.0004, (ys[front[0]] + ys[front[-1]]) / 2, "Pareto frontier", fontsize=9, color=T["muted"], ha="left", rotation=0)
    offs = {"C0": (0.0006, -0.22), "C1": (0.0006, -0.22), "C2": (0.0006, 0.1), "C3": (0.0007, 0.08), "C4": (0.0006, -0.22),
            "C5": (0.0006, 0.1), "C6": (0.0006, 0.1), "C7": (-0.0007, 0.1), "C8": (-0.0007, -0.28), "C9": (0.0006, -0.22)}
    for c in CONDS:
        ax.scatter(xs[c], ys[c], s=60 + 0.055 * C[c]["as_sent_tokens"], color=cc(c, T), edgecolor=T["surface"], linewidth=1.5, zorder=3)
        dx, dy = offs[c]
        ax.annotate(c if c not in ("C3", "C8") else f"{c}  {C[c]['treatment']}", (xs[c], ys[c]), xytext=(xs[c] + dx, ys[c] + dy),
                    fontsize=10.5, color=T["text"], fontweight=bold(c), ha="right" if dx < 0 else "left")
    ax.set_xlim(0.063, 0.096); ax.set_ylim(2, 6.8); ax.grid(True); ax.set_axisbelow(True)
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"${v:.3f}"))
    ax.set_xlabel("Mean cost per audit run (USD, pinned fp8 rates)"); ax.set_ylabel("Expected golden bug groups from one run (of 27)")
    heading(fig, T, "C3 sits on the cost–performance frontier",
            "Each point averages nine runs. Cost is dominated by reading the repository, not by the prompt: all ten conditions land within \\$0.066–\\$0.092.\n"
            "Marker size ∝ as-sent prompt tokens.", gap=0.045)
    finish(fig, "F5_cost_frontier", T, out)

# ------------------------------------------------ F6 prompt length
def f6(T, out):
    fig, axes = plt.subplots(1, 2, figsize=(13, 6), sharex=True); fig.subplots_adjust(left=0.07, right=0.98, top=0.76, bottom=0.14, wspace=0.18)
    xs = {c: C[c]["as_sent_tokens"] for c in CONDS}
    for ax, key, ylab, ttl in ((axes[0], "union27", "Union over 3 replicates (of 27)", "Breadth"), (axes[1], "majority27", "Majority, ≥2 of 3 replicates (of 27)", "Repeatability")):
        ax.plot([xs["C6"], xs["C9"]], [R["C6"][key], R["C9"][key]], color=T["muted"], lw=1.2, ls=":", zorder=1)
        for c in CONDS:
            ax.scatter(xs[c], R[c][key], s=110, color=cc(c, T), edgecolor=T["surface"], linewidth=1.5, zorder=3, marker="s" if c == "C9" else "o")
        if key == "union27":
            offs = {"C0": (-4, -14), "C1": (4, 6), "C2": (4, 6), "C3": (4, -14), "C4": (4, -14), "C5": (4, -14), "C6": (-6, 8), "C7": (4, 6), "C8": (-6, -15), "C9": (6, -14)}
        else:
            offs = {"C0": (-4, -14), "C1": (4, 6), "C2": (4, 6), "C3": (4, 6), "C4": (4, -14), "C5": (4, 6), "C6": (-6, 8), "C7": (4, -14), "C8": (-6, 8), "C9": (6, -14)}
        for c in CONDS:
            ax.annotate(c, (xs[c], R[c][key]), xytext=offs[c], textcoords="offset points", fontsize=10.5, color=T["text"], fontweight=bold(c), ha="right" if offs[c][0] < 0 else "left")
        ax.set_xscale("log"); ax.set_xticks([500, 1000, 2000, 4000, 8000]); ax.set_xticklabels(["500", "1k", "2k", "4k", "8k"])
        ax.set_xlim(380, 11000); ax.grid(True); ax.set_axisbelow(True); ax.set_ylabel(ylab); ax.set_xlabel("System-prompt tokens as sent (log scale)")
        ax.set_title(ttl, pad=10)
    axes[0].set_ylim(5, 11); axes[1].set_ylim(1, 7)
    heading(fig, T, "Prompt length does not buy recall",
            "C6 (detailed 27-class taxonomy) and C9 (generic security prose, square marker, length-matched to C6) land on the same point in both panels.\n"
            "The 650-token C3 beats every prompt over 6,000 tokens on repeatability.", y=0.97, gap=0.06)
    finish(fig, "F6_prompt_length", T, out)

# ------------------------------------------------ F7 repository heatmap
def f7(T, out):
    repos = ["reNFT", "Noya", "BendDAO"]
    order = sorted(CONDS, key=lambda c: (-R[c]["union27"], -R[c]["majority27"]))
    fig, ax = plt.subplots(figsize=(10.5, 7.6)); fig.subplots_adjust(left=0.24, right=0.9, top=0.8, bottom=0.1)
    n = len(order)
    for i, c in enumerate(order):
        yi = n - 1 - i
        for j, repo in enumerate(repos):
            pr = R[c]["per_repo"][repo]; frac = pr["union"] / pr["denominator"]
            k = min(4, int(round(frac / 0.18)))
            ax.add_patch(Rectangle((j + 0.04, yi + 0.04), 0.92, 0.92, facecolor=T["seq"][k], edgecolor="none"))
            ax.text(j + 0.5, yi + 0.5, f"{pr['union']} / {pr['majority']}", ha="center", va="center", fontsize=11.5, color=T["seq_text"][k], fontweight=bold(c))
    ax.set_yticks([n - 1 - i + 0.5 for i in range(n)]); ax.set_yticklabels([label(c) for c in order], fontsize=11)
    for tl, c in zip(ax.get_yticklabels(), order): tl.set_color(T["text"]); tl.set_fontweight(bold(c))
    dens = {r: R["C0"]["per_repo"][r]["denominator"] for r in repos}
    ax.set_xticks([j + 0.5 for j in range(3)]); ax.set_xticklabels([f"{r}\n({dens[r]} groups)" for r in repos], fontsize=11)
    ax.set_xlim(0, 3); ax.set_ylim(0, n); ax.tick_params(length=0)
    for s in ax.spines.values(): s.set_visible(False)
    for k in range(5):
        fig.patches.append(Rectangle((0.60 + k * 0.05, 0.025), 0.035, 0.02, transform=fig.transFigure, facecolor=T["seq"][k], edgecolor="none"))
    fig.text(0.595, 0.035, "union recall within repo:  0%", ha="right", va="center", fontsize=9, color=T["text2"])
    fig.text(0.60 + 5 * 0.05, 0.035, "≥70%", ha="left", va="center", fontsize=9, color=T["text2"])
    heading(fig, T, "Recall depended strongly on the repository",
            "Cell = union / majority group counts for that repository. Colour = union recall within the repository.\n"
            "reNFT was nearly a desert for every prompt; no condition reproduced a reNFT bug in two of three runs.", gap=0.045)
    finish(fig, "F7_repository_dependence", T, out)

# ------------------------------------------------ tables
def tables():
    out = os.path.join(HERE, "..", "tables"); os.makedirs(out, exist_ok=True)
    rows = [["Condition", "Treatment", "What it adds", "Taxonomy", "Prompt tokens (as sent)"]]
    tax = {"C5": "Lean", "C6": "Detailed", "C7": "Headers", "C8": "Detailed"}
    for c in CONDS: rows.append([c, C[c]["treatment"], C[c]["adds"], tax.get(c, "None"), C[c]["as_sent_tokens"]])
    with open(os.path.join(out, "table01_condition_design.csv"), "w", newline="") as f: csv.writer(f).writerows(rows)
    with open(os.path.join(out, "table01_condition_design.md"), "w") as f:
        f.write("| " + " | ".join(rows[0]) + " |\n|" + "---|" * len(rows[0]) + "\n")
        for r in rows[1:]: f.write("| " + " | ".join(str(x) for x in r) + " |\n")
    rows = [["Condition", "Union /27", "Majority /27", "Found 3/3", "Listed /11", "Omitted /16", "Groups/run", "Findings /run", "Cost /run", "Turns", "Tool calls", "Grep calls"]]
    for c in CONDS:
        p = PR[c]; r = R[c]
        rows.append([c, r["union27"], r["majority27"], r["support_hist"].get("3", 0), r["listed11"], r["omitted16"], f"{r['exp_1run']/3:.2f}",
                     f"{p['findings_per_run']:.1f}", f"${p['cost_mean']:.3f}", f"{p['turns_mean']:.1f}", f"{p['tool_calls_mean']:.1f}", f"{p['grep_calls_mean']:.1f}"])
    with open(os.path.join(out, "table02_outcomes_and_process.csv"), "w", newline="") as f: csv.writer(f).writerows(rows)
    with open(os.path.join(out, "table02_outcomes_and_process.md"), "w") as f:
        f.write("| " + " | ".join(rows[0]) + " |\n|" + "---|" * len(rows[0]) + "\n")
        for r in rows[1:]: f.write("| " + " | ".join(str(x) for x in r) + " |\n")

if __name__ == "__main__":
    for th in ("light", "dark"):
        T = THEMES[th]; setup(T)
        out = os.path.join(HERE, th); os.makedirs(out, exist_ok=True)
        for f in (f1, f2, f3, f4, f5, f6, f7): f(T, out)
        print(th, sorted(x for x in os.listdir(out) if x.endswith(".png")))
    tables(); print("tables done")
