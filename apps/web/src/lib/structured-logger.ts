type LogLevel = "info" | "warn" | "error";

type StructuredLogInput = {
  level: LogLevel;
  message: string;
  requestId?: string;
  route?: string;
  doctorId?: string | null;
  metadata?: Record<string, unknown>;
  error?: unknown;
};

function readLogLevel() {
  return (process.env.LOG_LEVEL || "info").trim().toLowerCase();
}

function shouldWrite(level: LogLevel) {
  const current = readLogLevel();
  const priority: Record<LogLevel, number> = { info: 1, warn: 2, error: 3 };
  const currentLevel = (
    current === "warn" || current === "error" ? current : "info"
  ) as LogLevel;
  return priority[level] >= priority[currentLevel];
}

function normalizeError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { value: String(error) };
}

async function sendToCentralLog(entry: Record<string, unknown>) {
  const endpoint = (process.env.LOG_INGEST_URL || "").trim();
  if (!endpoint) return;

  const token = (process.env.LOG_INGEST_TOKEN || "").trim();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(entry),
      cache: "no-store",
    });
  } catch {
    // Merkezi log toplayiciya ulasilamasa da ana akis devam etsin.
  }
}

export function getRequestId(request: Request) {
  const incoming = (request.headers.get("x-request-id") || "").trim();
  return incoming || crypto.randomUUID();
}

export function requestIdHeaders(requestId: string) {
  return {
    "x-request-id": requestId,
  };
}

export function logStructured(input: StructuredLogInput) {
  if (!shouldWrite(input.level)) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level: input.level,
    message: input.message,
    requestId: input.requestId || null,
    route: input.route || null,
    doctorId: input.doctorId || null,
    metadata: input.metadata || {},
    error: normalizeError(input.error),
  };

  const payload = JSON.stringify(entry);

  if (input.level === "error") {
    console.error(payload);
  } else if (input.level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }

  void sendToCentralLog(entry);
}

export function logInfo(input: Omit<StructuredLogInput, "level">) {
  logStructured({ ...input, level: "info" });
}

export function logWarn(input: Omit<StructuredLogInput, "level">) {
  logStructured({ ...input, level: "warn" });
}

export function logError(input: Omit<StructuredLogInput, "level">) {
  logStructured({ ...input, level: "error" });
}
