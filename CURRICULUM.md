# CURRICULUM.md — 105-Day Full-Stack Learning Journey

The complete day-by-day curriculum for the learning journey. This is the **source of truth** for the entire application.

---

## Overview

- **Total days:** 105
- **Total modules:** 8
- **Total weeks:** 21
- **Estimated hours:** 420

---

## Modules

| # | Title | Days | Weeks | Hours | Day Range |
|---|-------|------|-------|-------|-----------|
| 1 | Foundation: Git, Terminal, Python, OOP & DSA | 10 | 2 | 40 | 1–10 |
| 2 | Frontend: HTML, CSS & JavaScript | 15 | 3 | 60 | 11–25 |
| 3 | Frontend: React & Next.js | 25 | 5 | 100 | 26–50 |
| 4 | Backend Track | 25 | 5 | 100 | 51–75 |
| 5 | Databases | 10 | 2 | 40 | 76–85 |
| 6 | QA & Testing | 5 | 1 | 20 | 86–90 |
| 7 | DevOps & CI/CD | 10 | 2 | 40 | 91–100 |
| 8 | Software Architecture & Design | 5 | 1 | 20 | 101–105 |

---

## Module 1 — Foundation: Git, Terminal, Python, OOP & DSA (Days 1–10)

| Day | Topic |
|-----|-------|
| 1 | Environment Setup, Git & Terminal |
| 2 | Python Fundamentals |
| 3 | Python Collections, Files & Errors |
| 4 | OOP I — Classes, Objects & Encapsulation |
| 5 | OOP II — Inheritance, Polymorphism & Abstraction |
| 6 | SOLID Principles & Design Patterns |
| 7 | DSA I — Linear Structures & Big-O |
| 8 | DSA II — Recursion, Searching & Sorting |
| 9 | DSA III — Trees, Graphs & Heaps |
| 10 | Foundation Review & Assessment |

## Module 2 — Frontend: HTML, CSS & JavaScript (Days 11–25)

| Day | Topic |
|-----|-------|
| 11 | HTML Fundamentals |
| 12 | CSS Fundamentals |
| 13 | Flexbox & CSS Grid |
| 14 | CSS Transitions, Animations & Advanced Patterns |
| 15 | JavaScript Fundamentals |
| 16 | JavaScript Arrays & Objects |
| 17 | DOM Manipulation |
| 18 | Asynchronous JavaScript |
| 19 | Error Handling & Debugging |
| 20 | ES6+ Modern JavaScript |
| 21 | Working with APIs |
| 22 | Local Storage & Data Persistence |
| 23 | Web Accessibility & Performance |
| 24 | Frontend Project Planning & Architecture |
| 25 | Frontend Integration & Module Review |

## Module 3 — Frontend: React & Next.js (Days 26–50)

| Day | Topic |
|-----|-------|
| 26 | React Introduction & JSX |
| 27 | Props & Component Communication |
| 28 | State & useState Hook |
| 29 | useEffect & Side Effects |
| 30 | Forms & Event Handling in React |
| 31 | useRef, useMemo & useCallback |
| 32 | Custom Hooks |
| 33 | React Router |
| 34 | Context API & State Management |
| 35 | Next.js Introduction & App Router |
| 36 | Server Components & Client Components |
| 37 | Data Fetching in Next.js |
| 38 | API Routes & Route Handlers |
| 39 | Server Actions & Forms |
| 40 | Styling in Next.js |
| 41 | Authentication in Next.js |
| 42 | Database Integration |
| 43 | State Management Patterns |
| 44 | Image & Font Optimization |
| 45 | Caching & Performance |
| 46 | Testing React & Next.js |
| 47 | Deployment & Production |
| 48 | Advanced Patterns & Best Practices |
| 49 | Portfolio Project Planning |
| 50 | Module 3 Review & Assessment |

## Module 4 — Backend Track (Days 51–75)

| Day | Topic |
|-----|-------|
| 51 | Node.js Fundamentals |
| 52 | Express.js Introduction |
| 53 | REST API Design Principles |
| 54 | Middleware & Error Handling |
| 55 | Authentication & Authorization |
| 56 | Python Web Development Introduction |
| 57 | FastAPI & Async Python |
| 58 | API Security |
| 59 | WebSockets & Real-time Communication |
| 60 | File Upload & Storage |
| 61 | Background Jobs & Task Queues |
| 62 | Email & Notification Systems |
| 63 | API Integration & External Services |
| 64 | Logging & Monitoring |
| 65 | Backend Project Architecture |
| 66 | Python Advanced Backend |
| 67 | GraphQL Introduction |
| 68 | Microservices Concepts |
| 69 | Message Queues & Event-Driven Architecture |
| 70 | API Versioning & Documentation |
| 71 | Caching Strategies |
| 72 | Performance Optimization |
| 73 | Testing Backend Applications |
| 74 | Backend Capstone Project |
| 75 | Module 4 Review & Assessment |

## Module 5 — Databases (Days 76–85)

| Day | Topic |
|-----|-------|
| 76 | Database Fundamentals |
| 77 | PostgreSQL Fundamentals |
| 78 | SQL Joins & Relationships |
| 79 | Advanced SQL |
| 80 | Prisma ORM |
| 81 | Database Design Patterns |
| 82 | MongoDB Introduction |
| 83 | MongoDB Advanced Operations |
| 84 | ORM Comparison & Data Migration |
| 85 | Module 5 Review & Assessment |

## Module 6 — QA & Testing (Days 86–90)

| Day | Topic |
|-----|-------|
| 86 | Testing Fundamentals |
| 87 | Unit Testing |
| 88 | Integration Testing |
| 89 | End-to-End Testing |
| 90 | Testing Strategy & Code Quality |

## Module 7 — DevOps & CI/CD (Days 91–100)

| Day | Topic |
|-----|-------|
| 91 | Linux Fundamentals |
| 92 | Docker Fundamentals |
| 93 | Docker for Development & Production |
| 94 | CI/CD Concepts & GitHub Actions |
| 95 | Deployment Platforms |
| 96 | Infrastructure as Code |
| 97 | Monitoring & Observability |
| 98 | Security in DevOps |
| 99 | DevOps Project |
| 100 | Module 7 Review & Assessment |

## Module 8 — Software Architecture & Design (Days 101–105)

| Day | Topic |
|-----|-------|
| 101 | Architectural Patterns |
| 102 | System Design |
| 103 | API Design & Documentation |
| 104 | Portfolio & Professional Development |
| 105 | Capstone Project & Celebration |

---

## Seeding Process

### Prerequisites

- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Supabase project with tables created (Phase 1E migrations applied)

### Running the Seed

```bash
pnpm seed:curriculum
```

The script:
1. Validates curriculum data (105 days, no gaps, no duplicates)
2. Upserts modules (idempotent — safe to run multiple times)
3. Upserts curriculum days (idempotent — safe to run multiple times)
4. Verifies the seed result in the database

### Seed Data Location

- `seed/curriculum.ts` — All module and day data (source of truth)
- `seed/seed.ts` — Seed script with validation and database operations

---

## Validation Rules

The seed script validates:

| Rule | Description |
|------|-------------|
| Total days | Exactly 105 curriculum days |
| No gaps | Days 1–105 all present |
| No duplicates | Each day number appears exactly once |
| Module references | Each day references a valid module |
| Day ranges | Module start_day/end_day match actual day range |
| Day counts | Module day count matches actual days in module |
| Subtopics | Each day has a valid subtopics array |

---

## Design Decisions

1. **Seed data in TypeScript** — The curriculum is stored in `seed/curriculum.ts` as typed data structures, not SQL. This makes it maintainable, type-safe, and easy to update.

2. **Upsert (not insert)** — The seed uses `onConflict` upserts so it can be run multiple times without creating duplicates.

3. **Service-role for seeding** — The seed script uses the service-role key to bypass RLS. This is appropriate for data seeding operations.

4. **Batch inserts** — Days are inserted in batches of 20 for efficiency while avoiding payload limits.

5. **Automated verification** — The seed script verifies the result after seeding, not just before. This ensures the database state matches expectations.

---

## Curriculum Structure

Each curriculum day includes:

| Field | Description |
|-------|-------------|
| `day_number` | Unique 1–105 identifier |
| `module_id` | Foreign key to the parent module |
| `week_number` | Week number within the journey |
| `topic` | Main topic title |
| `content` | Detailed learning material description |
| `subtopics` | Array of subtopic strings |
| `project_information` | Hands-on project description |
| `assessment_information` | Assessment or quiz details |

---

## Querying the Curriculum

```sql
-- Get a specific day
SELECT * FROM curriculum_days WHERE day_number = 42;

-- Get all days in a module
SELECT * FROM curriculum_days WHERE module_id = '<module-uuid>' ORDER BY day_number;

-- Get all days in a week
SELECT * FROM curriculum_days WHERE week_number = 5 ORDER BY day_number;

-- Get module with day count
SELECT m.*, COUNT(cd.id) as day_count
FROM modules m
LEFT JOIN curriculum_days cd ON cd.module_id = m.id
GROUP BY m.id
ORDER BY m.module_number;
```
