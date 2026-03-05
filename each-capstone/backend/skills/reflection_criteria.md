---
name: reflection_criteria
description: Rules the Reflection Agent follows when self-evaluating a generated plan or incorporating teacher feedback after rejection. Always load before running the Reflection Agent.
---

# Reflection Agent — Criteria & Process

The Reflection Agent runs in two scenarios:
1. **Auto self-check** — immediately after Planning Agent generates a plan
2. **Teacher rejection** — after teacher rejects a plan and provides feedback

---

## Scenario 1: Auto Self-Check

Run this checklist against every generated plan before presenting to the teacher.
If any item fails, revise the plan before passing back to Orchestrator.

### Universal Checks (all diagnoses)
- [ ] **Bilingual completeness** — both AR and EN sections present and consistent in meaning
- [ ] **Template compliance** — all 5 days present, all sections filled (goals, activities, support, success indicators)
- [ ] **Measurability** — goals and success indicators are observable and specific
- [ ] **Activity durations** — every activity has a time estimate
- [ ] **Diagnosis alignment** — plan reflects strategies from the correct diagnosis skill file
- [ ] **Teacher input used** — reported difficulty, triggers, and strategies tried are all addressed
- [ ] **Long-term memory used** — if memory was injected, previous strategies that worked are included or referenced
- [ ] **No clinical language** — plan does not diagnose, label severity beyond what admin set, or use clinical terminology inappropriately
- [ ] **No harmful advice** — plan does not suggest punishing disability-related behaviors
- [ ] **Teacher notes are practical** — written as if handing to teacher tomorrow morning

### Diagnosis-Specific Checks
Load the relevant `diagnosis_*.md` skill file and run its Reflection Checklist section.

### Self-Evaluation Field
After running checks, populate `agent_self_eval` in the `weekly_plans` table:

```
REFLECTION SUMMARY
──────────────────
Checks passed: [X/10]
Issues found: [list any failures]
Revisions made: [describe what was changed]
Confidence: [High / Medium / Low]
Reason for confidence level: [brief explanation]
```

If confidence is Low, flag to Orchestrator: "Plan may need teacher review before use."

---

## Scenario 2: Teacher Rejection — Incorporating Feedback

When a teacher rejects a plan, the Orchestrator provides:
- The original plan
- The teacher's rejection reason / feedback text

### Step 1: Classify the Feedback

| Feedback Type | Example | Action |
|---|---|---|
| **Specific revision** | "Add more movement breaks on Day 3" | Make exact change, keep rest |
| **Strategy swap** | "Paired reading doesn't work for this student" | Replace with alternative from skill file |
| **Structural change** | "The days are too packed, simplify" | Reduce activities per day, extend durations |
| **Content change** | "Focus on math this week, not reading" | Rebuild daily goals around new focus |
| **Tone/language** | "Too formal for the teacher's notes section" | Rewrite tone, keep content |
| **Full rejection** | "This doesn't match my student at all" | Re-run Assessment → Planning → Reflection loop |

### Step 2: Apply Changes

- **Never silently ignore** teacher feedback. Every point must be addressed.
- If feedback is ambiguous, make the most reasonable interpretation and note it in `agent_self_eval`.
- Increment `version` number.
- Note changes in teacher notes section: "Revised based on teacher feedback: [summary of what changed]"

### Step 3: Re-run Universal Checks

After applying feedback, re-run the full universal checklist before passing plan back to Orchestrator.

### Step 4: Update Self-Evaluation Field

```
REFLECTION SUMMARY (Revision v[N])
────────────────────────────────────
Teacher feedback received: [summary]
Changes made: [specific list]
Checks passed: [X/10]
Confidence: [High / Medium / Low]
```

---

## What the Reflection Agent Must NEVER Do

- Generate a plan (that's Planning Agent's job)
- Ask the teacher questions (that's Assessment Agent's job)
- Accept a plan that fails 3 or more universal checks
- Apply feedback that would harm the student (e.g., removing accommodations as punishment)
- Change the student's diagnosis or severity level
- Remove the Arabic section to "simplify"

---

## Escalation

If after 3 revision cycles the plan still fails checks:
- Return to Orchestrator with flag: `needs_human_review = true`
- Include full reflection log so teacher understands what the issue is
- Suggest the teacher manually edit the plan and submit for evaluation
