# =============================================================================
# EACH Backend — Every Ability, Celebrated Here
# FastAPI + LangGraph Swarm + Supabase
# Version 3.0 | March 2026
# =============================================================================

# =============================================================================
# SECTION 1: IMPORTS & CONFIGURATION
# =============================================================================

import os
import re
import json
import logging
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from supabase import create_client, Client

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.prebuilt import create_react_agent
from langgraph_swarm import create_handoff_tool, create_swarm

# ── Environment ───────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
SUPABASE_URL   = os.environ["SUPABASE_URL"]
SUPABASE_KEY   = os.environ["SUPABASE_KEY"]
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_skills_env    = os.getenv("SKILLS_PATH", "skills")
SKILLS_PATH    = Path(__file__).parent / _skills_env

# ── Logging (no PII) ──────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("EACH")

# ── Supabase client ───────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── LLM ───────────────────────────────────────────────────────────────────────
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.3,
    api_key=OPENAI_API_KEY,
    request_timeout=300,
)

# ── Shared checkpointer (per-thread memory for LangGraph Swarm) ───────────────
_checkpointer = InMemorySaver()


# =============================================================================
# SECTION 2: SKILL LOADER FUNCTIONS
# =============================================================================

SKILL_MAP: dict[str, str] = {
    "adhd":       "diagnosis_adhd.md",
    "autism":     "diagnosis_autism.md",
    "dyslexia":   "diagnosis_dyslexia.md",
    "processing": "diagnosis_processing.md",
}


def load_skill(filename: str) -> str:
    """Read a skill markdown file. Falls back to diagnosis_unknown.md if missing."""
    target = SKILLS_PATH / filename
    if not target.exists():
        logger.warning(f"Skill file not found: {target}")
        fallback = SKILLS_PATH / "diagnosis_unknown.md"
        if fallback.exists():
            return fallback.read_text(encoding="utf-8")
        return ""
    return target.read_text(encoding="utf-8")


def get_diagnosis_skill(diagnosis: str) -> str:
    """Return skill file content for the given diagnosis (case-insensitive)."""
    d = (diagnosis or "").lower().strip()
    for key, filename in SKILL_MAP.items():
        if key in d:
            return load_skill(filename)
    return load_skill("diagnosis_unknown.md")


def load_plan_template() -> str:
    return load_skill("plan_template.md")


def load_reflection_criteria() -> str:
    return load_skill("reflection_criteria.md")


def load_evaluation_rubric() -> str:
    return load_skill("evaluation_rubric.md")


# =============================================================================
# SECTION 3: DATABASE FUNCTIONS (Supabase — synchronous)
# =============================================================================

def next_monday() -> date:
    today = date.today()
    days_ahead = 7 - today.weekday()  # weekday(): Mon=0, so next Mon
    if days_ahead == 7:
        days_ahead = 0  # today is already Monday
    return today + timedelta(days=days_ahead)


def get_plan_version(student_id: int) -> int:
    """Return the next version number for this student's plans."""
    res = (
        supabase.table("plans")
        .select("version")
        .eq("student_id", student_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]["version"] + 1
    return 1


def get_student(student_id: int) -> dict | None:
    res = (
        supabase.table("students")
        .select("*")
        .eq("student_id", student_id)
        .single()
        .execute()
    )
    return res.data


def find_student_by_name(message: str) -> dict | None:
    """Match a student from the message — full name, first name, or Arabic name."""
    if not (message or "").strip():
        return None
    students = supabase.table("students").select("*").execute().data or []
    msg = message.strip()
    msg_lower = msg.lower()
    words = set(re.findall(r"\b\w+\b", msg_lower))
    for s in students:
        en = (s.get("name_en") or "").strip()
        ar = (s.get("name_ar") or "").strip()
        en_lower = en.lower()
        # Full name (EN or AR) in message
        if en and en_lower in msg_lower:
            return s
        if ar and ar in msg:
            return s
        # First name only
        first_en = en_lower.split()[0] if en else ""
        if first_en and (first_en in msg_lower or first_en in words):
            return s
        # First word of Arabic name
        if ar:
            first_ar = ar.split()[0]
            if first_ar and first_ar in msg:
                return s
    return None


def list_students_with_alert_counts() -> list:
    """Return all students. Add class_name from grade for grouping (DB uses grade, not class_id)."""
    rows = supabase.table("students").select("*").execute().data or []
    for s in rows:
        s["class_name"] = s.get("grade") or s.get("class_name") or s.get("class_id") or ""
        s["class_id"] = s.get("grade") or s.get("class_id")
    return rows


def get_student_full_profile(student_id: int) -> dict:
    student = get_student(student_id)
    if not student:
        return {}

    plans = (
        supabase.table("plans")
        .select("*")
        .eq("student_id", student_id)
        .order("week_start_date", desc=True)
        .limit(5)
        .execute()
        .data or []
    )
    sessions = (
        supabase.table("sessions")
        .select("*")
        .eq("student_id", student_id)
        .order("session_id", desc=True)
        .limit(5)
        .execute()
        .data or []
    )
    milestones = (
        supabase.table("milestones")
        .select("*")
        .eq("student_id", student_id)
        .limit(5)
        .execute()
        .data or []
    )
    return {
        "student":    student,
        "plans":      plans,
        "sessions":   sessions,
        "milestones": milestones,
    }


def search_long_term_memory(student_id: int) -> str:
    """
    Returns a formatted plain-text summary of past history for a student.
    Injected into the Orchestrator system prompt on every session start.
    """
    student = get_student(student_id) or {}

    plans = (
        supabase.table("plans")
        .select("plan_content_en, score, teacher_score, week_start_date, version")
        .eq("student_id", student_id)
        .order("week_start_date", desc=True)
        .limit(2)
        .execute()
        .data or []
    )
    sessions = (
        supabase.table("sessions")
        .select("difficulty_reported, triggers_noted, strategies_tried, support_needed")
        .eq("student_id", student_id)
        .order("session_id", desc=True)
        .limit(2)
        .execute()
        .data or []
    )
    milestones = (
        supabase.table("milestones")
        .select("*")
        .eq("student_id", student_id)
        .limit(3)
        .execute()
        .data or []
    )

    name = student.get("name_en", "Student")
    lines = [f"=== LONG-TERM MEMORY: {name} ==="]

    if student.get("previous_assessment"):
        lines.append(f"\nPrevious Assessment:\n{student['previous_assessment']}")

    if plans:
        lines.append("\nRecent Plans:")
        for p in plans:
            lines.append(
                f"  - Week {p.get('week_start_date')} v{p.get('version')}: "
                f"agent score {p.get('score')}, teacher score {p.get('teacher_score')}"
            )

    if sessions:
        lines.append("\nRecent Sessions:")
        for s in sessions:
            lines.append(
                f"  - Difficulty: {s.get('difficulty_reported')} | "
                f"Triggers: {s.get('triggers_noted')} | "
                f"Tried: {s.get('strategies_tried')}"
            )

    if milestones:
        lines.append("\nRecent Milestones:")
        for m in milestones:
            lines.append(f"  - {m.get('title')}: {m.get('description')}")

    lines.append("=== END MEMORY ===")
    return "\n".join(lines)


def _messages_to_store(result_messages: list, last_tags_found: list) -> list:
    """Convert LangChain messages to storable format [{role, content, tags_found?}]."""
    stored = []
    last_ai_idx = -1
    for i, msg in enumerate(result_messages):
        if isinstance(msg, AIMessage) and msg.content:
            last_ai_idx = i
    for i, msg in enumerate(result_messages):
        if isinstance(msg, HumanMessage) and msg.content:
            c = msg.content if isinstance(msg.content, str) else str(msg.content)
            if c.strip():
                stored.append({"role": "user", "content": c.strip()})
        elif isinstance(msg, AIMessage) and msg.content:
            c = msg.content if isinstance(msg.content, str) else str(msg.content)
            if c.strip():
                tags = last_tags_found if i == last_ai_idx else []
                stored.append({"role": "assistant", "content": _clean_tags(c), "tags_found": tags})
    return stored


def save_session_to_db(thread_id: str, student_id: int, session_data: dict, messages: list | None = None) -> None:
    payload = {
        "session_id":          thread_id,
        "student_id":          student_id,
        "difficulty_reported": session_data.get("difficulty_reported", ""),
        "triggers_noted":      session_data.get("triggers_noted", ""),
        "strategies_tried":    session_data.get("strategies_tried", ""),
        "support_needed":      session_data.get("support_needed", ""),
        "plan_approved":       session_data.get("plan_approved", False),
        "eval_score":          session_data.get("eval_score", 0),
    }
    if messages is not None:
        payload["messages"] = messages
    supabase.table("sessions").upsert(payload).execute()


def get_session_messages(thread_id: str) -> list:
    """Load stored messages for a session. Requires sessions.messages column (jsonb).
    Run migrations/001_add_session_messages.sql if you get empty history."""
    try:
        res = supabase.table("sessions").select("session_id, messages").eq("session_id", thread_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            msgs = row.get("messages")
            if isinstance(msgs, list):
                return msgs
    except Exception as e:
        logger.warning(f"Could not load session messages (column may not exist): {e}")
    return []


def _stored_messages_to_langchain(stored: list, max_messages: int = 30) -> list:
    """Convert stored format [{role, content}] to LangChain HumanMessage/AIMessage list. Caps at max_messages (tail)."""
    out = []
    for m in stored[-max_messages:] if len(stored) > max_messages else stored:
        if not isinstance(m, dict):
            continue
        role = (m.get("role") or "").strip().lower()
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role in ("user", "teacher"):
            out.append(HumanMessage(content=content))
        elif role == "assistant":
            out.append(AIMessage(content=content))
    return out


def _last_message_has_pending_tool_calls(messages: list) -> bool:
    """True if the last message is an AIMessage with tool_calls and no ToolMessage follows (causes INVALID_CHAT_HISTORY)."""
    if not messages:
        return False
    last = messages[-1]
    if not isinstance(last, AIMessage):
        return False
    return bool(getattr(last, "tool_calls", None) or [])


def save_plan_to_db(
    student_id: int,
    plan_content_en: str,
    plan_content_ar: str,
    approved: bool,
    score: int,
    version: int,
) -> int:
    """Insert a plan and return the new plan_id."""
    week_start = next_monday()
    res = supabase.table("plans").insert({
        "student_id":       student_id,
        "week_start_date":  week_start.isoformat(),
        "version":          version,
        "plan_content_en":  plan_content_en,
        "plan_content_ar":  plan_content_ar,
        "teacher_approved": approved,
        "score":            score,
    }).execute()
    return res.data[0]["plan_id"]


def teacher_score_plan(plan_id: int, score: int) -> None:
    supabase.table("plans").update({
        "teacher_score":    score,
        "teacher_approved": True,
    }).eq("plan_id", plan_id).execute()


def log_mood(student_id: int, mood: str, note: str) -> None:
    try:
        supabase.table("mood_logs").insert({
            "student_id": student_id,
            "mood":       mood,
            "note":       note,
        }).execute()
    except Exception as e:
        logger.warning(f"log_mood failed: {e}")


def log_milestone(student_id: int, title: str, description: str) -> None:
    try:
        supabase.table("milestones").insert({
            "student_id":  student_id,
            "title":       title,
            "description": description,
        }).execute()
    except Exception as e:
        logger.warning(f"log_milestone failed: {e}")


# =============================================================================
# SECTION 4: SESSION STATE MANAGEMENT
# =============================================================================

# In-memory store: thread_id → session dict
# (thread memory is lost on server restart — acceptable per spec)
_sessions: dict[str, dict] = {}


def init_session(thread_id: str, student_id: int) -> dict:
    """
    Initialize a new session or return the existing one.
    Called at the start of every /chat request.
    """
    if thread_id in _sessions:
        return _sessions[thread_id]

    student = get_student(student_id)
    if not student:
        raise ValueError(f"Student {student_id} not found in Supabase")

    _sessions[thread_id] = {
        "student_id":          student_id,
        "student_profile":     student,
        "diagnosis_skill":     get_diagnosis_skill(student.get("diagnosis", "")),
        "long_term_memory":    search_long_term_memory(student_id),
        "difficulty_reported": "",
        "triggers_noted":      "",
        "strategies_tried":    "",
        "support_needed":      "",
        "current_plan":        "",
        "plan_version":        get_plan_version(student_id),
        "reflection_done":     False,
        "plan_approved":       False,
        "eval_score":          0,
        "preferred_language":  "en",
    }
    return _sessions[thread_id]


def get_session(thread_id: str) -> dict | None:
    return _sessions.get(thread_id)


def resolve_and_store_preferred_language(thread_id: str, req: "ChatRequest") -> str:
    """
    Resolve preferred_language: from request, or session, or detect from message.
    Store in session for all subsequent turns. Returns "en" | "ar".
    """
    session = get_session(thread_id)
    lang = None
    if req.preferred_language in ("en", "ar"):
        lang = req.preferred_language
    elif session and session.get("preferred_language") in ("en", "ar"):
        lang = session["preferred_language"]
    if lang is None:
        lang = _detect_language_from_message(req.message)
    if session:
        update_session(thread_id, {"preferred_language": lang})
    return lang


def update_session(thread_id: str, updates: dict) -> None:
    if thread_id in _sessions:
        _sessions[thread_id].update(updates)


def all_fields_complete(session: dict) -> bool:
    fields = ["difficulty_reported", "triggers_noted", "strategies_tried", "support_needed"]
    return all(bool(session.get(f)) for f in fields)


def session_summary(session: dict) -> dict:
    """Return a safe, serializable snapshot of current session state."""
    return {
        "student_id":          session.get("student_id"),
        "difficulty_reported": session.get("difficulty_reported"),
        "triggers_noted":      session.get("triggers_noted"),
        "strategies_tried":    session.get("strategies_tried"),
        "support_needed":      session.get("support_needed"),
        "all_fields_complete": all_fields_complete(session),
        "plan_generated":      bool(session.get("current_plan")),
        "reflection_done":     session.get("reflection_done"),
        "plan_approved":       session.get("plan_approved"),
        "eval_score":          session.get("eval_score"),
        "plan_version":        session.get("plan_version"),
        "preferred_language":  session.get("preferred_language", "en"),
    }


# =============================================================================
# SECTION 5: GUARDRAILS & SYSTEM PROMPTS
# =============================================================================

GUARDRAILS = """
=== SYSTEM GUARDRAILS — APPLY TO EVERY RESPONSE ===

GUARDRAIL 1 — INPUT SCOPE:
Only engage with topics related to special education, teaching strategies,
student learning support, and classroom accommodations. If the teacher asks
anything unrelated, respond: "I can only help with supporting your student's
learning. Is there something specific I can help you with?"

GUARDRAIL 2 — STUDENT SCOPE:
You are authorized to discuss only the student whose session is currently open.
Never reference, compare to, or name any other student.

GUARDRAIL 3 — OUTPUT SAFETY:
- NEVER suggest a new diagnosis or modify the student's existing diagnosis.
- NEVER recommend punishment for disability-related behaviors.
- NEVER use clinical or medical language beyond what is in the student profile.
- If the teacher asks for medical advice, defer to the school's clinical team.
- NEVER suggest strategies flagged as harmful in the diagnosis skill files.

GUARDRAIL 4 — LANGUAGE (overridden per-session; see OUTPUT LANGUAGE below):
Use the teacher's preferred_language for ALL responses. Do NOT mix languages. Do NOT translate unless explicitly asked.

GUARDRAIL 5 — DATA PRIVACY:
Never include student IDs, full names, or personal details in system logs.
In your responses, refer to the student by first name only.

=== END GUARDRAILS ===
"""


def _language_rule(session: dict) -> str:
    """Strict output language rule: use preferred_language from session."""
    lang = session.get("preferred_language", "en")
    lang_name = "Arabic" if lang == "ar" else "English"
    return f"""OUTPUT LANGUAGE — CRITICAL:
You MUST respond in {lang_name} only (preferred_language={lang}). Do NOT mix languages. Do NOT translate unless the teacher explicitly asks. Never switch to a different language mid-conversation."""


def _fmt_assessment_fields(session: dict) -> str:
    fields = {
        "difficulty_reported": session.get("difficulty_reported", ""),
        "triggers_noted":      session.get("triggers_noted", ""),
        "strategies_tried":    session.get("strategies_tried", ""),
        "support_needed":      session.get("support_needed", ""),
    }
    filled   = [k for k, v in fields.items() if v]
    missing  = [k for k, v in fields.items() if not v]
    parts = [f"  Fields collected ({len(filled)}/4): {', '.join(filled) if filled else 'none'}"]
    if missing:
        parts.append(f"  Still needed: {', '.join(missing)}")
    return "\n".join(parts)


def build_orchestrator_prompt(session: dict) -> str:
    student   = session.get("student_profile", {})
    name_en   = student.get("name_en", "the student")
    name_ar   = student.get("name_ar", "")
    diagnosis = student.get("diagnosis", "Unknown")
    severity  = student.get("severity_level", "unknown")
    memory    = session.get("long_term_memory", "No prior history available.")

    lang_rule = _language_rule(session)
    return f"""{GUARDRAILS}

{lang_rule}

You are the EACH Orchestrator — the central coordinator. Your ONLY job is to route.

NEVER do any of these yourself:
- Give strategies, tips, or educational advice
- Output lists of activities, techniques, or interventions
- Generate or write any part of a plan
- Answer assessment questions (the Assessment Agent does that)
- Produce plans (the Planning Agent does that)

You ONLY: (1) briefly greet or acknowledge, (2) immediately call a handoff tool.
AVAILABLE TOOLS (use these EXACT names): transfer_to_assessment_agent, transfer_to_planning_agent, transfer_to_reflection_agent, transfer_to_evaluation_agent.

CRITICAL — When the teacher describes ANY difficulty, concern, or observation (e.g. "he has trouble with X", "difficulty connecting letters", "struggles with Y") → call transfer_to_assessment_agent IMMEDIATELY. Do NOT reply with strategies, activities, or advice. The Assessment Agent will handle it.
If the teacher explicitly asks for a plan, weekly plan, strategies, or intervention program → call transfer_to_planning_agent immediately (do NOT block on assessment completeness).
You MUST NOT generate strategies, activities, or interventions. Only route via tools.

CURRENT STUDENT:
  English name : {name_en}
  Arabic name  : {name_ar}
  Diagnosis    : {diagnosis}
  Severity     : {severity}

{memory}

ROUTING RULES — call the handoff tool immediately; NEVER add strategies or plans in your reply:

1. Teacher explicitly asks for a plan, weekly plan, strategies, or intervention program → immediately call transfer_to_planning_agent. Do NOT block planning because of missing assessment fields. The Planning Agent will use available information and state assumptions.
2. Teacher describes difficulties, observations, or learning concerns (e.g. "He has trouble connecting letters to sounds", "struggles with X", "difficulty with Y") → transfer_to_assessment_agent. NEVER give strategies yourself.
3. If any of the 4 assessment fields are still missing AND the teacher describes difficulties, observations, or learning concerns → call transfer_to_assessment_agent. The Assessment Agent gathers this info; you NEVER give strategies.
4. Teacher describes what they've tried or behaviors observed → transfer_to_assessment_agent.
5. Teacher shares positive progress or observation (e.g. "improvement", "reads faster", "did better today") → you MUST acknowledge it and respond. Either (a) respond briefly in OUTPUT LANGUAGE and offer to update the plan (e.g. "That's great to hear. Would you like me to update the weekly plan to reflect this?"), or (b) call transfer_to_planning_agent so the plan can be updated. Never ignore teacher observations.
6. First message of session: if it is only a greeting (e.g. "Hi", "Hello") → respond briefly in the OUTPUT LANGUAGE; do NOT transfer. If the first message contains a learning concern or difficulty → transfer_to_assessment_agent.
7. Teacher asks to revise or change a plan → transfer_to_planning_agent.
8. PLAN_GENERATED tag present → transfer_to_reflection_agent.
9. REFLECTION_PASSED tag present → present plan, ask for approval, then transfer_to_evaluation_agent when they approve.
10. Teacher approves or says "already approved" → transfer_to_evaluation_agent.
11. Teacher rejects or requests changes → transfer_to_reflection_agent.
12. FALLBACK: Always respond to every message. If unsure where to route, default to transfer_to_assessment_agent. Never leave the teacher without a response.

CURRENT SESSION STATE:
{_fmt_assessment_fields(session)}
  Plan generated   : {"Yes" if session.get("current_plan") else "No"}
  Reflection done  : {session.get("reflection_done")}
  Plan approved    : {session.get("plan_approved")}
  Evaluation score : {session.get("eval_score") or "Not yet scored"}
"""


def build_assessment_prompt(session: dict) -> str:
    student   = session.get("student_profile", {})
    name_en   = student.get("name_en", "the student")
    diagnosis = student.get("diagnosis", "Unknown")
    severity  = student.get("severity_level", "")
    skill     = session.get("diagnosis_skill", "")

    already = {
        "difficulty_reported": session.get("difficulty_reported", ""),
        "triggers_noted":      session.get("triggers_noted", ""),
        "strategies_tried":    session.get("strategies_tried", ""),
        "support_needed":      session.get("support_needed", ""),
    }
    missing = [k for k, v in already.items() if not v]

    lang_rule = _language_rule(session)
    return f"""{GUARDRAILS}

{lang_rule}

You are the EACH Assessment Agent.

YOUR ROLE: Gather exactly 4 pieces of information about {name_en} through
natural, supportive conversation. Ask ONE question at a time.
If the teacher answers multiple fields at once, capture all of them.

STUDENT: {name_en} | Diagnosis: {diagnosis} ({severity})

DIAGNOSIS-SPECIFIC QUESTION GUIDANCE:
{skill}

THE 4 REQUIRED FIELDS:
1. difficulty_reported  — What specific difficulty is {name_en} facing this week?
2. triggers_noted       — What situations, times, or subjects trigger this?
3. strategies_tried     — What has the teacher already tried?
4. support_needed       — What specific support does {name_en} need this week?

FIELDS ALREADY COLLECTED:
{json.dumps(already, ensure_ascii=False, indent=2)}

STILL MISSING: {', '.join(missing) if missing else 'Nothing — all fields complete!'}

AFTER EACH TEACHER MESSAGE — emit one tag for every field the teacher answered:

FIELD_COLLECTED: {{"field": "<field_name>", "value": "<what the teacher said>"}}

Example: if the teacher says "He loses focus during math", emit:
FIELD_COLLECTED: {{"field": "difficulty_reported", "value": "loses focus during math"}}

WHEN ALL 4 FIELDS ARE COMPLETE — also emit the full summary tag:

ASSESSMENT_COMPLETE: {{"difficulty_reported": "...", "triggers_noted": "...", "strategies_tried": "...", "support_needed": "..."}}

Then say: "Thank you! I have everything I need to create {name_en}'s plan."
Then call transfer_to_orchestrator.

RULES:
- Never ask more than one question per message.
- Always emit FIELD_COLLECTED for any field the teacher just answered, BEFORE your response.
- Never ask again about a field that is already listed under FIELDS ALREADY COLLECTED.
- Never skip to planning — always complete all 4 fields first.
- Probe for more detail if an answer is too vague.
"""


def build_planning_prompt(session: dict) -> str:
    student      = session.get("student_profile", {})
    name_en      = student.get("name_en", "the student")
    name_ar      = student.get("name_ar", "")
    diagnosis    = student.get("diagnosis", "Unknown")
    severity     = student.get("severity_level", "")
    grade        = student.get("grade", "")
    skill        = session.get("diagnosis_skill", "")
    template     = load_plan_template()
    memory       = session.get("long_term_memory", "")
    difficulty   = session.get("difficulty_reported", "")
    lang_rule    = _language_rule(session)
    triggers     = session.get("triggers_noted", "")
    strategies   = session.get("strategies_tried", "")
    support      = session.get("support_needed", "")
    version      = session.get("plan_version", 1)
    week_start   = next_monday().isoformat()

    return f"""{GUARDRAILS}

{lang_rule}

You are the EACH Planning Agent.

YOUR ROLE: Generate a complete 5-day weekly learning plan. The teacher may ask for a plan even when not all assessment fields are filled. In that case: generate a plan based on available information, state your assumptions clearly at the start (e.g. what you assumed about triggers or support needed), and optionally suggest one or two follow-up questions for refinement. Do NOT refuse to plan; always produce a plan when asked.

STUDENT PROFILE:
  English name : {name_en}
  Arabic name  : {name_ar}
  Grade        : {grade}
  Diagnosis    : {diagnosis} ({severity})

THIS WEEK'S ASSESSMENT (use what is available; fields may be partially filled):
  Difficulty reported : {difficulty or "(not yet reported)"}
  Triggers noted      : {triggers or "(not yet reported)"}
  Strategies tried    : {strategies or "(not yet reported)"}
  Support needed      : {support or "(not yet reported)"}

LONG-TERM MEMORY (use this to avoid repeated strategies and build on what worked):
{memory}

DIAGNOSIS-SPECIFIC STRATEGIES (use ONLY strategies from this document):
{skill}

PLAN TEMPLATE (follow this structure exactly):
{template}

PLAN METADATA:
  Week starts  : {week_start}
  Version      : {version}

INSTRUCTIONS:
1. Generate the plan ONLY in the teacher's language (see OUTPUT LANGUAGE above). Do NOT generate bilingual output. Do NOT include [EN] or [AR] markers.
2. Prefer outputting the plan as a single JSON object with this exact structure (so the UI can render tables):
   {{ "title": "Weekly plan title", "date": "YYYY-MM-DD", "difficulty": "…", "goals": [{{ "goal": "…", "baseline": "…", "target": "…", "measurement": "…", "review_date": "…" }} or strings], "daily_plan": [{{ "day": "Mon", "reading": "…", "math": "…", "behavior": "…", "notes": "…" }} or strings], "strategies": [{{ "situation": "…", "strategy": "…", "script": "…", "frequency": "…" }} or strings], "materials": ["item1", "item2"] }}
   All array elements may be simple strings if you prefer. If you output JSON, put PLAN_GENERATED: [plan starts below] then the JSON on the next line(s).
3. If you do not output JSON, use clean markdown with sections: Weekly Goals, Activities, Daily Exercises, Materials Needed, Progress Tracking (adapt section names to the language).
4. Generate the COMPLETE plan — all 5 days (Sunday through Thursday for KSA, or Monday through Friday if the school follows that schedule).
5. All goals must be measurable and observable.
6. All activities must have time durations.
7. All strategies must come from the diagnosis skill file above.
8. Teacher notes must be immediately actionable (as if handed to teacher at 7am).
9. Do NOT repeat strategies already noted as ineffective in long-term memory.

When the plan is complete, output EXACTLY this on its own line BEFORE the plan text (or JSON):

PLAN_GENERATED: [plan starts below]

Then output the full plan (JSON or markdown). Then call transfer_to_orchestrator.

MANDATORY ORDER: (1) Output the tag line above, (2) Output the COMPLETE plan (JSON with title, goals, daily_plan, strategies), (3) Only then add one short line like "I focused on shorter phonics practice and more breaks." if you want, (4) Then call transfer_to_orchestrator. Never call transfer_to_orchestrator before the full plan is output — the plan is extracted from your message and shown in the Plan tab.

CRITICAL — CHAT DISPLAY: Do NOT include the plan content or JSON in any conversational reply. The plan is extracted automatically and shown only in the Plan tab. After the plan block, do not add text like "CURRENT PLAN TO REVIEW" or "here is the JSON". At most add one short line (e.g. "I focused on shorter phonics practice and more breaks.") before calling transfer_to_orchestrator. The teacher will see only a short message in chat; the full plan appears in the Plan tab.
"""


def build_reflection_prompt(session: dict) -> str:
    student   = session.get("student_profile", {})
    name_en   = student.get("name_en", "the student")
    criteria  = load_reflection_criteria()
    plan      = session.get("current_plan", "")
    lang_rule = _language_rule(session)

    return f"""{GUARDRAILS}

{lang_rule}

You are the EACH Reflection Agent.

YOUR ROLE: Quality-check the generated plan. Improve it if needed.
YOU NEVER create plans from scratch — only validate and improve.

STUDENT: {name_en}

CURRENT PLAN TO REVIEW:
{plan}

QUALITY CRITERIA (from reflection_criteria.md):
{criteria}

INSTRUCTIONS:
1. Run through ALL 10 universal checks.
2. If 8 or more checks pass → the plan is acceptable.
3. If fewer than 8 pass → revise the plan to fix all failing checks.
4. After checking/revising, output a REFLECTION SUMMARY.

If the plan PASSES (≥8/10 checks), output EXACTLY this on its own line:

REFLECTION_PASSED: [reflection summary below]
[Your reflection summary here]
[Then the final (possibly revised) plan]

If the plan was REVISED, output EXACTLY this instead:

PLAN_REVISED: [revised plan below]
[Your reflection summary here]
[Then the revised plan]

After outputting either tag, call transfer_to_orchestrator.

RULES:
- Never ask the teacher questions — this is an internal quality check.
- Keep the plan in the teacher's language (do not add or remove language sections).
- Never change the student's diagnosis or severity.
- If incorporating teacher feedback: classify the feedback type, apply all
  requested changes, re-run checks, increment the version note.
- After 3 revision cycles without passing, add a note: "NEEDS_HUMAN_REVIEW: true"
- Do NOT repeat the plan text or say "CURRENT PLAN TO REVIEW" in your reply. Output only the tag (REFLECTION_PASSED or PLAN_REVISED), your summary, and the plan block. The teacher sees only a short message in chat; the plan is shown in the Plan tab.
"""


def build_evaluation_prompt(session: dict) -> str:
    student  = session.get("student_profile", {})
    name_en  = student.get("name_en", "the student")
    rubric   = load_evaluation_rubric()
    plan     = session.get("current_plan", "")
    version  = session.get("plan_version", 1)
    memory   = session.get("long_term_memory", "")
    lang_rule = _language_rule(session)

    return f"""{GUARDRAILS}

{lang_rule}

You are the EACH Evaluation Agent.

YOUR ROLE: Score the approved plan on a 1–5 scale.

STUDENT: {name_en}
PLAN VERSION: {version}

PLAN TO EVALUATE:
{plan}

HISTORICAL CONTEXT (for comparison):
{memory}

SCORING RUBRIC:
{rubric}

INSTRUCTIONS:
1. If the teacher says they already approved in the UI (e.g. "I already approved", "approved", "I approved it") → do NOT output any evaluation summary or reasoning. Only output: "Thank you — your approval and score have been recorded." Then call transfer_to_orchestrator immediately.
2. Otherwise, score the plan 1–5 using the rubric above and write detailed reasoning.
3. Output the score EXACTLY like this on its own line: EVAL_SCORE: [1-5]
4. Then output your full reasoning. Then call transfer_to_orchestrator.

You must never show a long evaluation summary in the chat when the teacher has already approved in the UI.
"""


# =============================================================================
# SECTION 6: AGENT FACTORY
# =============================================================================

def build_swarm(thread_id: str):
    """
    Build and return a LangGraph Swarm for the given thread.
    Called on EVERY /chat request (per spec §7.1 — prompts must be re-injected).
    """
    session = get_session(thread_id)
    if not session:
        raise ValueError(f"Session not found for thread {thread_id}")

    # ── Handoff tools ──────────────────────────────────────────────────────────
    # Orchestrator → specialists
    to_assessment  = create_handoff_tool(agent_name="assessment_agent")
    to_planning    = create_handoff_tool(agent_name="planning_agent")
    to_reflection  = create_handoff_tool(agent_name="reflection_agent")
    to_evaluation  = create_handoff_tool(agent_name="evaluation_agent")

    # Specialists → orchestrator
    to_orchestrator = create_handoff_tool(agent_name="orchestrator")

    # Build prompts fresh (spec §7.1 — re-inject on every message)
    prompts = {
        "orchestrator":     build_orchestrator_prompt(session),
        "assessment_agent": build_assessment_prompt(session),
        "planning_agent":   build_planning_prompt(session),
        "reflection_agent": build_reflection_prompt(session),
        "evaluation_agent": build_evaluation_prompt(session),
    }

    # ── Agents (state_modifier injects system prompt per-agent) ───────────────
    orchestrator_tools = [to_assessment, to_planning, to_reflection, to_evaluation]
    orchestrator_tool_names = [t.name for t in orchestrator_tools]
    logger.info(f"Orchestrator tools (EXACT names for prompts): {orchestrator_tool_names}")

    orchestrator = create_react_agent(
        llm,
        tools=orchestrator_tools,
        name="orchestrator",
        prompt=prompts["orchestrator"],
    )
    assessment_agent = create_react_agent(
        llm,
        tools=[to_orchestrator],
        name="assessment_agent",
        prompt=prompts["assessment_agent"],
    )
    planning_agent = create_react_agent(
        llm,
        tools=[to_orchestrator],
        name="planning_agent",
        prompt=prompts["planning_agent"],
    )
    reflection_agent = create_react_agent(
        llm,
        tools=[to_orchestrator],
        name="reflection_agent",
        prompt=prompts["reflection_agent"],
    )
    evaluation_agent = create_react_agent(
        llm,
        tools=[to_orchestrator],
        name="evaluation_agent",
        prompt=prompts["evaluation_agent"],
    )

    # ── Swarm ─────────────────────────────────────────────────────────────────
    swarm = create_swarm(
        [orchestrator, assessment_agent, planning_agent, reflection_agent, evaluation_agent],
        default_active_agent="orchestrator",
        checkpointer=_checkpointer,
    )

    return swarm.compile(), prompts


def detect_active_agent(swarm, thread_id: str) -> str:
    """
    Inspect swarm state to determine which agent should handle the next message.
    LangGraph Swarm tracks active_agent in state values.
    Returns the agent name string (defaults to 'orchestrator').
    """
    config = {"configurable": {"thread_id": thread_id}}
    try:
        state = swarm.get_state(config)
        if not state or not state.values:
            return "orchestrator"

        # LangGraph Swarm stores active_agent directly in state
        active = state.values.get("active_agent")
        if active:
            return active

        # Fallback: scan messages for last transfer_to_* tool call
        messages = state.values.get("messages", [])
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    name = tc.get("name", "")
                    if name.startswith("transfer_to_"):
                        target = name.replace("transfer_to_", "")
                        if target == "orchestrator":
                            return "orchestrator"
                        return f"{target}_agent" if not target.endswith("_agent") else target
    except Exception as e:
        logger.warning(f"detect_active_agent error: {e}")

    return "orchestrator"


# =============================================================================
# SECTION 7: RESPONSE PROCESSING
# =============================================================================


def _log_handoff_tools_called(messages: list, thread_id: str = "") -> None:
    """Debug: log every transfer_to_* tool call from AI messages."""
    for m in messages:
        if isinstance(m, AIMessage) and getattr(m, "tool_calls", None):
            for tc in m.tool_calls:
                name = tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", "")
                if name and name.startswith("transfer_to_"):
                    logger.info(f"Handoff tool called: {name} (thread={thread_id})")


# Regex patterns for agent output tags
_RE_FIELD_COLLECTED = re.compile(r'FIELD_COLLECTED:\s*(\{.*?\})', re.DOTALL)
_RE_ASSESSMENT  = re.compile(
    r"ASSESSMENT_COMPLETE:\s*(\{.*?\})", re.DOTALL
)
# Allow flexible whitespace/casing so we catch LLM output variations
# Optional "[plan starts below]" so we match even if LLM puts it on next line or omits it
_RE_PLAN_GEN    = re.compile(r"PLAN_GENERATED\s*:\s*(?:\[plan starts below\]\s*)?(.*)", re.DOTALL | re.IGNORECASE)
_RE_PLAN_REV    = re.compile(r"PLAN_REVISED\s*:\s*\[revised plan below\]\s*(.*)", re.DOTALL | re.IGNORECASE)
_RE_REFL_PASSED = re.compile(r"REFLECTION_PASSED:\s*\[reflection summary below\](.*)", re.DOTALL)
_RE_EVAL_SCORE  = re.compile(r"EVAL_SCORE:\s*([1-5])")


def _looks_like_plan_json(s: str) -> bool:
    """True if s parses as JSON and has plan schema: title + (goals or dailyPlan or daily_plan)."""
    if not s or not isinstance(s, str) or len(s) < 20:
        return False
    try:
        obj = json.loads(s)
        if not isinstance(obj, dict):
            return False
        has_title = "title" in obj
        has_plan_arrays = any(k in obj for k in ("goals", "daily_plan", "dailyPlan", "strategies"))
        return bool(has_title and has_plan_arrays)
    except json.JSONDecodeError:
        return False


def _extract_first_plan_json_from_text(text: str) -> str | None:
    """
    Find the FIRST valid JSON object in text (handles "CURRENT PLAN TO REVIEW", markdown fences, etc.).
    If it has title and (goals or dailyPlan or daily_plan), return it as formatted JSON string.
    """
    if not text or len(text) < 30:
        return None
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                raw = text[start : i + 1]
                try:
                    obj = json.loads(raw)
                    if not isinstance(obj, dict):
                        return None
                    if "title" not in obj:
                        return None
                    if not any(k in obj for k in ("goals", "daily_plan", "dailyPlan", "strategies")):
                        return None
                    return json.dumps(obj, ensure_ascii=False, indent=2)
                except json.JSONDecodeError:
                    return None
    return None


def _extract_plan_json_from_text(text: str) -> str | None:
    """
    Last-resort: LLM sometimes outputs plan JSON but omits PLAN_GENERATED tag.
    1) Try ```json ... ``` or ``` ... ``` blocks.
    2) Try first valid JSON object in text (handles "CURRENT PLAN TO REVIEW", fences).
    Returns the plan string to store (indented JSON), or None.
    """
    if not text or len(text) < 50:
        return None
    # 1) Code blocks
    for start_marker in ("```json", "```"):
        idx = text.find(start_marker)
        if idx == -1:
            continue
        start = idx + len(start_marker)
        rest = text[start:].lstrip()
        end = rest.find("```")
        if end == -1:
            continue
        raw = rest[:end].strip()
        if len(raw) < 50 or not raw.startswith("{"):
            continue
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict) and "title" in obj and any(k in obj for k in ("goals", "daily_plan", "dailyPlan", "strategies")):
                return json.dumps(obj, ensure_ascii=False, indent=2)
        except json.JSONDecodeError:
            continue
    # 2) First valid plan-shaped JSON anywhere in text
    return _extract_first_plan_json_from_text(text)


def parse_agent_output(output_text: str, thread_id: str) -> dict:
    """
    Scan agent output for special tags, update session state accordingly,
    and return cleaned response text plus metadata.
    """
    session    = get_session(thread_id)
    if not session:
        return {"response": output_text, "tags_found": []}

    tags_found: list[str] = []
    cleaned    = output_text

    # ── FIELD_COLLECTED (incremental per-turn field capture) ─────────────────
    for m in _RE_FIELD_COLLECTED.finditer(output_text):
        try:
            data = json.loads(m.group(1))
            field = data.get("field", "").strip()
            value = data.get("value", "").strip()
            valid_fields = {"difficulty_reported", "triggers_noted", "strategies_tried", "support_needed"}
            if field in valid_fields and value:
                update_session(thread_id, {field: value})
                tags_found.append(f"FIELD_COLLECTED:{field}")
        except json.JSONDecodeError:
            logger.warning("FIELD_COLLECTED JSON parse failed")

    # ── ASSESSMENT_COMPLETE ───────────────────────────────────────────────────
    m = _RE_ASSESSMENT.search(output_text)
    if m:
        try:
            data = json.loads(m.group(1))
            update: dict = {}
            for field in ["difficulty_reported", "triggers_noted", "strategies_tried", "support_needed"]:
                if data.get(field):
                    update[field] = data[field]
            update_session(thread_id, update)
            tags_found.append("ASSESSMENT_COMPLETE")
        except json.JSONDecodeError:
            logger.warning("ASSESSMENT_COMPLETE JSON parse failed")

    # ── PLAN_GENERATED ────────────────────────────────────────────────────────
    m = _RE_PLAN_GEN.search(output_text)
    if m:
        plan_text = m.group(1).strip()
        if plan_text:
            update_session(thread_id, {"current_plan": plan_text})
            tags_found.append("PLAN_GENERATED")
            sess = get_session(thread_id)
            student_id = sess.get("student_id") if sess else None
            logger.info(f"Plan generated and saved for studentId={student_id} thread_id={thread_id} (len={len(plan_text)})")
        else:
            logger.warning("PLAN_GENERATED tag found but captured plan content was empty")
    else:
        # Fallback: LLM may have used different formatting; look for PLAN_GENERATED then content (e.g. JSON block)
        idx = re.search(r"PLAN_GENERATED\s*:", output_text, re.IGNORECASE)
        if idx:
            after = output_text[idx.end() :].strip()
            # Strip optional "[plan starts below]" line then take the rest
            after = re.sub(r"^\s*\[plan starts below\]\s*", "", after, flags=re.IGNORECASE)
            if after and len(after) > 20:
                update_session(thread_id, {"current_plan": after})
                tags_found.append("PLAN_GENERATED")
                sess = get_session(thread_id)
                student_id = sess.get("student_id") if sess else None
                logger.info(f"Plan generated (fallback) and saved for studentId={student_id} thread_id={thread_id} (len={len(after)})")

    # Last-resort: LLM sometimes outputs plan JSON but omits the tag; look for plan-shaped JSON in output
    if "PLAN_GENERATED" not in tags_found and "PLAN_REVISED" not in tags_found:
        plan_candidate = _extract_plan_json_from_text(output_text)
        if plan_candidate:
            update_session(thread_id, {"current_plan": plan_candidate})
            tags_found.append("PLAN_GENERATED")
            sess = get_session(thread_id)
            student_id = sess.get("student_id") if sess else None
            logger.info(f"Plan extracted from JSON fallback for studentId={student_id} thread_id={thread_id} (len={len(plan_candidate)})")
        else:
            # Diagnostic: log when we had no plan so we can see what the agent actually output
            snippet = (output_text.strip()[-500:] if len(output_text) > 500 else output_text.strip()) or "(empty)"
            logger.info(f"No plan found in agent output (len={len(output_text)}). Snippet: {snippet[:200]!r}...")

    # ── PLAN_REVISED ──────────────────────────────────────────────────────────
    m = _RE_PLAN_REV.search(output_text)
    if m:
        plan_text = m.group(1).strip()
        update_session(thread_id, {"current_plan": plan_text})
        tags_found.append("PLAN_REVISED")

    # ── REFLECTION_PASSED ─────────────────────────────────────────────────────
    m = _RE_REFL_PASSED.search(output_text)
    if m:
        update_session(thread_id, {"reflection_done": True})
        tags_found.append("REFLECTION_PASSED")

    # ── EVAL_SCORE ────────────────────────────────────────────────────────────
    m = _RE_EVAL_SCORE.search(output_text)
    if m:
        score = int(m.group(1))
        update_session(thread_id, {"eval_score": score})
        tags_found.append(f"EVAL_SCORE:{score}")

    return {
        "response":   _clean_tags(output_text),  # fallback; /chat overrides this
        "tags_found": tags_found,
    }


def _try_extract_plan_from_ai_message_chunks(thread_id: str, message_contents: list[str]) -> str | None:
    """
    When full concatenated output didn't yield a plan, try each AI message chunk separately.
    Returns plan string if found and updates session; else None.
    """
    for chunk in message_contents:
        if not chunk or len(chunk) < 30:
            continue
        plan = _extract_plan_json_from_text(chunk)
        if plan:
            update_session(thread_id, {"current_plan": plan})
            sess = get_session(thread_id)
            student_id = sess.get("student_id") if sess else None
            logger.info(f"Plan extracted from individual AI message chunk for studentId={student_id} thread_id={thread_id} (len={len(plan)})")
            return plan
        plan = _extract_first_plan_json_from_text(chunk)
        if plan:
            update_session(thread_id, {"current_plan": plan})
            sess = get_session(thread_id)
            student_id = sess.get("student_id") if sess else None
            logger.info(f"Plan extracted (first-JSON) from individual AI message chunk for studentId={student_id} thread_id={thread_id} (len={len(plan)})")
            return plan
    return None


def _clean_tags(text: str) -> str:
    """Remove internal structured tags from text shown to the teacher."""
    tag_patterns = [
        r"FIELD_COLLECTED:\s*\{.*?\}",
        r"ASSESSMENT_COMPLETE:\s*\{.*?\}",
        r"PLAN_GENERATED:\s*\[plan starts below\]",
        r"PLAN_REVISED:\s*\[revised plan below\]",
        r"REFLECTION_PASSED:\s*\[reflection summary below\]",
        r"EVAL_SCORE:\s*[1-5]",
    ]
    cleaned = text
    for pat in tag_patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()


# Safe message when plan is ready (artifact-only; no JSON in chat)
_PLAN_READY_MESSAGE = (
    "Plan is ready. Review it in the Plan tab. You can Approve or Decline and send feedback to revise."
)


def _contains_plan_or_json_leakage(text: str) -> bool:
    """True if text looks like raw plan/JSON or internal process output. Teachers must never see this in chat."""
    if not text or not isinstance(text, str):
        return False
    t = text.strip()
    # Literal "CURRENT PLAN TO REVIEW" (any case)
    if "CURRENT PLAN TO REVIEW" in t.upper():
        return True
    # Triple backticks around JSON or plan content
    if "```" in t and ("json" in t.lower() or re.search(r"```\s*\n?\s*\{", t) or '"title"' in t or '"goals"' in t or '"daily_plan"' in t or '"dailyPlan"' in t):
        return True
    # Large JSON object that includes "title" (plan schema)
    if re.search(r'\{\s*"title"\s*:', t):
        return True
    if re.search(r'\{\s*"goals"\s*:', t):
        return True
    if re.search(r'\{\s*"dailyPlan"\s*:', t) or re.search(r'\{\s*"daily_plan"\s*:', t):
        return True
    if re.search(r'\{\s*"dateRange"\s*:', t):
        return True
    return False


def _extract_optional_one_line_summary(text: str) -> Optional[str]:
    """If there is a short sentence before JSON/plan block, return it (max ~140 chars)."""
    if not text or not isinstance(text, str):
        return None
    for sep in [r"```", r'\{\s*"title"', r'\{\s*"goals"', "PLAN_GENERATED:", "PLAN_REVISED:"]:
        m = re.search(sep, text, re.IGNORECASE)
        if m:
            before = text[: m.start()].strip()
            before = " ".join(before.split())
            if 10 <= len(before) <= 140 and not _contains_plan_or_json_leakage(before):
                return before
            break
    return None


def _sanitize_chat_response_for_teacher(
    text: str,
    plan_attached: bool,
    tags_found: Optional[list] = None,
) -> str:
    """
    Guardrail: never send raw JSON, plan dumps, or process talk to the chat UI.
    When a plan is attached or leakage is detected, replace with a short teacher-friendly message.
    """
    tags_found = tags_found or []
    plan_in_tags = "PLAN_GENERATED" in tags_found or "PLAN_REVISED" in tags_found

    if not plan_attached and not plan_in_tags and not _contains_plan_or_json_leakage(text):
        process_phrases = [
            r"current plan to review\s*:?\s*",
            r"here is the (plan\s*)?(json)?\s*:?\s*",
            r"```json\s*[\s\S]*?```",
        ]
        out = text
        for pat in process_phrases:
            out = re.sub(pat, "", out, flags=re.IGNORECASE | re.DOTALL)
        return out.strip() or text.strip()

    if plan_attached or plan_in_tags or _contains_plan_or_json_leakage(text):
        logger.info("Chat response sanitized: plan/JSON leakage or plan_attached — replaced with safe message")
    summary = _extract_optional_one_line_summary(text)
    if summary:
        return f"{_PLAN_READY_MESSAGE}\n\n{summary}"
    return _PLAN_READY_MESSAGE


def extract_bilingual_plan(plan_text: str) -> tuple[str, str]:
    """
    Extract plan content. Plans are now monolingual (teacher's language only).
    If no [EN]/[AR] markers: return (plan_text, plan_text) so UI can display regardless of toggle.
    If legacy bilingual markers exist: split and return (en_content, ar_content).
    """
    en_match = re.search(r"\[EN\](.*?)(?=\[AR\]|$)", plan_text, re.DOTALL)
    ar_match = re.search(r"\[AR\](.*?)$", plan_text, re.DOTALL)
    if en_match or ar_match:
        en = en_match.group(1).strip() if en_match else ""
        ar = ar_match.group(1).strip() if ar_match else ""
        return en, ar
    # Monolingual plan: same content for both columns
    content = plan_text.strip()
    return content, content


# =============================================================================
# SECTION 8: FASTAPI APPLICATION
# =============================================================================

app = FastAPI(
    title="EACH Backend",
    description="Every Ability, Celebrated Here — AI-powered IEP planning for Saudi special education teachers",
    version="3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────

def _detect_language_from_message(text: str) -> str:
    """Fallback: detect language from user message. Arabic chars → 'ar', else 'en'."""
    if not text or not isinstance(text, str):
        return "en"
    for c in text:
        if "\u0600" <= c <= "\u06FF" or "\u0750" <= c <= "\u077F":
            return "ar"
    return "en"


class ChatRequest(BaseModel):
    message:            str
    student_id:         Optional[int] = None
    thread_id:          Optional[str] = None
    preferred_language: Optional[str] = None  # "en" | "ar" from UI toggle
    intent:             Optional[str] = None  # "PLAN_GENERATE" | "PLAN_SIMPLIFY" | "PLAN_ADD_STRATEGY"; fallback to detect from message


class ChatResponse(BaseModel):
    response:            str
    session:             dict
    plan:                Optional[str] = None
    plan_id:             Optional[int] = None
    tags_found:          list[str] = []
    suggested_student_id: Optional[int] = None


class EvaluateRequest(BaseModel):
    thread_id: str
    score:     int
    plan_id:   Optional[int] = None


class SavePlanRequest(BaseModel):
    thread_id:       str
    approved:        bool
    plan_content_en: str = ""
    plan_content_ar: str = ""


class ApprovePlanRequest(BaseModel):
    score: int


class PlanReviseRequest(BaseModel):
    student_id: int
    current_plan: str
    feedback: str
    plan_id: Optional[str] = None
    context: Optional[dict] = None  # studentProfile, approvedUpdates, recentTeacherNotes, recentChatTurns


class PlanReviseResponse(BaseModel):
    revised_plan: str
    plan_json: Optional[dict] = None


class MoodRequest(BaseModel):
    student_id: int
    mood:       str
    note:       str = ""


class MilestoneRequest(BaseModel):
    student_id:  int
    title:       str
    description: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "version": "3.0", "system": "EACH — Every Ability, Celebrated Here"}


@app.get("/health")
def health():
    return {"status": "healthy", "architecture": "LangGraph Swarm", "version": "3.0"}


@app.get("/sessions/{thread_id}/messages")
def get_session_messages_endpoint(thread_id: str):
    """Load message history for a session. Returns [] if none or column missing."""
    try:
        msgs = get_session_messages(thread_id)
        return {"messages": msgs}
    except Exception as e:
        logger.error(f"GET /sessions/{thread_id}/messages error: {e}")
        return {"messages": []}


@app.get("/sessions/recent")
def get_recent_sessions():
    """Return recent sessions from DB for Recent Messages (session history)."""
    try:
        res = (
            supabase.table("sessions")
            .select("session_id, student_id, date, difficulty_reported, triggers_noted, plan_approved")
            .order("date", desc=True)
            .limit(20)
            .execute()
        )
        sessions = res.data or []
        if not sessions:
            return []
        student_ids = list({s["student_id"] for s in sessions if s.get("student_id")})
        if not student_ids:
            return [{"session_id": s["session_id"], "student_id": None, "student_name": "", "date": s.get("date"), "preview": "Session", "thread_id": s["session_id"]} for s in sessions]
        students_res = supabase.table("students").select("student_id, name_en, name_ar").in_("student_id", student_ids).execute()
        students = {s["student_id"]: s for s in (students_res.data or [])}
        result = []
        for s in sessions:
            sid = s.get("student_id")
            st = students.get(sid) or {}
            name = st.get("name_en") or st.get("name_ar") or ""
            parts = [s.get("difficulty_reported"), s.get("triggers_noted")] if s.get("difficulty_reported") or s.get("triggers_noted") else []
            preview = "; ".join(p for p in parts if p)[:80] if parts else "Session"
            result.append({
                "session_id": s["session_id"],
                "student_id": sid,
                "student_name": name,
                "thread_id": s["session_id"],
                "date": s.get("date"),
                "preview": preview,
                "plan_approved": s.get("plan_approved"),
            })
        return result
    except Exception as e:
        logger.error(f"GET /sessions/recent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/students")
def get_students():
    try:
        return list_students_with_alert_counts()
    except Exception as e:
        logger.error(f"GET /students error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/students/{student_id}")
def get_student_profile(student_id: int):
    profile = get_student_full_profile(student_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
    return profile


def _chat_general_mode(message: str, preferred_language: str | None = None) -> tuple[str, Optional[int]]:
    """
    General mode: no student selected. Use LLM to respond helpfully,
    list students, or infer student from message. Returns (response_text, suggested_student_id).
    preferred_language: "en" | "ar" from UI; if None, fallback to detect from message.
    """
    students = list_students_with_alert_counts()
    student_list = ", ".join(
        f"{s.get('name_en', '?')}" + (f" / {s.get('name_ar', '')}" if s.get("name_ar") else "")
        for s in students[:20]
    ) or "No students in database yet."

    matched = find_student_by_name(message)
    suggested_id = matched["student_id"] if matched else None

    lang = preferred_language if preferred_language in ("en", "ar") else _detect_language_from_message(message)
    lang_name = "Arabic" if lang == "ar" else "English"
    system = f"""You are EACH — Every Ability, Celebrated Here. An AI assistant for Saudi special education teachers.

STUDENTS IN DATABASE: {student_list}

The teacher is chatting with you. They can:
- Say hello, ask general questions, or ask who their students are
- Mention any student by name (e.g. "Ahmed" or "How is Sara doing?") — the system will automatically work with that student
- Ask for help with planning, strategies, or classroom support

You MUST respond in {lang_name} only (preferred_language={lang}). Do NOT mix languages. Be warm and conversational.
If they ask who their students are, list the names above naturally — tell them to just mention a name and you'll continue.
Never say "select a student" or "please select" — they simply mention a name and you adapt."""
    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=message)])
    text = response.content if hasattr(response, "content") else str(response)
    return (text.strip(), suggested_id)


def _agent_label(agent_name: str) -> str:
    """Map internal agent name to display label."""
    labels = {
        "orchestrator":      "Orchestrator",
        "assessment_agent":  "Assessment Agent",
        "planning_agent":    "Planning Agent",
        "reflection_agent":  "Reflection Agent",
        "evaluation_agent":  "Evaluation Agent",
    }
    return labels.get(agent_name, agent_name or "Orchestrator")


def _message_for_intent(intent: Optional[str], fallback: str) -> str:
    """Map teacher intent to canonical message for the agent."""
    if intent == "PLAN_GENERATE":
        return "Generate a weekly plan based on the student's profile and any approved updates."
    if intent == "PLAN_SIMPLIFY":
        return "Make the plan easier: fewer tasks, shorter durations, clearer steps, more breaks, less cognitive load."
    if intent == "PLAN_ADD_STRATEGY":
        return "Add a strategy to the plan for this student (e.g. reading focus, behavior, or support)."
    return fallback


def _chat_stream(req: ChatRequest):
    """Generator that yields SSE events for real-time progress + final response."""
    import json as _json
    try:
        student_id = req.student_id
        if student_id is None:
            matched = find_student_by_name(req.message)
            if matched:
                student_id = matched["student_id"]

        if student_id is None:
            pref_lang = req.preferred_language if req.preferred_language in ("en", "ar") else _detect_language_from_message(req.message)
            yield f"data: {_json.dumps({'type': 'progress', 'agent': 'orchestrator', 'label': _agent_label('orchestrator')})}\n\n"
            response_text, suggested_id = _chat_general_mode(req.message, pref_lang)
            yield f"data: {_json.dumps({'type': 'done', 'response': response_text, 'session': {}, 'plan': None, 'tags_found': [], 'suggested_student_id': suggested_id})}\n\n"
            return

        thread_id = req.thread_id or f"student_{student_id}_{date.today().isoformat()}"

        yield f"data: {_json.dumps({'type': 'progress', 'agent': 'loading_skills', 'label': 'Loading skills...'})}\n\n"
        session = init_session(thread_id, student_id)
        preferred_lang = resolve_and_store_preferred_language(thread_id, req)
        swarm, _ = build_swarm(thread_id)
        config = {"configurable": {"thread_id": thread_id}}

        effective_message = _message_for_intent(req.intent, req.message)

        messages_to_send = [HumanMessage(content=effective_message)]
        # If checkpoint has AIMessage with tool_calls but no ToolMessage, invoke would raise INVALID_CHAT_HISTORY.
        # Use a fresh thread_id for this invoke only so the run succeeds and the plan can be returned.
        try:
            state = swarm.get_state(config)
            existing = (state.values or {}).get("messages") or []
            if existing and _last_message_has_pending_tool_calls(existing):
                config = {"configurable": {"thread_id": f"{thread_id}_r_{int(time.time() * 1000)}"}}
                logger.info(f"Using fresh config for invoke to avoid INVALID_CHAT_HISTORY (thread {thread_id})")
        except Exception:
            pass

        try:
            stream = swarm.stream(
                {"messages": messages_to_send},
                config,
                stream_mode="updates",
            )
        except TypeError:
            stream = None

        if stream is not None:
            for chunk in stream:
                node_name = None
                if isinstance(chunk, dict):
                    node_name = list(chunk.keys())[0] if chunk else None
                elif isinstance(chunk, (list, tuple)) and len(chunk) >= 1:
                    node_name = chunk[0] if isinstance(chunk[0], str) else None
                if node_name:
                    label = _agent_label(node_name)
                    yield f"data: {_json.dumps({'type': 'progress', 'agent': node_name, 'label': label})}\n\n"
            result = swarm.get_state(config).values
        else:
            yield f"data: {_json.dumps({'type': 'progress', 'agent': 'orchestrator', 'label': _agent_label('orchestrator')})}\n\n"
            result = swarm.invoke(
                {"messages": messages_to_send},
                config,
            )

        messages = result.get("messages", [])
        response_text = ""
        full_ai_text = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                c = msg.content if isinstance(msg.content, str) else str(msg.content)
                if not response_text and c.strip():
                    response_text = c
                full_ai_text = c + "\n" + full_ai_text
        parsed = parse_agent_output(full_ai_text, thread_id)
        parsed["response"] = _clean_tags(response_text)
        current_plan_stream = (get_session(thread_id) or {}).get("current_plan") or None
        if not current_plan_stream:
            ai_chunks = []
            for msg in messages:
                if isinstance(msg, AIMessage) and msg.content:
                    c = msg.content if isinstance(msg.content, str) else str(msg.content)
                    if c.strip():
                        ai_chunks.append(c)
            plan_from_chunk = _try_extract_plan_from_ai_message_chunks(thread_id, ai_chunks)
            if plan_from_chunk:
                current_plan_stream = plan_from_chunk
                parsed["tags_found"] = list(parsed.get("tags_found", [])) + ["PLAN_GENERATED"]
        plan_attached_stream = bool(current_plan_stream and _looks_like_plan_json(current_plan_stream)) or "PLAN_GENERATED" in parsed.get("tags_found", []) or "PLAN_REVISED" in parsed.get("tags_found", [])
        parsed["response"] = _sanitize_chat_response_for_teacher(
            parsed["response"],
            plan_attached=plan_attached_stream,
            tags_found=parsed.get("tags_found"),
        )
        _log_handoff_tools_called(messages, thread_id)
        sess = get_session(thread_id)
        tags = parsed.get("tags_found", [])
        agent_name = "orchestrator"
        for t in tags:
            if t.startswith("FIELD_COLLECTED") or t == "ASSESSMENT_COMPLETE":
                agent_name = "assessment_agent"
                break
            if t in ("PLAN_GENERATED", "PLAN_REVISED"):
                agent_name = "planning_agent"
                break
            if t == "REFLECTION_PASSED":
                agent_name = "reflection_agent"
                break
            if t.startswith("EVAL_SCORE"):
                agent_name = "evaluation_agent"
                break
        logger.info(f"Language debug: preferred_language={preferred_lang} | final_agent={agent_name} | thread={thread_id}")
        if sess and sess.get("plan_approved") and "EVAL_SCORE" in parsed["tags_found"]:
            if len(parsed["response"]) > 150:
                parsed["response"] = "Thank you — your approval and score have been recorded."
        if sess:
            stored_msgs = _messages_to_store(messages, parsed["tags_found"])
            save_session_to_db(thread_id, student_id, sess, messages=stored_msgs)
        plan_id_saved = None
        if sess and sess.get("current_plan") and ("PLAN_GENERATED" in parsed["tags_found"] or _looks_like_plan_json(sess["current_plan"])):
            plan_en, plan_ar = extract_bilingual_plan(sess["current_plan"])
            plan_id_saved = save_plan_to_db(
                student_id=sess["student_id"], plan_content_en=plan_en, plan_content_ar=plan_ar,
                approved=False, score=sess.get("eval_score", 0), version=sess.get("plan_version", 1),
            )
            logger.info(f"Plan saved to DB for studentId={student_id} planId={plan_id_saved}")
        if current_plan_stream and plan_attached_stream:
            logger.info(f"Returning plan to frontend (stream) studentId={student_id} len={len(current_plan_stream)}")
        payload = {
            "type": "done",
            "response": parsed["response"],
            "session": session_summary(get_session(thread_id) or {}),
            "plan": current_plan_stream,
            "plan_id": plan_id_saved,
            "tags_found": parsed["tags_found"],
            "suggested_student_id": student_id if req.student_id is None else None,
        }
        yield f"data: {_json.dumps(payload)}\n\n"
    except Exception as e:
        logger.error(f"Chat stream error: {e}", exc_info=True)
        yield f"data: {_json.dumps({'type': 'error', 'detail': str(e)})}\n\n"


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """Stream chat with real-time progress events (SSE)."""
    return StreamingResponse(
        _chat_stream(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    Main conversation endpoint.

    When student_id is None: general mode — agent responds with student list, greets, or infers student from message.
    When student_id is set: full swarm flow (assessment, planning, etc.).
    """
    try:
        # ── Auto-detect student from message when none selected ───────────────────
        student_id = req.student_id
        if student_id is None:
            matched = find_student_by_name(req.message)
            if matched:
                student_id = matched["student_id"]
                logger.info(f"Auto-detected student from message: {matched.get('name_en')} (id={student_id})")

        # ── General mode: no student found in message ──────────────────────────────
        if student_id is None:
            pref_lang = req.preferred_language if req.preferred_language in ("en", "ar") else _detect_language_from_message(req.message)
            response_text, suggested_id = _chat_general_mode(req.message, pref_lang)
            return ChatResponse(
                response            = response_text,
                session             = {},
                plan                = None,
                tags_found          = [],
                suggested_student_id = suggested_id,
            )

        # ── Full swarm mode: student known (from frontend or auto-detected) ───────
        thread_id = req.thread_id or f"student_{student_id}_{date.today().isoformat()}"

        # 1. Initialize or retrieve session
        session = init_session(thread_id, student_id)
        preferred_lang = resolve_and_store_preferred_language(thread_id, req)

        # 2. Build swarm with fresh prompts baked into each agent via state_modifier
        swarm, _ = build_swarm(thread_id)
        config = {"configurable": {"thread_id": thread_id}}

        effective_message = _message_for_intent(req.intent, req.message)

        messages_to_send = [HumanMessage(content=effective_message)]
        # If checkpoint has AIMessage with tool_calls but no ToolMessage, invoke would raise INVALID_CHAT_HISTORY.
        # Use a fresh thread_id for this invoke only so the run succeeds and the plan is returned.
        try:
            state = swarm.get_state(config)
            existing = (state.values or {}).get("messages") or []
            if existing and _last_message_has_pending_tool_calls(existing):
                config = {"configurable": {"thread_id": f"{thread_id}_r_{int(time.time() * 1000)}"}}
                logger.info(f"Using fresh config for invoke to avoid INVALID_CHAT_HISTORY (thread {thread_id})")
        except Exception:
            pass

        logger.info(f"Active agent: {detect_active_agent(swarm, thread_id)} | thread: {thread_id}")

        # 3. Invoke — each agent uses its own state_modifier; no extra SystemMessage needed
        result = swarm.invoke(
            {"messages": messages_to_send},
            config,
        )

        # 5. Extract the specialist's response (not the orchestrator's relay).
        #
        # Swarm flow:
        #   orchestrator (transfer_to_X) → specialist (content + transfer_to_orchestrator)
        #   → orchestrator (relay summary ← we do NOT want this)
        #
        # Strategy: find the last AIMessage that contains BOTH real content AND a
        # transfer_to_orchestrator tool call — that is the specialist's reply.
        # Fall back to the last AIMessage with any content if no handoff found.
        # 4. Extract messages (full swarm mode)
        #    - response_text : last AIMessage with content (shown to teacher)
        #    - full_ai_text  : all AIMessage content concatenated (for tag scanning)
        messages = result.get("messages", [])
        response_text = ""
        full_ai_text  = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                c = msg.content if isinstance(msg.content, str) else str(msg.content)
                if not response_text and c.strip():
                    response_text = c
                full_ai_text = c + "\n" + full_ai_text  # prepend (chronological order)

        # 5. Parse tags from ALL AI messages so we don't miss tags in earlier messages
        #    (e.g. PLAN_GENERATED from planning agent before orchestrator re-ran)
        parsed = parse_agent_output(full_ai_text, thread_id)
        parsed["response"] = _clean_tags(response_text)  # show teacher the last message
        current_plan = (get_session(thread_id) or {}).get("current_plan") or None
        if not current_plan:
            ai_chunks = []
            for msg in messages:
                if isinstance(msg, AIMessage) and msg.content:
                    c = msg.content if isinstance(msg.content, str) else str(msg.content)
                    if c.strip():
                        ai_chunks.append(c)
            plan_from_chunk = _try_extract_plan_from_ai_message_chunks(thread_id, ai_chunks)
            if plan_from_chunk:
                current_plan = plan_from_chunk
                parsed["tags_found"] = list(parsed.get("tags_found", [])) + ["PLAN_GENERATED"]
        plan_attached = bool(current_plan and _looks_like_plan_json(current_plan)) or "PLAN_GENERATED" in parsed.get("tags_found", []) or "PLAN_REVISED" in parsed.get("tags_found", [])
        parsed["response"] = _sanitize_chat_response_for_teacher(
            parsed["response"],
            plan_attached=plan_attached,
            tags_found=parsed.get("tags_found"),
        )

        sess = get_session(thread_id)

        # 5b. Do not show evaluation summary in chat when teacher already approved in UI
        if sess and sess.get("plan_approved") and "EVAL_SCORE" in parsed["tags_found"]:
            if len(parsed["response"]) > 150:
                parsed["response"] = "Thank you — your approval and score have been recorded."

        # 6. Log handoff tool calls and language for debugging
        _log_handoff_tools_called(messages, thread_id)
        tags = parsed.get("tags_found", [])
        agent_name = "orchestrator"
        for t in tags:
            if t.startswith("FIELD_COLLECTED") or t == "ASSESSMENT_COMPLETE":
                agent_name = "assessment_agent"
                break
            if t in ("PLAN_GENERATED", "PLAN_REVISED"):
                agent_name = "planning_agent"
                break
            if t == "REFLECTION_PASSED":
                agent_name = "reflection_agent"
                break
            if t.startswith("EVAL_SCORE"):
                agent_name = "evaluation_agent"
                break
        logger.info(f"Language debug: preferred_language={preferred_lang} | final_agent={agent_name} | thread={thread_id}")

        # 7. Persist session and messages to Supabase
        if sess:
            stored_msgs = _messages_to_store(messages, parsed["tags_found"])
            save_session_to_db(thread_id, student_id, sess, messages=stored_msgs)

        plan_id_saved: int | None = None
        if sess and sess.get("current_plan") and ("PLAN_GENERATED" in parsed["tags_found"] or _looks_like_plan_json(sess["current_plan"])):
            plan_en, plan_ar = extract_bilingual_plan(sess["current_plan"])
            plan_id_saved = save_plan_to_db(
                student_id      = sess["student_id"],
                plan_content_en = plan_en,
                plan_content_ar = plan_ar,
                approved        = False,
                score           = sess.get("eval_score", 0),
                version         = sess.get("plan_version", 1),
            )
            logger.info(f"Plan saved to DB for studentId={student_id} planId={plan_id_saved}")

        current_plan = (get_session(thread_id) or {}).get("current_plan") or None
        if current_plan and plan_attached:
            logger.info(f"Returning plan to frontend studentId={student_id} len={len(current_plan)}")

        return ChatResponse(
            response             = parsed["response"],
            session              = session_summary(get_session(thread_id) or {}),
            plan                 = current_plan,
            plan_id              = plan_id_saved,
            tags_found           = parsed["tags_found"],
            suggested_student_id = student_id if req.student_id is None else None,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"POST /chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluate")
def evaluate(req: EvaluateRequest):
    """Teacher scores a plan (1–5)."""
    if not 1 <= req.score <= 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")

    try:
        if req.plan_id:
            teacher_score_plan(req.plan_id, req.score)

        # Also update session eval score
        sess = get_session(req.thread_id)
        if sess:
            update_session(req.thread_id, {"eval_score": req.score})
            save_session_to_db(req.thread_id, sess["student_id"], get_session(req.thread_id) or {})

        return {"status": "ok", "message": f"Teacher score {req.score} saved"}
    except Exception as e:
        logger.error(f"POST /evaluate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/plans/{plan_id}/approve")
def approve_plan(plan_id: int, req: ApprovePlanRequest):
    """Approve an existing plan (teacher_approved=true, teacher_score)."""
    if not 1 <= req.score <= 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5")
    try:
        teacher_score_plan(plan_id, req.score)
        return {"status": "ok", "message": f"Plan {plan_id} approved"}
    except Exception as e:
        logger.error(f"PATCH /plans/{plan_id}/approve error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/plans/save")
def save_plan(req: SavePlanRequest):
    """Save a plan with approval status. Splits bilingual content if not pre-split."""
    sess = get_session(req.thread_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session {req.thread_id} not found")

    try:
        plan_en = req.plan_content_en
        plan_ar = req.plan_content_ar

        # If the frontend didn't pre-split, try to extract from current_plan
        if not plan_en and not plan_ar and sess.get("current_plan"):
            plan_en, plan_ar = extract_bilingual_plan(sess["current_plan"])

        plan_id = save_plan_to_db(
            student_id      = sess["student_id"],
            plan_content_en = plan_en,
            plan_content_ar = plan_ar,
            approved        = req.approved,
            score           = sess.get("eval_score", 0),
            version         = sess.get("plan_version", 1),
        )

        update_session(req.thread_id, {"plan_approved": req.approved})
        save_session_to_db(req.thread_id, sess["student_id"], get_session(req.thread_id) or {})

        return {"status": "ok", "plan_id": plan_id, "approved": req.approved}
    except Exception as e:
        logger.error(f"POST /plans/save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _revise_plan_with_llm(
    current_plan: str,
    feedback: str,
    preferred_lang: str = "en",
    context: Optional[dict] = None,
) -> tuple[str, Optional[dict]]:
    """Call LLM to revise plan based on teacher feedback (REVISION MODE). Returns (revised_plan_text, plan_json or None)."""
    lang_instruction = "Respond only in Arabic." if preferred_lang == "ar" else "Respond only in English."
    ctx = context or {}
    student_profile = ctx.get("studentProfile") or {}
    approved_updates = ctx.get("approvedUpdates") or []
    recent_notes = ctx.get("recentTeacherNotes") or []
    recent_turns = ctx.get("recentChatTurns") or []

    simplify_instruction = ""
    if "easier" in feedback.lower() or "simplif" in feedback.lower() or "less" in feedback.lower():
        simplify_instruction = """
APPLY SIMPLIFICATION: fewer tasks, shorter durations, clearer steps, more breaks, less cognitive load.
"""

    prompt = f"""You are the EACH Planning Agent in REVISION MODE. The teacher has declined the current plan and provided feedback. Revise the plan accordingly.

{lang_instruction}

CRITICAL: Revise the EXISTING plan based on teacher feedback. Do NOT discard the whole plan unless the feedback explicitly requires major or full changes. Prefer targeted edits (e.g. shorten activities, add breaks, lower difficulty) over rewriting from scratch.

CURRENT PLAN:
{current_plan}

TEACHER FEEDBACK (apply these changes):
{feedback}
{simplify_instruction}

CONTEXT (use to ground the revision):
- Student profile: {student_profile}
- Approved updates: {approved_updates}
- Recent teacher notes: {recent_notes}
- Recent chat (last 2–3 turns): {recent_turns[:3] if isinstance(recent_turns, list) else recent_turns}

INSTRUCTIONS:
1. Produce the FULL revised plan that incorporates the feedback and context.
2. You MUST output ONLY a single JSON object (no markdown, no intro). Use this exact schema:
   {{"title":"...","dateRange":{{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}},"student":{{"name":"...","classOrGrade":"..."}},"difficultyLevel":"standard|easy|challenging","basedOn":["..."],"goals":[{{"goal":"...","baseline":"...","target":"...","measurement":"...","reviewDate":"YYYY-MM-DD"}}],"dailyPlan":[{{"day":"Mon","reading":"...","math":"...","support":"...","breaks":"...","notes":"..."}}],"strategies":[{{"situation":"...","strategy":"...","teacherScript":"...","frequency":"..."}}],"materials":["..."],"homeFollowUp":["..."]}}
3. Use empty arrays or strings where not applicable. All fields must be present.

Output ONLY the JSON object now."""
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        text = (response.content if hasattr(response, "content") else str(response)).strip()
        plan_json = None
        try:
            start = text.find("{")
            if start >= 0:
                depth = 0
                end = -1
                for i in range(start, len(text)):
                    if text[i] == "{":
                        depth += 1
                    elif text[i] == "}":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                if end > start:
                    plan_json = json.loads(text[start:end])
                    if isinstance(plan_json, dict) and any(
                        k in plan_json for k in ("goals", "dailyPlan", "strategies", "materials", "daily_plan")
                    ):
                        text = json.dumps(plan_json, ensure_ascii=False, indent=2)
        except (json.JSONDecodeError, ValueError):
            pass
        return (text, plan_json)
    except Exception as e:
        logger.error(f"LLM revise plan error: {e}")
        raise


@app.post("/plan/revise", response_model=PlanReviseResponse)
def plan_revise(req: PlanReviseRequest):
    """Revise plan based on teacher feedback. Calls LLM in REVISION MODE and returns updated plan (strict JSON)."""
    try:
        preferred_lang = "en"
        if req.context and isinstance(req.context.get("preferred_language"), str):
            pl = req.context["preferred_language"]
            if pl in ("en", "ar"):
                preferred_lang = pl
        revised_text, plan_json = _revise_plan_with_llm(
            req.current_plan,
            req.feedback,
            preferred_lang=preferred_lang,
            context=req.context,
        )
        return PlanReviseResponse(revised_plan=revised_text, plan_json=plan_json)
    except Exception as e:
        logger.error(f"POST /plan/revise error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/mood")
def mood(req: MoodRequest):
    """Log a student's mood observation."""
    try:
        log_mood(req.student_id, req.mood, req.note)
        return {"status": "ok", "message": "Mood logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/milestone")
def milestone(req: MilestoneRequest):
    """Log a student milestone."""
    try:
        log_milestone(req.student_id, req.title, req.description)
        return {"status": "ok", "message": "Milestone logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
