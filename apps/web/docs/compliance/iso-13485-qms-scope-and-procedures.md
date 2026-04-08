# ISO 13485 QMS Scope and Procedures

Document ID: QMS-13485-001  
Version: 0.2-draft  
Owner: Operations Owner  
Approver: Product/Clinical Owner  
Date: 2026-03-24

## 1. QMS Scope

This QMS scope covers software development, verification, release, deployment, monitoring, and support processes for the clinical software product.

## 2. Document Control Procedure

- All controlled documents must include: document ID, version, owner, approver, approval date.
- Versioning model: major.minor (e.g., 1.0, 1.1).
- Changes must be recorded in change history section.
- Obsolete versions are archived and marked as superseded.

Current repository document set under control:

- docs/compliance/_.md and docs/compliance/_.csv
- docs/regulator-uyumluluk-paketi-adim-1.md
- son kontroller.md (master status tracker)

## 3. Change Control Procedure

- Any clinical-impacting change requires documented impact assessment.
- Required approvals before release: Tech Lead, Product/Clinical Owner.
- Emergency changes require post-implementation review within 48h.

Operational implementation:

- Technical gate: `npm run release:check` must pass.
- Process gate: residual risk decision section in RM-PLAN-001 must be updated before release.

## 4. CAPA Procedure

- Trigger sources: incidents, audit findings, repeated defects.
- CAPA record minimum fields:
  - issue summary
  - root cause
  - corrective action
  - preventive action
  - owner and due date
  - effectiveness check result

CAPA record template (minimum):

- CAPA ID
- Source (incident, audit, defect trend, security finding)
- Severity
- Linked risk IDs (from iso-14971-risk-register.csv)
- Target completion date
- Closure evidence link

## 5. Training and Responsibility

- Role-based responsibilities follow RACI in regulator package.
- Onboarding training required for any role handling clinical-impacting workflows.
- Training completion records retained by Operations Owner.

Initial role ownership mapping:

- Product/Clinical Owner: clinical criteria and validation sign-off
- Tech Lead: IEC 62304 lifecycle and traceability maintenance
- Security/Compliance Owner: risk register governance and residual risk recommendation
- Operations Owner: release operations, backup drills, QMS record retention

## 6. Supplier and Dependency Quality Controls

- Dependencies must pass audit policy at release gate.
- Critical third-party services require documented fallback strategy.
- Supplier incidents must be evaluated for clinical impact.

## 7. Internal Audit Cadence

- Quarterly process audit for QMS controls.
- Findings tracked as CAPA items until closure.

## 8. Change History

- 0.1-draft (2026-03-24): initial template created.
- 0.2-draft (2026-03-24): repository-specific control scope, process gates, and CAPA template added.
