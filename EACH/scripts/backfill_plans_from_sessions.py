#!/usr/bin/env python3
"""
Backfill plans from sessions.messages into the plans table.

Sessions store plan content inside the messages (assistant messages with
PLAN_GENERATED or PLAN_REVISED in tags_found), but PlansTab reads from
the plans table. This script extracts plans from existing sessions and
inserts them into plans so they appear in the UI.

Run from project root: python scripts/backfill_plans_from_sessions.py
"""
import json
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

_RE_PLAN_GEN = re.compile(
    r"PLAN_GENERATED:\s*\[plan starts below\](.*?)(?=REFLECTION_PASSED|EVAL_SCORE|EVALUATION SUMMARY|$)",
    re.DOTALL | re.IGNORECASE,
)
_RE_PLAN_REV = re.compile(
    r"PLAN_REVISED:\s*\[revised plan below\](.*?)(?=REFLECTION_PASSED|EVAL_SCORE|EVALUATION SUMMARY|$)",
    re.DOTALL | re.IGNORECASE,
)


def week_start_from_session(session_date) -> date:
    """Compute Monday of the week for a session date."""
    if session_date:
        try:
            if isinstance(session_date, str):
                d = date.fromisoformat(session_date.split("T")[0].split(" ")[0])
            else:
                d = session_date if hasattr(session_date, "date") else date.today()
        except (ValueError, AttributeError):
            d = date.today()
    else:
        d = date.today()
    # Monday = 0, so go back to start of week
    return d - timedelta(days=d.weekday())


def sanitize_plan_content(plan_text: str) -> str:
    if not plan_text or not isinstance(plan_text, str):
        return ""
    text = plan_text.strip()
    for marker in ["REFLECTION_PASSED", "EVAL_SCORE", "EVALUATION SUMMARY", "REFLECTION SUMMARY"]:
        idx = text.upper().find(marker.upper())
        if idx >= 0:
            text = text[:idx].rstrip()
    return text


def extract_plan_from_message_content(content: str, tags: list) -> str:
    """Extract plan text from assistant message content."""
    if not content:
        return ""
    content = str(content).strip()
    # Try standard PLAN_GENERATED / PLAN_REVISED markers first
    for pattern in (_RE_PLAN_GEN, _RE_PLAN_REV):
        m = pattern.search(content)
        if m:
            return sanitize_plan_content(m.group(1).strip())
    # Fallback: content is the plan (EACH — Weekly Learning Plan...)
    if "PLAN_GENERATED" in tags or "PLAN_REVISED" in tags:
        return sanitize_plan_content(content)
    return ""


def get_plan_version(student_id: int, week_start: date) -> int:
    """Next version for this student; optionally check week to avoid duplicates."""
    res = (
        supabase.table("plans")
        .select("version, week_start_date")
        .eq("student_id", student_id)
        .order("version", desc=True)
        .limit(10)
        .execute()
    )
    ws = week_start.isoformat()
    for row in (res.data or []):
        if row.get("week_start_date") == ws:
            return -1  # Already have plan for this week
    if res.data:
        return res.data[0]["version"] + 1
    return 1


def main():
    print("Fetching sessions with messages...")
    res = supabase.table("sessions").select(
        "session_id, student_id, date, eval_score, plan_approved, messages"
    ).execute()
    sessions = res.data or []
    print(f"Found {len(sessions)} sessions.")

    inserted = 0
    skipped = 0

    for row in sessions:
        session_id = row.get("session_id")
        student_id = row.get("student_id")
        messages = row.get("messages")

        if student_id is None:
            skipped += 1
            continue
        student_id = int(student_id)
        if not isinstance(messages, list) or len(messages) == 0:
            skipped += 1
            continue

        # Find last assistant message with PLAN_GENERATED or PLAN_REVISED
        plan_content = ""
        for m in reversed(messages):
            if m.get("role") != "assistant":
                continue
            tags = m.get("tags_found") or []
            if "PLAN_GENERATED" in tags or "PLAN_REVISED" in tags:
                content = m.get("content") or ""
                plan_content = extract_plan_from_message_content(content, tags)
                break

        if not plan_content:
            skipped += 1
            continue

        week_start = week_start_from_session(row.get("date"))
        version = get_plan_version(student_id, week_start)
        if version < 0:
            print(f"  Skip (plan exists): student_id={student_id} week={week_start}")
            skipped += 1
            continue

        try:
            approved = row.get("plan_approved", False)
            eval_score = row.get("eval_score") or 0
            payload = {
                "student_id": student_id,
                "week_start_date": week_start.isoformat(),
                "version": version,
                "plan_content_en": plan_content,
                "plan_content_ar": plan_content,
                "teacher_approved": approved,
                "score": eval_score,
            }
            if approved and eval_score:
                payload["teacher_score"] = eval_score
            supabase.table("plans").insert(payload).execute()
            inserted += 1
            print(f"  Inserted plan for student_id={student_id} (session={session_id})")
        except Exception as e:
            print(f"  Skipped session {session_id}: {e}")
            skipped += 1

    print(f"\nDone. Inserted {inserted} plans, skipped {skipped} sessions.")


if __name__ == "__main__":
    main()
