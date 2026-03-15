# PRD: Municipal Asset Lifecycle Management System

---

## Introduction

This document defines the full product requirements for a **Municipal Asset Lifecycle Management System** — a web-based platform that enables a municipality to plan, register, operate, maintain, and retire its entire public asset portfolio across all organizational bodies.

The system is designed around the central principle that **a municipal asset must not be modeled as a flat record**. Instead, every asset exists simultaneously in a lifecycle stage, under one or more responsible bodies, with an associated budget envelope, a document set, and an event log. The architecture must reflect this multi-dimensional reality from day one.

The asset portfolio includes: public buildings, educational buildings, facilities, public gardens, trees, sports fields and sports facilities, leased and allocated real estate, and assets in formation through planning or developer obligations. The system must support all organizational bodies that interact with these assets: the CEO Office, Planning Administration, Assets Department, Operations/Gardening Department, Culture/Society/Sports Administration, Sports Department, field contractors, and the Data and Innovation Headquarters. External contractors and public-facing users are also in scope.

The system is organized into four implementation phases:

- **Phase 1 — Stable Foundations:** Core domain entities (Asset Family, Asset Type, Asset, Responsible Body, Lifecycle Stage, Budget Envelope, Document, Event)
- **Phase 2 — Operational Depth:** Contract, Work Order, Condition Record, Handover Record, GIS Location, Asset Hierarchy
- **Phase 3 — Planning and Municipal Complexity:** Planning Entity, Developer Obligation, Allocation, Body Transfer, Operator Model, Revenue and Collection
- **Phase 4 — Advanced Control:** KPI dashboards, backlog logic, risk scoring, exception management, document completeness rules, budget variance rules, lifecycle transition rules

All four phases are in scope for this PRD. Phases must be implemented in order, as each depends on the data foundations established by the previous one.

---

## Goals

- Provide a single, authoritative system of record for all municipal assets across all families and types
- Model every asset as an entity that exists within a lifecycle stage, under defined responsible bodies, with an active budget, a document set, and a traceable event log
- Support all organizational bodies with role-appropriate views and permissions: headquarters, planning, operations, departments, field contractors, and public users
- Implement a lifecycle state machine with soft enforcement — transitions trigger warnings when required conditions are unmet, but users can override with justification
- Support whole-of-life budgeting: CAPEX, OPEX, renewal reserve, developer funding, external sources, and lease income — all linked to assets and stages
- Support hierarchical asset structures: building → wing → floor → room; garden → zone → facility → component; sports facility → field → sub-asset
- Track two open organizational gaps as placeholder entities flagged for resolution: the holding body for educational buildings and the holding body for developer-obligation-born health and community assets
- Provide executive, departmental, and operational dashboards with KPIs, backlogs, risk scores, and exception alerts
- Expose a public-facing view for appropriate asset data
- Support GIS integration with map-based asset visualization

---

## User Stories

---

### PHASE 1 — STABLE FOUNDATIONS

---

### US-001: Asset Family schema and migration
**Description:** As a developer, I want an `asset_families` table so that all assets can be classified at the highest level.

**Acceptance Criteria:**
- [x] Table `asset_families` created with columns: `id` (UUID PK), `name` (string, not null, unique), `description` (text), `is_active` (boolean, default true), `created_at`, `updated_at`
- [x] Seed data inserted for all known families: Public Buildings, Educational Buildings, Facilities, Public Gardens, Trees, Sports Fields and Sports Facilities, Real Estate / Lease / Allocation Assets, Assets in Formation, Community / Health Assets from Developer Obligations
- [x] Migration runs cleanly on a fresh database
- [x] Typecheck passes

---

### US-002: Asset Type schema and migration
**Description:** As a developer, I want an `asset_types` table linked to `asset_families` so that detailed classification within each family is possible.

**Acceptance Criteria:**
- [x] Table `asset_types` created with columns: `id` (UUID PK), `asset_family_id` (FK → asset_families), `name` (string, not null), `description` (text), `is_active` (boolean, default true), `created_at`, `updated_at`
- [x] Unique constraint on (`asset_family_id`, `name`)
- [x] Seed data inserted for all known types per family, including: Community Center, School, Kindergarten, Maternal and Child Health Center, Health Fund Clinic, Public Garden, Traffic Island, Single Tree, Football Field, Sports Hall, Municipal Office, Warehouse, Commercial Unit, and others from the domain specification
- [x] Foreign key constraint enforced
- [x] Migration runs cleanly
- [x] Typecheck passes

---

### US-003: Responsible Body schema and migration
**Description:** As a developer, I want a `responsible_bodies` table so that every organizational body involved in asset management can be represented.

**Acceptance Criteria:**
- [x] Table `responsible_bodies` created with columns: `id` (UUID PK), `name` (string, not null, unique), `body_type` (enum: `headquarters`, `planning`, `assets`, `operations`, `administration`, `department`, `contractor`, `data_governance`, `placeholder`), `description` (text), `is_active` (boolean, default true), `created_at`, `updated_at`
- [x] Seed data inserted for: CEO Office / Executive Headquarters, Planning Administration / Public Construction Headquarters, Assets Department, Operations / Gardening Department, Culture Society and Sports Administration, Sports Department, Data and Innovation Headquarters, Contractors / Suppliers / Field Parties
- [x] Two placeholder entries inserted with `body_type = 'placeholder'` and names: "Educational Buildings Holding Body (TBD)" and "Health/Community Developer Obligation Holding Body (TBD)" — both flagged with a `is_placeholder` boolean column (default false, true for these two) and a `resolution_note` text column explaining the open decision
- [x] Migration runs cleanly
- [x] Typecheck passes

---

### US-004: Lifecycle Stage schema and migration
**Description:** As a developer, I want a `lifecycle_stages` table that defines all valid stages in the shared asset lifecycle, so that the state machine can reference them.

**Acceptance Criteria:**
- [x] Table `lifecycle_stages` created with columns: `id` (UUID PK), `name` (string, not null, unique), `display_order` (integer, not null), `description` (text), `applies_to_families` (JSONB array of family IDs, nullable — null means applies to all), `created_at`, `updated_at`
- [x] Seed data inserted for all 10 stages in order: Need Identification (1), Asset Definition (2), Planning and Approval (3), Budgeting and Allocation (4), Establishment / Implementation / Intake (5), Activation and Operation (6), Maintenance and Control (7), Change / Upgrade / Reconfiguration (8), Renewal / Replacement (9), Disposal / End of Life (10)
- [x] Table `lifecycle_transitions` created with columns: `id`, `from_stage_id` (FK), `to_stage_id` (FK), `applies_to_family_id` (FK, nullable — null means all families), `required_document_types` (JSONB array), `required_events` (JSONB array), `warning_message` (text — message shown on soft enforcement), `is_active` (boolean)
- [x] Migration runs cleanly
- [x] Typecheck passes

---

### US-005: Asset core schema and migration
**Description:** As a developer, I want an `assets` table that is the central entity of the system, linking family, type, lifecycle, responsible bodies, location, planning, and budget.

**Acceptance Criteria:**
- [x] Table `assets` created with all core columns:
  - `id` (UUID PK)
  - `asset_name` (string, not null)
  - `asset_code` (string, unique, not null — human-readable identifier)
  - `asset_family_id` (FK → asset_families, not null)
  - `asset_type_id` (FK → asset_types, not null)
  - `current_lifecycle_stage_id` (FK → lifecycle_stages, not null)
  - `current_status` (enum: `active`, `inactive`, `in_formation`, `in_construction`, `decommissioned`, `disposed`, default `in_formation`)
  - `ownership_model` (enum: `owned`, `leased_in`, `leased_out`, `allocated`, `developer_obligation`, `partnership`)
  - `strategic_owner_body_id` (FK → responsible_bodies, nullable)
  - `responsible_body_id` (FK → responsible_bodies, nullable)
  - `operational_body_id` (FK → responsible_bodies, nullable)
  - `maintenance_body_id` (FK → responsible_bodies, nullable)
  - `data_steward_body_id` (FK → responsible_bodies, nullable)
  - `parent_asset_id` (FK → assets self-referential, nullable)
  - `planning_entity_id` (FK → planning_entities, nullable — will be populated in Phase 3)
  - `developer_obligation_id` (FK → developer_obligations, nullable — Phase 3)
  - `active_budget_envelope_id` (FK → budget_envelopes, nullable — populated after Phase 1 budget stories)
  - `location_id` (FK → gis_locations, nullable — Phase 2)
  - `gis_reference` (string, nullable)
  - `address` (text, nullable)
  - `area_sqm` (decimal, nullable)
  - `service_start_date` (date, nullable)
  - `handover_date` (date, nullable)
  - `decommission_date` (date, nullable)
  - `notes` (text, nullable)
  - `is_placeholder_body` (boolean, default false — true if asset is assigned to a TBD placeholder body)
  - `created_at`, `updated_at`
- [x] Index on `asset_family_id`, `asset_type_id`, `current_lifecycle_stage_id`, `responsible_body_id`, `current_status`
- [x] Migration runs cleanly
- [x] Typecheck passes

---

### US-006: Budget Envelope schema and migration
**Description:** As a developer, I want a `budget_envelopes` table that supports whole-of-life budgeting per asset, per lifecycle stage, and per fiscal year.

**Acceptance Criteria:**
- [x] Table `budget_envelopes` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, not null)
  - `lifecycle_stage_id` (FK → lifecycle_stages, nullable — null means applies to full asset lifecycle)
  - `budget_type` (enum: `capex`, `opex`, `renewal_reserve`, `external_funding`, `developer_funded`, `lease_income`, `service_charges`, `maintenance_reserve`, `adjustment`, `equipment`)
  - `fiscal_year` (integer, nullable)
  - `is_multi_year` (boolean, default false)
  - `multi_year_start` (integer, nullable)
  - `multi_year_end` (integer, nullable)
  - `approved_amount` (decimal, default 0)
  - `committed_amount` (decimal, default 0)
  - `actual_amount` (decimal, default 0)
  - `variance_amount` (decimal — computed as approved minus actual, stored for query performance)
  - `external_source_description` (text, nullable)
  - `developer_funded_amount` (decimal, default 0)
  - `responsible_body_id` (FK → responsible_bodies, nullable)
  - `notes` (text, nullable)
  - `created_at`, `updated_at`
- [x] Index on `asset_id`, `fiscal_year`, `budget_type`, `lifecycle_stage_id`
- [x] Migration runs cleanly
- [x] Typecheck passes

---

### US-007: Document schema and migration
**Description:** As a developer, I want a `documents` table that supports document attachment to assets, events, budget envelopes, contracts, and planning entities.

**Acceptance Criteria:**
- [x] Table `document_types` created with columns: `id`, `name` (string, unique), `description`, `is_active`
- [x] Seed data inserted for all known document types: plan, permit, approval, allocation document, specification, execution report, delivery document, as-made document, occupancy protocol, activation approval, operator agreement, inspection form, work order, maintenance report, safety report, closure approval, decommissioning protocol, disposal decision, developer commitment, budget approval, contract, title deed, condition survey, field photo, GIS reference document, survey report
- [x] Table `documents` created with columns:
  - `id` (UUID PK)
  - `document_type_id` (FK → document_types, not null)
  - `title` (string, not null)
  - `description` (text, nullable)
  - `file_url` (string, not null — storage path or external URL)
  - `file_name` (string)
  - `file_size_bytes` (integer)
  - `mime_type` (string)
  - `attached_to_entity_type` (enum: `asset`, `event`, `budget_envelope`, `contract`, `planning_entity`, `developer_obligation`, `handover_record`, `work_order`)
  - `attached_to_entity_id` (UUID, not null)
  - `uploaded_by_user_id` (FK → users, nullable — users table added in US-073)
  - `lifecycle_stage_id` (FK → lifecycle_stages, nullable — stage at which document was added)
  - `is_required` (boolean, default false — set by document completeness rules)
  - `is_verified` (boolean, default false)
  - `verified_by_user_id` (FK → users, nullable)
  - `verified_at` (timestamp, nullable)
  - `expiry_date` (date, nullable)
  - `created_at`, `updated_at`
- [x] Index on (`attached_to_entity_type`, `attached_to_entity_id`), `document_type_id`, `lifecycle_stage_id`
- [x] Migration runs cleanly
- [x] Typecheck passes

---

### US-008: Event schema and migration
**Description:** As a developer, I want an `events` table that records every meaningful lifecycle action on an asset, providing a full, immutable audit trail.

**Acceptance Criteria:**
- [x] Table `event_types` created with columns: `id`, `name` (string, unique), `category` (enum: `business`, `operational`, `governance`), `description`, `is_active`
- [x] Seed data inserted for all known event types grouped by category:
  - Business: need_opened, plan_reviewed, land_allocated, budget_approved, contract_signed, funding_changed, asset_transferred, operator_changed, approval_granted, allocation_confirmed
  - Operational: construction_started, asset_delivered, asset_received, asset_activated, maintenance_opened, inspection_completed, inspection_failed, pruning_executed, fault_opened, service_suspended, safety_issue_reported, work_order_created, work_order_closed, turf_replaced, irrigation_repaired, asset_reassigned
  - Governance: status_changed, missing_document_detected, budget_variance_detected, asset_at_risk_flagged, overdue_milestone_flagged, lifecycle_stage_changed, contract_renewed, asset_decommissioned
- [x] Table `events` created with columns:
  - `id` (UUID PK)
  - `event_type_id` (FK → event_types, not null)
  - `asset_id` (FK → assets, not null)
  - `lifecycle_stage_id` (FK → lifecycle_stages, nullable — stage at time of event)
  - `occurred_at` (timestamp, not null, default now())
  - `recorded_by_user_id` (FK → users, nullable)
  - `responsible_body_id` (FK → responsible_bodies, nullable)
  - `description` (text, nullable)
  - `metadata` (JSONB, nullable — flexible payload for event-specific data)
  - `is_system_generated` (boolean, default false — true for auto-generated governance events)
  - `created_at`
- [x] Events are append-only: no update or delete exposed via API
- [x] Index on `asset_id`, `event_type_id`, `occurred_at`, `lifecycle_stage_id`
- [x] Migration runs cleanly
- [x] Typecheck passes

---

### US-009: Asset Family CRUD API
**Description:** As a system administrator, I want REST API endpoints for managing asset families so that classifications can be created and maintained.

**Acceptance Criteria:**
- [x] `GET /api/asset-families` returns all active families
- [x] `GET /api/asset-families/:id` returns a single family with its asset types
- [x] `POST /api/asset-families` creates a new family; requires `name`
- [x] `PUT /api/asset-families/:id` updates name, description, is_active
- [x] Soft delete via `is_active = false` — no hard delete
- [x] All endpoints return consistent JSON shape with `data`, `error`, `meta` envelope
- [x] Input validated: `name` required and max 120 chars
- [x] Typecheck passes

---

### US-010: Asset Type CRUD API
**Description:** As a system administrator, I want REST API endpoints for managing asset types within a family.

**Acceptance Criteria:**
- [x] `GET /api/asset-types` returns all active types, supports `?family_id=` filter
- [x] `GET /api/asset-types/:id` returns a single type
- [x] `POST /api/asset-types` creates a new type; requires `asset_family_id` and `name`
- [x] `PUT /api/asset-types/:id` updates name, description, is_active
- [x] Duplicate type name within the same family is rejected with 422
- [x] Soft delete only
- [x] Typecheck passes

---

### US-011: Responsible Body CRUD API
**Description:** As a system administrator, I want REST API endpoints for managing responsible bodies.

**Acceptance Criteria:**
- [x] `GET /api/responsible-bodies` returns all bodies, supports `?body_type=` and `?include_placeholders=` filters
- [x] `GET /api/responsible-bodies/:id` returns body details including assets it is responsible for (count by role type)
- [x] `POST /api/responsible-bodies` creates a new body; requires `name` and `body_type`
- [x] `PUT /api/responsible-bodies/:id` updates name, description, body_type, is_active, resolution_note
- [x] Placeholder bodies cannot be set to `is_active = false` without explicit confirmation flag in payload
- [x] Soft delete only
- [x] Typecheck passes

---

### US-012: Lifecycle Stage management API
**Description:** As a developer and administrator, I want API endpoints for reading lifecycle stages and managing allowed transitions so that the state machine is configurable.

**Acceptance Criteria:**
- [x] `GET /api/lifecycle-stages` returns all stages ordered by `display_order`
- [x] `GET /api/lifecycle-stages/:id` returns stage details including outgoing transitions
- [x] `GET /api/lifecycle-transitions` returns all transitions, supports `?from_stage_id=` and `?family_id=` filters
- [x] `POST /api/lifecycle-transitions` creates a new transition rule; requires `from_stage_id`, `to_stage_id`, `warning_message`
- [x] `PUT /api/lifecycle-transitions/:id` updates required_document_types, required_events, warning_message, is_active
- [x] Lifecycle stages themselves are read-only via API (managed by migration/seed only)
- [x] Typecheck passes

---

### US-013: Asset CRUD API — core
**Description:** As any authorized user, I want REST API endpoints for creating, reading, updating, and searching assets.

**Acceptance Criteria:**
- [x] `GET /api/assets` returns paginated list of assets; supports filters: `family_id`, `type_id`, `status`, `lifecycle_stage_id`, `responsible_body_id`, `operational_body_id`, `ownership_model`, `is_placeholder_body`, `search` (full-text on name and code)
- [x] `GET /api/assets/:id` returns full asset detail including family, type, lifecycle stage, all responsible body roles, current budget envelopes, recent events (last 10), documents (count by type), and hierarchy (parent + direct children)
- [x] `POST /api/assets` creates a new asset; requires `asset_name`, `asset_family_id`, `asset_type_id`; auto-assigns `current_lifecycle_stage_id` to "Need Identification" and `current_status` to `in_formation`; auto-generates `asset_code` if not provided (format: `[FAMILY_PREFIX]-[YEAR]-[SEQUENCE]`)
- [x] `PUT /api/assets/:id` updates all non-computed fields; does not allow direct `current_lifecycle_stage_id` update (must use transition endpoint)
- [x] `GET /api/assets/:id/children` returns direct children in the hierarchy
- [x] `GET /api/assets/:id/ancestry` returns the full ancestor chain
- [x] Typecheck passes

---

### US-014: Asset lifecycle transition API with soft enforcement
**Description:** As an asset manager, I want to transition an asset from one lifecycle stage to another, with the system checking conditions and warning me if requirements are unmet but allowing me to proceed.

**Acceptance Criteria:**
- [x] `POST /api/assets/:id/transition` accepts `{ to_stage_id, justification, override_warnings }` in body
- [x] Endpoint checks `lifecycle_transitions` table for a valid transition from current stage to requested stage (considering asset family)
- [x] If no valid transition exists, return 422 with message "No valid transition path from [current] to [requested] for this asset family"
- [x] If transition exists but conditions are unmet (missing required documents, missing required events), return 200 with `warnings` array listing each unmet condition and `transition_blocked: false` — the transition is NOT blocked, only warned
- [x] If `override_warnings: true` is passed, transition proceeds; a governance event `lifecycle_stage_changed` is auto-created with metadata including `warnings_overridden: true` and the justification text
- [x] If all conditions are met, transition proceeds; `lifecycle_stage_changed` event created without override flag
- [x] Asset `current_lifecycle_stage_id` is updated atomically with the event creation
- [x] Previous stage is recorded in the event metadata for full history
- [x] Typecheck passes

---

### US-015: Budget Envelope CRUD API
**Description:** As a budget manager, I want API endpoints for creating and managing budget envelopes per asset and per lifecycle stage.

**Acceptance Criteria:**
- [x] `GET /api/budget-envelopes` returns envelopes; supports filters: `asset_id`, `budget_type`, `fiscal_year`, `lifecycle_stage_id`, `responsible_body_id`
- [x] `GET /api/budget-envelopes/:id` returns envelope detail
- [x] `GET /api/assets/:id/budgets` returns all budget envelopes for an asset, grouped by budget_type, with totals
- [x] `POST /api/budget-envelopes` creates a new envelope; requires `asset_id`, `budget_type`; at least one of `fiscal_year` or `is_multi_year` must be set
- [x] `PUT /api/budget-envelopes/:id` updates approved_amount, committed_amount, actual_amount; `variance_amount` is recomputed on every update
- [x] `DELETE /api/budget-envelopes/:id` allowed only if `actual_amount = 0`; otherwise soft-close via an `is_closed` flag
- [x] Typecheck passes

---

### US-016: Document upload and attachment API
**Description:** As any authorized user, I want to upload a document and attach it to an asset, event, budget envelope, or other entity.

**Acceptance Criteria:**
- [x] `POST /api/documents/upload` accepts multipart file upload; stores file in configured storage (local disk in dev, object storage in prod); returns a `file_url` and metadata
- [x] `POST /api/documents` creates a document record; requires `document_type_id`, `title`, `file_url`, `attached_to_entity_type`, `attached_to_entity_id`
- [x] `GET /api/documents` returns documents; supports filters: `attached_to_entity_type`, `attached_to_entity_id`, `document_type_id`, `lifecycle_stage_id`, `is_required`, `is_verified`
- [x] `GET /api/documents/:id` returns document detail with download URL
- [x] `PUT /api/documents/:id/verify` marks document as verified; sets `verified_by_user_id` and `verified_at`
- [x] `DELETE /api/documents/:id` soft-deletes (sets `is_deleted` flag); file in storage is retained
- [x] File size limit enforced (configurable, default 50MB)
- [x] Typecheck passes

---

### US-017: Event creation and retrieval API
**Description:** As any authorized user, I want to create events on assets and retrieve the event log.

**Acceptance Criteria:**
- [x] `POST /api/events` creates a new event; requires `event_type_id`, `asset_id`; `occurred_at` defaults to now if not provided
- [x] `GET /api/events` returns paginated events; supports filters: `asset_id`, `event_type_id`, `category`, `lifecycle_stage_id`, `responsible_body_id`, `occurred_at_from`, `occurred_at_to`, `is_system_generated`
- [x] `GET /api/assets/:id/events` returns full event log for an asset ordered by `occurred_at` descending
- [x] Events cannot be updated or deleted via API (immutable log)
- [x] System-generated governance events are created automatically by the transition endpoint (US-014), budget variance logic (Phase 4), and document completeness rules (Phase 4)
- [x] Typecheck passes

---

### US-018: User authentication schema and API
**Description:** As a developer, I want user accounts with JWT-based authentication so that all actions are tied to an identified user.

**Acceptance Criteria:**
- [x] Table `users` created with columns: `id` (UUID PK), `email` (string, unique, not null), `name` (string), `role` (enum: `admin`, `planner`, `asset_manager`, `operations_manager`, `department_user`, `contractor`, `public`, default `public`), `responsible_body_id` (FK → responsible_bodies, nullable — the body this user belongs to), `is_active` (boolean, default true), `last_login_at`, `created_at`, `updated_at`
- [x] `POST /api/auth/register` creates a user (admin only)
- [x] `POST /api/auth/login` accepts email + password; returns signed JWT
- [x] `POST /api/auth/refresh` refreshes JWT
- [x] `GET /api/auth/me` returns current user profile
- [x] JWT middleware validates token on all protected routes
- [x] Password hashed with bcrypt (min 12 rounds)
- [x] Typecheck passes

---

### US-019: Role-based access control middleware
**Description:** As a developer, I want route-level and resource-level access control so that users can only perform actions permitted by their role.

**Acceptance Criteria:**
- [x] Middleware created that reads JWT `role` claim and enforces the following:
  - `public`: read-only access to approved public asset data only
  - `contractor`: read own assigned work orders; create events and documents on assigned assets only
  - `department_user`: read all assets in their body; create and update assets in their body
  - `operations_manager`: full CRUD on assets, events, documents, work orders; read budgets
  - `asset_manager`: full CRUD including budgets and contracts
  - `planner`: full CRUD on planning entities and developer obligations; read all assets
  - `admin`: full access to all endpoints including user management and seed data
- [x] Attempting a forbidden action returns 403 with message indicating required role
- [x] All existing endpoints updated to require at minimum authenticated access (`public` role allowed only on explicitly public endpoints)
- [x] Typecheck passes

---

### US-020: Asset Family management UI
**Description:** As a system administrator, I want a UI page to view, create, and edit asset families.

**Acceptance Criteria:**
- [x] Route `/admin/asset-families` renders a table of all asset families with name, description, active status, and type count
- [x] Each row has Edit and Deactivate actions
- [x] "Add Family" button opens an inline form or modal with name and description fields
- [x] Validation errors displayed inline
- [x] Inactive families shown with visual distinction (greyed out)
- [x] Typecheck passes
- [x] Verify changes work in browser

---

### US-021: Asset Type management UI
**Description:** As a system administrator, I want a UI page to manage asset types within each family.

**Acceptance Criteria:**
- [ ] Route `/admin/asset-types` renders a grouped table organized by family
- [ ] Filter by family via dropdown
- [ ] "Add Type" button opens form pre-populated with selected family
- [ ] Edit and Deactivate per row
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-022: Responsible Body management UI
**Description:** As a system administrator, I want a UI page to manage responsible bodies, including visibility of placeholder bodies.

**Acceptance Criteria:**
- [ ] Route `/admin/responsible-bodies` renders a table with name, body_type, status, and asset count
- [ ] Placeholder bodies displayed with a distinct warning badge and "Open Decision" label
- [ ] Each placeholder shows the `resolution_note` in an expandable row
- [ ] Edit modal includes resolution_note field for admin to document when decision is made
- [ ] Toggle active/inactive with confirmation dialog
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-023: Asset list view with filters and search
**Description:** As any authorized user, I want a searchable, filterable list of all assets visible to my role so that I can find the asset I need quickly.

**Acceptance Criteria:**
- [ ] Route `/assets` renders a table of assets with columns: asset_code, asset_name, family, type, status, lifecycle stage, responsible body, last event date
- [ ] Filter panel includes: Family (multi-select), Type (multi-select, dependent on Family), Status (multi-select), Lifecycle Stage (multi-select), Responsible Body (multi-select), Ownership Model (multi-select), Placeholder Body flag (checkbox)
- [ ] Search box filters by asset_name and asset_code (debounced, 300ms)
- [ ] Pagination: 25 assets per page with page controls
- [ ] Each row links to the asset detail page
- [ ] Column sort on asset_code, asset_name, status, lifecycle stage
- [ ] Results count displayed above table
- [ ] Users with `public` role see only assets marked as publicly visible
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-024: Asset detail page — header and core fields
**Description:** As an authorized user, I want a dedicated asset detail page showing all core fields, responsible bodies, and current lifecycle stage.

**Acceptance Criteria:**
- [ ] Route `/assets/:id` renders the asset detail page
- [ ] Header section displays: asset_code, asset_name, family badge, type badge, status badge, ownership_model badge
- [ ] Core fields section displays: address, area_sqm, service_start_date, handover_date, decommission_date, notes, gis_reference
- [ ] Responsible Bodies section displays all six body roles (strategic owner, responsible, operational, maintenance, data steward, funding source) — each shows the body name or "Not assigned"
- [ ] If any body is a placeholder, a warning banner is shown: "This asset is assigned to a placeholder body — organizational ownership not yet resolved"
- [ ] Lifecycle Stage section shows current stage as a horizontal stepper with all 10 stages; current stage highlighted; completed stages marked
- [ ] Edit button (for authorized roles) opens edit form
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-025: Asset detail page — lifecycle transition panel
**Description:** As an asset manager, I want to transition an asset's lifecycle stage from the asset detail page, with clear warnings when conditions are unmet.

**Acceptance Criteria:**
- [ ] "Transition Stage" button visible on asset detail page for users with `asset_manager` role or higher
- [ ] Clicking opens a modal listing all valid next stages for the current asset (based on family and transition rules)
- [ ] Each available next stage shows a summary of required documents and events
- [ ] Unmet requirements shown in red with count of missing items; met requirements shown in green
- [ ] A "Justification" text field appears when there are unmet requirements
- [ ] Confirm button transitions the asset; if warnings exist and no justification entered, inline validation prevents submission
- [ ] On success, lifecycle stepper on detail page updates immediately; a toast notification confirms the transition
- [ ] On transition with warnings overridden, a yellow alert badge appears on the event log entry
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-026: Asset creation form
**Description:** As an asset manager or planner, I want to create a new asset through a multi-step form.

**Acceptance Criteria:**
- [ ] Route `/assets/new` renders a multi-step form: Step 1 — Classification (family, type); Step 2 — Identity (name, optional code, ownership model, address, area); Step 3 — Responsibility (body assignments for each role); Step 4 — Review and Submit
- [ ] Asset code auto-generated if left blank; user can override
- [ ] Family selection in Step 1 filters available types in the same step
- [ ] Step 3 body selectors are typeahead dropdowns pulling from `/api/responsible-bodies`
- [ ] Placeholder bodies shown with warning icon in dropdown — user can still select but a warning is displayed
- [ ] On submit, asset created via `POST /api/assets`; user redirected to new asset detail page
- [ ] Validation errors displayed inline per field
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-027: Budget Envelope management UI on asset detail page
**Description:** As a budget manager, I want to view and manage all budget envelopes for an asset from the asset detail page.

**Acceptance Criteria:**
- [ ] Asset detail page includes a "Budgets" tab
- [ ] Tab renders a table of all budget envelopes grouped by budget_type; columns: type, lifecycle stage, fiscal year / multi-year range, approved, committed, actual, variance (color-coded: green if variance ≥ 0, red if negative)
- [ ] "Add Budget Envelope" button opens a form: budget_type (select), lifecycle_stage (select, optional), fiscal_year or multi-year range, amounts
- [ ] Inline edit for approved, committed, actual amounts
- [ ] Total row per group and grand total row at bottom
- [ ] Closed envelopes shown greyed out with "Closed" badge
- [ ] Users with `department_user` role see budgets in read-only mode
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-028: Document management UI on asset detail page
**Description:** As any authorized user, I want to view, upload, and manage documents attached to an asset from the asset detail page.

**Acceptance Criteria:**
- [ ] Asset detail page includes a "Documents" tab
- [ ] Tab renders a list of documents grouped by document_type; each item shows: type badge, title, file name, upload date, uploaded by, verified badge if verified
- [ ] "Upload Document" button opens a form: document_type (select), title, file picker, lifecycle_stage (optional), expiry_date (optional)
- [ ] File drag-and-drop supported
- [ ] Each document row has: Download button, Verify button (for `asset_manager`+), Delete button (soft-delete, with confirmation)
- [ ] Required documents (from completeness rules, Phase 4) shown with a red "Required — Missing" placeholder if not yet uploaded
- [ ] Documents can also be attached to events; event log items show a paperclip icon if they have attached documents
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-029: Event log UI on asset detail page
**Description:** As any authorized user, I want to view the full event log for an asset and create new manual events.

**Acceptance Criteria:**
- [ ] Asset detail page includes an "Events" tab
- [ ] Tab renders a chronological list of events, newest first; each item shows: event type, category badge (business/operational/governance), occurred_at, recorded by, responsible body, description, and document count
- [ ] Governance events auto-generated by the system shown with a robot icon
- [ ] Events with `warnings_overridden: true` in metadata shown with a yellow alert badge and the justification text
- [ ] "Add Event" button (for `department_user`+) opens a form: event_type (grouped select by category), occurred_at, description, attach document (optional), responsible_body
- [ ] Infinite scroll or "Load more" for long logs
- [ ] Filter events by category (business / operational / governance) and date range
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### PHASE 2 — OPERATIONAL DEPTH

---

### US-030: Contract schema and migration
**Description:** As a developer, I want a `contracts` table to represent lease contracts, supplier agreements, operator agreements, and allocation agreements attached to assets.

**Acceptance Criteria:**
- [ ] Table `contract_types` created with seed data: lease_contract, supplier_agreement, allocation_agreement, service_contract, operator_agreement, developer_commitment
- [ ] Table `contracts` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, not null)
  - `contract_type_id` (FK → contract_types, not null)
  - `contract_reference` (string, unique — human-readable contract number)
  - `counterparty_name` (string, not null — tenant, supplier, operator, or developer)
  - `counterparty_type` (enum: `tenant`, `supplier`, `operator`, `developer`, `authority`, `other`)
  - `responsible_body_id` (FK → responsible_bodies, nullable)
  - `start_date` (date, not null)
  - `end_date` (date, nullable)
  - `notice_period_days` (integer, nullable)
  - `renewal_option` (boolean, default false)
  - `auto_renewal` (boolean, default false)
  - `contract_value` (decimal, nullable)
  - `periodic_amount` (decimal, nullable)
  - `payment_frequency` (enum: `monthly`, `quarterly`, `annual`, `one_off`, nullable)
  - `sla_description` (text, nullable)
  - `status` (enum: `draft`, `active`, `expired`, `terminated`, `renewed`, default `draft`)
  - `notes` (text, nullable)
  - `created_at`, `updated_at`
- [ ] Index on `asset_id`, `status`, `end_date`, `counterparty_type`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-031: Work Order schema and migration
**Description:** As a developer, I want a `work_orders` table to represent maintenance and field execution instructions issued to contractors or internal teams.

**Acceptance Criteria:**
- [ ] Table `work_order_categories` created with seed data: pruning, repair, inspection, cleaning, irrigation_repair, safety_remediation, surface_renewal, structural_repair, general_maintenance, equipment_replacement
- [ ] Table `work_orders` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, not null)
  - `work_order_number` (string, unique, auto-generated)
  - `category_id` (FK → work_order_categories, not null)
  - `title` (string, not null)
  - `description` (text)
  - `priority` (enum: `critical`, `high`, `medium`, `low`, default `medium`)
  - `status` (enum: `open`, `assigned`, `in_progress`, `pending_approval`, `closed`, `cancelled`, default `open`)
  - `assigned_to_body_id` (FK → responsible_bodies, nullable — contractor or internal team)
  - `assigned_to_user_id` (FK → users, nullable)
  - `reported_by_user_id` (FK → users, nullable)
  - `lifecycle_stage_id` (FK → lifecycle_stages, nullable)
  - `target_completion_date` (date, nullable)
  - `actual_completion_date` (date, nullable)
  - `estimated_cost` (decimal, nullable)
  - `actual_cost` (decimal, nullable)
  - `sla_breach_at` (timestamp, nullable — auto-computed from priority + SLA config)
  - `notes` (text)
  - `created_at`, `updated_at`
- [ ] Index on `asset_id`, `status`, `priority`, `assigned_to_body_id`, `target_completion_date`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-032: Condition Record schema and migration
**Description:** As a developer, I want a `condition_records` table to represent the assessed physical condition of an asset or asset component at a point in time.

**Acceptance Criteria:**
- [ ] Table `condition_records` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, not null)
  - `inspected_by_user_id` (FK → users, nullable)
  - `inspected_by_body_id` (FK → responsible_bodies, nullable)
  - `inspection_date` (date, not null)
  - `condition_score` (integer 1–5, not null — 1=critical, 5=excellent)
  - `structural_condition` (enum: `good`, `fair`, `poor`, `critical`, nullable)
  - `safety_condition` (enum: `safe`, `minor_hazard`, `major_hazard`, `unsafe`, nullable)
  - `maintenance_priority` (enum: `none`, `low`, `medium`, `high`, `urgent`, default `none`)
  - `replacement_urgency` (enum: `none`, `within_5_years`, `within_2_years`, `within_1_year`, `immediate`, default `none`)
  - `notes` (text)
  - `next_inspection_due` (date, nullable)
  - `created_at`, `updated_at`
- [ ] Index on `asset_id`, `inspection_date`, `condition_score`, `safety_condition`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-033: Handover Record schema and migration
**Description:** As a developer, I want a `handover_records` table to represent the formal transfer of an asset from a planning/construction body to an operational body.

**Acceptance Criteria:**
- [ ] Table `handover_records` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, not null)
  - `delivered_by_body_id` (FK → responsible_bodies, not null)
  - `received_by_body_id` (FK → responsible_bodies, not null)
  - `delivered_by_user_id` (FK → users, nullable)
  - `received_by_user_id` (FK → users, nullable)
  - `handover_date` (date, not null)
  - `handover_status` (enum: `pending`, `accepted`, `accepted_with_conditions`, `rejected`, default `pending`)
  - `defects_list` (JSONB array of objects with: description, severity, resolved boolean)
  - `missing_documents` (JSONB array of document type names)
  - `accepted_with_conditions_flag` (boolean, default false)
  - `conditions_description` (text, nullable)
  - `warranty_expiry_date` (date, nullable)
  - `notes` (text)
  - `created_at`, `updated_at`
- [ ] An asset can have multiple handover records over its life (e.g., from developer to municipality, then from planning body to operational body)
- [ ] Index on `asset_id`, `handover_date`, `handover_status`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-034: GIS Location schema and migration
**Description:** As a developer, I want a `gis_locations` table to store geographic coordinates and spatial metadata for assets, enabling map-based queries.

**Acceptance Criteria:**
- [ ] Table `gis_locations` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, unique — one primary location per asset; secondary can use metadata)
  - `latitude` (decimal, precision 10, scale 8, nullable)
  - `longitude` (decimal, precision 11, scale 8, nullable)
  - `geometry_type` (enum: `point`, `polygon`, `line`, default `point`)
  - `geojson` (JSONB, nullable — full GeoJSON for polygon/line assets like gardens and roads)
  - `address_formatted` (string, nullable)
  - `neighborhood` (string, nullable)
  - `district` (string, nullable)
  - `parcel_number` (string, nullable — cadastral reference)
  - `map_layer_reference` (string, nullable — external GIS system ID)
  - `created_at`, `updated_at`
- [ ] Foreign key from `assets.location_id` to `gis_locations.id` now resolves
- [ ] Index on `latitude`, `longitude`, `district`, `neighborhood`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-035: Asset hierarchy support and API
**Description:** As a developer and user, I want to query and manage asset hierarchy — parent-child relationships — so that buildings, floors, gardens, and their components can be modeled correctly.

**Acceptance Criteria:**
- [ ] `assets.parent_asset_id` FK (added in US-005) is now fully utilized
- [ ] `GET /api/assets/:id/children` returns direct children only
- [ ] `GET /api/assets/:id/descendants` returns all descendants recursively (via recursive CTE), up to 5 levels deep
- [ ] `GET /api/assets/:id/ancestry` returns full ancestor chain from root to current
- [ ] `POST /api/assets/:id/set-parent` accepts `{ parent_asset_id }` and sets or changes parent; validates that setting parent does not create a circular reference
- [ ] Asset list view (`GET /api/assets`) supports `?root_only=true` to return only top-level assets
- [ ] `GET /api/assets/tree` returns a nested tree structure for a given root asset or family
- [ ] Typecheck passes

---

### US-036: Contract CRUD API
**Description:** As an asset manager, I want API endpoints for managing contracts attached to assets.

**Acceptance Criteria:**
- [ ] `GET /api/contracts` returns contracts; supports filters: `asset_id`, `contract_type_id`, `status`, `counterparty_type`, `expiring_within_days` (filters by `end_date <= now + N days`)
- [ ] `GET /api/contracts/:id` returns full contract detail
- [ ] `GET /api/assets/:id/contracts` returns all contracts for an asset
- [ ] `POST /api/contracts` creates a contract; requires `asset_id`, `contract_type_id`, `counterparty_name`, `start_date`
- [ ] `PUT /api/contracts/:id` updates all mutable fields
- [ ] `POST /api/contracts/:id/renew` creates a renewal: sets current contract `status = renewed`, creates a new contract record linked to the same asset with a new `contract_reference` and updated dates; a `contract_renewed` event is auto-created on the asset
- [ ] `PUT /api/contracts/:id/status` transitions status with valid values; `terminated` status requires a `termination_reason` in payload
- [ ] Typecheck passes

---

### US-037: Work Order CRUD API
**Description:** As an operations manager or contractor, I want API endpoints for managing work orders.

**Acceptance Criteria:**
- [ ] `GET /api/work-orders` returns work orders; supports filters: `asset_id`, `status`, `priority`, `assigned_to_body_id`, `assigned_to_user_id`, `category_id`, `overdue` (boolean — `target_completion_date < now AND status NOT IN (closed, cancelled)`)
- [ ] `GET /api/work-orders/:id` returns full work order detail
- [ ] `GET /api/assets/:id/work-orders` returns all work orders for an asset
- [ ] `POST /api/work-orders` creates a work order; `work_order_number` auto-generated; a `work_order_created` event is auto-created on the asset
- [ ] `PUT /api/work-orders/:id` updates mutable fields
- [ ] `PUT /api/work-orders/:id/assign` assigns to a body or user; status transitions to `assigned`; notification event created
- [ ] `PUT /api/work-orders/:id/close` closes work order; requires `actual_completion_date`; accepts `actual_cost`; auto-creates `work_order_closed` event
- [ ] Contractors with `contractor` role can only GET and update status/notes/photos on work orders assigned to them
- [ ] Typecheck passes

---

### US-038: Condition Record API
**Description:** As an operations manager or inspector, I want API endpoints for recording and retrieving condition assessments.

**Acceptance Criteria:**
- [ ] `GET /api/condition-records` returns records; supports filters: `asset_id`, `condition_score` (range), `safety_condition`, `maintenance_priority`, `replacement_urgency`, `inspection_date_from`, `inspection_date_to`
- [ ] `GET /api/assets/:id/condition-records` returns condition history for an asset ordered by `inspection_date` descending; first record is the current condition
- [ ] `GET /api/assets/:id/current-condition` returns the most recent condition record only
- [ ] `POST /api/condition-records` creates a new condition record; an `inspection_completed` event is auto-created on the asset; if `condition_score <= 2`, an `asset_at_risk_flagged` governance event is also auto-created
- [ ] Condition records are immutable once created (no PUT, no DELETE)
- [ ] Typecheck passes

---

### US-039: Handover Record API
**Description:** As a planner or asset manager, I want API endpoints for managing handover records that formally transfer an asset between bodies.

**Acceptance Criteria:**
- [ ] `GET /api/handover-records` returns records; supports filters: `asset_id`, `handover_status`, `delivered_by_body_id`, `received_by_body_id`
- [ ] `GET /api/assets/:id/handover-records` returns all handover records for an asset
- [ ] `POST /api/handover-records` creates a handover record with `status = pending`; an `asset_delivered` event is auto-created on the asset
- [ ] `PUT /api/handover-records/:id/accept` sets status to `accepted` or `accepted_with_conditions`; if conditions, requires `conditions_description`; auto-creates `asset_received` event on asset; updates `asset.handover_date` to the handover record's `handover_date`
- [ ] `PUT /api/handover-records/:id/reject` sets status to `rejected`; requires rejection reason in payload; auto-creates event
- [ ] If `missing_documents` list is non-empty at time of acceptance, a `missing_document_detected` governance event is auto-created
- [ ] Typecheck passes

---

### US-040: GIS Location API
**Description:** As an operations manager, I want API endpoints to manage GIS locations for assets.

**Acceptance Criteria:**
- [ ] `GET /api/gis-locations` returns locations; supports filters: `district`, `neighborhood`, `has_coordinates` (boolean)
- [ ] `GET /api/gis-locations/near` accepts `lat`, `lng`, `radius_meters`; returns assets within the radius ordered by distance
- [ ] `POST /api/gis-locations` creates a location record and links it to an asset via `asset_id`; asset's `location_id` is updated
- [ ] `PUT /api/gis-locations/:id` updates coordinates and metadata
- [ ] `GET /api/gis-locations/geojson` returns a GeoJSON FeatureCollection of all assets with coordinates; supports `family_id`, `status`, `lifecycle_stage_id` filters for selective export
- [ ] Typecheck passes

---

### US-041: Contract management UI on asset detail page
**Description:** As an asset manager, I want to view and manage contracts for an asset from the asset detail page.

**Acceptance Criteria:**
- [ ] Asset detail page includes a "Contracts" tab
- [ ] Tab renders a list of contracts with: contract reference, type, counterparty name, status badge, start date, end date, contract value
- [ ] Contracts expiring within 90 days highlighted with amber warning badge
- [ ] Expired contracts highlighted with red badge
- [ ] "Add Contract" button opens a form modal with all required fields
- [ ] Each contract row has Edit, Renew, and View Documents actions
- [ ] Renew action opens pre-filled form for new contract dates
- [ ] Contract history (renewed contracts) shown in a collapsible sub-row
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-042: Work Order management UI
**Description:** As an operations manager, I want a dedicated work orders page and a per-asset work orders tab.

**Acceptance Criteria:**
- [ ] Route `/work-orders` renders a full work order list with filters: status, priority, category, assigned body, overdue toggle
- [ ] Asset detail page includes a "Work Orders" tab showing asset-specific work orders
- [ ] Each work order shows: number, title, category, priority badge (color-coded), status badge, assigned body, target date, overdue indicator
- [ ] "Create Work Order" button on both views opens a form (asset pre-filled on asset detail tab)
- [ ] Work order detail modal shows full info, action log, and attached documents
- [ ] Status pipeline displayed as horizontal status chips: Open → Assigned → In Progress → Pending Approval → Closed
- [ ] Contractors see only their assigned work orders
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-043: Condition Record UI on asset detail page
**Description:** As an operations manager, I want to view condition history and record new inspections for an asset.

**Acceptance Criteria:**
- [ ] Asset detail page includes a "Condition" tab
- [ ] Current condition shown as a prominently styled score card with color coding: 5=green, 4=light green, 3=amber, 2=orange, 1=red
- [ ] Condition card shows: score, structural condition, safety condition, maintenance priority, replacement urgency, inspection date, next inspection due date
- [ ] "Record Inspection" button opens form with all condition fields
- [ ] Condition history shown as a timeline below the current condition card
- [ ] If safety_condition is `unsafe` or `major_hazard`, a red banner shown at the top of the asset detail page with text: "Safety Issue — Immediate attention required"
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-044: Handover Record UI on asset detail page
**Description:** As a planner or asset manager, I want to manage handover records directly from the asset detail page.

**Acceptance Criteria:**
- [ ] Asset detail page includes a "Handover" tab
- [ ] Tab shows all handover records in chronological order with: delivered_by, received_by, handover_date, status badge
- [ ] Pending handovers highlighted with pulsing indicator
- [ ] Handover detail expands to show defects list, missing documents, and conditions
- [ ] "Record Handover" button (for `planner` and `asset_manager`) opens a form with all required fields; defects list is a dynamic list editor
- [ ] Accept and Reject action buttons on pending handovers (for `asset_manager` and `admin`)
- [ ] Missing documents listed with red warning icons; if accepted with conditions, conditions text shown in amber
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-045: GIS Map view
**Description:** As any authorized user, I want a map view of all assets so I can find and filter assets geographically.

**Acceptance Criteria:**
- [ ] Route `/map` renders a full-page map (using Leaflet or Mapbox — use Leaflet as default open-source option)
- [ ] Map loads asset point markers from `GET /api/gis-locations/geojson`
- [ ] Marker color corresponds to asset family (configurable color scheme)
- [ ] Clicking a marker opens a popup with: asset name, type, status badge, lifecycle stage, and a link to the asset detail page
- [ ] Side panel with family, type, status, and lifecycle stage filters; map updates in real-time as filters change
- [ ] Polygon and line geometry (for gardens, roads) rendered as GeoJSON shapes
- [ ] Assets without coordinates shown in a "Unmapped Assets" side list
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### PHASE 3 — PLANNING AND MUNICIPAL COMPLEXITY

---

### US-046: Planning Entity schema and migration
**Description:** As a developer, I want a `planning_entities` table to represent assets that exist only in the planning stage, before they become physical or registered operational assets.

**Acceptance Criteria:**
- [ ] Table `planning_entities` created with columns:
  - `id` (UUID PK)
  - `name` (string, not null)
  - `planning_code` (string, unique, auto-generated)
  - `asset_family_id` (FK → asset_families, not null)
  - `asset_type_id` (FK → asset_types, not null)
  - `planning_body_id` (FK → responsible_bodies, nullable — body managing this planning entity)
  - `intended_receiving_body_id` (FK → responsible_bodies, nullable — who will operate after delivery)
  - `intended_receiving_body_is_placeholder` (boolean, default false)
  - `population_forecast_notes` (text, nullable)
  - `service_area_description` (text, nullable)
  - `planned_area_sqm` (decimal, nullable)
  - `target_delivery_date` (date, nullable)
  - `current_planning_milestone` (string, nullable)
  - `status` (enum: `identified`, `in_planning`, `approved`, `in_implementation`, `delivered`, `converted_to_asset`, default `identified`)
  - `linked_asset_id` (FK → assets, nullable — populated when planning entity converts to a real asset)
  - `developer_obligation_id` (FK → developer_obligations, nullable)
  - `funding_source_notes` (text, nullable)
  - `notes` (text, nullable)
  - `created_at`, `updated_at`
- [ ] Index on `asset_family_id`, `status`, `planning_body_id`, `target_delivery_date`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-047: Developer Obligation schema and migration
**Description:** As a developer (software), I want a `developer_obligations` table to represent a developer's commitment to deliver or fund a future public asset.

**Acceptance Criteria:**
- [ ] Table `developer_obligations` created with columns:
  - `id` (UUID PK)
  - `obligation_reference` (string, unique, not null — human-readable reference)
  - `related_project_name` (string, not null — name of the development project)
  - `developer_name` (string, not null)
  - `promised_asset_type_id` (FK → asset_types, not null)
  - `promised_asset_family_id` (FK → asset_families, not null)
  - `committed_area_sqm` (decimal, nullable)
  - `committed_delivery_date` (date, nullable)
  - `actual_delivery_date` (date, nullable)
  - `funding_model` (enum: `developer_builds`, `developer_funds_municipality_builds`, `combined`, `land_only`, nullable)
  - `committed_funding_amount` (decimal, nullable)
  - `status` (enum: `open`, `in_progress`, `delivered`, `partially_delivered`, `in_dispute`, `closed_gap_identified`, default `open`)
  - `gaps_identified` (text, nullable — description of gap between what was promised and what was delivered)
  - `receiving_body_id` (FK → responsible_bodies, nullable — body that will receive the asset)
  - `receiving_body_is_placeholder` (boolean, default false)
  - `planning_entity_id` (FK → planning_entities, nullable)
  - `delivery_milestones` (JSONB array of objects: { milestone_name, target_date, actual_date, status })
  - `notes` (text)
  - `created_at`, `updated_at`
- [ ] Index on `status`, `developer_name`, `committed_delivery_date`, `promised_asset_family_id`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-048: Allocation schema and migration
**Description:** As a developer, I want an `allocations` table to represent formal allocation of a municipal asset or space to a body, tenant, or operator.

**Acceptance Criteria:**
- [ ] Table `allocations` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, not null)
  - `allocated_to_body_id` (FK → responsible_bodies, nullable — internal body)
  - `allocated_to_name` (string, nullable — external party name)
  - `allocation_type` (enum: `internal_use`, `operator`, `tenant`, `partner`, `temporary_use`)
  - `start_date` (date, not null)
  - `end_date` (date, nullable)
  - `area_sqm` (decimal, nullable — portion of asset allocated)
  - `usage_description` (text)
  - `is_revenue_generating` (boolean, default false)
  - `periodic_fee` (decimal, nullable)
  - `fee_frequency` (enum: `monthly`, `quarterly`, `annual`, nullable)
  - `status` (enum: `active`, `pending`, `expired`, `terminated`, default `pending`)
  - `notes` (text)
  - `created_at`, `updated_at`
- [ ] Index on `asset_id`, `status`, `end_date`, `is_revenue_generating`
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-049: Body Transfer schema and migration
**Description:** As a developer, I want a `body_transfers` table to record the formal transfer of asset responsibility from one organizational body to another.

**Acceptance Criteria:**
- [ ] Table `body_transfers` created with columns:
  - `id` (UUID PK)
  - `asset_id` (FK → assets, not null)
  - `transfer_type` (enum: `strategic_owner`, `responsible_body`, `operational_body`, `maintenance_body`, `data_steward`)
  - `from_body_id` (FK → responsible_bodies, not null)
  - `to_body_id` (FK → responsible_bodies, not null)
  - `transfer_date` (date, not null)
  - `reason` (text, not null)
  - `authorized_by_user_id` (FK → users, nullable)
  - `notes` (text)
  - `created_at`
- [ ] Body transfers are immutable (no update or delete)
- [ ] Migration runs cleanly
- [ ] Typecheck passes

---

### US-050: Planning Entity API
**Description:** As a planner, I want API endpoints to manage planning entities and convert them to active assets.

**Acceptance Criteria:**
- [ ] `GET /api/planning-entities` returns entities; supports filters: `family_id`, `type_id`, `status`, `planning_body_id`, `developer_obligation_id`, `overdue` (boolean — `target_delivery_date < now AND status NOT IN (delivered, converted_to_asset)`)
- [ ] `GET /api/planning-entities/:id` returns full detail
- [ ] `POST /api/planning-entities` creates a new entity
- [ ] `PUT /api/planning-entities/:id` updates mutable fields
- [ ] `POST /api/planning-entities/:id/convert-to-asset` converts a planning entity to a real asset:
  - Creates a new record in `assets` pre-populated with family, type, bodies from the planning entity
  - Sets `planning_entity.status = converted_to_asset` and `planning_entity.linked_asset_id`
  - Sets `asset.planning_entity_id` to the planning entity
  - Sets asset lifecycle stage to "Establishment / Implementation / Intake"
  - Creates a `plan_reviewed` event on the new asset
  - Returns the new asset ID
- [ ] Placeholder receiving body flag shown in API response if `intended_receiving_body_is_placeholder = true`
- [ ] Typecheck passes

---

### US-051: Developer Obligation API
**Description:** As a planner, I want API endpoints for managing developer obligations and tracking their delivery milestones.

**Acceptance Criteria:**
- [ ] `GET /api/developer-obligations` returns obligations; supports filters: `status`, `developer_name`, `promised_asset_family_id`, `overdue` (boolean), `receiving_body_is_placeholder`
- [ ] `GET /api/developer-obligations/:id` returns full detail including linked planning entity and milestones
- [ ] `POST /api/developer-obligations` creates obligation
- [ ] `PUT /api/developer-obligations/:id` updates all mutable fields including milestones array
- [ ] `PUT /api/developer-obligations/:id/milestone/:index` updates a specific milestone's actual_date and status within the milestones JSONB array
- [ ] If `actual_delivery_date` is set and differs from `committed_delivery_date` by more than 30 days, a `overdue_milestone_flagged` governance event is auto-created on the linked asset if one exists
- [ ] If `gaps_identified` is populated, a governance event `asset_at_risk_flagged` is auto-created
- [ ] Typecheck passes

---

### US-052: Allocation API
**Description:** As an asset manager, I want API endpoints for managing asset allocations.

**Acceptance Criteria:**
- [ ] `GET /api/allocations` returns allocations; supports filters: `asset_id`, `status`, `allocation_type`, `is_revenue_generating`, `expiring_within_days`
- [ ] `GET /api/assets/:id/allocations` returns all allocations for an asset
- [ ] `POST /api/allocations` creates an allocation; auto-creates an `asset_transferred` event on the asset
- [ ] `PUT /api/allocations/:id` updates mutable fields
- [ ] `PUT /api/allocations/:id/terminate` terminates an allocation; requires reason; sets `status = terminated`; auto-creates event
- [ ] Revenue-generating allocations expose `periodic_fee` and `fee_frequency` for use by the revenue model in Phase 4
- [ ] Typecheck passes

---

### US-053: Body Transfer API
**Description:** As an asset manager, I want API endpoints to transfer responsibility for an asset from one body to another, with full auditability.

**Acceptance Criteria:**
- [ ] `GET /api/body-transfers` returns transfers; supports filters: `asset_id`, `transfer_type`, `from_body_id`, `to_body_id`
- [ ] `GET /api/assets/:id/body-transfers` returns full transfer history for an asset
- [ ] `POST /api/body-transfers` creates a transfer record and updates the corresponding role field on the `assets` table atomically:
  - `transfer_type = responsible_body` → updates `assets.responsible_body_id`
  - `transfer_type = operational_body` → updates `assets.operational_body_id`
  - etc.
  - An `asset_reassigned` event is auto-created on the asset with metadata indicating from/to bodies
- [ ] Body transfers are immutable: no PUT, no DELETE
- [ ] If `to_body_id` is a placeholder body, a warning is returned in the response: `{ warning: "Target body is a placeholder — organizational ownership not yet resolved" }` — but transfer proceeds
- [ ] Typecheck passes

---

### US-054: Operator Model API
**Description:** As an asset manager or administrator, I want to assign an operator to an asset and manage operator agreements.

**Acceptance Criteria:**
- [ ] An operator is a combination of an `allocation` record (type `operator`) plus an optional linked `contract` (type `operator_agreement`)
- [ ] `POST /api/assets/:id/assign-operator` is a convenience endpoint that: creates an allocation of type `operator`, optionally creates a linked contract, and updates `assets.operational_body_id` if the operator is a known body; auto-creates `operator_changed` event
- [ ] `PUT /api/assets/:id/change-operator` terminates the existing operator allocation and calls assign-operator logic for the new one
- [ ] `GET /api/assets/:id/current-operator` returns the active operator allocation and linked contract if any
- [ ] Typecheck passes

---

### US-055: Revenue and Collection model API
**Description:** As an asset manager, I want to track revenue expected and received from revenue-generating assets (lease income, booking fees, service charges).

**Acceptance Criteria:**
- [ ] Table `revenue_records` created with columns: `id`, `asset_id`, `allocation_id` (nullable), `contract_id` (nullable), `revenue_type` (enum: `lease_income`, `booking_fee`, `service_charge`, `operator_fee`, `other`), `period_start` (date), `period_end` (date), `expected_amount` (decimal), `actual_amount` (decimal), `payment_date` (date, nullable), `status` (enum: `expected`, `received`, `partial`, `overdue`, `waived`), `notes` (text), `created_at`, `updated_at`
- [ ] `GET /api/revenue-records` returns records; supports filters: `asset_id`, `status`, `revenue_type`, `period_start_from`, `period_end_to`
- [ ] `POST /api/revenue-records` creates a record; if `expected_amount > 0` and no `actual_amount`, status defaults to `expected`
- [ ] `PUT /api/revenue-records/:id/mark-received` sets actual_amount and payment_date; updates status to `received` or `partial`
- [ ] `GET /api/assets/:id/revenue-summary` returns totals: total expected YTD, total received YTD, total overdue
- [ ] Typecheck passes

---

### US-056: Planning Entity management UI
**Description:** As a planner, I want a dedicated page to manage planning entities and track their progress toward becoming operational assets.

**Acceptance Criteria:**
- [ ] Route `/planning` renders a list of planning entities with columns: planning_code, name, family, type, status badge, target delivery date, overdue indicator, linked developer obligation flag, placeholder receiving body warning
- [ ] Filter panel: family, type, status, planning body, overdue toggle, placeholder body toggle
- [ ] "Add Planning Entity" button opens creation form
- [ ] Each row links to a planning entity detail page
- [ ] Planning entity detail page shows: all fields, linked developer obligation (if any), documents tab, events tab, milestone progress bar
- [ ] "Convert to Asset" button on detail page (for `planner` and `admin`); opens a confirmation modal showing what will be created; on confirm, redirects to new asset detail page
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-057: Developer Obligation tracking UI
**Description:** As a planner, I want a dedicated page to track all developer obligations and their delivery milestones.

**Acceptance Criteria:**
- [ ] Route `/developer-obligations` renders a list with columns: obligation reference, developer name, promised asset type, committed delivery date, actual delivery date, status badge, gap indicator
- [ ] Filter panel: status, developer name, family, overdue toggle, placeholder receiving body toggle
- [ ] Obligation detail page shows: all fields, milestones displayed as a timeline with target vs actual dates, documents tab, events tab, linked planning entity (if any)
- [ ] Milestones with missed target dates shown in red; completed milestones in green
- [ ] "Flag Gap" button opens a text input to record gaps_identified — auto-creates governance event
- [ ] Placeholder receiving body shown with open-decision warning banner
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-058: Asset transfer and body assignment UI
**Description:** As an asset manager, I want a UI workflow to transfer responsibility for an asset from one body to another, with full confirmation.

**Acceptance Criteria:**
- [ ] Asset detail page "Responsibilities" section has an "Edit Assignments" action (for `asset_manager`+)
- [ ] Opening this shows all 5 body role fields as editable typeahead dropdowns
- [ ] Changing any field shows a confirmation dialog: "You are transferring [role] from [current body] to [new body]. This will be recorded permanently. Add a reason:" with a required reason text field
- [ ] On confirm, `POST /api/body-transfers` is called; asset detail page updates immediately
- [ ] Body transfer history shown in a collapsible section below the responsibility cards
- [ ] Placeholder body assignments shown with warning icon; selecting a placeholder body shows: "This body is a placeholder — organizational ownership decision pending"
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-059: Revenue and collection UI on asset detail page
**Description:** As an asset manager, I want to view and manage revenue records for revenue-generating assets.

**Acceptance Criteria:**
- [ ] Asset detail page includes a "Revenue" tab, visible only for assets with `is_revenue_generating` allocations or `lease_income` / `service_charges` budget envelopes
- [ ] Tab shows: revenue summary card (expected YTD, received YTD, overdue YTD in red), and a table of revenue records grouped by period
- [ ] "Add Revenue Record" button opens form: revenue_type, period_start, period_end, expected_amount, allocation/contract linkage
- [ ] Each record has a "Mark Received" action that opens a small form for actual_amount and payment_date
- [ ] Overdue records (expected but unpaid past period_end) highlighted in red
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### PHASE 4 — ADVANCED CONTROL

---

### US-060: Document completeness rules engine
**Description:** As a developer, I want a configurable rules engine that defines which document types are required per asset family, asset type, and lifecycle stage, so that missing documents can be detected automatically.

**Acceptance Criteria:**
- [ ] Table `document_completeness_rules` created with columns: `id`, `asset_family_id` (FK, nullable — null means all families), `asset_type_id` (FK, nullable), `lifecycle_stage_id` (FK, not null), `document_type_id` (FK, not null), `is_mandatory` (boolean, default true), `is_active` (boolean, default true)
- [ ] Seed data inserted for all critical rules derived from the domain specification, including:
  - Planning and Approval stage → plan, permit, allocation document (all families)
  - Establishment stage → specification, execution report, delivery documents, as-made documents
  - Activation and Operation stage → occupancy protocol, activation approval
  - Maintenance stage → inspection form
  - Disposal stage → closure approval, decommissioning protocol
  - Handover stage → delivery document (for Planning Administration assets)
- [ ] `GET /api/document-completeness-rules` returns rules; supports filters by family, type, stage
- [ ] `POST/PUT /api/document-completeness-rules` CRUD for admin management
- [ ] `GET /api/assets/:id/document-completeness` returns: for each applicable rule for this asset's current stage, whether the required document type is present — returns a list of `{ rule, required_document_type, is_satisfied, missing }` objects plus an overall `completeness_score` (percentage of satisfied rules)
- [ ] Typecheck passes

---

### US-061: Budget variance detection and governance events
**Description:** As a developer, I want automatic detection of budget variance so that assets with significant cost overruns trigger governance events.

**Acceptance Criteria:**
- [ ] A background job (or triggered function) runs on every `budget_envelopes` update
- [ ] If `actual_amount > approved_amount` by more than a configurable threshold (default 10%), a `budget_variance_detected` governance event is auto-created on the asset with metadata: `{ budget_type, approved_amount, actual_amount, variance_amount, variance_percent }`
- [ ] The event is created only once per envelope per variance crossing (not on every subsequent update) — tracked by a `variance_event_created` boolean on the envelope
- [ ] `GET /api/assets/:id/budget-variance-summary` returns all envelopes where `variance_amount < 0` with percentage breakdowns
- [ ] `GET /api/reports/budget-variance` returns all assets with at least one variance event in the current fiscal year; supports filters by family, body, fiscal_year, budget_type
- [ ] Typecheck passes

---

### US-062: Lifecycle transition rules validation service
**Description:** As a developer, I want a reusable validation service that checks whether an asset meets all conditions for a lifecycle transition, powering both the API soft enforcement and the UI warning system.

**Acceptance Criteria:**
- [ ] A `TransitionValidationService` (or equivalent module) is created and exported
- [ ] It accepts `(asset_id, from_stage_id, to_stage_id)` and returns: `{ is_valid_path: boolean, unmet_conditions: Array<{ type: 'document' | 'event', description: string, is_blocking: false }> }`
- [ ] Soft enforcement: `is_blocking` is always `false` — no condition ever blocks the transition, only warns
- [ ] Service checks `lifecycle_transitions` table for `required_document_types` and `required_events`
- [ ] For each required document type, checks `documents` table for existence attached to this asset
- [ ] For each required event type, checks `events` table for at least one such event on this asset
- [ ] Service is called by `POST /api/assets/:id/transition` (US-014) and by the `GET /api/assets/:id/transition-readiness/:to_stage_id` endpoint
- [ ] `GET /api/assets/:id/transition-readiness/:to_stage_id` is a new read-only endpoint that returns the validation result without performing any transition — used by the UI to show warnings before the user confirms
- [ ] Typecheck passes

---

### US-063: Risk scoring engine
**Description:** As a developer, I want an automated risk score computed for each asset based on condition records, overdue work orders, missing documents, budget variance, and open governance events.

**Acceptance Criteria:**
- [ ] A `RiskScoringService` is created that computes a risk score (0–100) for an asset:
  - Condition score component: `condition_score <= 2` → +30 points; `condition_score == 3` → +15 points
  - Safety condition: `unsafe` → +30; `major_hazard` → +20; `minor_hazard` → +10
  - Overdue work orders: +5 per overdue critical work order; +3 per overdue high; +1 per overdue medium
  - Missing required documents: +5 per missing mandatory document for current stage
  - Budget variance: variance > 20% → +10; 10–20% → +5
  - Open governance events in last 90 days: `asset_at_risk_flagged` → +15; `overdue_milestone_flagged` → +10; `missing_document_detected` → +5; `budget_variance_detected` → +5
  - Risk band: 0–20 = Low, 21–50 = Medium, 51–80 = High, 81–100 = Critical
- [ ] Table `asset_risk_scores` created: `id`, `asset_id` (unique), `risk_score` (integer), `risk_band` (enum), `score_components` (JSONB), `computed_at` (timestamp)
- [ ] Risk scores recomputed on: new condition record, work order status change, document upload, budget update, governance event creation
- [ ] `GET /api/assets/:id/risk-score` returns current risk score and component breakdown
- [ ] Typecheck passes

---

### US-064: Maintenance backlog logic
**Description:** As a developer, I want a maintenance backlog computed per responsible body and per asset family so that operations managers can see their workload and priorities.

**Acceptance Criteria:**
- [ ] `GET /api/reports/maintenance-backlog` returns aggregated data: total open work orders grouped by `priority`, `status`, `category`, `assigned_to_body_id`, and `asset_family_id`
- [ ] `GET /api/reports/maintenance-backlog/by-body/:body_id` returns backlog for a specific body
- [ ] `GET /api/reports/maintenance-backlog/by-asset/:asset_id` returns backlog for a specific asset
- [ ] Backlog items marked overdue (target_completion_date < today and not closed) are counted separately
- [ ] Backlog includes `estimated_cost` and `actual_cost` totals per group
- [ ] `GET /api/reports/overdue-work-orders` returns all overdue open work orders sorted by priority then overdue days descending; supports filter by body and family
- [ ] Typecheck passes

---

### US-065: Exception management service and API
**Description:** As a developer, I want an exception detection service that proactively identifies assets requiring attention and surfaces them to the relevant bodies.

**Acceptance Criteria:**
- [ ] `GET /api/exceptions` returns a prioritized list of asset exceptions; each exception includes: `asset_id`, `asset_name`, `exception_type` (enum below), `severity` (critical / high / medium), `description`, `detected_at`
- [ ] Exception types detected automatically:
  - `contract_expiring_soon`: contract end_date within 60 days
  - `contract_expired`: contract end_date in the past and status = active
  - `missing_mandatory_document`: at least one mandatory document for current stage is missing
  - `safety_hazard`: condition record with safety_condition in `unsafe` or `major_hazard`
  - `critical_condition`: condition_score = 1
  - `overdue_work_order`: critical or high priority work order past target date
  - `budget_overrun`: budget envelope with negative variance > 10%
  - `overdue_developer_obligation`: developer obligation past committed_delivery_date
  - `placeholder_body_assigned`: asset assigned to a placeholder body
  - `no_condition_record_in_1_year`: no condition record created in the last 12 months
  - `handover_pending_over_30_days`: handover record in pending status for more than 30 days
- [ ] Exceptions filtered by caller's responsible_body_id when role is `department_user` or `operations_manager`; admin and headquarters roles see all exceptions
- [ ] Supports filters: `exception_type`, `severity`, `asset_family_id`, `responsible_body_id`
- [ ] Typecheck passes

---

### US-066: Executive KPI dashboard — backend
**Description:** As a developer, I want backend API endpoints that power the executive-level dashboard with cross-portfolio KPIs.

**Acceptance Criteria:**
- [ ] `GET /api/dashboard/executive` returns:
  - `total_assets`: count by status and family
  - `assets_by_lifecycle_stage`: count per stage per family
  - `assets_at_risk`: count where risk_band in ('High', 'Critical')
  - `open_exceptions`: count by exception_type and severity
  - `developer_obligations_summary`: total, delivered, overdue, placeholder_receiving_body count
  - `planning_entities_summary`: total, converted, overdue
  - `budget_variance_summary`: count of assets with variance events this fiscal year, total variance amount
  - `maintenance_backlog_summary`: total open work orders, total overdue, estimated cost
  - `contracts_expiring_summary`: count expiring within 30, 60, 90 days
  - `placeholder_bodies_summary`: count of assets assigned to placeholder bodies, list of placeholder bodies with asset counts
- [ ] All values computable from the database in a single query pass (no N+1)
- [ ] Response cached for 5 minutes (configurable)
- [ ] Typecheck passes

---

### US-067: Department-level dashboard — backend
**Description:** As a developer, I want a department-specific dashboard API that scopes all KPIs to the requesting user's responsible body.

**Acceptance Criteria:**
- [ ] `GET /api/dashboard/department` accepts query param `?body_id=` (required for admin; auto-resolved from JWT for department_user and operations_manager roles)
- [ ] Returns same structure as executive dashboard but all counts filtered to assets where `responsible_body_id`, `operational_body_id`, or `maintenance_body_id` matches the body_id
- [ ] Additional department-specific fields:
  - `assets_needing_inspection`: assets where last condition record is older than 12 months
  - `work_orders_by_category`: count per category for this body
  - `my_contracts_expiring`: contracts where responsible_body_id matches, expiring within 90 days
  - `recent_events`: last 10 events on this body's assets
- [ ] Typecheck passes

---

### US-068: Executive KPI dashboard UI
**Description:** As a headquarters user or administrator, I want a visual dashboard showing the full municipal asset portfolio status at a glance.

**Acceptance Criteria:**
- [ ] Route `/dashboard` renders the executive dashboard (visible to `admin`, `asset_manager`, and `operations_manager` roles with full portfolio access)
- [ ] Summary stat cards: Total Assets (with breakdown link), Assets at Risk (red if > 0), Open Exceptions (amber), Active Developer Obligations, Planning Entities in Progress
- [ ] Chart: Assets by Lifecycle Stage (horizontal bar chart per family)
- [ ] Chart: Budget Variance Overview (stacked bar by budget_type showing approved vs actual across top 10 variance assets)
- [ ] Exceptions panel: top 10 exceptions sorted by severity with asset name, type, and link
- [ ] Placeholder Bodies panel: list of placeholder bodies with asset count and resolution_note
- [ ] Developer Obligations panel: overdue obligations with developer name, promised asset type, overdue days
- [ ] All panels link through to filtered list views
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-069: Department dashboard UI
**Description:** As a department user or operations manager, I want a dashboard scoped to my body's assets.

**Acceptance Criteria:**
- [ ] Route `/dashboard/department` renders department-scoped view (auto-scoped to user's body)
- [ ] Summary cards: My Assets, Overdue Work Orders (red if > 0), Assets Needing Inspection, Expiring Contracts
- [ ] Work Order pipeline: count per status shown as a horizontal funnel
- [ ] Condition overview: distribution of condition scores (1–5) for my assets as a mini bar chart
- [ ] Recent events feed: last 10 events on my assets
- [ ] Quick actions: Create Work Order, Record Inspection, Upload Document — all with asset typeahead pre-fill
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-070: Exception management UI
**Description:** As any authorized user, I want a dedicated exceptions page to review and act on all flagged issues.

**Acceptance Criteria:**
- [ ] Route `/exceptions` renders the exception list
- [ ] Exceptions grouped by severity: Critical (red), High (orange), Medium (amber)
- [ ] Each exception card shows: asset name, asset code, family badge, exception type label, description, detected date, a link to the relevant asset detail page
- [ ] Filter panel: severity, exception_type, family, responsible_body
- [ ] Dismiss button on each exception (for `asset_manager`+); dismissed exceptions moved to a "Resolved" tab; a dismissal event created on the asset
- [ ] Count badge on navigation menu item showing total active critical + high exceptions
- [ ] `contractor` role does not see this page
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-071: Risk registry view UI
**Description:** As an asset manager or administrator, I want a risk registry view listing all assets ordered by risk score.

**Acceptance Criteria:**
- [ ] Route `/risk-registry` renders a table of all assets with a computed risk score
- [ ] Columns: asset_code, asset_name, family, type, risk_band (color-coded badge), risk_score, top contributing factors (top 3 from score_components), last updated
- [ ] Default sort: risk_score descending (Critical first)
- [ ] Filter by family, responsible_body, risk_band, lifecycle_stage
- [ ] Clicking a row opens the asset detail page
- [ ] Export to CSV button (for `asset_manager`+) — exports current filtered view
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-072: Document completeness dashboard UI
**Description:** As an asset manager, I want a document completeness view showing which assets are missing required documents for their current lifecycle stage.

**Acceptance Criteria:**
- [ ] Route `/document-completeness` renders a table of assets with completeness scores
- [ ] Columns: asset_code, asset_name, family, lifecycle_stage, completeness_score (shown as progress bar), missing_count (red badge if > 0)
- [ ] Clicking a row expands to show: list of required document types for current stage, green check if present, red X if missing
- [ ] Filter by family, stage, responsible_body, `has_missing` toggle (show only assets with missing documents)
- [ ] "Go to asset" link on each row
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-073: Public-facing asset view
**Description:** As a public user, I want to view basic information about municipal assets so I can understand what public facilities exist in my area.

**Acceptance Criteria:**
- [ ] Route `/public/assets` renders a public-facing list of assets filtered to `current_status = active` and `ownership_model` not in sensitive categories
- [ ] Visible fields only: asset_name, asset_type, neighborhood (from GIS location), status, service_start_date
- [ ] No budget, document, contract, or body data exposed
- [ ] Public map view at `/public/map` using the same Leaflet component, with only active assets shown
- [ ] No authentication required for these routes
- [ ] API endpoints `/api/public/assets` and `/api/public/gis-locations/geojson` do not require JWT
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

## Non-Goals

The following items are explicitly out of scope for this system:

- **Financial accounting or ERP integration:** The system tracks budget envelopes and revenue records but does not replace a financial accounting system. No ledger, no journal entries, no GL codes.
- **HR or personnel management:** Responsible bodies are organizational units, not individual employee records. The system does not manage staffing, shifts, or payroll.
- **Procurement workflow:** Work orders may reference a supplier, but the full procurement process (tenders, bids, purchase orders) is managed in a separate procurement system.
- **Building management systems (BMS) integration:** The system does not integrate with IoT sensors, SCADA systems, or automated building monitoring equipment in Phase 1–4.
- **Full GIS platform:** The system embeds basic map visualization and stores coordinates; it is not a replacement for a dedicated GIS platform. Deep spatial analysis (routing, catchment modeling, topology) is out of scope.
- **Booking and scheduling engine:** The system records that a sports facility has a booking model, but the full real-time booking calendar, slot management, and public booking portal are not in scope.
- **Payment gateway:** Revenue records are tracked but no online payment processing is in scope.
- **Email or SMS notification system:** The system may generate governance events and exceptions, but outbound push notifications via email or SMS are not in scope.
- **Mobile native application:** The system is a responsive web application. A dedicated iOS or Android native app is not in scope.
- **Multi-municipality or SaaS model:** The system is designed for a single municipality. Multi-tenancy is not in scope.

---

## Technical Notes

### Stack
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui component library, Leaflet for maps
- **Backend:** Node.js with TypeScript, Express or Fastify, Prisma ORM
- **Database:** PostgreSQL
- **Authentication:** JWT (access token + refresh token), bcrypt for password hashing
- **File Storage:** Local disk in development; AWS S3 or compatible object storage in production (configurable via environment variable)
- **Testing:** Vitest for unit and integration tests; Playwright for E2E browser tests
- **API shape:** All REST responses use a consistent envelope: `{ data, error, meta: { page, per_page, total } }`

### Architecture principles
- All lifecycle transitions go through the `TransitionValidationService` — no direct stage updates on the asset record
- All governance events are created by the system automatically — they are never manually created by users
- All body transfers go through the `body_transfers` table — no direct body field updates on the asset record (except as a side effect of the transfer endpoint)
- Placeholder bodies must never silently absorb assets without a visible warning in both the API response and the UI
- Event log is immutable — no update or delete, ever
- Condition records are immutable — each inspection creates a new record
- Risk scores are computed asynchronously and stored in `asset_risk_scores`; they are never computed inline in a request

### Naming conventions
- UUID primary keys on all tables
- Snake_case column names
- Enum values in lowercase_with_underscores
- Auto-generated human-readable codes follow format: `[PREFIX]-[YEAR]-[5-digit-sequence]` (e.g., `PB-2026-00042` for public building)

### Open organizational decisions to flag in UI
These two gaps must be surfaced in the UI throughout the system and must not be silently resolved by the software:

1. **Educational Buildings Holding Body (TBD):** No organizational body has been formally defined to hold educational buildings after construction and delivery. All educational building assets should be assigned to the "Educational Buildings Holding Body (TBD)" placeholder until a real body is defined. Any asset assigned to this placeholder must display a prominent open-decision warning.

2. **Health/Community Developer Obligation Holding Body (TBD):** Assets such as Maternal and Child Health Centers and Health Fund Clinics born from developer obligations have no defined holding body (direct municipality holder, municipality-owner with external operator, or allocation-only model). All such assets should be assigned to the "Health/Community Developer Obligation Holding Body (TBD)" placeholder until the three-option decision (direct hold / owner+operator / allocate-and-deliver) is formally resolved.

---
