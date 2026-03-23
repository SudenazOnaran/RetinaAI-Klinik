export type DeploymentProfile = "ON_PREM" | "VPC" | "CLOUD";

export type SlaProfile = {
  uptimeTargetPercent: number;
  p1ResponseMinutes: number;
  p1ResolutionHours: number;
  p2ResponseHours: number;
  backupFrequencyHours: number;
  rpoHours: number;
  rtoHours: number;
};

type DeploymentSlaResponse = {
  profile: DeploymentProfile;
  profileLabel: string;
  networkIsolation: string;
  notes: string;
  sla: SlaProfile;
};

function asNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDeploymentProfile(): DeploymentSlaResponse {
  const rawProfile = String(process.env.DEPLOYMENT_PROFILE || "ON_PREM")
    .trim()
    .toUpperCase();

  const profile: DeploymentProfile =
    rawProfile === "VPC" || rawProfile === "CLOUD" ? rawProfile : "ON_PREM";

  const profileMeta: Record<
    DeploymentProfile,
    Omit<DeploymentSlaResponse, "sla">
  > = {
    ON_PREM: {
      profile: "ON_PREM",
      profileLabel: "On-Premise",
      networkIsolation: "Klinik ic ag, internet cikisi kontrollu",
      notes: "Veri merkezinde kurum kontrolu, lokal yedekleme zorunlu.",
    },
    VPC: {
      profile: "VPC",
      profileLabel: "VPC",
      networkIsolation: "Ozel subnet + security group + private DB",
      notes: "Bulutta izole ag, private endpoint ve WAF onerilir.",
    },
    CLOUD: {
      profile: "CLOUD",
      profileLabel: "Public Cloud",
      networkIsolation: "Yonetilen servisler, edge WAF ve IAM zorunlu",
      notes: "Paylasimli altyapi, sik IAM ve sifre yonetimi gerektirir.",
    },
  };

  const sla: SlaProfile = {
    uptimeTargetPercent: asNumber(process.env.SLA_UPTIME_TARGET_PERCENT, 99.5),
    p1ResponseMinutes: asNumber(process.env.SLA_P1_RESPONSE_MINUTES, 15),
    p1ResolutionHours: asNumber(process.env.SLA_P1_RESOLUTION_HOURS, 4),
    p2ResponseHours: asNumber(process.env.SLA_P2_RESPONSE_HOURS, 4),
    backupFrequencyHours: asNumber(process.env.SLA_BACKUP_FREQUENCY_HOURS, 24),
    rpoHours: asNumber(process.env.SLA_RPO_HOURS, 24),
    rtoHours: asNumber(process.env.SLA_RTO_HOURS, 8),
  };

  return {
    ...profileMeta[profile],
    sla,
  };
}
