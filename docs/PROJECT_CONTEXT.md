# RTT Screener

## About

RTT Screener is a technical stock screening and research tool for swing traders.

The goal is to help users review technically interesting stocks and understand RTT qualification context.

The application should be fast, clean, modern, and suitable for research workflows.

---

## Core Strategy

The first version focuses on one strategy only.

EMA Alignment

10 EMA > 20 EMA > 50 EMA > 100 EMA > 200 EMA

Only stocks satisfying this rule are considered.

---

## Product Philosophy

Every screen should help traders answer one question.

Dashboard

What technical setups are worth reviewing today?

Scanner

Why was this stock selected by the RTT engine?

Stock Details

What technical context supports the RTT qualification view?

Portfolio

How are these monitored positions fitting the current research workflow?

---

## Technology

Frontend

React

TypeScript

Vite

Tailwind

Backend

Supabase

Future

Python services

AI

OpenAI

---

## Coding Rules

Never redesign existing UI.

Keep components reusable.

Use TypeScript strictly.

Never duplicate code.

Always explain architectural decisions.

Write clean production-ready code.

Maintain responsiveness.

Do not break existing functionality.

Prefer composition over duplication.

Always preserve the design system.

---

## Development Process

Before implementing

Understand the requirement.

Explain the implementation plan.

Implement.

Run checks.

Suggest improvements.

Never modify unrelated files.

Never perform large refactors without approval.