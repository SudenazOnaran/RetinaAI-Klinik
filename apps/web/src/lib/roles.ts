export const DOCTOR_ROLES = [
  "DOCTOR",
  "ASSISTANT",
  "MANAGER",
  "AUDITOR",
  "ADMIN",
] as const;

export type DoctorRole = (typeof DOCTOR_ROLES)[number];

export function normalizeDoctorRole(
  value: string | null | undefined,
): DoctorRole {
  const candidate = String(value || "")
    .trim()
    .toUpperCase();
  if ((DOCTOR_ROLES as readonly string[]).includes(candidate)) {
    return candidate as DoctorRole;
  }
  return "DOCTOR";
}

export function isRoleAllowed(
  role: DoctorRole,
  allowedRoles: readonly DoctorRole[],
): boolean {
  return allowedRoles.includes(role);
}

const ADMIN_PATH_RULES: Array<{
  prefix: string;
  roles: readonly DoctorRole[];
}> = [
  {
    prefix: "/admin",
    roles: ["ADMIN"],
  },
];

export function canAccessAdminPath(
  role: DoctorRole,
  pathname: string,
): boolean {
  const matchedRule = ADMIN_PATH_RULES.find((rule) =>
    pathname.startsWith(rule.prefix),
  );
  if (!matchedRule) return true;
  return isRoleAllowed(role, matchedRule.roles);
}

const DASHBOARD_PATH_RULES: Array<{
  prefix: string;
  roles: readonly DoctorRole[];
}> = [
  {
    prefix: "/dashboard/ayarlar",
    roles: ["DOCTOR", "MANAGER"],
  },
  {
    prefix: "/dashboard/profil-bilgileri",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR"],
  },
  {
    prefix: "/dashboard/hastalar",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER"],
  },
  {
    prefix: "/dashboard/analiz",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER"],
  },
  {
    prefix: "/dashboard/raporlar",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR"],
  },
  {
    prefix: "/dashboard/on-segment-analiz",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER"],
  },
  {
    prefix: "/dashboard/gecmis",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR"],
  },
  {
    prefix: "/dashboard/takvim",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER"],
  },
  {
    prefix: "/dashboard/izleme",
    roles: ["MANAGER", "AUDITOR"],
  },
  {
    prefix: "/dashboard/pilot-metrikleri",
    roles: ["DOCTOR", "MANAGER", "AUDITOR"],
  },
  {
    prefix: "/dashboard",
    roles: ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR"],
  },
];

export function canAccessDashboardPath(
  role: DoctorRole,
  pathname: string,
): boolean {
  const matchedRule = DASHBOARD_PATH_RULES.find((rule) =>
    pathname.startsWith(rule.prefix),
  );

  if (!matchedRule) {
    return true;
  }

  return isRoleAllowed(role, matchedRule.roles);
}
