<p align="center">
  <img src="EACH/frontend/public/logo.png" width="200"/>
</p>

<h1 align="center">EACH</h1>

<p align="center">
Every Ability, Celebrated Here
</p>

<p align="center">
Agentic AI system for personalized special education planning
</p>

---

# Overview

**EACH** is an agentic AI platform designed to assist special education teachers in creating **personalized weekly learning plans** for students with diverse learning needs.

The system focuses on supporting learners with:

- ADHD
- Autism Spectrum Disorder
- Dyslexia
- Processing Disorders
- Attention and engagement challenges

Instead of relying on a single chatbot response, EACH uses a **multi-agent architecture** where specialized AI agents collaborate to analyze student needs, generate structured plans, review plan quality, and record teacher feedback.

---

# Agent Architecture

EACH uses a **LangGraph Swarm architecture** where different agents collaborate in a structured workflow.

| Agent | Role | Description |
|------|------|-------------|
| **Orchestrator** | Router | Routes teacher requests to the appropriate agent |
| **Assessment Agent** | Context Collector | Collects difficulty, triggers, strategies tried, and support needs |
| **Planning Agent** | Plan Generator | Generates structured weekly learning plans |
| **Reflection Agent** | Quality Reviewer | Reviews and improves generated plans |
| **Evaluation Agent** | Plan Scorer | Records teacher approval and evaluation score |

---

# Key Features

| Feature | Description |
|------|-------------|
| Multi-Agent Planning | Structured AI workflow instead of a single chatbot |
| Diagnosis-Aware Planning | Uses diagnosis-specific skill files |
| Session Memory | Maintains student context across conversations |
| Plan Quality Review | Reflection agent validates plan quality |
| Teacher Evaluation | Plans can be approved and scored |
| Document Analysis | Uploaded IEP or homework files can be analyzed |
| Arabic & English Support | Responses adapt to teacher language |

---

# Backend Components

| Component | Technology |
|--------|-------------|
| Backend Framework | FastAPI |
| Agent Orchestration | LangGraph Swarm |
| LLM Integration | LangChain |
| Database | Supabase |
| LLM Models | OpenAI GPT |
| Document Analysis | Gemini Flash |

---
---

---

## Project Poster

<p align="center">
  <img src="EACH/assets/PHOTO-2026-03-04-23-38-23.jpg" width="1000">
</p>

<p align="center">
EACH — Every Ability, Celebrated Here  
Agentic AI platform for personalized special education planning.
</p>

---
