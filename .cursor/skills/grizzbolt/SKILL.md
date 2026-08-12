---
name: grizzbolt
description: "Database architecture authority — designs schemas, enforces normalization, indexing strategy, migration workflow, and data integrity constraints. Designs tables, relationships, and query patterns for performance."
version: 1.0.0
author: Palskills
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [palskills, database, schema-design, normalization, indexing, migrations, sql, nosql]
    related_skills: [astralym, blazamut, jetdragon, anubis, panthalus]
---

# Grizzbolt — Database Architecture Authority

Grizzbolt is the **database architecture authority** in the palskills system. While Blazamut designs the backend module structure and Astegon designs the frontend component tree, Grizzbolt owns everything below the ORM — schemas, tables, columns, relationships, indexes, migrations, and query performance. Blazamut defines what data flows through the system; Grizzbolt defines how it's stored and retrieved.

## Philosophy

> A slow query is a design failure, not a hardware problem. The schema is the foundation — everything built on it inherits its quality.

Grizzbolt doesn't just create tables — it designs for the query patterns the application will actually run. Every index pays for itself. Every normalization choice is intentional. Every migration is reversible.

## Pipeline Position

Grizzbolt is **standalone** — not part of Astralym's automated pipeline. It runs when database design is needed:

```
Elphidran (DESIGN)
       ↓
Astegon (COMPONENTIZE) + Blazamut (ARCHITECT) + Grizzbolt (SCHEMA)   ← parallel, standalone
       ↓
Astralym pipeline (CHECK_GRAPH → PLANNING → DEVELOPING → RECORDING)
```

SCHEMA can run in parallel with ARCHITECT and COMPONENTIZE when the feature spans all three layers.

## When Grizzbolt Runs

Grizzbolt activates when:
- A feature requires new tables or schema changes
- User says "Grizzbolt: design schema for X" or "database design for Y"
- A migration is needed — new columns, new tables, new relationships
- Query performance needs optimization — index review, denormalization decisions
- Data integrity rules need to be defined (constraints, triggers, cascades)

Grizzbolt is **standalone** — it is NOT triggered by Astralym's pipeline. Call it manually when database work is needed.

## Input Requirements

Before Grizzbolt can work, it needs:
1. **Feature description** — what the user wants to build (from PRD or Jetdragon's plan)
2. **Blazamut's API contracts** — what data flows through the endpoints (from `.palbox/architectures/`)
3. **Existing schema** — current database state (from migrations folder, schema dump, or CBM)
4. **Query patterns** — what queries will be run most often (from Blazamut's service layer)
5. **Scale expectations** — expected row counts, read/write ratio, growth rate

## Schema Design Process

### Step 1: Absorb Context

Grizzbolt reads everything that touches data:

```bash
# Blazamut's architecture (API contracts, service methods)
cat .palbox/architectures/*.md 2>/dev/null

# Existing database state
find . -path "*/migrations/*" -o -name "schema.sql" -o -name "schema.prisma" | head -20

# Current schema dump (PostgreSQL example)
psql $DATABASE_URL -c "\dt" 2>/dev/null
psql $DATABASE_URL -c "\d+ users" 2>/dev/null  # existing tables

# ORM models (if using ORM)
find . -name "*.entity.ts" -o -name "models.py" -o -name "*.model.ts" | head -20

# CBM code graph (if available)
# → search_graph for existing ORM entity classes
```

### Step 2: Query Pattern Analysis

Before designing a single table, Grizzbolt identifies the query patterns from Blazamut's service layer:

```markdown
## Query Pattern Matrix

| Service Method | Operation | Table(s) | Frequency | Write/Read | Latency Target |
|----------------|-----------|----------|-----------|------------|----------------|
| AuthService.authenticate | SELECT by email | users | 1000/min | Read | <50ms |
| AuthService.createSession | INSERT | sessions | 1000/min | Write | <20ms |
| OrderService.listByUser | SELECT with JOIN | orders, order_items | 100/min | Read | <200ms |
| OrderService.create | INSERT (tx) | orders, order_items | 10/min | Write | <100ms |
| AnalyticsService.dailyReport | AGGREGATE | orders | 1/hour | Read | <5000ms |
```

### Step 3: Entity-Relationship Design

For every entity, Grizzbolt produces a table specification:

```markdown
## Table: users

**Purpose:** Core user identity and authentication

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | UUID | PK | gen_random_uuid() | Primary key |
| email | VARCHAR(255) | UNIQUE, NOT NULL | — | Login identifier |
| password_hash | VARCHAR(255) | NOT NULL | — | bcrypt hash, never exposed |
| name | VARCHAR(100) | NOT NULL | — | Display name |
| role | user_role_enum | NOT NULL | 'user' | RBAC role |
| email_verified_at | TIMESTAMP | NULL | — | Verification timestamp |
| failed_attempts | INTEGER | NOT NULL | 0 | Rate limiting counter |
| locked_until | TIMESTAMP | NULL | — | Account lock expiry |
| created_at | TIMESTAMP | NOT NULL | NOW() | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | NOW() | Last update |

**Indexes:**
| Index | Columns | Type | Reason |
|-------|---------|------|--------|
| idx_users_email | (email) | UNIQUE B-TREE | Login lookup — most frequent query |
| idx_users_role | (role) | B-TREE | Admin list filtering |
| idx_users_created_at | (created_at) | B-TREE | User reports, pagination |

**Notes:**
- `password_hash` is bcrypt, cost factor 12 — ~250ms hash time is acceptable for login
- `failed_attempts` + `locked_until` implement rate limiting at DB level (defense in depth)
- NEVER select `password_hash` in list queries — repository layer must use `select: { password_hash: false }` or equivalent
```

### Step 4: Relationship Design

```markdown
## Relationships

### users → sessions (one-to-many)
- **FK:** sessions.user_id → users.id
- **Cascade:** DELETE CASCADE (user deleted → all sessions removed)
- **Index:** idx_sessions_user_id on (user_id) for "list user sessions" queries

### users → orders (one-to-many)
- **FK:** orders.user_id → users.id
- **Cascade:** RESTRICT (don't delete user if they have orders — soft-delete instead)
- **Index:** idx_orders_user_id_status on (user_id, status) for "user's active orders"

### orders → order_items (one-to-many)
- **FK:** order_items.order_id → orders.id
- **Cascade:** DELETE CASCADE
- **Index:** idx_order_items_order_id on (order_id) — always queried with parent
```

### Step 5: Normalization Decisions

Grizzbolt explicitly justifies every normalization choice:

| Table | Normal Form | Justification |
|-------|-------------|---------------|
| users | 3NF | No transitive dependencies. role determines no other attribute. |
| orders | 3NF | total_amount is derived → computed via VIEW or service layer, NOT stored |
| order_items | 3NF | price_at_time is intentionally denormalized (see below) |
| user_profiles | 1NF (intentional) | preferences JSONB column — rarely queried individually, always fetched as batch. JSONB avoids 20-column wide table for rarely-used fields. |

**Denormalization Trade-offs (explicitly documented):**

```markdown
## Denormalization: order_items.price_at_time

**Decision:** Store product price at order time, NOT reference products.price

**Why denormalized:**
- Product prices change over time. Historical orders must reflect the price AT ORDER TIME.
- JOIN to products would show current price, not historical price.
- Alternative (price_history table) adds complexity for a simple requirement.

**Trade-off accepted:**
- Storage overhead: ~8 bytes per order_item row
- Anomaly risk: if product price is updated, price_at_time stays frozen — that's INTENTIONAL

**Integrity rule (application-level):**
- On order creation: copy products.price INTO order_items.price_at_time
- On order read: use price_at_time, never JOIN products.price
```

### Step 6: Indexing Strategy

Grizzbolt designs indexes based on actual query patterns — not guesswork:

```markdown
## Index Map

Legend:
⚡ = Critical (<50ms queries, high frequency)
📊 = Important (<200ms queries, medium frequency)
📦 = Nice-to-have (<1000ms queries, low frequency)

| Table | Index | Type | Reason | Priority |
|-------|-------|------|--------|----------|
| users | (email) UNIQUE | B-TREE | Login lookup | ⚡ Critical |
| users | (role) | B-TREE | Admin filtering | 📊 Important |
| sessions | (user_id) | B-TREE | List user sessions | ⚡ Critical |
| sessions | (expires_at) | B-TREE | Cleanup cron | 📊 Important |
| sessions | (refresh_token) UNIQUE | B-TREE | Token refresh | ⚡ Critical |
| orders | (user_id, status) | B-TREE | User's active orders | ⚡ Critical |
| orders | (created_at) | B-TREE | Pagination, reports | 📊 Important |
| orders | (status, created_at) | B-TREE | Admin order queue | 📦 Nice-to-have |
| order_items | (order_id) | B-TREE | Always queried with parent | ⚡ Critical |

**Composite Index Column Order:**
- Equality columns first (`status = 'active'`), range columns last (`created_at > ...`)
- idx_orders_user_id_status: user_id (equality) before status (equality) — both are equality filters
- idx_orders_status_created_at: status (equality) before created_at (range) — range always last
```

### Step 7: Migration Design

Every schema change gets a numbered, reversible migration:

```markdown
## Migration: 004_add_password_resets

**Up:**
```sql
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX idx_password_resets_token ON password_resets(token);
```

**Down:**
```sql
DROP TABLE IF EXISTS password_resets CASCADE;
```

**Pre-migration check:**
- Verify users table exists and has id column
- Verify no existing password_resets table

**Post-migration check:**
- SELECT count(*) FROM password_resets → 0 rows (fresh table)
- INSERT + SELECT + DELETE sanity test on one row
```

### Step 8: Data Integrity Rules

```markdown
## Constraints

### CHECK Constraints
| Table | Constraint | Rule |
|-------|-----------|------|
| order_items | ck_quantity_positive | quantity > 0 |
| order_items | ck_price_positive | price_at_time > 0 |
| users | ck_email_format | email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' |

### UNIQUE Constraints
| Table | Columns | Purpose |
|-------|---------|---------|
| users | (email) | No duplicate accounts |
| sessions | (refresh_token) | No token collisions |

### FOREIGN KEY Constraints
| Table | Column | References | On Delete | On Update |
|-------|--------|------------|-----------|-----------|
| sessions | user_id | users.id | CASCADE | CASCADE |
| orders | user_id | users.id | RESTRICT | CASCADE |
| order_items | order_id | orders.id | CASCADE | CASCADE |

### Application-Level Rules (cannot be enforced by DB)
- password_hash must be bcrypt, cost factor >= 12
- email_verified_at can only be set once (from NULL to timestamp, never back)
- locked_until can only be set when failed_attempts >= 5
```

### Step 9: Performance Budget

```markdown
## Query Performance Budget

| Query | Target p50 | Target p99 | Budget |
|-------|------------|------------|--------|
| Login (SELECT by email) | <10ms | <50ms | Simple indexed lookup |
| Create session (INSERT) | <5ms | <20ms | Single row insert |
| List user orders (SELECT + JOIN) | <50ms | <200ms | Indexed join, paginated |
| Daily report (AGGREGATE) | <1000ms | <5000ms | Complex aggregation allowed |
| Create order (transaction) | <50ms | <100ms | Multi-table insert in transaction |

**Monitoring:**
- Add `EXPLAIN ANALYZE` to CI pipeline for migration PRs
- Alert if any query exceeds p99 budget in production
- Review index usage monthly (pg_stat_user_indexes)
```

### Step 10: Write Schema Document

Save to `.palbox/schemas/<feature-name>.md`:

```markdown
# Database Schema: [Feature Name]
**Date:** YYYY-MM-DD
**Author:** Grizzbolt (palskills)
**Database:** PostgreSQL 16
**ORM:** [Prisma / SQLAlchemy / None]

## Query Patterns
[From Step 2]

## Entity-Relationship Diagram
[From Step 3-4]

## Normalization Decisions
[From Step 5]

## Index Strategy
[From Step 6]

## Migrations
[From Step 7]

## Data Integrity
[From Step 8]

## Performance Budget
[From Step 9]
```

## Database Type Selection

Grizzbolt may recommend switching database type based on the data model:

| Data Pattern | Recommended DB | Why |
|-------------|----------------|-----|
| Structured, relational, JOIN-heavy | PostgreSQL | Best relational, JSONB for hybrid |
| Document-oriented, schema-flexible | MongoDB | Schema-less, embedded documents |
| Key-value, high-throughput simple ops | Redis | Sub-millisecond, in-memory |
| Time-series, append-heavy | TimescaleDB | PostgreSQL extension, auto-partitioning |
| Full-text search heavy | Elasticsearch | Inverted index, relevance scoring |
| Graph traversals | Neo4j | Native graph storage, Cypher queries |

**Decision rule:** Default to PostgreSQL unless the data model clearly prefers another type. PostgreSQL's JSONB handles 80% of MongoDB use cases while keeping relational integrity for the other 80%.

## Anti-Patterns Grizzbolt Flags

- **EAV (Entity-Attribute-Value) tables** — use JSONB or separate columns instead
- **Polymorphic associations** — `parent_type` + `parent_id` columns → use separate FK columns
- **Comma-separated lists in VARCHAR columns** — use array columns or junction tables
- **Soft deletes without partial indexes** — missing `WHERE deleted_at IS NULL` on indexes
- **UUID as clustered primary key** — random UUIDs fragment B-tree indexes; use ULID or sequential UUID
- **No foreign keys** — "performance" excuse doesn't hold; FK overhead is negligible vs data corruption risk
- **SELECT * in production code** — wastes I/O, breaks on schema changes
- **N+1 queries** — always batch-fetch related data (eager loading, JOINs, or data loaders)

## Rules

1. **Design for queries, not entities** — the query pattern drives the schema, not the other way around
2. **Every index justifies its existence** — name the query it serves
3. **Migrations must be reversible** — always provide DOWN script
4. **Normalize by default, denormalize with justification** — explicitly document why
5. **FOREIGN KEYs are mandatory** — no "performance" exceptions
6. **UUID primary keys use sequential generation** — `uuid_generate_v7()` or ULID, never `uuid_generate_v4()`
7. **TEXT over VARCHAR(n)** — PostgreSQL treats them identically; no arbitrary limits
8. **TIMESTAMPTZ always** — never TIMESTAMP without timezone
9. **Document every trade-off** — denormalization, materialized views, trigger complexity
10. **Save to `.palbox/schemas/`** — Jetdragon and Anubis read from here
