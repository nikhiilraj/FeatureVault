# FeatureVault Development & Architecture Log

This document serves as a continuous record of the architectural features, design decisions, and system improvements implemented over time. It can be referenced by AI assistants or developers to maintain full context of the project's evolution.

---

## 📅 Session Record: Advanced Observability & Telemetry Overhaul
**Phase:** System Reliability & Architecture Enhancements

### 🎯 Objective Completed
Upgraded the basic monitoring layer into a highly concurrent, FAANG-level 3-pillar observability environment (Metrics, Traces, Logs) optimized for high-performance Node processes and distributed infrastructure constraints.

### 🛠️ Key Architectural Implementations

#### 1. LGTM Offline Diagnostic Stack (`infra/o11y`)
- **Self-Hosted Isolation:** Built an isolated, 100% offline Docker Compose stack specifically for development containing Prometheus, Tempo, and Grafana natively avoiding Grafana Cloud costs.
- **Zero-Touch Provisioning:** Engineered automatic `datasources.yaml` and `dashboards.yaml` mapping Grafana directly to the Prometheus targets without requiring GUI configurations.
- **Node Bridge:** Configured `prometheus.yml` to securely bridge over `host.docker.internal:4000` to actively scrape the host local `pnpm dev:api` instance.

#### 2. Advanced FAANG-Tier ATS Metrics (`lib/metrics.ts` & `server.ts`)
- **Database Starvation Tracing:** Hooked directly into the Fastify Drizzle-PG driver natively exporting `fv_pg_pool_active_connections`, `fv_pg_pool_idle`, and critical `fv_pg_pool_waiting_queries`.
- **Distributed Queue Telemetry (BullMQ):** Wrote recurring intervals scraping BullMQ to monitor Background Async load via `fv_bullmq_jobs_waiting` and `active` counts.
- **Security SOC Logging:** Wrapped Redis sliding-window strict rate limiters routing `429` blocks natively to `fv_rate_limit_exceeded_total` preventing silent Layer-7 abuse.

#### 3. Mathematical Allocation Fairness Verification (`worker.ts`)
- Implemented real-time analytical parsing of the `MurmurHash3` deterministic allocation logic.
- Deployed native `fv_experiment_allocations_total` grouped mathematically by variant IDs. This successfully visualizes traffic-split distribution dynamically inside Grafana to actively prove there is zero mathematical bias in the algorithm. 

#### 4. The Grafana Dashboard Overhaul (`infra/grafana-dashboard.json`)
- Re-architected the JSON layout completely into 4 targeted Rows:
  - **Row 1:** North Star (Ops/Sec, Latency Target, Active Streaming SDKs).
  - **Row 2:** Distributed Queues (BullMQ Async processing layers).
  - **Row 3:** Data Starvation (PostgreSQL Lock mapping & Redis proxy efficiency).
  - **Row 4:** Analytics Checks (Algorithms & Throttling Drops).

---

*Note to AI Assistants: Please append to the top of this log chronologically upon completing new feature systems.*
