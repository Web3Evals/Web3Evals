"""Regenerate F1 (title) and F5 (y-axis label) with corrected wording, as new _v2 files.

Reuses make_figures.py unchanged: the f1() routine is called with its
heading() and finish() hooks wrapped so that (a) the headline reads
"one run per repository" instead of "a single audit run" and (b) the output
is written to F1_leaderboard_v2.* instead of overwriting F1_leaderboard.*.
Usage: python make_F1_fixed.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_figures as mf

OLD = "Expected golden bug groups from a single audit run"
NEW = "Expected golden bug groups from one run per repository"
_heading, _finish = mf.heading, mf.finish

def heading(fig, T, title, subtitle, **kw):
    _heading(fig, T, NEW if title == OLD else title, subtitle, **kw)

OLD_Y = "Expected golden bug groups from one run (of 27)"
NEW_Y = "Expected golden bug groups from one run per repository (of 27)"

def finish(fig, name, T, out):
    for ax in fig.axes:                      # F5: y-axis label carries the same unit slip
        if ax.get_ylabel() == OLD_Y: ax.set_ylabel(NEW_Y)
    _finish(fig, name.replace("F1_leaderboard", "F1_leaderboard_v2").replace("F5_cost_frontier", "F5_cost_frontier_v2"), T, out)

mf.heading, mf.finish = heading, finish

if __name__ == "__main__":
    for th in ("light", "dark"):
        T = mf.THEMES[th]; mf.setup(T)
        mf.f1(T, os.path.join(mf.HERE, th)); mf.f5(T, os.path.join(mf.HERE, th))
        print(th, "-> F1_leaderboard_v2, F5_cost_frontier_v2 (.png/.svg)")
