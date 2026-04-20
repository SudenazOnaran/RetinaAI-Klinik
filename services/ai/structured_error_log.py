"""Yalnızca hata olayları için tek satırlık JSON log (stdout değil, stderr)."""

from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def resolve_request_id(request_headers) -> str:
    """Flask request.headers: önce gelen x-request-id, yoksa yeni UUID."""
    rid = (
        request_headers.get("X-Request-Id")
        or request_headers.get("x-request-id")
        or ""
    ).strip()
    if rid:
        return rid
    return str(uuid.uuid4())


def log_structured_error(
    *,
    request_id: str,
    route: str,
    action: str,
    error_message: str,
    stack: str | None = None,
    cause: str | None = None,
    patient_id: str | None = None,
    analysis_id: str | None = None,
    digest: str | None = None,
    ai_response_summary: str | None = None,
    payload_summary: str | None = None,
    service: str = "flask",
) -> None:
    payload: dict[str, Any] = {
        "timestamp": utc_now_iso(),
        "requestId": request_id,
        "service": service,
        "route": route,
        "action": action,
        "errorMessage": error_message,
    }
    if stack is not None:
        payload["stack"] = stack
    if cause is not None:
        payload["cause"] = cause
    if patient_id is not None:
        payload["patientId"] = patient_id
    if analysis_id is not None:
        payload["analysisId"] = analysis_id
    if digest is not None:
        payload["digest"] = digest
    if ai_response_summary is not None:
        payload["aiResponseSummary"] = ai_response_summary
    if payload_summary is not None:
        payload["payloadSummary"] = payload_summary

    print(json.dumps(payload, ensure_ascii=False), file=sys.stderr, flush=True)
