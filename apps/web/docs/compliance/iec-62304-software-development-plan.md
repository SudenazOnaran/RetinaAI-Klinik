# IEC 62304 Software Development Plan

Document ID: SDP-62304-001  
Version: 0.2-draft  
Owner: Tech Lead  
Approver: Product/Clinical Owner  
Date: 2026-03-24

## 1. Purpose

This plan defines software lifecycle activities and controls in alignment with IEC 62304.

## 2. Software Safety Classification

- Classification: Pending (Target: Class B for pilot decision-support software, to be finalized after formal clinical harm review).
- Justification basis: initial hazards in `iso-14971-risk-register.csv` and non-autonomous clinician-in-the-loop workflow.

## 3. Lifecycle Process

1. Requirements definition
2. Architecture and design
3. Implementation
4. Verification and validation
5. Release and deployment
6. Maintenance and problem resolution

Current project mapping:

- Requirements and functional scope: son kontroller.md, docs/regulator-uyumluluk-paketi-adim-1.md
- Implementation baseline: src/, services/ai/app.py, prisma/ schema + migrations
- Verification baseline: vitest unit tests and Playwright e2e suite
- Deployment baseline: release scripts and CI release gate

## 4. Entry and Exit Criteria

- Requirement phase exit: approved requirements and acceptance criteria.
- Implementation phase exit: code review completed and static checks pass.
- Verification phase exit: unit/integration/e2e minimum pass criteria met.
- Release exit: release:check pass, residual risk decision approved.

Release gate command:

- `npm run release:check`

## 5. Configuration and Change Management

- Source control: Git with protected main/release branches.
- Release integrity: CI release gate and documented checklist in son kontroller.md.
- Change approval: Tech Lead + Product/Clinical Owner for clinical-impacting changes.

Repository controls in use:

- Migration-controlled DB changes via prisma/migrations (runtime DDL removed)
- Build artifact lock mitigation via `clean:next-artifacts`
- Release env fail-fast checks via `env:check:release`

## 6. Problem Resolution Process

- Defect intake source: monitoring alerts, support reports, test failures.
- Triage SLA: critical within 24h, high within 72h.
- Root cause analysis required for recurring/high severity defects.
- CAPA linkage required for quality-impacting issues.

## 7. Verification Strategy

- Unit tests: business logic and validation.
- Integration tests: API auth, validation, DB fault scenarios.
- E2E tests: core clinical workflows and role access controls.
- Security checks: dependency audit and release gate checks.

Current evidence examples:

- Unit/integration: `src/lib/*.test.ts`
- E2E: `e2e/auth-flow.spec.ts`, `e2e/patient-crud.spec.ts`, `e2e/api-integration.spec.ts`, `e2e/role-access.spec.ts`
- Quality gate: `npm run ci`, `npm run release:check`

## 8. Traceability Requirement

- Mandatory traceability matrix file:
  - docs/compliance/iec-62304-traceability-matrix.csv

## 9. Change History

- 0.1-draft (2026-03-24): initial template created.
- 0.2-draft (2026-03-24): lifecycle mapping, release gate details, and verification evidence references added.
