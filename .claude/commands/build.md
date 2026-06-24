# /build — Feature & Product Builder

> **Trigger**: User describes a feature or product they want Claude to help build.
> **Goal**: Guide user from idea → PRD → Technical Plan → Build Guide → Handoff Prompt.

---

## Phase 1 — Discovery (ONE question at a time, using AskUserQuestion tool)

When user invokes `/build <idea>`, **first ask Q0 to determine survey depth**, then ask questions one by one using the `AskUserQuestion` tool. "Other" is always auto-added by the tool for free-text input. Wait for each answer before asking the next.

**Q0 — Survey depth (ask FIRST, before any other question)**
```json
{
  "question": "How many questions do you want to answer so I can understand your idea?",
  "header": "Survey depth",
  "multiSelect": false,
  "options": [
    { "label": "Quick — 3 questions", "description": "Only the most essential questions — ideal when your idea is already clear" },
    { "label": "Standard — 5 questions", "description": "Default question set — balances speed and detail" },
    { "label": "Detailed — 8 questions", "description": "Deeper dive into user flows, data model, auth — output will be more precise" }
  ]
}
```

**After the user selects a depth, ask exactly this many questions:**

- **Quick (3 questions):** Q1, Q3, Q4
- **Standard (5 questions):** Q1, Q2, Q3, Q4, Q5
- **Detailed (8 questions):** Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8

---

**Q1 — Target users**
```json
{
  "question": "Who will use this feature or product?",
  "header": "Target users",
  "multiSelect": true,
  "options": [
    { "label": "Developer / technical team", "description": "Internal tool, CLI, SDK, technical dashboard" },
    { "label": "End user / B2C customer", "description": "App for everyday users, no technical knowledge required" },
    { "label": "Admin / operations", "description": "Backoffice, data management, system operations" },
    { "label": "Business owner / manager", "description": "Reports, analytics, business decision-making" }
  ]
}
```

**Q2 — MVP type**
```json
{
  "question": "What form should the MVP take?",
  "header": "MVP type",
  "multiSelect": true,
  "options": [
    { "label": "CRUD app", "description": "Create / read / update / delete records — typical web app" },
    { "label": "Dashboard / analytics", "description": "Display data, charts, reports — mostly read-only" },
    { "label": "Form & workflow", "description": "Collect data, process through a flow, approvals" },
    { "label": "API / integration service", "description": "No UI, exposes an API or connects services" }
  ]
}
```

**Q3 — Tech stack**
```json
{
  "question": "Is this a new project or an addition to an existing system?",
  "header": "Stack",
  "multiSelect": false,
  "options": [
    { "label": "Greenfield - no stack chosen yet", "description": "Brand new project, Claude will recommend a suitable stack" },
    { "label": "Go + React / Next.js", "description": "Go backend, React or Next.js frontend" },
    { "label": "Node.js + React / Next.js", "description": "Full JS stack, monorepo or separate repos" },
    { "label": "Python + FastAPI / Django", "description": "Python backend, optional frontend" }
  ]
}
```

**Q4 — Constraints** (multi-select)
```json
{
  "question": "Are there any constraints to be aware of? (select all that apply)",
  "header": "Constraints",
  "multiSelect": true,
  "options": [
    { "label": "No constraints", "description": "Free choice of tech, timeline, and scope" },
    { "label": "Specific deadline", "description": "Must be done within a defined timeframe" },
    { "label": "Third-party service integration", "description": "Stripe, Twilio, Firebase, etc." },
    { "label": "Cannot change existing DB / infra", "description": "Must reuse existing schema or infrastructure" }
  ]
}
```

**Q5 — Existing context**
```json
{
  "question": "Do you already have any related documents or code?",
  "header": "Context",
  "multiSelect": true,
  "options": [
    { "label": "Nothing yet", "description": "Starting from scratch, no mockups or specs" },
    { "label": "Mockup / design", "description": "Figma, sketch, or screen descriptions" },
    { "label": "API spec / schema", "description": "OpenAPI, ERD, or DB schema already exists" },
    { "label": "Existing code", "description": "Need to extend or integrate into a running codebase" }
  ]
}
```

**Q6 — Core user flows** *(Detailed mode only)*
```json
{
  "question": "What are the 3 most important actions a user will take in the app?",
  "header": "Core flows",
  "multiSelect": true,
  "options": [
    { "label": "Sign up / log in", "description": "Auth flow — create account, login, logout" },
    { "label": "Create / edit content", "description": "Create/edit form — posts, products, tasks, etc." },
    { "label": "Search / filter / view list", "description": "List view, search, filter, sort" },
    { "label": "Payment / order / booking", "description": "Transaction flow — purchase, schedule, checkout" }
  ]
}
```

**Q7 — Data entities** *(Detailed mode only)*
```json
{
  "question": "What are the main types of data that need to be stored?",
  "header": "Data entities",
  "multiSelect": true,
  "options": [
    { "label": "User / account", "description": "Profile, preferences, auth info" },
    { "label": "Content / records", "description": "Posts, products, tasks, orders — the app's primary entity" },
    { "label": "Relationships", "description": "Follow, like, comment, assign — links between entities" },
    { "label": "Media / files", "description": "Images, video, documents — file upload and storage" }
  ]
}
```

**Q8 — Auth requirements** *(Detailed mode only)*
```json
{
  "question": "What are the auth requirements for the app?",
  "header": "Auth",
  "multiSelect": false,
  "options": [
    { "label": "Email + password", "description": "Register and log in with email/password — simplest option" },
    { "label": "Social login (Google, GitHub)", "description": "OAuth2 — users don't need to remember a password" },
    { "label": "No login required", "description": "Fully public app, no user accounts" },
    { "label": "Magic link / OTP", "description": "Login via email link or OTP code — no password needed" }
  ]
}
```

---

**After receiving all answers**, before generating output, Claude must:

1. List the files present in `.claude/references/` (if the directory exists).
2. Ask the user via AskUserQuestion: *"I see documents in `.claude/references/`. Which files would you like me to read as a basis?"* — options are the file names + "Skip, not needed".
3. If the user selects files → read them before generating output, and incorporate them into the PRD and Technical Plan.
4. If the directory does not exist or is empty → skip, proceed directly to Phase 2.
5. If the user selects "Skip" → proceed directly to Phase 2.

---

## Phase 2 — Generate 4 Outputs (in order, after answers received)

### Output 1: PRD

```markdown
## PRD — [Feature/Product Name]

### Problem Statement
[1-2 sentences: what problem, who is affected]

### Target Users
- [User type 1]: [pain point]
- [User type 2]: [pain point]

### User Stories
| # | As a... | I want to... | So that... |
|---|---------|--------------|------------|
| 1 | [role]  | [action]     | [outcome]  |

### Acceptance Criteria
- [ ] [measurable criterion 1]
- [ ] [measurable criterion 2]

### Out of Scope (v1)
- [excluded item 1]
- [excluded item 2]
```

---

### Output 2: Technical Plan

```markdown
## Technical Plan — [Feature/Product Name]

### Stack
- **Backend**: [language/framework]
- **Frontend**: [framework]
- **Database**: [DB + ORM if any]
- **Infrastructure**: [hosting/docker/etc]
- **Key deps**: [list only non-obvious libs]

### Architecture Overview
[2-3 sentences describing the main flow: browser → API → DB → response]

### File & Folder Structure
[relevant directory tree, only new/changed paths]

### Data Model
| Table/Collection | Fields (key ones) | Relations |
|---|---|---|
| [name] | [fields] | [FK/ref] |

### API Endpoints (if applicable)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/... | JWT | ... |

### Key Decisions & Trade-offs
- [decision]: [why this, not that]
```

---

### Output 3: Step-by-Step Build Guide

```markdown
## Build Guide — [Feature/Product Name]

### Phase A: Setup & Foundation
- [ ] [S] [task 1]
- [ ] [M] [task 2]

### Phase B: Core Feature
- [ ] [M] [task 3]
- [ ] [L] [task 4]

### Phase C: Polish & Ship
- [ ] [S] [task 5]
- [ ] [S] [task 6]

**Complexity key**: S = <1h, M = 1-4h, L = 4h+
```

---

### Output 4: Handoff Prompt

Generate a self-contained prompt for a fresh Claude session to start building immediately:

```markdown
## Handoff Prompt (copy & paste into new session)

---
You are building [feature/product name].

**Context:**
[2-3 sentences summarizing the problem + solution]

**Stack:** [stack summary]

**PRD Summary:**
- Users: [who]
- Core feature: [what]
- Key acceptance criteria: [top 3]

**Start with this task:**
[first task from build guide — be specific: file to create, function to write, etc.]

**Do NOT:**
- Add features beyond the scope above
- Ask clarifying questions — start building
---
```

---

## Rules for /build execution

1. Phase 1 is mandatory — never skip to outputs without answers.
2. **Always ask Q0 first** — determine survey depth before any other question.
3. Ask only the questions matching the chosen depth: Quick=Q1,Q3,Q4 / Standard=Q1-Q5 / Detailed=Q1-Q8.
4. Use `AskUserQuestion` tool for every Phase 1 question — never ask as plain text.
5. Ask ONE question at a time — wait for answer before next question.
6. "Other" is auto-added by AskUserQuestion — do not add it manually to options.
7. After Phase 1 answers: check `.claude/references/` — list files, ask which ones to read. Skip if empty/absent.
8. Read chosen reference files BEFORE generating any output. Incorporate into PRD + Technical Plan.
9. Generate all 4 outputs in sequence after answers. Do not stop between outputs.
10. PRD owns the "what" — Tech Plan owns the "how" — no duplication.
11. Build Guide tasks must be atomic: one task = one testable unit of work.
12. Handoff Prompt must be self-contained — a fresh Claude with no context must be able to start from it.
13. If user's answers are vague, make a reasonable assumption and state it explicitly rather than asking again.
14. Keep outputs concise — tables > prose, bullets > paragraphs.
