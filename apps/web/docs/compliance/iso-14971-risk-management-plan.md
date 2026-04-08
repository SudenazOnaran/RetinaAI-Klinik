# ISO 14971 Risk Management Plan

Document ID: RM-PLAN-001  
Version: 0.2-draft  
Owner: Security/Compliance Owner  
Approver: Product/Clinical Owner  
Date: 2026-03-24

## 1. Purpose

This plan defines the risk management process for the medical software product and aligns with ISO 14971 requirements.

## 2. Scope

- Product scope: Doctor pilot software and AI-assisted retina analysis workflow.
- Lifecycle scope: design, implementation, validation, deployment, operations, post-market monitoring.
- Deployment scope: On-prem and VPC profiles documented in env matrix and runbook.

## 3. Roles and Responsibilities

- Product/Clinical Owner: clinical safety criteria, clinical acceptance decisions.
- Tech Lead: software risk controls implementation and traceability.
- Security/Compliance Owner: risk register governance and residual risk summary.
- Operations Owner: production monitoring, incident feedback into risk process.

## 4. Risk Acceptability Criteria

- Severity scale: S1 (minor) to S4 (catastrophic).
- Probability scale: P1 (rare) to P4 (frequent).
- Acceptance matrix:
  - Low: acceptable with routine monitoring.
  - Medium: acceptable only with documented control and verification evidence.
  - High: not acceptable without additional control and re-evaluation.
  - Critical: release blocked until risk reduced and approved.

Current release policy alignment:

- High/Critical open risks block `release:check` approval until control evidence is linked.
- Medium risks require owner + due date + verification plan.

## 5. Risk Management Activities

1. Identify hazards and hazardous situations.
2. Estimate risk (severity x probability).
3. Define risk controls (design, process, operational).
4. Verify control effectiveness.
5. Evaluate residual risk.
6. Produce risk management report per release.
7. Feed production incidents and near misses back into risk register.

## 6. Required Records

- Risk register: docs/compliance/iso-14971-risk-register.csv
- Verification evidence links: test cases, monitoring alerts, release checks.
- Residual risk decision record: add release-specific section in this document.

Current evidence sources in repository:

- Release gate and checks: package.json (`release:check`, `env:check:release`, `test:e2e`)
- Environment safety controls: docs/env-fail-fast-matrix.md
- Operational controls and incident handling: docs/operasyon-runbook.md
- Backup/restore resilience evidence: docs/backup-restore-tatbikat.md
- Production hardening baseline: docs/production-readiness-assessment.md

## 7. Review Cadence

- Sprint review: risk register updates.
- Release gate: residual risk approval mandatory.
- Post-incident review: within 48 hours after major incident.

## 8. Residual Risk Decision (Per Release)

Release: Pilot-2026-Q2  
Decision date: Pending  
Decision: Pending  
Decision rationale: To be completed after risk register review meeting and traceability updates.  
Approved by: Pending

## 9. Change History

- 0.1-draft (2026-03-24): initial template created.
- 0.2-draft (2026-03-24): project-specific evidence, release policy alignment, and initial release target added.
