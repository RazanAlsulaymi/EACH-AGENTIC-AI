---
name: diagnosis_unknown
description: Fallback skill for students with a diagnosis not in the known list (ADHD, Autism, Dyslexia, Processing Disorder). Loaded by Orchestrator when diagnosis does not match any known skill file.
---

# Unknown / Other Diagnosis — Teaching Guide for EACH Agents

> ⚠️ EACH never diagnoses. This student has a diagnosis recorded by the admin
> that is not in the standard skill library.
> Your role is to gather specific information from the teacher to build
> a personalized understanding of this student's needs.

## What to Do

You do not have pre-built guidance for this diagnosis.
**The teacher is your primary source of knowledge for this student.**

Do NOT:
- Guess or assume based on the diagnosis name
- Apply generic strategies not grounded in what the teacher reports
- Make clinical statements about the diagnosis

DO:
- Ask the teacher detailed questions about this specific student
- Build your understanding from their answers
- Apply general special education best practices
- Reference the student's uploaded IEP/assessment files if available

---

## Assessment Agent — Key Questions to Ask

Since you don't have diagnosis-specific guidance, gather a full picture:

**Understanding the Student**
- "Can you describe [student]'s main learning challenges in your own words?"
- "What does a difficult day look like for [student]?"
- "What does a good day look like?"

**Strengths**
- "What is [student] good at or enjoys in class?"
- "What type of activities engage them most?"

**Triggers & Patterns**
- "Are there specific subjects, times of day, or situations that are harder?"
- "What seems to cause frustration or withdrawal?"

**What's Been Tried**
- "What strategies have you already tried with [student]?"
- "What worked, even partially?"
- "What definitely didn't work?"

**Support Needed This Week**
- "What's the most urgent thing you need help with this week?"
- "Is there a specific goal you're working toward?"

---

## Planning Agent — General Special Education Best Practices

Use these when no diagnosis-specific guidance is available.
Always ground the plan in what the teacher actually reported.

### Universal Design for Learning (UDL) Principles
| Principle | In Practice |
|---|---|
| **Multiple means of representation** | Present info visually, verbally, and hands-on |
| **Multiple means of action** | Allow verbal, written, or visual responses |
| **Multiple means of engagement** | Connect to student interests, offer choice |

### General Strategies That Help Most Students
- Clear, consistent routines
- Break tasks into smaller steps
- Immediate, specific positive feedback
- Visual supports for instructions
- Check for understanding before moving on
- Reduce unnecessary cognitive load
- Build on strengths to address weaknesses

### Weekly Plan Structure (Universal)
- **Day 1**: Engage + introduce (hook the student, connect to what they know)
- **Day 2**: Guided practice (teacher support, step-by-step)
- **Day 3**: Collaborative practice (peer support or small group)
- **Day 4**: Independent practice (with scaffolds available)
- **Day 5**: Review + flexible assessment (match student's response mode)

---

## Reflection Agent — Quality Checklist for Unknown Diagnosis Plans

Before approving a plan, verify:
- [ ] Plan is based on teacher's specific answers, not generic assumptions
- [ ] Student's strengths are incorporated
- [ ] Reported triggers and difficult situations are addressed
- [ ] At least one strategy the teacher said worked previously is included
- [ ] Plan does not make clinical statements about the diagnosis
- [ ] Both Arabic and English versions are consistent

---

## Recommendation

If this diagnosis appears frequently, create a dedicated skill file for it.
Add it to the skill map in `main.py`:
```python
skill_map = {
    "adhd": "diagnosis_adhd.md",
    "autism": "diagnosis_autism.md",
    "dyslexia": "diagnosis_dyslexia.md",
    "processing": "diagnosis_processing.md",
    "new_diagnosis_name": "diagnosis_new_diagnosis_name.md",  # ← add here
}
```
