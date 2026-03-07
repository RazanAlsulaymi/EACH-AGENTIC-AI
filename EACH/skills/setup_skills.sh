#!/bin/bash
# Run this once to put skill files in the right place for main.py
# main.py looks for ./skills/ relative to its location

mkdir -p skills

# Copy all skill files
for f in diagnosis_adhd.md diagnosis_autism.md diagnosis_dyslexia.md \
          diagnosis_processing.md diagnosis_unknown.md \
          plan_template.md reflection_criteria.md \
          evaluation_rubric.md gemini_ocr.md; do
  cp "$f" skills/
done

echo "Skills directory ready: $(ls skills/*.md | wc -l) files"
