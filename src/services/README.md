# Service Layer

The application follows a **service-oriented architecture**: React components render
state, and all business logic lives in services. Server components call services
directly; client components call them through API routes only.

Each domain below is a future service module. Only `validation/` exists in this
phase (Phase 1B). All others are **planned and not implemented** — do not consume
them yet.

| Module         | Responsibility                                                    | Status  |
| -------------- | ----------------------------------------------------------------- | ------- |
| `validation/`  | Shared validation helpers used across config and services         | Active  |
| `curriculum/`  | Reading the curriculum from Supabase (no hardcoded data in UI)    | Planned |
| `ai/`          | Text generation for post drafts                                   | Planned |
| `image/`       | Branded image generation                                          | Planned |
| `linkedin/`    | Official LinkedIn API client (OAuth 2.0)                          | Planned |
| `publishing/`  | Review, approve and publish posts                                 | Planned |
| `scheduling/`  | Scheduling of approved posts                                      | Planned |
