---
name: diagnosis_autism
description: Classroom strategies, assessment questions, and weekly plan guidance for students already diagnosed with Autism Spectrum Disorder. Loaded by Orchestrator at session start when student diagnosis = Autism.
---

# Autism Spectrum Disorder — Teaching Guide for EACH Agents

> ⚠️ EACH never diagnoses. This student's ASD diagnosis was set by the admin.
> Your role is to help the teacher support this student — not to assess or confirm the diagnosis.

## Understanding ASD in the Classroom

Autism Spectrum Disorder is highly variable. No two students present the same way.
Key areas that commonly affect classroom learning:

- **Sensory sensitivities** — over/under-reactive to sound, light, texture, smell
- **Routine dependence** — distress from unexpected changes
- **Social communication** — difficulty reading social cues, literal interpretation of language
- **Special interests** — deep focus on specific topics (can be leveraged for motivation)
- **Executive function** — difficulty with transitions, planning, flexible thinking

Always refer to the student's `severity_level` and the teacher's specific observations.
Avoid generalizing — ask the teacher to describe this student's specific profile.

---

## Assessment Agent — Key Questions to Ask

**Sensory & Environment**
- "Are there sensory triggers (sounds, lights, textures) that distress [student]?"
- "Does [student] have a calm-down space or sensory tool they use?"
- "Is the classroom environment manageable for them or overwhelming?"

**Routine & Transitions**
- "How does [student] handle schedule changes or unexpected events?"
- "Do you give advance notice before transitions? Does it help?"
- "What's the most difficult transition point in the day?"

**Communication**
- "Does [student] communicate verbally, with AAC, or through other means?"
- "Do they understand figurative language or do they interpret things literally?"
- "How do they signal when they're overwhelmed or need help?"

**Engagement & Motivation**
- "Does [student] have a special interest we can connect learning to?"
- "Do they engage better with visual materials, hands-on tasks, or technology?"
- "How do they respond to peer interaction vs. independent work?"

---

## Planning Agent — Evidence-Based Strategies

### High-Impact Strategies
| Strategy | Best For | How to Use |
|---|---|---|
| **Visual supports** | Routine + communication | Picture schedules, visual timers, task boards |
| **Advance warning** | Transitions | "In 5 minutes we will switch to math" |
| **Social stories** | Social situations | Short narratives explaining expected behavior |
| **Interest-based learning** | Engagement | Connect lesson content to student's special interest |
| **Structured work systems** | Independence | Clear "first-then" visual sequences |
| **Sensory breaks** | Regulation | Designated quiet space or sensory tools |
| **Predictable routine** | Anxiety reduction | Same sequence every day, changes communicated early |

### Weekly Plan Structure for ASD
- **Day 1**: Introduce concept with visual supports + connect to student's interest if possible
- **Day 2**: Structured independent practice with clear visual task sequence
- **Day 3**: Social learning activity (structured, with explicit role assignment)
- **Day 4**: Routine review + sensory break built in
- **Day 5**: Mastery check using preferred response mode (verbal, written, visual, or AAC)

### What to AVOID in ASD Plans
- Sudden schedule changes without preparation
- Open-ended ambiguous instructions ("do your best" — be explicit instead)
- Forcing eye contact or social interaction beyond comfort level
- Sensory overload (group activities in loud environments without support)
- Removing special interest as punishment

---

## Reflection Agent — Quality Checklist for ASD Plans

Before approving a plan, verify:
- [ ] Routine and predictability maintained throughout the week
- [ ] Transition warnings built into at least 3 days
- [ ] Sensory considerations addressed (based on teacher input)
- [ ] At least one interest-based activity per week
- [ ] Communication mode matches student's profile
- [ ] Plan doesn't assume neurotypical social behavior
- [ ] Both Arabic and English versions are consistent

---

## Evaluation Agent — Scoring Notes

When scoring plans for ASD students:
- **Score 5**: Plan is individualized to this student's sensory/communication profile, uses interest-based learning, and includes structured transitions
- **Score 4**: Plan uses ASD-appropriate structure but may miss sensory or communication specifics
- **Score 3**: Generic structured plan, limited personalization
- **Score 1-2**: No ASD-specific accommodations

Alert threshold: Agent score < 3 for two consecutive weeks → trigger `no_improvement` alert.
