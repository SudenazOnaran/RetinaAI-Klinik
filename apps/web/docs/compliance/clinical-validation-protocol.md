# Clinical Validation Protocol

Document ID: CLIN-VAL-001  
Version: 0.2-draft  
Owner: Product/Clinical Owner  
Approver: Security/Compliance Owner  
Date: 2026-03-24

## 1. Objective

Define a repeatable protocol to measure sensitivity, specificity, and per-site performance for the AI-assisted retina analysis workflow.

## 2. Study Scope

- Population criteria: Adult diabetic patients evaluated in retina screening workflow.
- Inclusion criteria:
  - Age >= 18
  - Fundus image quality meeting minimum clinical readability
  - Ground truth label available from specialist review
- Exclusion criteria:
  - Missing consent or incomplete metadata
  - Severe image artifacts preventing grading
  - Duplicate capture from same visit when not needed for protocol
- Study sites: Minimum 2 independent sites (target 3 in pilot expansion).

## 3. Ground Truth Strategy

- Gold standard labeling method: specialist consensus (minimum two independent raters).
- Disagreement resolution: third rater adjudication.
- Label governance: versioned labeling guideline.

## 4. Dataset Management

- Dataset split policy: training/validation/test separation with site-level leakage controls.
- Minimum sample thresholds per class: initial pilot target >= 100 case images per primary class and >= 100 control images per site (revise after data feasibility review).
- Data quality checks: missingness, label consistency, image quality criteria.

Data governance controls:

- All datasets must be de-identified before analysis export.
- Dataset manifest must include source site, acquisition date range, and label version.
- Reproducible analysis run must record model version and evaluation script version.

## 5. Statistical Analysis Plan

Primary metrics:

- Sensitivity
- Specificity

Secondary metrics:

- PPV/NPV
- AUC (if applicable)
- Per-site performance variability

Reporting requirements:

- Confidence intervals for primary metrics
- Site-stratified confusion matrices
- Error pattern summary

## 6. Safety and Ethics

- Patient privacy handling aligned with KVKK.
- De-identification/anonymization checks mandatory before analysis.
- Audit trail for data extraction and analysis runs.

## 7. Acceptance Criteria

- Minimum sensitivity threshold: 0.85 (pilot draft, pending clinical owner approval).
- Minimum specificity threshold: 0.80 (pilot draft, pending clinical owner approval).
- Maximum allowed per-site deviation: <= 0.10 absolute difference against pooled sensitivity/specificity.

Decision rule:

- If any primary metric is below threshold, release decision is No-Go until corrective action is defined.

## 8. Deliverables

- Clinical validation report (sensitivity/specificity/per-site)
- Dataset manifest and labeling summary
- Statistical appendix with calculation methods

Minimum report package fields:

- Versioned cohort definition and exclusions table
- Per-site confusion matrix and 95% confidence intervals
- Error analysis by false positive/false negative pattern
- Recommendation section for clinical deployment scope

## 9. Change History

- 0.1-draft (2026-03-24): initial template created.
- 0.2-draft (2026-03-24): pilot-ready scope, draft thresholds, and reporting minimums added.
