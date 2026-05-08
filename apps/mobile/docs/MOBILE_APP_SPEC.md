# RetinaAI Klinik — Mobile Application Specification

> **Version:** 1.0.0 | **Generated:** April 29, 2026  
> **Target Platform:** Flutter (iOS + Android)  
> **Backend Compatibility:** Web App v1 (Next.js 15 + Prisma + PostgreSQL)  
> **Base API URL:** `https://<your-domain>/api/mobile/v1`

---

## Table of Contents

1. [Authentication System](#1-authentication-system)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Home / Dashboard](#3-home--dashboard)
4. [Patient Management](#4-patient-management)
5. [Doctor Information Model](#5-doctor-information-model)
6. [AI Analysis Flow](#6-ai-analysis-flow)
7. [Admin Panel](#7-admin-panel)
8. [Calendar / Appointments](#8-calendar--appointments)
9. [Data Models](#9-data-models)
10. [API Structure](#10-api-structure)
11. [Mobile App Screen Map & Navigation](#11-mobile-app-screen-map--navigation)
12. [UX Rules](#12-ux-rules)
13. [Security & Privacy](#13-security--privacy)
14. [Offline-First Architecture](#14-offline-first-architecture)

---

## 1. Authentication System

### 1.1 Token Format

The web backend uses a **custom HMAC-SHA256 signed token** — NOT a standard JWT.

```
<base64url(payload)>.<base64url(signature)>
```

The payload JSON is:

```json
{
  "id":    "string",
  "name":  "string",
  "email": "string",
  "role":  "DOCTOR | ASSISTANT | MANAGER | AUDITOR | ADMIN",
  "iat":   1234567890000
}
```

> `iat` is a **millisecond** Unix timestamp (not seconds).  
> The signature is `HMAC-SHA256(payload, SESSION_SECRET)`.  
> There is **no expiry field in the token itself**; expiry policy is enforced server-side via account `isActive` status.

---

### 1.2 Login Screen

**Endpoint:** `POST /api/mobile/v1/auth/login`

#### Request Body

```json
{
  "email":    "doctor@example.com",
  "password": "Password123"
}
```

#### Validation Rules (client-side)

| Field      | Type   | Required | Rules |
|------------|--------|----------|-------|
| `email`    | string | ✅ Yes   | Valid email format, trimmed, lowercased |
| `password` | string | ✅ Yes   | Non-empty |

#### Success Response (HTTP 200)

```json
{
  "success": true,
  "token": "eyJpZCI...",
  "doctor": {
    "id":        "clud123abc",
    "name":      "Ahmet",
    "surname":   "Yılmaz",
    "email":     "doctor@example.com",
    "role":      "DOCTOR",
    "specialty": "Oftalmoloji",
    "hospital":  "Ankara Şehir Hastanesi"
  }
}
```

#### Error Responses

| HTTP Status | `error` message (tr) | Meaning |
|-------------|----------------------|---------|
| 400 | `Email ve şifre gereklidir` | Missing fields |
| 401 | `Geçersiz email veya şifre` | Wrong credentials |
| 403 | `Hesabınız aktif değil` | Account deactivated or pending approval |
| 429 | Rate-limit message with retry seconds | Too many failed attempts |
| 500 | `Sunucu hatası` | Unexpected server error |

> **Rate Limiting (web backend):** 5 failed attempts per 5 min window → 15-minute lockout. Keys are composed of `IP::email`.

#### Mobile Token Storage

```
Store token in: Flutter Secure Storage (flutter_secure_storage)
Key:            "doctor_session_token"
```

After storing, attach to every subsequent API request as:

```
Authorization: Bearer <token>
```

---

### 1.3 Token Verification (App Start / Refresh)

**Endpoint:** `POST /api/mobile/v1/auth/verify`

**Headers:** `Authorization: Bearer <token>`

#### Success Response (HTTP 200)

```json
{
  "success": true,
  "valid":   true,
  "doctor": {
    "id":        "...",
    "name":      "...",
    "surname":   "...",
    "email":     "...",
    "role":      "DOCTOR",
    "specialty": "...",
    "hospital":  "..."
  }
}
```

#### Failure Response (HTTP 401 / 403)

```json
{
  "success": false,
  "valid":   false,
  "error":   "Geçersiz token"
}
```

> Call this endpoint **on every app cold start**. If `valid` is false, clear stored token and route to Login.

---

### 1.4 Logout

There is no mobile-specific logout endpoint. To log out:

1. Delete the stored token from Flutter Secure Storage.
2. Navigate to the Login screen.
3. *(Optional)* Optionally call `POST /api/doctor/logout` (web endpoint) if the app shares session cookies, but this is not required for token-based mobile auth.

---

### 1.5 Password Reset (Temporary Password Flow)

**Endpoint:** `POST /api/doctor/password/reset-temp`

> This web endpoint is used when a doctor receives a temporary password from a MANAGER. The mobile app should support this flow.

#### Request Body

```json
{
  "email":             "doctor@example.com",
  "temporaryPassword": "Tmp-abc123A1",
  "newPassword":       "NewSecurePass1!"
}
```

#### Password Rules

| Rule | Value |
|------|-------|
| Minimum length | 10 characters |
| Public registration minimum | 8 characters |
| Temporary password format | `Tmp-<random10chars>A1` |

#### Error Codes from Login Indicating Reset Required

| `errorCode` | Meaning |
|-------------|---------|
| `PASSWORD_RESET_REQUIRED` | Doctor must reset temporary password |
| `TEMP_PASSWORD_EXPIRED` | Temporary password has expired |

> When login returns one of these codes, redirect to the **Password Reset Screen**.

---

### 1.6 Public Doctor Registration

**Endpoint:** `POST /api/doctor/public-register`

> Doctors self-register; their account is **`PENDING`** until an ADMIN approves it. Mobile app should support this registration flow.

#### Request Body

```json
{
  "name":      "Ahmet",
  "surname":   "Yılmaz",
  "email":     "doctor@hospital.com",
  "password":  "SecurePass123",
  "specialty": "Oftalmoloji",
  "hospital":  "Ankara Şehir Hastanesi"
}
```

#### Validation Rules

| Field | Required | Rules |
|-------|----------|-------|
| `name` | ✅ | Non-empty string |
| `surname` | ✅ | Non-empty string |
| `email` | ✅ | Valid email, must be unique |
| `password` | ✅ | Minimum 8 characters |
| `specialty` | ✅ | Non-empty string |
| `hospital` | ✅ | Non-empty string |

#### Success Response

```json
{
  "success": true,
  "message": "Kayıt başvurunuz alınmıştır. Admin onayından sonra sisteme giriş yapabilirsiniz."
}
```

> After registration, display a **"Pending Approval"** screen. The doctor cannot log in until ADMIN approves their account.

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

```
DOCTOR_ROLES = ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR", "ADMIN"]
```

| Role | Turkish Label | Description |
|------|--------------|-------------|
| `DOCTOR` | Doktor | Standard clinic doctor |
| `ASSISTANT` | Asistan | Doctor assistant with limited write access |
| `MANAGER` | Müdür | Clinic manager; can register new doctors |
| `AUDITOR` | Denetçi | Read-only access to reports and logs |
| `ADMIN` | Admin | System administrator; approves doctor accounts |

### 2.2 Permission Matrix

| Screen / Feature | DOCTOR | ASSISTANT | MANAGER | AUDITOR | ADMIN |
|-----------------|--------|-----------|---------|---------|-------|
| Login | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard Home | ✅ | ✅ | ✅ | ✅ | ❌ |
| Patient List | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Patient | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Patient | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete Patient | ✅ | ❌ | ✅ | ❌ | ❌ |
| AI Analysis | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| Analysis History | ✅ | ✅ | ✅ | ✅ | ❌ |
| Calendar | ✅ | ✅ | ✅ | ❌ | ❌ |
| App Settings | ✅ | ❌ | ✅ | ❌ | ❌ |
| Profile Info | ✅ | ✅ | ✅ | ✅ | ❌ |
| KVKK Panel | ✅ | ❌ | ✅ | ✅ | ❌ |
| Monitoring/Logs | ❌ | ❌ | ✅ | ✅ | ❌ |
| Pilot Metrics | ✅ | ❌ | ✅ | ✅ | ❌ |
| Register New Doctor | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approve Doctors | ❌ | ❌ | ❌ | ❌ | ✅ |
| Admin Panel | ❌ | ❌ | ❌ | ❌ | ✅ |

### 2.3 Doctor Approval Status

Each doctor account has an `approvalStatus` field:

| Value | Meaning |
|-------|---------|
| `PENDING` | Awaiting admin approval; cannot log in |
| `APPROVED` | Active account; can log in |
| `REJECTED` | Account rejected |

> If login returns HTTP 403 with `"Hesabınız aktif değil"`, show a "Pending Approval" message.

---

## 3. Home / Dashboard

### 3.1 Data Displayed

The dashboard is **role-aware** and fetches the following metrics:

| Metric | Source | Description |
|--------|--------|-------------|
| Total Patients | `Patient.count` where `doctorId = me` | Total registered patients |
| Total Analyses | `Analysis.count` via patients | All AI analyses performed |
| High-Risk Patients | `Patient` with risk ≥ Evre 2 (Moderate NPDR+) | Urgent follow-up list |
| Recent Patients | Latest 5 `Patient` records | Quick access list |
| Alert Patients | Complex query: latest analysis confidence + doctor feedback | Patients needing attention |

### 3.2 High-Risk Patient Detection Logic

A patient is flagged as **high-risk** if their `risk` field contains any of:

- `__DTG__:URGENT` (prefix)
- `Evre 3`, `Stage 3` (Severe NPDR)
- `Evre 4`, `Stage 4` (Proliferative DR)
- `Severe NPDR`
- `Proliferative`, `Proliferative_DR`

### 3.3 Dashboard Metric Cards (Mobile UI)

Render 4 summary cards:

```
┌─────────────────┐  ┌─────────────────┐
│  👥 Hastalar    │  │  🔬 Analizler   │
│  Total count    │  │  Total count    │
└─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐
│  ⚠️ Yüksek Risk │  │  🕐 Son Aktivite│
│  Count + list   │  │  Recent list    │
└─────────────────┘  └─────────────────┘
```

### 3.4 Dashboard API Calls

> The mobile dashboard assembles data from these endpoints:

```
GET /api/mobile/v1/patients           → patient count + recent patients
GET /api/mobile/v1/analyses           → analysis count
GET /api/mobile/v1/patients?risk=high → high-risk patients (filter client-side)
```

---

## 4. Patient Management

### 4.1 Patient Creation — All Fields

**Endpoint:** `POST /api/mobile/v1/patients`

#### Form Fields

| Field | Label (TR) | Type | Required | Validation |
|-------|-----------|------|----------|------------|
| `fullName` | Ad Soyad | string | ✅ | Min 2, Max 120 chars, trimmed |
| `tcNo` | TC Kimlik No | string | ✅ | Exactly 11 digits, numbers only |
| `age` | Yaş | integer | ✅ | 0–120 |
| `gender` | Cinsiyet | string (enum) | ✅ | `"Erkek"` or `"Kadın"` |
| `diabetesYears` | Diyabet Süresi (yıl) | integer | ❌ Optional | 0–80 |
| `hba1c` | HbA1c (%) | float | ❌ Optional | 3.0–20.0 |

> **Note:** There is no phone, email, or address field on the `Patient` model. Those belong to the `Doctor` model.

> **Uniqueness:** `tcNo` must be unique per doctor (`doctorId + tcNo` unique constraint).

#### Request Body (Single Patient)

```json
{
  "fullName":      "Fatma Kaya",
  "tcNo":          "12345678901",
  "age":            52,
  "gender":         "Kadın",
  "diabetesYears":  8,
  "hba1c":          7.4
}
```

#### Success Response

```json
{
  "success": true,
  "patient": {
    "id":           "cluabc123",
    "fullName":     "Fatma Kaya",
    "tcNo":         "12345678901",
    "age":           52,
    "gender":        "Kadın",
    "risk":          "Yok",
    "diabetesYears": 8,
    "hba1c":         7.4,
    "createdAt":     "2026-04-29T10:00:00.000Z"
  }
}
```

#### Risk Field Initial Value

Always set to `"Yok"` (No risk) on creation. Updated automatically based on AI analysis feedback.

---

### 4.2 Batch Patient Sync (Offline)

**Endpoint:** `POST /api/mobile/v1/patients`

Use when syncing offline-created patients:

```json
{
  "patients": [
    {
      "id":       "offline_<uuid>",
      "fullName": "Mehmet Demir",
      "tcNo":     "98765432109",
      "age":       45,
      "gender":    "Erkek"
    }
  ]
}
```

#### Sync Response

```json
{
  "success":   true,
  "results":   [
    {
      "offline_id": "offline_<uuid>",
      "server_id":  "cludef456",
      "status":     "created"
    }
  ],
  "timestamp": "2026-04-29T10:00:05.000Z"
}
```

> **Offline ID Naming:** Prefix offline records as `offline_<uuid>`. The server detects this prefix and creates a new record.

---

### 4.3 Patient List Screen

**Endpoint:** `GET /api/mobile/v1/patients`

Optional query param: `?since=<ISO8601>` (for incremental sync)

#### Response Shape per Patient in List

```json
{
  "id":            "cluabc123",
  "fullName":      "Fatma Kaya",
  "tcNo":          "12345678901",
  "age":            52,
  "gender":         "Kadın",
  "risk":           "Yok",
  "diabetesYears":  8,
  "hba1c":          7.4,
  "createdAt":      "2026-04-29T10:00:00.000Z",
  "analysisCount":  3,
  "lastAnalysis": {
    "id":         "anl123",
    "aiResult":   "Evre 2 (Orta - Moderate NPDR)",
    "confidence": 0.87,
    "createdAt":  "2026-04-28T09:00:00.000Z"
  }
}
```

#### Displayed Columns (Mobile List Row)

| Column | Source Field |
|--------|-------------|
| Patient Name | `fullName` |
| TC No (masked) | `tcNo` → show last 4 digits: `*******1234` |
| Age | `age` |
| Risk Level | `risk` (colored badge) |
| Last Analysis | `lastAnalysis.aiResult` + date |
| Analysis Count | `analysisCount` |

#### Risk Badge Colors

| Risk / DR Stage | Color |
|----------------|-------|
| `Yok` / No risk | Gray |
| Evre 0 (No DR) | Green |
| Evre 1 (Mild NPDR) | Blue |
| Evre 2 (Moderate NPDR) | Yellow/Amber |
| Evre 3 (Severe NPDR) | Orange |
| Evre 4 (Proliferative DR) | Red |

#### Search & Filter

- **Search by:** `fullName` (contains, case-insensitive), `tcNo`
- **Sort by:** `createdAt` desc (default), `fullName` asc
- **Filter by:** risk level

---

### 4.4 Patient Detail Screen

**Endpoint:** `GET /api/mobile/v1/patients/{id}`

#### Response

```json
{
  "success": true,
  "patient": {
    "id":            "cluabc123",
    "fullName":      "Fatma Kaya",
    "tcNo":          "12345678901",
    "age":            52,
    "gender":         "Kadın",
    "risk":           "Evre 2 (Orta - Moderate NPDR)",
    "diabetesYears":  8,
    "hba1c":          7.4,
    "createdAt":      "2026-04-29T10:00:00.000Z",
    "analyses": [
      {
        "id":           "anl123",
        "aiResult":     "Evre 2 (Orta - Moderate NPDR)",
        "confidence":   0.87,
        "heatmapUrl":   "https://...",
        "originalImage":"https://...",
        "doctorNote":   null,
        "isCorrect":    null,
        "actualResult": null,
        "createdAt":    "2026-04-28T09:00:00.000Z"
      }
    ]
  }
}
```

#### Available Tabs in Patient Detail

| Tab | Content |
|-----|---------|
| **Rapor Oluştur** | Create new clinical report (text-based) |
| **AI Analiz** | Upload fundus/FFA/OCT image, run AI, view result |
| **Raporlar** | Clinical report history list |
| **Radyolojik Raporlar** | AI workflow (radiological) report history |
| **İlerleme** | Confidence score over time chart (DR progression) |

#### Actions Available on Patient Detail

| Action | Role | Endpoint |
|--------|------|----------|
| Edit patient info | DOCTOR, ASSISTANT, MANAGER | `PATCH /api/mobile/v1/patients/{id}` |
| Delete patient | DOCTOR, MANAGER | `DELETE /api/mobile/v1/patients/{id}` |
| Run AI analysis | DOCTOR, ASSISTANT, MANAGER | `POST /api/ai/predict` (multipart) |
| Add doctor note | DOCTOR, ASSISTANT, MANAGER | `PATCH /api/mobile/v1/analyses/{analysisId}` |
| Export PDF report | DOCTOR, MANAGER | `POST /api/doctor/report/generate` |

---

### 4.5 Patient Update

**Endpoint:** `PATCH /api/mobile/v1/patients/{id}`

```json
{
  "fullName":      "Fatma Kaya Güneş",
  "age":            53,
  "gender":         "Kadın",
  "diabetesYears":  9,
  "hba1c":          7.9,
  "risk":           "Evre 2 (Orta - Moderate NPDR)"
}
```

All fields are optional (partial update).

---

### 4.6 Patient Delete

**Endpoint:** `DELETE /api/mobile/v1/patients/{id}`

> Cascades to all `Analysis` records of the patient.

```json
{
  "success": true,
  "message": "Hasta silindi"
}
```

---

## 5. Doctor Information Model

### 5.1 Doctor DB Model (from Prisma schema)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string (CUID) | Auto | Primary key |
| `name` | string | ✅ | First name |
| `surname` | string | ✅ | Last name |
| `email` | string | ✅ | Unique, login credential |
| `password` | string | ✅ | bcrypt hashed (cost factor 10) |
| `role` | DoctorRole enum | ✅ | Default: `DOCTOR` |
| `isActive` | boolean | ✅ | Default: `true`; `false` = cannot login |
| `specialty` | string | ✅ | e.g. `"Oftalmoloji"` |
| `hospital` | string | ✅ | e.g. `"Ankara Şehir Hastanesi"` |
| `approvalStatus` | ApprovalStatus enum | ✅ | `PENDING / APPROVED / REJECTED` |
| `createdAt` | DateTime | Auto | |

### 5.2 Extended Doctor Profile (from `DoctorSettings`)

Stored in `DoctorSettings.settings` JSON field, type `RetinaSettings.doctor`:

| Field | Type | Description |
|-------|------|-------------|
| `fullName` | string | Display name for reports |
| `branch` | string | Medical branch (e.g. `"Göz Hastalıkları"`) |
| `licenseNo` | string | Medical license number |
| `contactPhone` | string | Phone number (format: `[0-9+()\-\s]{10,24}`) |
| `signatureName` | string | Name printed on PDF reports |

### 5.3 Clinic Settings (from `DoctorSettings`)

| Field | Type | Description |
|-------|------|-------------|
| `clinic.clinicName` | string | Clinic name on reports |
| `clinic.address` | string | Clinic address |
| `clinic.reportHeader` | string | Report title header |

### 5.4 Profile API

**Endpoint:** `GET /api/doctor/profile`  
**Endpoint:** `PATCH /api/doctor/profile`

Profile update requires a verification code (sent via email/phone). The mobile app should implement this 2-step profile update flow.

#### Profile Update Fields

| Field | Max Length | Validation |
|-------|-----------|------------|
| `fullName` | 80 chars | 3–80 chars |
| `email` | 120 chars | Valid email format |
| `branch` | 80 chars | Any string |
| `licenseNo` | 40 chars | Any string |
| `contactPhone` | 24 chars | `/^[0-9+()\-\s]{10,24}$/` |
| `signatureName` | 80 chars | Any string |

### 5.5 Doctor Actions in Mobile App

| Action | Endpoint | Roles |
|--------|----------|-------|
| View own profile | `GET /api/doctor/profile` | All |
| Update profile | `PATCH /api/doctor/profile` | DOCTOR, MANAGER |
| Change password | `POST /api/doctor/password/reset-temp` | All |
| Register new doctor (internal) | `POST /api/doctor/register` | MANAGER only |
| View settings | `GET /api/doctor/settings` | DOCTOR, MANAGER |
| Update settings | `PATCH /api/doctor/settings` | DOCTOR, MANAGER |

---

## 6. AI Analysis Flow

### 6.1 Overview

The AI system supports **three imaging modalities**:

| Modality | Endpoint | Image Type |
|----------|----------|-----------|
| **Fundus** (Retinal Photography) | `POST /api/ai/predict` | JPEG/PNG fundus image |
| **FFA** (Fluorescein Angiography) | `POST /api/ai/predict-ffa` | FFA image |
| **OCT** (Optical Coherence Tomography) | `POST /api/ai/predict-oct` | OCT image |

### 6.2 Fundus AI Analysis

**Endpoint:** `POST /api/ai/predict`  
**Content-Type:** `multipart/form-data`  
**Auth:** Session Cookie (web) / Bearer Token does NOT work for this endpoint — **use web session**

> ⚠️ **Important for Mobile:** The AI endpoints (`/api/ai/predict*`) require a web session cookie (`doctor_session`). The mobile app must either:  
> - Option A: Perform a web login and store the session cookie alongside the token.  
> - Option B: Use a dedicated mobile AI endpoint (to be implemented as `/api/mobile/v1/analyses/predict`).

#### Request (multipart/form-data)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `image` | File | ✅ | Fundus image (JPEG/PNG) |
| `patientId` | string | ❌ Optional | Server patient ID |
| `roiMask` | File | ❌ Optional | ROI mask image |

#### Success Response (HTTP 200)

```json
{
  "success":  true,
  "drGrade":  2,
  "pytorch": {
    "label":      "Evre 2 (Orta - Moderate NPDR)",
    "confidence": 0.87
  }
}
```

#### Queued Response (AI service temporarily unavailable)

```json
{
  "success": false,
  "queued":  true,
  "queueId": "req_abc123",
  "message": "Analiz kuyruğa alındı"
}
```

### 6.3 DR Grading Scale

| `drGrade` | `label` (TR) | `label` (EN) | Risk Level |
|-----------|-------------|-------------|-----------|
| 0 | Evre 0 (Sağlıklı - No DR) | Stage 0 (Healthy - No DR) | None |
| 1 | Evre 1 (Hafif - Mild NPDR) | Stage 1 (Mild NPDR) | Low |
| 2 | Evre 2 (Orta - Moderate NPDR) | Stage 2 (Moderate NPDR) | Medium |
| 3 | Evre 3 (Şiddetli - Severe NPDR) | Stage 3 (Severe NPDR) | High |
| 4 | Evre 4 (Proliferatif - PDR) | Stage 4 (Proliferative PDR) | Critical |

### 6.4 Analysis Result Screen

After AI analysis, display these elements:

| Element | Source Field | Notes |
|---------|-------------|-------|
| **DR Grade** | `aiResult` / `drGradeInt` | Text label + color badge |
| **Confidence Score** | `confidence` (0.0–1.0) | Show as % (e.g. 87%) |
| **Heatmap Image** | `heatmapUrl` | GradCAM visualization |
| **Original Image** | `originalImage` | Uploaded fundus image |
| **AI Narrative** | `aiInferenceJson` | Structured AI explanation |
| **ODRI Labels** | `aiOdriLabels` | Comma-separated lesion labels |
| **ODRI Confidences** | `aiOdriConfidences` | Per-lesion confidence values |
| **Doctor Note** | `doctorNote` | Doctor's free-text note |
| **Is Correct** | `isCorrect` | Doctor validation (true/false) |
| **Actual Result** | `actualResult` | Doctor's corrected label |
| **Medications** | `ilaclar` | Prescribed medications (varchar 1500) |
| **DR Feedback** | `drFeedback` | Doctor's structured feedback |

### 6.5 Doctor Feedback on Analysis

**Endpoint:** `PATCH /api/mobile/v1/analyses/{id}`

```json
{
  "doctorNote":   "Maküla normal, periferik hemorajiler mevcut",
  "isCorrect":    false,
  "actualResult": "Evre 3 (Şiddetli - Severe NPDR)",
  "drFeedback":   "Evre 3 (Şiddetli - Severe NPDR)",
  "drGradeInt":   3
}
```

### 6.6 Analysis History

**Endpoint:** `GET /api/mobile/v1/analyses`

Query params:
- `?patientId=<id>` — filter by patient
- `?since=<ISO8601>` — incremental sync

Returns up to **100** analyses ordered by `createdAt DESC`.

### 6.7 PDF Report Generation

The web app generates PDF reports from analysis data. For mobile:

> PDF generation is handled server-side. Show a "Download Report" button that opens the PDF URL via in-app browser or system PDF viewer.

Report sections saved in `Analysis` model:

| Field | Content |
|-------|---------|
| `sectionAnamnesis` | Patient history |
| `sectionExamFindings` | Examination findings |
| `sectionClinicalAssessment` | Clinical assessment |
| `sectionLabResults` | Lab results |
| `sectionTreatmentRecommendations` | Treatment plan |
| `sectionDoctorNotes` | Doctor's notes |
| `reportTitle` | Report title |
| `reportDateKey` | Report date (text or ISO) |
| `reportDoctorDisplayName` | Signing doctor name |

---

## 7. Admin Panel

> The Admin panel is only accessible to `ADMIN` role. Mobile app should route ADMIN users to a dedicated admin section.

### 7.1 Admin Capabilities

| Feature | Endpoint | Method |
|---------|----------|--------|
| List doctor accounts | `GET /api/admin/requests?status=ALL/PENDING/APPROVED/REJECTED` | GET |
| Approve doctor | `PATCH /api/admin/requests` with `{doctorId, action: "APPROVE"}` | PATCH |
| Reject doctor | `PATCH /api/admin/requests` with `{doctorId, action: "REJECT"}` | PATCH |
| View landing contacts | `GET /api/admin/landing-contacts` | GET |

### 7.2 Doctor Request Object

```json
{
  "id":             "clud123",
  "name":           "Ahmet",
  "surname":        "Yılmaz",
  "email":          "doctor@hospital.com",
  "specialty":      "Oftalmoloji",
  "hospital":       "Ankara Şehir Hastanesi",
  "role":           "DOCTOR",
  "approvalStatus": "PENDING",
  "isActive":       false,
  "createdAt":      "2026-04-28T12:00:00.000Z"
}
```

### 7.3 Admin Filter Options

```
status = "ALL" | "PENDING" | "APPROVED" | "REJECTED"
```

### 7.4 Landing Contact Object

```json
{
  "id":        "contact123",
  "fullName":  "Klinik Yöneticisi",
  "email":     "manager@klinik.com",
  "phone":     "+90 555 123 4567",
  "message":   "Kurumsal lisans hakkında bilgi almak istiyorum",
  "createdAt": "2026-04-27T08:00:00.000Z"
}
```

---

## 8. Calendar / Appointments

### 8.1 Calendar Events

**Endpoint:** `GET /api/doctor/calendar?month=YYYY-MM`  
**Auth:** Bearer Token (web session cookie required — same note as AI endpoint)

#### CalendarEvent Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `id` | string | Auto | UUID |
| `doctorId` | string | Auto | From session |
| `dateKey` | string | ✅ | Format: `YYYY-MM-DD` |
| `time` | string | ✅ | Format: `HH:MM` (24h) |
| `title` | string | ✅ | Event title |
| `note` | string | ✅ | Event notes |
| `createdAt` | DateTime | Auto | |
| `updatedAt` | DateTime | Auto | |

#### Create Event

**Endpoint:** `POST /api/doctor/calendar`

```json
{
  "dateKey": "2026-05-15",
  "time":    "09:30",
  "title":   "Hasta Kontrolü - Fatma Kaya",
  "note":    "DR takip muayenesi"
}
```

> **Conflict Check:** Two events cannot share the same `doctorId + dateKey + time` (HTTP 409 if conflict).

#### Update Event

**Endpoint:** `PATCH /api/doctor/calendar`

```json
{
  "id":    "cal123",
  "title": "Updated Title",
  "note":  "Updated note"
}
```

#### Delete Event

**Endpoint:** `DELETE /api/doctor/calendar`

```json
{
  "id": "cal123"
}
```

### 8.2 Calendar Roles

Only `DOCTOR`, `ASSISTANT`, and `MANAGER` can access calendar features. `AUDITOR` and `ADMIN` cannot.

---

## 9. Data Models

### 9.1 Doctor Model

```
Doctor {
  id               : String  (CUID, PK)
  name             : String
  surname          : String
  email            : String  (UNIQUE)
  password         : String  (bcrypt hash)
  role             : DoctorRole  (DOCTOR|ASSISTANT|MANAGER|AUDITOR|ADMIN)
  isActive         : Boolean  (default: true)
  specialty        : String
  hospital         : String
  approvalStatus   : ApprovalStatus  (PENDING|APPROVED|REJECTED)
  createdAt        : DateTime  (auto)

  // Relations
  patients         : Patient[]
  calendarEvents   : CalendarEvent[]
  settings         : DoctorSettings?
  credentialPolicy : DoctorCredentialPolicy?
}
```

### 9.2 Patient Model

```
Patient {
  id            : String  (CUID, PK)
  doctorId      : String  (FK → Doctor.id, CASCADE DELETE)
  fullName      : String
  tcNo          : String  (11 digits, unique per doctor)
  age           : Int  (0–120)
  gender        : String?  ("Erkek" | "Kadın")
  risk          : String  (default: "Yok"; updated via AI feedback)
  diabetesYears : Int?  (0–80)
  hba1c         : Float?  (3.0–20.0)
  createdAt     : DateTime  (auto)

  // Relations
  analyses      : Analysis[]
  doctor        : Doctor
}
```

### 9.3 Analysis Model

```
Analysis {
  id                         : String  (CUID, PK)
  patientId                  : String  (FK → Patient.id, CASCADE DELETE)
  aiResult                   : String  (DR stage label text)
  confidence                 : Float   (0.0–1.0)
  heatmapUrl                 : String?  (GradCAM image URL)
  originalImage              : String?  (fundus image URL)
  doctorNote                 : String?  (free text OR manual_report_v2 JSON)
  isCorrect                  : Boolean?  (doctor validation flag)
  actualResult               : String?  (doctor's corrected DR label)
  createdAt                  : DateTime  (auto)
  aiOdriLabels               : String?  (JSON array of lesion labels)
  aiOdriConfidences          : String?  (JSON array of per-lesion confidences)
  ilaclar                    : String?  (medications, max 1500 chars)
  drFeedback                 : String?  (doctor DR feedback token/label)
  aiInferenceJson            : Json?    (full structured AI output)
  datasetSchemaVersion       : String   (default: "1")
  drGradeInt                 : Int?     (0–4 integer grade)
  doctorStructuredReview     : Json?    (structured doctor corrections)
  physicianClinicalReasoning : String?  (free text clinical rationale)
  comorbidityJson            : Json?    (HT, dyslipidemia etc.)
  reportDateKey              : String?  (max 32 chars)
  reportDoctorDisplayName    : String?  (max 200 chars)
  reportTitle                : String?  (max 500 chars)
  sectionAnamnesis           : String?
  sectionClinicalAssessment  : String?
  sectionDoctorNotes         : String?
  sectionExamFindings        : String?
  sectionLabResults          : String?
  sectionTreatmentRecommendations : String?
  uncertaintyScore           : Float?   (0–1, model uncertainty)
  ffaImageUrl                : String?  (FFA image URL)
  octImageUrl                : String?  (OCT image URL)
  ffaDrFeedback              : String?  (doctor feedback for FFA)
  octDrFeedback              : String?  (doctor feedback for OCT)
  reportKind                 : AnalysisReportKind?

  // Relations
  patient                    : Patient
  trainingDatasetEntry       : TrainingDatasetEntry?
}
```

### 9.4 CalendarEvent Model

```
CalendarEvent {
  id        : String  (CUID, PK)
  doctorId  : String  (FK → Doctor.id, CASCADE DELETE)
  dateKey   : String  (format: YYYY-MM-DD)
  time      : String  (format: HH:MM)
  title     : String
  note      : String
  createdAt : DateTime  (auto)
  updatedAt : DateTime  (auto)

  // Index: [doctorId, dateKey]
}
```

### 9.5 KvkkConsent Model

```
KvkkConsent {
  id             : String  (PK)
  doctorId       : String
  patientId      : String
  consentGiven   : Boolean  (default: false)
  consentVersion : String   (default: "v1")
  consentAt      : DateTime?
  note           : String?
  createdAt      : DateTime  (auto)
  updatedAt      : DateTime  (auto)

  // Unique: [doctorId, patientId]
}
```

### 9.6 AuditLog Model

```
AuditLog {
  id          : String  (PK, UUID)
  doctorId    : String
  role        : String
  action      : String  ("CREATE"|"UPDATE"|"DELETE"|"VIEW"|"mobile_login"|...)
  entityType  : String  ("PATIENT"|"ANALYSIS"|"doctor"|...)
  entityId    : String?
  description : String?
  metadata    : Json?
  createdAt   : DateTime  (auto)
}
```

### 9.7 Enums

```
DoctorRole      = DOCTOR | ASSISTANT | MANAGER | AUDITOR | ADMIN
ApprovalStatus  = PENDING | APPROVED | REJECTED
AnalysisReportKind = CLINICAL | RADIOLOGICAL  (inferred from reportKind field)
```

### 9.8 DoctorSettings JSON Structure

Stored in `DoctorSettings.settings` as JSON:

```json
{
  "doctor": {
    "fullName":      "Dr. Ahmet Yılmaz",
    "branch":        "Göz Hastalıkları",
    "licenseNo":     "TR-12345",
    "contactPhone":  "+90 555 000 0000",
    "signatureName": "Dr. A. Yılmaz"
  },
  "clinic": {
    "clinicName":    "Retina Analiz Merkezi",
    "address":       "...",
    "reportHeader":  "RETINA ANALİZ RAPORU"
  },
  "report": {
    "includeDoctorNotes": true,
    "includeHeatmap":     true,
    "includeMedications": true,
    "autoOpenPreview":    true,
    "compactPdf":         true
  },
  "triage": {
    "highRiskFollowupDays":   2,
    "mediumRiskFollowupDays": 14,
    "lowRiskFollowupDays":    120,
    "aiConfidenceThreshold":  0.7
  },
  "notifications": {
    "criticalCaseAlert": true,
    "followupReminder":  true
  },
  "appearance": {
    "darkMode": false
  }
}
```

---

## 10. API Structure

### 10.1 Mobile API Endpoints (v1)

> **Base URL:** `https://<domain>/api/mobile/v1`  
> **Auth:** All endpoints except `auth/login` require `Authorization: Bearer <token>`

#### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/login` | Doctor login, returns token | ❌ |
| `POST` | `/auth/verify` | Verify token validity | ✅ |

#### Patients

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/patients` | List all patients (`?since=ISO8601`) | ✅ |
| `POST` | `/patients` | Create patient OR batch sync | ✅ |
| `GET` | `/patients/{id}` | Get patient detail with analyses | ✅ |
| `PATCH` | `/patients/{id}` | Update patient fields | ✅ |
| `DELETE` | `/patients/{id}` | Delete patient (cascades analyses) | ✅ |

#### Analyses

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/analyses` | List analyses (`?patientId=&since=`) | ✅ |
| `POST` | `/analyses` | Create analysis OR batch sync | ✅ |
| `GET` | `/analyses/{id}` | Get analysis detail | ✅ |
| `PATCH` | `/analyses/{id}` | Update doctor note/feedback | ✅ |
| `DELETE` | `/analyses/{id}` | Delete analysis | ✅ |

#### Sync

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/sync` | Full offline batch sync (patients + analyses) | ✅ |
| `GET` | `/sync` | Get sync status | ✅ |

---

### 10.2 Web API Endpoints Used by Mobile

> These are web session-based endpoints. For mobile, use the session cookie approach or implement mobile equivalents.

#### Auth (Web)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/doctor/login` | Web login (sets cookie) |
| `POST` | `/api/doctor/logout` | Web logout (clears cookie) |
| `GET` | `/api/doctor/session` | Get current session info |
| `POST` | `/api/doctor/public-register` | Self-registration (PENDING approval) |
| `POST` | `/api/doctor/register` | Register new doctor (MANAGER only) |
| `POST` | `/api/doctor/password/reset-temp` | Reset temporary password |

#### Doctor

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/doctor/profile` | Get doctor profile + settings |
| `PATCH` | `/api/doctor/profile` | Update profile (with verification) |
| `GET` | `/api/doctor/settings` | Get doctor settings |
| `PATCH` | `/api/doctor/settings` | Update settings |
| `GET` | `/api/doctor/calendar?month=YYYY-MM` | List calendar events |
| `POST` | `/api/doctor/calendar` | Create calendar event |
| `PATCH` | `/api/doctor/calendar` | Update calendar event |
| `DELETE` | `/api/doctor/calendar` | Delete calendar event |

#### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/predict` | Fundus AI analysis (multipart) |
| `POST` | `/api/ai/predict-ffa` | FFA AI analysis (multipart) |
| `POST` | `/api/ai/predict-oct` | OCT AI analysis (multipart) |
| `GET` | `/api/ai/queue` | Check queued AI request status |

#### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/requests?status=` | List doctor accounts |
| `PATCH` | `/api/admin/requests` | Approve/reject doctor |
| `GET` | `/api/admin/landing-contacts` | View landing contact submissions |

---

### 10.3 Request/Response Conventions

#### Headers

```
Content-Type:  application/json
Authorization: Bearer <token>
x-request-id:  <uuid>  (optional but recommended for tracing)
```

#### Standard Success Response

```json
{
  "success":   true,
  "data":      { ... },
  "timestamp": "2026-04-29T10:00:00.000Z"
}
```

#### Standard Error Response

```json
{
  "success": false,
  "error":   "Hata açıklaması"
}
```

#### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (account inactive, wrong role) |
| 404 | Not Found |
| 409 | Conflict (duplicate TC No, time slot conflict) |
| 429 | Rate Limited (login lockout) |
| 500 | Server Error |
| 503 | Service Unavailable (AI service down) |

---

## 11. Mobile App Screen Map & Navigation

### 11.1 Unauthenticated Screens

```
SplashScreen
├── LoginScreen
│   └── ForgotPassword → ResetPasswordScreen
├── DoctorRegisterScreen  (public self-registration)
│   └── PendingApprovalScreen
└── (ResetPasswordScreen — for temp password flow)
```

### 11.2 Authenticated Navigation

Bottom Navigation Bar (role-dependent):

```
[DOCTOR / ASSISTANT / MANAGER / AUDITOR]
┌──────────────────────────────────────────┐
│  🏠 Anasayfa │ 👥 Hastalar │ 🔬 Analiz  │
│  📋 Raporlar │ 👤 Profil               │
└──────────────────────────────────────────┘

[ADMIN]
┌──────────────────────────────────────────┐
│  🛡️ Admin Panel │ 👤 Profil             │
└──────────────────────────────────────────┘
```

### 11.3 Full Screen Map

```
App
├── Auth
│   ├── LoginScreen
│   ├── DoctorRegisterScreen
│   ├── PendingApprovalScreen
│   └── ResetPasswordScreen
│
├── Dashboard (Bottom Tab: Anasayfa)
│   └── DashboardHomeScreen
│       ├── MetricCards (totalPatients, totalAnalyses, highRisk)
│       ├── HighRiskPatientList → PatientDetailScreen
│       └── RecentPatientList → PatientDetailScreen
│
├── Patients (Bottom Tab: Hastalar) [DOCTOR, ASSISTANT, MANAGER]
│   ├── PatientListScreen
│   │   ├── SearchBar
│   │   ├── FilterSheet (by risk)
│   │   └── PatientListTile → PatientDetailScreen
│   ├── NewPatientScreen (FAB button)
│   └── PatientDetailScreen
│       ├── Tab: Rapor Oluştur → CreateClinicalReportScreen
│       ├── Tab: AI Analiz → AIAnalysisScreen
│       │   ├── ImagePickerCard (Fundus / FFA / OCT)
│       │   ├── AnalysisResultCard
│       │   │   ├── DRGradeWidget
│       │   │   ├── ConfidenceBar
│       │   │   ├── HeatmapImage
│       │   │   └── DoctorFeedbackForm
│       │   └── MedicationInput
│       ├── Tab: Raporlar → ReportListScreen
│       ├── Tab: Radyolojik Raporlar → RadiologicalReportListScreen
│       └── Tab: İlerleme → ProgressionChartScreen
│
├── Analysis (Bottom Tab: Analiz) [DOCTOR, ASSISTANT, MANAGER]
│   └── AIAnalysisScreen (standalone — select patient first)
│
├── Reports (Bottom Tab: Raporlar) [DOCTOR, ASSISTANT, MANAGER, AUDITOR]
│   ├── ReportsListScreen (patients with reports)
│   └── PatientReportDetailScreen
│       ├── ClinicalReportCard
│       └── RadiologicalReportCard
│
├── Calendar (accessible from Profile/more) [DOCTOR, ASSISTANT, MANAGER]
│   ├── CalendarScreen (monthly view)
│   └── EventDetailSheet
│       ├── CreateEventForm
│       └── EditEventForm
│
├── History (accessible from more) [DOCTOR, ASSISTANT, MANAGER, AUDITOR]
│   └── AnalysisHistoryScreen
│       ├── SearchBar
│       ├── FilterSheet
│       └── AnalysisHistoryTile → AnalysisDetailScreen
│
├── KVKK (accessible from more) [DOCTOR, MANAGER, AUDITOR]
│   └── KVKKComplianceScreen
│       ├── ConsentRecordsList
│       └── ProcessingLogsList
│
├── Profile (Bottom Tab: Profil)
│   ├── ProfileInfoScreen (view/edit doctor profile)
│   ├── AppSettingsScreen [DOCTOR, MANAGER]
│   │   ├── ReportSettingsSection
│   │   ├── TriageSettingsSection
│   │   └── NotificationSettingsSection
│   ├── LogoutButton
│   └── (MANAGER only) ManageDoctorsScreen
│
└── Admin (Bottom Tab: Admin Panel) [ADMIN only]
    ├── DoctorRequestsScreen
    │   ├── FilterTabs (PENDING / APPROVED / REJECTED / ALL)
    │   └── DoctorRequestCard (Approve / Reject buttons)
    └── LandingContactsScreen
```

### 11.4 Role-Based Bottom Navigation

| Tab | Visible to |
|-----|-----------|
| Anasayfa | All (except ADMIN) |
| Hastalar | DOCTOR, ASSISTANT, MANAGER |
| Analiz | DOCTOR, ASSISTANT, MANAGER |
| Raporlar | DOCTOR, ASSISTANT, MANAGER, AUDITOR |
| Profil | All |
| Admin Panel | ADMIN only |

---

## 12. UX Rules

### 12.1 Must Remain Consistent with Web

| Item | Web Behavior | Mobile Behavior |
|------|-------------|----------------|
| DR Stage Labels | TR: `Evre N (...)` / EN: `Stage N (...)` | Same labels — no custom labels |
| Risk Colors | Green→Yellow→Orange→Red (0→4) | Same color scheme |
| TC No Format | 11 digits, numeric only, masked display | Same validation + last-4-digit masking |
| KVKK Consent | Tracked per doctorId+patientId | Same tracking required |
| Audit Logging | All actions logged to `AuditLog` | Log via API (mobile_login already implemented) |
| Language | TR (default) + EN toggle | Implement both TR and EN |
| Confidence Threshold | 0.7 (from settings) | Respect `triage.aiConfidenceThreshold` |
| Follow-up Days | High: 2d, Medium: 14d, Low: 120d | Show follow-up indicators accordingly |

### 12.2 Mobile-Specific Optimizations

| Feature | Recommendation |
|---------|---------------|
| Patient List | Virtual scrolling (lazy load 20 at a time) |
| Image Upload | Compress images before upload (max 2MB recommended) |
| Heatmap Display | Pinch-to-zoom support |
| Calendar | Native calendar picker for date selection |
| PDF Reports | Open in-app WebView or native PDF viewer |
| Offline Mode | SQLite local cache with sync indicators |
| Search | Debounce 300ms before firing search |
| Pull-to-Refresh | On all list screens |
| Biometrics | Offer Face ID / Fingerprint after first login |

### 12.3 Error Handling & Empty States

| State | Display |
|-------|---------|
| No patients | Empty illustration + "Yeni hasta ekle" CTA |
| No analyses | "Henüz analiz yapılmamış" message |
| Network error | Snackbar + "Yeniden dene" button |
| 429 Rate Limit | Countdown timer showing lockout remaining time |
| AI queue | Progress indicator + "Analiz kuyruğa alındı" message |
| Pending approval | Full-screen status card with admin contact info |

---

## 13. Security & Privacy

### 13.1 Token Storage

```
Package:    flutter_secure_storage
iOS:        Keychain
Android:    EncryptedSharedPreferences
Key:        "doctor_session_token"
```

> **Never** store the token in SharedPreferences, local files, or SQLite unencrypted.

### 13.2 Authentication Flow

```
App Start
    ↓
Read token from SecureStorage
    ↓
POST /api/mobile/v1/auth/verify
    ↓
valid=true?  ──→ Navigate to Dashboard
valid=false? ──→ Clear token → Navigate to Login
```

### 13.3 Sensitive Data Handling

| Data | Handling |
|------|---------|
| TC No | Mask on display: `*******1234` |
| Doctor password | Never stored or logged in mobile |
| Patient images | Fetch from signed URLs; do not cache to unencrypted storage |
| Heatmap images | Cache in-memory only during session |
| Doctor token | Secure storage only |
| HbA1c / Clinical data | Display only within authenticated session |

### 13.4 HTTPS Enforcement

- All API calls must use HTTPS in production.
- Implement **certificate pinning** for production builds.
- Do not allow HTTP fallback.

### 13.5 KVKK / GDPR Compliance

The web backend has a full KVKK compliance module. The mobile app must:

| Requirement | Implementation |
|-------------|---------------|
| Explicit consent display | Show KVKK notice before first patient data access |
| Consent version tracking | `KvkkConsent.consentVersion` (default: `"v1"`) |
| Data minimization | Only request permissions needed (camera, storage) |
| Audit trail | All data operations create `AuditLog` entries server-side |
| Anonymization | Accessible via KVKK screen (DOCTOR, MANAGER, AUDITOR) |
| Right to erasure | Doctor can delete patient records (cascades analyses) |

### 13.6 Input Security

| Attack Vector | Mitigation |
|--------------|------------|
| SQL Injection | All DB access via Prisma ORM (parameterized) |
| XSS | N/A for mobile; sanitize any WebView content |
| Token Theft | Secure storage, no clipboard logging |
| Man-in-the-Middle | HTTPS + certificate pinning |
| Brute Force | Server-side rate limiting (5 attempts / 5 min window) |
| Unauthorized Access | All endpoints verify token + doctor ownership |

### 13.7 Doctor Ownership Enforcement

Every API call verifies:
1. Token is valid (HMAC signature).
2. The doctor's account is `isActive = true`.
3. The requested patient/analysis belongs to `session.doctorId`.

```
// Example verification in every patient endpoint:
WHERE patient.doctorId = session.id AND patient.id = requestedId
```

---

## 14. Offline-First Architecture

### 14.1 Local SQLite Schema (Recommended)

```sql
CREATE TABLE patients (
  id            TEXT PRIMARY KEY,
  server_id     TEXT,
  doctor_id     TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  tc_no         TEXT NOT NULL,
  age           INTEGER NOT NULL,
  gender        TEXT,
  risk          TEXT DEFAULT 'Yok',
  diabetes_years INTEGER,
  hba1c         REAL,
  created_at    TEXT NOT NULL,
  is_synced     INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0,
  updated_at    TEXT
);

CREATE TABLE analyses (
  id            TEXT PRIMARY KEY,
  server_id     TEXT,
  patient_id    TEXT NOT NULL,
  ai_result     TEXT NOT NULL,
  confidence    REAL,
  heatmap_url   TEXT,
  original_image TEXT,
  doctor_note   TEXT,
  is_correct    INTEGER,
  actual_result TEXT,
  dr_grade_int  INTEGER,
  dr_feedback   TEXT,
  created_at    TEXT NOT NULL,
  is_synced     INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0,
  updated_at    TEXT
);

CREATE TABLE sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- Store: last_sync_patients, last_sync_analyses
```

### 14.2 Offline ID Generation

```dart
// Dart example
String generateOfflineId() => 'offline_${const Uuid().v4()}';
```

### 14.3 Sync Strategy

```
Background sync interval: every 5 minutes when online

Full Sync Flow (POST /api/mobile/v1/sync):
1. Collect all local records where is_synced = 0
2. Send to /sync endpoint
3. Receive server_id mappings
4. Update local SQLite: set server_id, is_synced = 1
5. Fetch new records from server: GET /patients?since=<last_sync>
6. Update last_sync_timestamp in sync_meta

Conflict Resolution:
- Server is source of truth for existing records
- Offline-created records (offline_ prefix) always create new server records
```

### 14.4 Sync Endpoint Request

**Endpoint:** `POST /api/mobile/v1/sync`

```json
{
  "patients": [
    {
      "id":       "offline_abc123",
      "fullName": "Yeni Hasta",
      "tcNo":     "11122233344",
      "age":       40,
      "gender":   "Erkek"
    }
  ],
  "analyses": [
    {
      "id":        "offline_def456",
      "patientId": "offline_abc123",
      "aiResult":  "Evre 1 (Hafif - Mild NPDR)",
      "confidence": 0.78
    }
  ],
  "syncTimestamp": "2026-04-29T09:00:00.000Z"
}
```

### 14.5 Sync Response

```json
{
  "success":  true,
  "syncedAt": "2026-04-29T09:00:05.000Z",
  "results": {
    "patients": {
      "created": 1,
      "updated": 0,
      "failed":  0,
      "mapping": {
        "offline_abc123": "clu_server_id_1"
      }
    },
    "analyses": {
      "created": 1,
      "updated": 0,
      "failed":  0,
      "mapping": {
        "offline_def456": "clu_server_id_2"
      }
    }
  }
}
```

---

## Appendix A: Environment Variables Required

```env
DATABASE_URL     = postgresql://user:pass@host:5432/db
SESSION_SECRET   = <min 32 char random string>
NODE_ENV         = production
AI_SERVICE_URL   = http://ai-service:8000
CORS_ORIGIN      = https://your-mobile-api-domain.com
```

---

## Appendix B: Flutter Package Recommendations

| Purpose | Package |
|---------|---------|
| Secure Storage | `flutter_secure_storage` |
| Local DB | `sqflite` or `drift` |
| HTTP Client | `dio` with interceptors |
| Image Picker | `image_picker` |
| PDF Viewer | `flutter_pdfview` or `syncfusion_flutter_pdfviewer` |
| Calendar UI | `table_calendar` |
| Chart (DR progression) | `fl_chart` |
| UUID generation | `uuid` |
| Connectivity | `connectivity_plus` |
| State Management | `riverpod` or `bloc` |
| i18n | `flutter_localizations` + `intl` |

---

## Appendix C: DR Stage Quick Reference

| Grade | Label (TR) | Label (EN) | Risk | Follow-up |
|-------|-----------|-----------|------|-----------|
| 0 | Evre 0 (Sağlıklı - No DR) | Stage 0 (Healthy - No DR) | None | 120 days |
| 1 | Evre 1 (Hafif - Mild NPDR) | Stage 1 (Mild NPDR) | Low | 120 days |
| 2 | Evre 2 (Orta - Moderate NPDR) | Stage 2 (Moderate NPDR) | Medium | 14 days |
| 3 | Evre 3 (Şiddetli - Severe NPDR) | Stage 3 (Severe NPDR) | High | 2 days |
| 4 | Evre 4 (Proliferatif - PDR) | Stage 4 (Proliferative PDR) | Critical | 2 days |

---

*This specification was extracted directly from the RetinaAI Klinik web application source code (Prisma schema, Next.js API routes, React components, and TypeScript type definitions). All field names, validations, and API contracts reflect the production codebase as of April 29, 2026.*
