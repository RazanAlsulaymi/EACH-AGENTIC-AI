---
name: diagnosis_adhd
description: Classroom strategies, assessment questions, and weekly plan guidance for students already diagnosed with ADHD. Loaded by Orchestrator at session start when student diagnosis = ADHD.
---

# ADHD — Teaching Guide for EACH Agents

> ⚠️ EACH never diagnoses. This student's ADHD diagnosis was set by the admin.
> Your role is to help the teacher support this student — not to assess or confirm the diagnosis.

## Understanding ADHD in the Classroom

ADHD (Attention Deficit Hyperactivity Disorder) presents differently per student.
The three main presentations are:
- **Inattentive** — easily distracted, forgets instructions, loses materials
- **Hyperactive-Impulsive** — difficulty staying seated, interrupts, acts before thinking
- **Combined** — both inattentive and hyperactive traits

Severity level is stored in the student profile (`mild`, `moderate`, `severe`).
Always factor severity when generating plans.

---

## Assessment Agent — Key Questions to Ask

When gathering information from the teacher, prioritize these areas:

**Attention & Focus**
- "Where in the lesson does [student] lose focus first?"
- "How long can [student] stay on task before needing redirection?"
- "What time of day is [student] most focused?"

**Hyperactivity / Impulsivity**
- "Does [student] struggle more with sitting still or with waiting their turn?"
- "Are there specific triggers that increase restlessness (noise, transitions, long tasks)?"

**Strategies Already Tried**
- "Have you used movement breaks? How often and did they help?"
- "Have visual schedules or timers made a difference?"
- "Does [student] respond better to individual vs group tasks?"

**Support Needed**
- "Do you need strategies for focus, behavior management, or both?"
- "Is there a specific subject or time slot causing the most difficulty?"

---

## Planning Agent — Evidence-Based Strategies

Use these when generating the weekly plan. Always match strategy to what the teacher reported.

### High-Impact Strategies
| Strategy | Best For | How to Use |
|---|---|---|
| **Movement breaks** | Hyperactive presentation | Every 20-30 min, 2-3 min physical activity |
| **Visual schedules** | Inattentive presentation | Post daily schedule with icons, check off tasks |
| **Chunking tasks** | All presentations | Break 30-min tasks into 3 × 10-min blocks |
| **Timer use** | Focus and transitions | "You have 10 minutes for this task" with visible timer |
| **Preferential seating** | Distraction reduction | Front-center, away from windows/doors |
| **Fidget tools** | Hyperactive/combined | Stress ball, textured seat cushion |
| **Immediate positive feedback** | All presentations | Praise within 30 seconds of desired behavior |

### Weekly Plan Structure for ADHD
- **Day 1**: Introduce new concept with hands-on activity (max 20 min)
- **Day 2**: Practice with structured worksheet + movement break midway
- **Day 3**: Peer collaboration (structured pairs, clear roles)
- **Day 4**: Review + game-based reinforcement
- **Day 5**: Assessment + celebration of effort (not just outcome)

### What to AVOID in ADHD Plans
- Long uninterrupted reading or writing tasks (>15 min)
- Punishing movement — redirect it instead
- Removing recess as consequence
- Overwhelming instructions (max 2-3 steps at a time)

---

## Reflection Agent — Quality Checklist for ADHD Plans

Before approving a plan, verify:
- [ ] At least 2 movement breaks per day
- [ ] No single task block exceeds 20 minutes
- [ ] Visual or structured supports mentioned
- [ ] Positive reinforcement strategy included
- [ ] Plan accounts for teacher-reported triggers
- [ ] Both Arabic and English versions are consistent

---

## Evaluation Agent — Scoring Notes

When scoring plans for ADHD students:
- **Score 5**: Plan addresses specific triggers + uses 3+ evidence-based strategies + has measurable daily goals
- **Score 4**: Plan uses 2 strategies, mostly addresses reported difficulties
- **Score 3**: Generic ADHD plan, doesn't reflect teacher's specific input
- **Score 1-2**: No ADHD-specific accommodations, plan could apply to any student

Alert threshold: Agent score < 3 for two consecutive weeks → trigger `no_improvement` alert.
