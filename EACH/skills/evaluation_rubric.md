---
name: evaluation_rubric
description: Scoring rubric and reasoning guide for the Evaluation Agent. Used to score generated plans 1-5, compare against teacher scores, and determine when to trigger alerts. Always load before running the Evaluation Agent.
---

# Evaluation Agent — Scoring Rubric

The Evaluation Agent scores each approved weekly plan.
Scores are stored in the `evaluations` table:
- `agent_score` (1–5): set by this agent
- `teacher_score` (1–5): set by teacher via UI
- `agent_reasoning`: this agent's explanation

Both scores are stored independently. Do not adjust `agent_score` to match `teacher_score`.

---

## Scoring Rubric (1–5)

### Score 5 — Excellent
**All of the following are true:**
- Plan is fully personalized to this student's specific diagnosis, severity, and reported difficulty
- All 4 teacher inputs (difficulty, triggers, strategies_tried, support_needed) are directly addressed
- Long-term memory from past sessions is incorporated (if available)
- Goals are measurable and realistic for the week
- Every day has clear activities, durations, and success indicators
- Strategies come from the evidence base in the correct diagnosis skill file
- Bilingual sections are consistent and professionally written
- Teacher notes are practical and immediately actionable
- Reflection Agent self-eval shows ≥ 9/10 checks passed

### Score 4 — Good
**Most of the following are true:**
- Plan addresses the main difficulty and triggers reported
- 3 of 4 teacher inputs are clearly reflected
- Goals are measurable but may be slightly over/under-ambitious
- Most days have complete activity structure
- At least 2 evidence-based strategies from the diagnosis skill file
- Both AR and EN present, minor consistency gaps acceptable
- Teacher notes are useful but may lack specificity

### Score 3 — Adequate
**Minimum acceptable for a plan to be stored:**
- Plan is relevant to the student's diagnosis in general
- At least 2 of 4 teacher inputs addressed
- Goals exist but may not be fully measurable
- Plan structure is mostly complete (may be missing 1 day or 1 section)
- At least 1 diagnosis-appropriate strategy
- Both AR and EN present

### Score 2 — Needs Improvement
**Any of the following:**
- Plan is generic — could apply to any student with this diagnosis
- Fewer than 2 teacher inputs addressed
- Goals are vague or absent
- Missing 2+ days or major sections
- Strategies are generic (not from diagnosis skill file)
- AR or EN section is significantly weaker than the other

### Score 1 — Unacceptable
**Any of the following:**
- Plan does not address the reported difficulty at all
- Wrong diagnosis strategies applied
- Clinical language or harmful advice present
- Missing more than 2 days
- Plan is a repetition of a previous plan with no changes
- AR section is missing or placeholder text

---

## Reasoning Format

Populate `agent_reasoning` in the `evaluations` table using this format:

```
EVALUATION SUMMARY
──────────────────
Plan: v[version] for [student_name] | Week: [week_start_date]
Score: [1-5]

STRENGTHS
- [What the plan does well — be specific]
- [...]

GAPS
- [What's missing or weak — be specific]
- [...]

COMPARED TO PREVIOUS PLAN
- Previous score: [N] | Change: [improved / declined / no change]
- Key difference: [what changed between versions]

ALERT CHECK
- Two consecutive scores < 3: [YES → trigger alert / NO]
- No plan in 14 days: [checked by DB trigger]

RECOMMENDATION
[One sentence: approve as-is / minor revision suggested / major revision needed]
```

---

## Score Comparison with Teacher

After both `agent_score` and `teacher_score` are available:

| Gap | Interpretation | Action |
|---|---|---|
| 0–1 point difference | Agreement | No action needed |
| 2 points difference | Partial disagreement | Log in reasoning; useful training signal |
| 3+ points difference | Significant disagreement | Flag for review; may indicate agent calibration issue or teacher expectation mismatch |

When agent scores higher than teacher:
> Agent may be rewarding completeness while teacher values real-world usability.
> Adjust future plans to be more practical.

When teacher scores higher than agent:
> Teacher may have context the agent doesn't have (e.g., student had a breakthrough this week).
> Use this as positive signal, not a failure.

---

## Alert Triggers

The Evaluation Agent checks two conditions after every scoring:

### Condition 1: No Improvement
```python
if current_agent_score < 3 and previous_agent_score < 3:
    trigger_alert(
        alert_type="no_improvement",
        message_ar="لم يُلاحظ تحسن ملحوظ للطالب في الأسبوعين الماضيين",
        message_en="No significant improvement observed for this student over the last two weeks"
    )
```

### Condition 2: Missed Plan
Handled by DB trigger in `check_and_create_alerts()` function.
The Evaluation Agent does not need to check this directly.

### Condition 3: Score Trend Analysis (5+ plans)
When a student has 5+ scored plans:
- Calculate rolling average of last 3 agent scores
- If rolling average < 3.0 → flag for `no_improvement` alert
- If rolling average ≥ 4.5 → add positive milestone note to teacher notes

---

## What the Evaluation Agent Must NEVER Do

- Modify the plan content (read-only after Planning + Reflection)
- Override teacher's `teacher_score`
- Give score 5 to a plan that failed Reflection checks
- Score a plan that hasn't been through the Reflection Agent
- Make clinical judgments about the student's progress
