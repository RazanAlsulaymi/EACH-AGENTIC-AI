---
name: gemini_ocr
description: Instructions for the /api/analyze route and backend OCR tool. Tells the system how to call Gemini Flash for document analysis, what to extract, and how to store results. Load this when processing uploaded files.
---

# Gemini OCR — File Analysis Guide

EACH uses **Gemini 1.5 Flash** for OCR and document analysis.
Supported file types: PDF, PNG, JPG, JPEG, WEBP
Primary use cases: IEP documents, Arabic PDFs, homework scans, assessment reports

---

## When to Use Gemini OCR

Trigger OCR when a file is uploaded and `processing_status = 'pending'`.

The Orchestrator can also invoke OCR mid-session if the teacher uploads a file
and says something like:
- "I uploaded [student]'s IEP, can you use it?"
- "أرفقت ملف التقييم، استخدمه من فضلك"

---

## Gemini API Call

```python
import google.generativeai as genai
import base64
from pathlib import Path

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-1.5-flash")

def analyze_document(file_path: str, file_type: str, student_name: str, diagnosis: str) -> dict:
    """
    Analyze an uploaded document using Gemini Flash.
    Returns structured extraction result.
    """
    # Read and encode file
    file_bytes = Path(file_path).read_bytes()
    
    # Determine MIME type
    mime_map = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }
    mime_type = mime_map.get(file_path.split(".")[-1].lower(), "application/pdf")
    
    prompt = build_ocr_prompt(student_name, diagnosis, file_type)
    
    response = model.generate_content([
        {
            "mime_type": mime_type,
            "data": base64.b64encode(file_bytes).decode()
        },
        prompt
    ])
    
    return parse_ocr_response(response.text)
```

---

## OCR Prompt by File Type

### IEP Document (file_type = 'IEP')
```python
def build_ocr_prompt(student_name, diagnosis, file_type):
    if file_type == "IEP":
        return f"""
You are analyzing an IEP (Individualized Education Program) for {student_name}, 
who has been diagnosed with {diagnosis}.

Extract and return ONLY the following in JSON format:
{{
  "language_detected": "ar" or "en",
  "student_goals": ["goal 1", "goal 2", ...],
  "current_performance_level": "brief summary",
  "recommended_accommodations": ["accommodation 1", "accommodation 2", ...],
  "recommended_modifications": ["modification 1", ...],
  "related_services": ["service 1", ...],
  "key_insights": "2-3 sentence summary of most important findings for weekly planning",
  "extracted_text": "full raw text of the document"
}}

Important:
- If the document is in Arabic, return all fields in Arabic
- If the document is in English, return all fields in English  
- If bilingual, return key_insights in both languages
- Do not add information not present in the document
- If a field is not found, use null
"""
```

### Homework Scan (file_type = 'hw')
```python
    elif file_type == "hw":
        return f"""
You are analyzing a homework scan for {student_name}, diagnosed with {diagnosis}.

Extract and return in JSON format:
{{
  "language_detected": "ar" or "en",
  "subject_detected": "math / arabic / english / science / other",
  "completion_level": "complete / partial / minimal / blank",
  "error_patterns": ["pattern 1", "pattern 2", ...],
  "strengths_observed": ["strength 1", ...],
  "areas_of_difficulty": ["area 1", ...],
  "key_insights": "2-3 sentence summary relevant to planning support for this student",
  "extracted_text": "all readable text from the scan"
}}
"""
```

### Drawing / Creative Work (file_type = 'drawing')
```python
    elif file_type == "drawing":
        return f"""
You are analyzing a drawing or creative work by {student_name}, diagnosed with {diagnosis}.

Extract and return in JSON format:
{{
  "language_detected": "ar" or "en",
  "content_description": "what the drawing depicts",
  "fine_motor_observations": "brief observation about pen control, line quality, etc.",
  "engagement_indicators": "does the work suggest engagement, frustration, or disengagement?",
  "any_text_present": "transcribe any written text in the image",
  "key_insights": "1-2 sentence insight relevant to the student's learning",
  "extracted_text": "any text found in the image"
}}
"""
```

### Assessment Report (file_type = 'assessment')
```python
    elif file_type == "assessment":
        return f"""
You are analyzing an assessment report for {student_name}, diagnosed with {diagnosis}.

Extract and return in JSON format:
{{
  "language_detected": "ar" or "en",
  "assessment_type": "type of assessment conducted",
  "scores_or_levels": {{"subject/area": "score/level"}},
  "strengths": ["strength 1", ...],
  "areas_for_growth": ["area 1", ...],
  "recommendations": ["recommendation 1", ...],
  "key_insights": "2-3 sentence summary of most actionable findings for weekly planning",
  "extracted_text": "full raw text of the document"
}}
"""
    else:
        return f"""
Extract all readable text from this document for {student_name}.
Return JSON: {{"extracted_text": "...", "key_insights": "...", "language_detected": "ar or en"}}
"""
```

---

## Parsing the Response

```python
import json
import re

def parse_ocr_response(response_text: str) -> dict:
    """
    Parse Gemini's response, handling markdown code blocks if present.
    """
    # Strip markdown code blocks if present
    clean = re.sub(r"```json\s*|\s*```", "", response_text).strip()
    
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Fallback: return raw text as extracted_text
        return {
            "extracted_text": response_text,
            "key_insights": "Could not parse structured response. Raw text extracted.",
            "language_detected": "ar" if any(ord(c) > 1500 for c in response_text) else "en"
        }
```

---

## Storing Results in Database

After successful OCR, update `uploaded_files`:

```python
await supabase.table("uploaded_files").update({
    "processing_status": "complete",
    "language_detected": result.get("language_detected"),
    "extracted_text": result.get("extracted_text"),
    "key_insights": json.dumps(result, ensure_ascii=False)  # full JSON stored here
}).eq("file_id", file_id).execute()
```

If OCR fails:
```python
await supabase.table("uploaded_files").update({
    "processing_status": "failed"
}).eq("file_id", file_id).execute()
```

---

## Injecting OCR Results into Agent Context

When the Orchestrator injects OCR results into the session, use this format:

```
[DOCUMENT ANALYSIS — {file_type} uploaded for {student_name}]
Language: {language_detected}
Key Insights: {key_insights}
Relevant Findings: {JSON summary of most important fields}
[END DOCUMENT ANALYSIS]
```

The Assessment Agent should acknowledge the document and ask the teacher if
the findings match their observations, then proceed with gathering the 4 fields.

---

## Error Handling

| Error | Cause | Action |
|---|---|---|
| `processing_status = 'failed'` | Gemini API error or unreadable file | Notify teacher in chat, continue without file |
| `key_insights = null` | Document had no relevant content | Log, continue, don't block session |
| Language mismatch | AR doc detected as EN | Log warning, use extracted_text as fallback |
| File too large | PDF > 20MB | Return error: "File too large. Please upload under 20MB." |

---

## Privacy Rules

- Never log `extracted_text` to console in production — it contains student PII
- Files are stored in Supabase Storage with RLS — only uploading teacher can access
- OCR results stored in DB are covered by RLS policies (see migration SQL)
- Gemini API key must be in environment variables, never hardcoded
