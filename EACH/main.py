# =============================================================================
# EACH Backend — Every Ability, Celebrated Here
# FastAPI + LangGraph Swarm + Supabase
# Version 3.0 | March 2026
# =============================================================================

# =============================================================================
# SECTION 1: IMPORTS & CONFIGURATION
# =============================================================================

import base64
import json
import logging
import os
import re
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
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
try:
    import google.generativeai as genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
    _genai_available = bool(GEMINI_API_KEY)
except ImportError:
    _genai_available = False
# Skills path: always anchored to project (backend file location)
BASE_DIR    = Path(__file__).resolve().parent
SKILLS_PATH = BASE_DIR / "skills"

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
    "asd":        "diagnosis_autism.md",
    "dyslexia":   "diagnosis_dyslexia.md",
    "processing": "diagnosis_processing.md",
}


def get_diagnosis_skill_filename(diagnosis: str) -> str:
    """Return the skills filename for a diagnosis (for logging)."""
    d = (diagnosis or "").lower().strip()
    for key, filename in SKILL_MAP.items():
        if key in d:
            return filename
    return "diagnosis_unknown.md"


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


def detect_diagnosis_in_message(msg: str) -> str | None:
    """If the message explicitly asks about a diagnosis, return the diagnosis key (e.g. 'autism').
    Used to override skill loading for diagnosis-explanation questions."""
    if not msg or not isinstance(msg, str):
        return None
    m = msg.lower().strip()
    # Check in stable order; prefer longer/more specific matches
    for key in ("processing", "dyslexia", "adhd", "autism", "asd"):
        if key in m:
            return key
    return None


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
    """Return all students with plan_status, session_this_week, class_name."""
    rows = supabase.table("students").select("*").execute().data or []
    student_ids = [s["student_id"] for s in rows if s.get("student_id")]

    # Fetch plans to compute plan_status (pending = unapproved plan, done = approved, none = no plans)
    plans = (
        supabase.table("plans")
        .select("student_id, teacher_approved")
        .in_("student_id", student_ids)
        .order("week_start_date", desc=True)
        .execute()
        .data or []
    ) if student_ids else []
    plan_by_student: dict[int, dict] = {}
    for p in plans:
        sid = p.get("student_id")
        if sid is not None and sid not in plan_by_student:
            plan_by_student[sid] = p

    # Sessions this week: session_id format student_X_YYYY-MM-DD or use date column
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    sessions_res = supabase.table("sessions").select("session_id, student_id, date").execute()
    session_student_ids = set()
    for sess in (sessions_res.data or []):
        sid = sess.get("student_id")
        if not sid:
            continue
        d = sess.get("date")
        if d:
            try:
                sess_date = d[:10] if isinstance(d, str) else str(d)[:10]
                if sess_date >= week_start:
                    session_student_ids.add(sid)
            except Exception:
                pass
        else:
            # Fallback: parse from session_id (student_1_2026-03-05)
            parts = (sess.get("session_id") or "").split("_")
            if len(parts) >= 3:
                try:
                    sess_date = parts[2]
                    if sess_date >= week_start:
                        session_student_ids.add(sid)
                except Exception:
                    pass

    for s in rows:
        s["class_name"] = s.get("grade") or s.get("class_name") or s.get("class_id") or ""
        s["class_id"] = s.get("grade") or s.get("class_id")
        # plan_status: pending (unapproved), done (approved), none
        plan = plan_by_student.get(s.get("student_id"))
        if plan:
            s["plan_status"] = "pending" if not plan.get("teacher_approved") else "done"
        else:
            s["plan_status"] = "none"
        s["session_this_week"] = s.get("student_id") in session_student_ids
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
    files = (
        supabase.table("uploaded_files")
        .select("*")
        .eq("student_id", student_id)
        .order("file_id", desc=True)
        .limit(10)
        .execute()
        .data or []
    )
    return {
        "student":    student,
        "plans":      plans,
        "sessions":   sessions,
        "milestones": milestones,
        "files":      files,
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

    # Summarize session and append to students.previous_assessment
    _summarize_session_and_update_student(student_id, session_data)


def _summarize_session_and_update_student(student_id: int, session_data: dict) -> None:
    """Summarize session fields and append to students.previous_assessment. At most one entry per student per day."""
    diff = (session_data.get("difficulty_reported") or "").strip()
    triggers = (session_data.get("triggers_noted") or "").strip()
    strategies = (session_data.get("strategies_tried") or "").strip()
    support = (session_data.get("support_needed") or "").strip()
    if not diff and not triggers and not strategies and not support:
        return
    try:
        student = get_student(student_id)
        today = date.today().isoformat()
        current = (student or {}).get("previous_assessment") or ""
        if f"--- Session {today} ---" in current:
            return  # Already summarized for today
        name = (student or {}).get("name_en", "Student")
        raw = f"Difficulty: {diff}\nTriggers: {triggers}\nStrategies tried: {strategies}\nSupport needed: {support}"
        prompt = f"""Summarize this session note for {name} into 1-2 short sentences for a teacher's reference. Keep it concise and actionable.
Session notes:
{raw}

Output only the summary, no preamble."""
        response = llm.invoke([HumanMessage(content=prompt)])
        summary = (response.content if hasattr(response, "content") else str(response)).strip()
        if not summary:
            summary = raw[:300]
        entry = f"\n\n--- Session {today} ---\n{summary}"
        updated = (current + entry).strip()
        if len(updated) > 5000:
            updated = "...\n\n" + updated[-4900:]
        supabase.table("students").update({"previous_assessment": updated}).eq("student_id", student_id).execute()
    except Exception as e:
        logger.warning(f"_summarize_session_and_update_student failed: {e}")


def get_session_from_db(thread_id: str) -> dict | None:
    """Load session metadata from Supabase when not in memory (e.g. after refresh)."""
    try:
        res = (
            supabase.table("sessions")
            .select("session_id, student_id, eval_score")
            .eq("session_id", thread_id)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            row = res.data[0]
            sid = row.get("student_id")
            if sid is not None:
                return {
                    "student_id": int(sid),
                    "eval_score": row.get("eval_score", 0),
                    "plan_version": get_plan_version(int(sid)),
                }
    except Exception as e:
        logger.warning(f"get_session_from_db failed: {e}")
    # Fallback: parse student_id from thread_id (student_X_YYYY-MM-DD)
    parts = (thread_id or "").split("_")
    if len(parts) >= 2 and parts[0].lower() == "student":
        try:
            sid = int(parts[1])
            return {"student_id": sid, "eval_score": 0, "plan_version": get_plan_version(sid)}
        except (ValueError, IndexError):
            pass
    return None


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
        "preferred_language":  "ar",
    }
    return _sessions[thread_id]


def get_session(thread_id: str) -> dict | None:
    return _sessions.get(thread_id)


def resolve_and_store_preferred_language(thread_id: str, req: "ChatRequest") -> str:
    """
    Resolve preferred_language: UI toggle takes priority; else re-detect from current message.
    Store in session for all subsequent turns. Returns "en" | "ar".
    """
    session = get_session(thread_id)
    detected = _detect_language_from_message(req.message)
    if req.preferred_language in ("en", "ar"):
        lang = req.preferred_language
    else:
        lang = detected
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
You MAY engage with: special education, teaching strategies, student learning support,
classroom accommodations, diagnosis explanations (e.g. "What is autism?", "Explain processing disorder"),
and student information (e.g. "What is Fatima's diagnosis?"). Do NOT reject these.
Only reject clearly unrelated topics (e.g. weather, sports). If unrelated, respond:
"I can only help with supporting your student's learning. Is there something specific I can help you with?"

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
    return f"""OUTPUT LANGUAGE — NON-NEGOTIABLE:
You MUST respond in {lang_name} ONLY (preferred_language={lang}).
- If the teacher writes in Arabic → respond in Arabic only.
- If the teacher writes in English → respond in English only.
- NEVER mix languages in a single response.
- NEVER respond in English when the teacher wrote in Arabic.
- NEVER respond in Arabic when the teacher wrote in English.
- Do NOT translate unless the teacher explicitly asks.
- This rule overrides everything else. Violating it is a critical failure."""


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
    file_ctx = session.get("file_context", "")
    file_block = f"\nUPLOADED DOCUMENT CONTEXT (use for planning/assessment):\n{file_ctx}\n" if file_ctx else ""
    return f"""{GUARDRAILS}

{lang_rule}

{file_block}

You are the EACH Orchestrator — the central coordinator. Your ONLY job is to route.

NEVER do any of these yourself:
- Give strategies, tips, or educational advice
- Output lists of activities, techniques, or interventions
- Generate or write any part of a plan
- Answer assessment questions (the Assessment Agent does that)
- Produce plans (the Planning Agent does that)

You ONLY: (1) briefly greet or acknowledge, (2) immediately call a handoff tool.
AVAILABLE TOOLS (use these EXACT names): transfer_to_assessment_agent, transfer_to_planning_agent, transfer_to_reflection_agent, transfer_to_evaluation_agent.

CRITICAL — When the teacher describes ANY difficulty, concern, or observation → call transfer_to_assessment_agent. Do NOT reply with strategies or plans. Only route via tools.
If the teacher asks for a plan but assessment is INCOMPLETE (see "Still needed" below) → route to transfer_to_assessment_agent. Do NOT route to planning until all 4 fields are collected.
If assessment IS complete (all 4 fields collected, or last assistant message says "I have everything I need to create [name]'s plan") → then you may route to transfer_to_planning_agent when the teacher asks for a plan.

CURRENT STUDENT:
  English name : {name_en}
  Arabic name  : {name_ar}
  Diagnosis    : {diagnosis}
  Severity     : {severity}

{memory}

ROUTING RULES — call the handoff tool immediately; NEVER add strategies or plans in your reply:

1. INTENT — Student info: "What is Fatima's diagnosis?", "Tell me more about Fatima" → transfer_to_assessment_agent.
2. INTENT — Diagnosis explanation: "What is processing disorder?", "Explain dyslexia", "Tell me more about autism", "What does ASD mean?" → transfer_to_assessment_agent. Do NOT reject.
3. INTENT — Learning plan: "Create a weekly plan" → transfer_to_planning_agent ONLY if assessment is complete (all 4 fields collected). If "Still needed" is non-empty below → transfer_to_assessment_agent instead.
5. Teacher describes difficulties, observations, or learning concerns → transfer_to_assessment_agent.
6. Teacher describes what they've tried or behaviors observed → transfer_to_assessment_agent.
7. First message: if only a greeting → respond briefly; else if learning concern → transfer_to_assessment_agent.
8. Teacher asks to revise or change a plan → transfer_to_planning_agent.
9. PLAN_GENERATED tag → transfer_to_reflection_agent.
10. REFLECTION_PASSED tag → present plan, ask approval, then transfer_to_evaluation_agent.
11. Teacher approves or "already approved" → transfer_to_evaluation_agent.
12. Teacher rejects or requests changes → transfer_to_reflection_agent.
13. If the last assistant message indicates assessment is complete (e.g. "Thank you! I have everything I need to create [name]'s plan") → call transfer_to_planning_agent to generate the plan.
14. FALLBACK: default to transfer_to_assessment_agent. Only reject truly unrelated topics.

CURRENT SESSION STATE:
{_fmt_assessment_fields(session)}
  Plan generated   : {"Yes" if session.get("current_plan") else "No"}
  Reflection done  : {session.get("reflection_done")}
  Plan approved    : {session.get("plan_approved")}
  Evaluation score : {session.get("eval_score") or "Not yet scored"}
"""


def build_assessment_prompt(session: dict, current_message: str | None = None) -> str:
    student   = session.get("student_profile", {})
    name_en   = student.get("name_en", "the student")
    diagnosis = student.get("diagnosis", "Unknown")
    severity  = student.get("severity_level", "")
    # For diagnosis-explanation questions, use the diagnosis mentioned in the message
    det = detect_diagnosis_in_message(current_message or "")
    if det:
        skill = get_diagnosis_skill(det)
    else:
        skill = session.get("diagnosis_skill", "")

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

CRITICAL: You must NOT generate a plan, schedule, weekly goals, or day-by-day activities. Your ONLY job in assessment mode is to collect the 4 required fields, one question at a time.

YOUR ROLES:
1. DIAGNOSIS EXPLANATIONS: If the teacher asks about a diagnosis (e.g. "What is autism?", "Explain processing disorder"), answer from SKILL CONTEXT. Do NOT emit FIELD_COLLECTED.
2. STUDENT INFO: If the teacher asks about the student (e.g. "What is Fatima's diagnosis?"), share from profile and SKILL CONTEXT. Do NOT emit FIELD_COLLECTED.
3. ASSESSMENT: Otherwise, collect EXACTLY these 4 fields, one question at a time. Do NOT hand off to planning until ALL 4 are collected.

GROUNDING — Base your response on the SKILL CONTEXT.

STUDENT: {name_en} | Diagnosis: {diagnosis} ({severity})

SKILL CONTEXT (use for diagnosis explanations and student support):
{skill}

THE 4 REQUIRED FIELDS (you MUST collect all before transitioning):
1. difficulty_reported — What specific difficulty is {name_en} facing this week?
2. triggers_noted      — What situations, times, or subjects trigger this?
3. strategies_tried    — What has the teacher already tried?
4. support_needed      — What specific support does {name_en} need this week?

FIELDS ALREADY COLLECTED:
{json.dumps(already, ensure_ascii=False, indent=2)}

STILL MISSING: {', '.join(missing) if missing else 'Nothing — all 4 fields complete'}

After each teacher message, for EACH field the teacher answered, emit inside <META> tags:

<META>
FIELD_COLLECTED: {{"field": "<field_name>", "value": "<what the teacher said>"}}
</META>

You may emit multiple FIELD_COLLECTED if the teacher answered multiple fields. Example: if the teacher says "He loses focus during reading and writing tasks", emit:
<META>
FIELD_COLLECTED: {{"field": "difficulty_reported", "value": "loses focus during reading and writing tasks"}}
</META>

When ALL 4 fields are collected, emit:

<META>
ASSESSMENT_COMPLETE: {{"difficulty_reported": "...", "triggers_noted": "...", "strategies_tried": "...", "support_needed": "..."}}
</META>

Then say: "Thank you! I have everything I need to create {name_en}'s plan."
Then call transfer_to_orchestrator. Do NOT call any other tool.

RULES:
- NEVER generate a plan, weekly goals, activities, or schedules. Only ask questions and collect fields.
- Ask ONE question per message.
- Always emit FIELD_COLLECTED for any field the teacher just answered, BEFORE your response.
- Never ask again about a field already collected.
- Only emit ASSESSMENT_COMPLETE and hand off when ALL 4 fields are filled.
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
    file_ctx     = session.get("file_context", "")
    file_block   = f"\nUPLOADED DOCUMENT CONTEXT (use these insights for planning):\n{file_ctx}\n" if file_ctx else ""

    return f"""{GUARDRAILS}

{lang_rule}

{file_block}

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

SKILL CONTEXT — You MUST base your strategies and recommendations on this document:
{skill}

GROUNDING: All strategies must come from the SKILL CONTEXT above. Do not add generic strategies. If something is missing, say so.

PLAN TEMPLATE (follow this structure exactly):
{template}

PLAN METADATA:
  Week starts  : {week_start}
  Version      : {version}

INSTRUCTIONS:
1. Generate the plan ONLY in the teacher's language (see OUTPUT LANGUAGE above). Do NOT generate bilingual output. Do NOT include [EN] or [AR] markers.
2. Return clean, structured content entirely in the detected language. Example structure (adapt section names to the language):
   - Weekly Goals
   - Activities
   - Daily Exercises
   - Materials Needed
   - Progress Tracking
3. Generate the COMPLETE plan — all 5 days (Sunday through Thursday for KSA,
   or Monday through Friday if the school follows that schedule).
4. All goals must be measurable and observable.
5. All activities must have time durations.
6. All strategies must come from the SKILL CONTEXT above.
7. Teacher notes must be immediately actionable (as if handed to teacher at 7am).
8. Do NOT repeat strategies already noted as ineffective in long-term memory.

When the plan is complete, output EXACTLY this on its own line BEFORE the plan text:

PLAN_GENERATED: [plan starts below]

Then output the full plan. Then call transfer_to_orchestrator.
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

def build_swarm(thread_id: str, current_message: str | None = None):
    """
    Build and return a LangGraph Swarm for the given thread.
    Called on EVERY /chat request (per spec §7.1 — prompts must be re-injected).
    current_message: used to detect diagnosis-explanation questions and load the right skill.
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
        "assessment_agent": build_assessment_prompt(session, current_message),
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
    )
    # Pass checkpointer to compile() (required for get_state/thread persistence)
    compiled = swarm.compile(checkpointer=_checkpointer)

    return compiled, prompts


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
_RE_PLAN_GEN    = re.compile(r"PLAN_GENERATED:\s*\[plan starts below\](.*?)(?=REFLECTION_PASSED|EVAL_SCORE|EVALUATION SUMMARY|$)", re.DOTALL | re.IGNORECASE)
_RE_PLAN_REV    = re.compile(r"PLAN_REVISED:\s*\[revised plan below\](.*?)(?=REFLECTION_PASSED|EVAL_SCORE|EVALUATION SUMMARY|$)", re.DOTALL | re.IGNORECASE)
_RE_REFL_PASSED = re.compile(r"REFLECTION_PASSED:\s*\[reflection summary below\](.*)", re.DOTALL)
_RE_EVAL_SCORE  = re.compile(r"EVAL_SCORE:\s*([1-5])")

# Internal markers — content containing these is NOT shown as chat
_INTERNAL_MARKERS = (
    "PLAN_GENERATED",
    "PLAN_REVISED",
    "REFLECTION_PASSED",
    "EVAL_SCORE",
    "EVALUATION SUMMARY",
)


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
        plan_text = _sanitize_plan_content(m.group(1).strip())
        update_session(thread_id, {"current_plan": plan_text})
        tags_found.append("PLAN_GENERATED")

    # ── PLAN_REVISED ──────────────────────────────────────────────────────────
    m = _RE_PLAN_REV.search(output_text)
    if m:
        plan_text = _sanitize_plan_content(m.group(1).strip())
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


def _is_internal_agent_output(text: str) -> bool:
    """True if text contains internal markers (planning/reflection/eval output)."""
    if not text or not isinstance(text, str):
        return False
    t = text.strip().upper()
    return any(m in t for m in [m.upper() for m in _INTERNAL_MARKERS])


def _extract_teacher_facing_response(messages: list) -> str:
    """
    Return the last teacher-facing message (orchestrator/assessment only).
    Skip planning, reflection, and evaluation agent outputs — those are internal.
    """
    for msg in reversed(messages):
        if not isinstance(msg, AIMessage) or not msg.content:
            continue
        c = msg.content if isinstance(msg.content, str) else str(msg.content)
        if not c.strip():
            continue
        if _is_internal_agent_output(c):
            continue
        return c
    return ""


def _sanitize_plan_content(plan_text: str) -> str:
    """
    Return clean plan content only. Strip REFLECTION_PASSED, EVAL_SCORE,
    EVALUATION SUMMARY, transfer_to_orchestrator, and any trailing internal agent output.
    """
    if not plan_text or not isinstance(plan_text, str):
        return ""
    text = plan_text.strip()
    # Remove everything from first internal marker onward
    for marker in [
        "REFLECTION_PASSED", "EVAL_SCORE", "EVALUATION SUMMARY", "REFLECTION SUMMARY",
        "transfer_to_orchestrator", "transfer_to_assessment", "transfer_to_planning",
        "transfer_to_reflection", "transfer_to_evaluation",
    ]:
        idx = text.upper().find(marker.upper())
        if idx >= 0:
            text = text[:idx].rstrip()
    # Strip trailing handoff instructions that may appear on their own line
    lines = text.rstrip().splitlines()
    while lines:
        last = lines[-1].strip().lower()
        if not last or last.startswith("transfer_to_"):
            lines.pop()
        else:
            break
    return "\n".join(lines)


def _response_for_chat(response_text: str, tags_found: list[str]) -> str:
    """
    Return the chat bubble text. Reflection/Evaluation outputs are internal —
    do not render their full output as chat bubbles.
    """
    cleaned = _clean_tags(response_text).strip()
    # When a plan was just generated/revised, always show the plan intro (takes priority over eval)
    if "PLAN_GENERATED" in tags_found or "PLAN_REVISED" in tags_found:
        return "Here is your plan — please approve it or request changes."
    if any(t.startswith("EVAL_SCORE") for t in tags_found) and len(cleaned) > 80:
        return "Thank you — your approval and score have been recorded."
    if "REFLECTION_PASSED" in tags_found and len(cleaned) > 80:
        return "Plan has been reviewed. You can approve it or request changes below."
    return cleaned


def _clean_tags(text: str) -> str:
    """Remove internal structured tags and <META> blocks from text shown to the teacher."""
    cleaned = text
    # Strip <META>...</META> blocks (entire block including tags inside)
    cleaned = re.sub(r"<META>.*?</META>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    tag_patterns = [
        r"FIELD_COLLECTED:\s*\{.*?\}",
        r"ASSESSMENT_COMPLETE:\s*\{.*?\}",
        r"PLAN_GENERATED:\s*\[plan starts below\]",
        r"PLAN_REVISED:\s*\[revised plan below\]",
        r"REFLECTION_PASSED:\s*\[reflection summary below\]",
        r"EVAL_SCORE:\s*[1-5]",
    ]
    for pat in tag_patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()


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
    preferred_language: Optional[str] = None  # "en" | "ar" from UI toggle; fallback to detect from message


class ChatResponse(BaseModel):
    response:            str
    session:             dict
    plan:                Optional[str] = None
    plan_id:             Optional[int] = None
    tags_found:          list[str] = []
    suggested_student_id: Optional[int] = None
    skills_file:         Optional[str] = None  # e.g. diagnosis_processing.md — which skill was used


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

CRITICAL — OUTPUT LANGUAGE: You MUST respond in {lang_name} ONLY. If the teacher wrote in Arabic, respond in Arabic. If they wrote in English, respond in English. Never mix languages.

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
    """Map internal agent name to teacher-facing status label."""
    labels = {
        "orchestrator":      "Orchestrator",
        "assessment_agent":  "Assessment Agent",
        "planning_agent":    "Generating plan...",
        "reflection_agent":  "Reviewing plan...",
        "evaluation_agent":  "Recording score...",
    }
    return labels.get(agent_name, agent_name or "Orchestrator")


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
        detected_lang = req.preferred_language if req.preferred_language in ("en", "ar") else _detect_language_from_message(req.message)
        session = init_session(thread_id, student_id)
        update_session(thread_id, {"preferred_language": detected_lang})
        preferred_lang = detected_lang
        swarm, _ = build_swarm(thread_id, current_message=req.message)
        config = {"configurable": {"thread_id": thread_id}}

        try:
            stream = swarm.stream(
                {"messages": [HumanMessage(content=req.message)]},
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
                {"messages": [HumanMessage(content=req.message)]},
                config,
            )

        messages = result.get("messages", [])
        full_ai_text = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                c = msg.content if isinstance(msg.content, str) else str(msg.content)
                full_ai_text = c + "\n" + full_ai_text
        parsed = parse_agent_output(full_ai_text, thread_id)
        tags = parsed.get("tags_found", [])
        # Teacher-facing only: skip planning/reflection/evaluation agent output
        teacher_msg = _extract_teacher_facing_response(messages)
        parsed["response"] = _response_for_chat(teacher_msg, tags)
        _log_handoff_tools_called(messages, thread_id)
        sess = get_session(thread_id)
        agent_name = "orchestrator"
        for t in tags:
            if t in ("PLAN_GENERATED", "PLAN_REVISED"):
                agent_name = "planning_agent"
                break
            if t.startswith("FIELD_COLLECTED") or t == "ASSESSMENT_COMPLETE":
                agent_name = "assessment_agent"
                break
            if t == "REFLECTION_PASSED":
                agent_name = "reflection_agent"
                break
            if t.startswith("EVAL_SCORE"):
                agent_name = "evaluation_agent"
                break
        sess_dict = sess or {}
        diag_val = sess_dict.get("student_profile", {}).get("diagnosis", "") or ""
        det_in_msg = detect_diagnosis_in_message(req.message) if req else None
        skills_used = get_diagnosis_skill_filename(det_in_msg or diag_val)
        fields = ["difficulty_reported", "triggers_noted", "strategies_tried", "support_needed"]
        collected = [f for f in fields if sess_dict.get(f)]
        missing = [f for f in fields if not sess_dict.get(f)]
        student_name = sess_dict.get("student_profile", {}).get("name_en", "?")
        logger.info(f"Turn debug: student={student_name} | diagnosis={diag_val!r} | skills_file={skills_used} | agent={agent_name} | collected={collected} | missing={missing} | thread={thread_id}")
        if sess:
            stored_msgs = _messages_to_store(messages, parsed["tags_found"])
            save_session_to_db(thread_id, student_id, sess, messages=stored_msgs)
        plan_id_saved = None
        has_plan_tag = "PLAN_GENERATED" in parsed["tags_found"] or "PLAN_REVISED" in parsed["tags_found"]
        current_plan = sess.get("current_plan") if sess else None
        if has_plan_tag and sess and not current_plan:
            for pattern in (_RE_PLAN_REV, _RE_PLAN_GEN):
                m = pattern.search(full_ai_text)
                if m:
                    current_plan = _sanitize_plan_content(m.group(1).strip())
                    if current_plan:
                        update_session(thread_id, {"current_plan": current_plan})
                        break
        if has_plan_tag and sess and current_plan:
            plan_en, plan_ar = extract_bilingual_plan(current_plan)
            plan_id_saved = save_plan_to_db(
                student_id=sess["student_id"], plan_content_en=plan_en, plan_content_ar=plan_ar,
                approved=False, score=sess.get("eval_score", 0), version=sess.get("plan_version", 1),
            )
            logger.info(f"Plan saved: plan_id={plan_id_saved} student_id={sess['student_id']}")
        elif has_plan_tag and sess:
            logger.warning(f"Plan tag found but could not extract plan — NOT saved (student_id={sess.get('student_id')})")
        sess_final = get_session(thread_id) or {}
        raw_plan = sess_final.get("current_plan") or None
        clean_plan = _sanitize_plan_content(raw_plan) if raw_plan else None
        payload = {
            "type": "done",
            "event": "done",
            "response": parsed["response"],
            "session": session_summary(sess_final),
            "plan": clean_plan,
            "plan_id": plan_id_saved,
            "tags_found": parsed["tags_found"],
            "suggested_student_id": student_id if req.student_id is None else None,
            "skills_file": skills_used,
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
        swarm, _ = build_swarm(thread_id, current_message=req.message)
        config = {"configurable": {"thread_id": thread_id}}

        logger.info(f"Active agent: {detect_active_agent(swarm, thread_id)} | thread: {thread_id}")

        # 3. Invoke — each agent uses its own state_modifier; no extra SystemMessage needed
        result = swarm.invoke(
            {"messages": [HumanMessage(content=req.message)]},
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
        full_ai_text = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                c = msg.content if isinstance(msg.content, str) else str(msg.content)
                full_ai_text = c + "\n" + full_ai_text

        # 5. Parse tags and extract teacher-facing response (skip planning/reflection/eval)
        parsed = parse_agent_output(full_ai_text, thread_id)
        tags = parsed.get("tags_found", [])
        teacher_msg = _extract_teacher_facing_response(messages)
        parsed["response"] = _response_for_chat(teacher_msg, tags)

        sess = get_session(thread_id)

        # 6. Log handoff tool calls and language for debugging
        _log_handoff_tools_called(messages, thread_id)
        tags = parsed.get("tags_found", [])
        agent_name = "orchestrator"
        for t in tags:
            if t in ("PLAN_GENERATED", "PLAN_REVISED"):
                agent_name = "planning_agent"
                break
            if t.startswith("FIELD_COLLECTED") or t == "ASSESSMENT_COMPLETE":
                agent_name = "assessment_agent"
                break
            if t == "REFLECTION_PASSED":
                agent_name = "reflection_agent"
                break
            if t.startswith("EVAL_SCORE"):
                agent_name = "evaluation_agent"
                break
        sess_dict = sess or {}
        diag_val = sess_dict.get("student_profile", {}).get("diagnosis", "") or ""
        det_in_msg = detect_diagnosis_in_message(req.message) if req else None
        skills_used = get_diagnosis_skill_filename(det_in_msg or diag_val)
        fields = ["difficulty_reported", "triggers_noted", "strategies_tried", "support_needed"]
        collected = [f for f in fields if sess_dict.get(f)]
        missing = [f for f in fields if not sess_dict.get(f)]
        student_name = sess_dict.get("student_profile", {}).get("name_en", "?")
        logger.info(f"Turn debug: student={student_name} | diagnosis={diag_val!r} | skills_file={skills_used} | agent={agent_name} | collected={collected} | missing={missing} | thread={thread_id}")

        # 7. Persist session and messages to Supabase
        if sess:
            stored_msgs = _messages_to_store(messages, parsed["tags_found"])
            save_session_to_db(thread_id, student_id, sess, messages=stored_msgs)

        plan_id_saved: int | None = None
        has_plan_tag = "PLAN_GENERATED" in parsed["tags_found"] or "PLAN_REVISED" in parsed["tags_found"]
        current_plan = sess.get("current_plan") if sess else None
        if has_plan_tag and sess and not current_plan:
            for pattern in (_RE_PLAN_REV, _RE_PLAN_GEN):
                m = pattern.search(full_ai_text)
                if m:
                    current_plan = _sanitize_plan_content(m.group(1).strip())
                    if current_plan:
                        update_session(thread_id, {"current_plan": current_plan})
                        break
        if has_plan_tag and sess and current_plan:
            plan_en, plan_ar = extract_bilingual_plan(current_plan)
            plan_id_saved = save_plan_to_db(
                student_id      = sess["student_id"],
                plan_content_en = plan_en,
                plan_content_ar = plan_ar,
                approved        = False,
                score           = sess.get("eval_score", 0),
                version         = sess.get("plan_version", 1),
            )
            logger.info(f"Plan saved (non-stream): plan_id={plan_id_saved} student_id={sess['student_id']}")
        elif has_plan_tag and sess:
            logger.warning(f"Plan tag found but could not extract plan — NOT saved (student_id={sess.get('student_id')})")

        sess_final = get_session(thread_id) or {}
        raw_plan = sess_final.get("current_plan") or None
        clean_plan = _sanitize_plan_content(raw_plan) if raw_plan else None
        return ChatResponse(
            response             = parsed["response"],
            session              = session_summary(sess_final),
            plan                 = clean_plan,
            plan_id              = plan_id_saved,
            tags_found           = parsed["tags_found"],
            suggested_student_id = student_id if req.student_id is None else None,
            skills_file          = skills_used,
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
        sess = get_session_from_db(req.thread_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session {req.thread_id} not found")

    try:
        plan_en = req.plan_content_en
        plan_ar = req.plan_content_ar

        # If the frontend didn't pre-split, try to extract from current_plan (in-memory only)
        if not plan_en and not plan_ar and sess.get("current_plan"):
            plan_en, plan_ar = extract_bilingual_plan(sess["current_plan"])

        if not plan_en and not plan_ar:
            raise HTTPException(status_code=400, detail="No plan content to save")

        student_id = sess["student_id"]
        plan_id = save_plan_to_db(
            student_id      = student_id,
            plan_content_en = plan_en,
            plan_content_ar = plan_ar,
            approved        = req.approved,
            score           = sess.get("eval_score", 0),
            version         = sess.get("plan_version", 1),
        )

        mem_sess = get_session(req.thread_id)
        if mem_sess:
            update_session(req.thread_id, {"plan_approved": req.approved})
            save_session_to_db(req.thread_id, student_id, get_session(req.thread_id) or {})

        return {"status": "ok", "plan_id": plan_id, "approved": req.approved}
    except Exception as e:
        logger.error(f"POST /plans/save error: {e}")
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


@app.post("/api/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    student_id: int = Form(...),
    file_type: str = Form("IEP"),
    thread_id: str = Form(None),
):
    """Analyze an uploaded file (IEP, homework, etc.) using Gemini Flash OCR."""
    if not _genai_available:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    allowed = {"pdf", "png", "jpg", "jpeg", "webp"}
    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Please upload under 20MB.")

    student = get_student(student_id) if student_id else None
    name_en = student.get("name_en", "the student") if student else "the student"
    diagnosis = student.get("diagnosis", "Unknown") if student else "Unknown"

    try:
        mime_map = {
            "pdf": "application/pdf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "webp": "image/webp",
        }
        mime_type = mime_map.get(ext, "application/pdf")

        if file_type == "IEP":
            prompt = f"""You are analyzing an IEP document for {name_en}, diagnosed with {diagnosis}.
Extract and return ONLY JSON (no markdown):
{{
  "language_detected": "ar or en",
  "student_goals": ["goal 1", "goal 2"],
  "current_performance_level": "brief summary",
  "recommended_accommodations": ["accommodation 1"],
  "key_insights": "2-3 sentence summary for weekly planning",
  "extracted_text": "full raw text"
}}"""
        elif file_type == "hw":
            prompt = f"""You are analyzing homework for {name_en}, diagnosed with {diagnosis}.
Return ONLY JSON (no markdown):
{{
  "language_detected": "ar or en",
  "subject_detected": "math/arabic/english/science/other",
  "completion_level": "complete/partial/minimal/blank",
  "error_patterns": ["pattern 1"],
  "strengths_observed": ["strength 1"],
  "areas_of_difficulty": ["area 1"],
  "key_insights": "2-3 sentence summary",
  "extracted_text": "all readable text"
}}"""
        else:
            prompt = f"""Extract all readable text from this document for {name_en}.
Return ONLY JSON (no markdown): {{"extracted_text": "...", "key_insights": "...", "language_detected": "ar or en"}}"""

        model = genai.GenerativeModel("gemini-2.5-flash")
        image_part = {"mime_type": mime_type, "data": base64.b64encode(contents).decode()}
        response = model.generate_content([
            {"inline_data": image_part},
            prompt,
        ])
        response_text = response.text if hasattr(response, "text") else str(response)

        clean = re.sub(r"```json\s*|\s*```", "", response_text).strip()
        try:
            result = json.loads(clean)
        except json.JSONDecodeError:
            result = {
                "extracted_text": response_text,
                "key_insights": "Could not parse structured response.",
                "language_detected": "ar" if any(ord(c) > 1500 for c in response_text) else "en",
            }

        if thread_id:
            sess = get_session(thread_id)
            if sess:
                insights = result.get("key_insights", "")
                file_context = f"[DOCUMENT ANALYSIS — {file_type} uploaded for {name_en}]\nKey Insights: {insights}\n[END DOCUMENT ANALYSIS]"
                update_session(thread_id, {"file_context": file_context})

        # Persist to uploaded_files table
        file_id = str(uuid.uuid4())
        key_insights_val = result.get("key_insights", "")
        if not isinstance(key_insights_val, str):
            key_insights_val = json.dumps(key_insights_val, ensure_ascii=False) if key_insights_val else ""
        try:
            supabase.table("uploaded_files").insert({
                "file_id":           file_id,
                "student_id":        student_id,
                "file_type":         file_type,
                "language_detected": result.get("language_detected", "en"),
                "processing_status": "completed",
                "key_insights":      key_insights_val,
            }).execute()
        except Exception as e:
            logger.warning(f"uploaded_files insert failed: {e}")

        return {
            "status": "ok",
            "filename": file.filename,
            "file_type": file_type,
            "result": result,
            "key_insights": result.get("key_insights", ""),
            "language_detected": result.get("language_detected", "en"),
        }
    except Exception as e:
        logger.error(f"POST /api/analyze error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
