"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Settings,
  UserRound,
  ShieldCheck,
  PlugZap,
  Siren,
  FlaskConical,
  ChevronDown,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { DoctorRole, isRoleAllowed } from "@/lib/roles";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const menuItems: Array<{
  href: string;
  label: string;
  icon: any;
  roles: DoctorRole[];
}> = [
  {
    href: "/dashboard",
    label: "Panel",
    icon: LayoutDashboard,
    roles: ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR"],
  },
  {
    href: "/dashboard/hastalar",
    label: "Hasta Kayıtları",
    icon: Users,
    roles: ["DOCTOR", "ASSISTANT", "MANAGER"],
  },
  {
    href: "/dashboard/raporlar",
    label: "Hasta Raporları",
    icon: FileText,
    roles: ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR"],
  },
  {
    href: "/dashboard/takvim",
    label: "Takvim",
    icon: CalendarDays,
    roles: ["DOCTOR", "ASSISTANT", "MANAGER"],
  },
  {
    href: "/dashboard/entegrasyonlar",
    label: "Klinik Entegrasyon",
    icon: PlugZap,
    roles: ["DOCTOR", "MANAGER"],
  },
  {
    href: "/dashboard/izleme",
    label: "İzleme ve Alarm",
    icon: Siren,
    roles: ["MANAGER", "AUDITOR"],
  },
  {
    href: "/dashboard/pilot-metrikleri",
    label: "Pilot Metrikleri",
    icon: FlaskConical,
    roles: ["DOCTOR", "MANAGER", "AUDITOR"],
  },
];

const settingsSubItems: Array<{
  href: string;
  label: string;
  icon: any;
  roles: DoctorRole[];
}> = [
  {
    href: "/dashboard/ayarlar",
    label: "Sistem Ayarları",
    icon: Settings,
    roles: ["DOCTOR", "MANAGER"],
  },
  {
    href: "/dashboard/profil-bilgileri",
    label: "Profil Bilgileri",
    icon: UserRound,
    roles: ["DOCTOR", "ASSISTANT", "MANAGER", "AUDITOR"],
  },
  {
    href: "/dashboard/kvkk",
    label: "KVKK Uyum",
    icon: ShieldCheck,
    roles: ["DOCTOR", "MANAGER", "AUDITOR"],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<DoctorRole>("DOCTOR");

  useEffect(() => {
    const loadSessionRole = async () => {
      try {
        const res = await fetch("/api/doctor/session", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as {
          doctor?: {
            role?: DoctorRole;
          };
        };

        if (data.doctor?.role) {
          setRole(data.doctor.role);
        }
      } catch {
        // Varsayilan rol ile devam.
      }
    };

    void loadSessionRole();
  }, []);

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => isRoleAllowed(role, item.roles)),
    [role],
  );

  const visibleSettingsSubItems = useMemo(
    () => settingsSubItems.filter((item) => isRoleAllowed(role, item.roles)),
    [role],
  );

  const hasSettingsSection = visibleSettingsSubItems.length > 0;
  const settingsIsActive = visibleSettingsSubItems.some((item) =>
    pathname.startsWith(item.href),
  );

  return (
    <SidebarMenu className="gap-3">
      {visibleMenuItems.map((item) => {
        const isActive =
          pathname.startsWith(item.href) &&
          (item.href !== "/dashboard" || pathname === "/dashboard");

        return (
          <Fragment key={item.href}>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className={`
    relative group flex items-center h-12 px-4 rounded-xl
    ${
      isActive
        ? "border border-[var(--retina-border)] bg-[#edf5ff] text-[var(--retina-primary-deep)]"
        : "text-[#5f7482] hover:bg-[#f2f7ff] hover:text-[var(--retina-primary-deep)]"
    }
  `}
              >
                <Link
                  href={item.href}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={`h-5 w-5 ${
                        isActive
                          ? "text-[var(--retina-primary)]"
                          : "text-[#7f98a6] group-hover:text-[var(--retina-primary)]"
                      }`}
                    />
                    <span className="font-semibold tracking-wide text-[14px]">
                      {item.label}
                    </span>
                  </div>
                  {isActive && (
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--retina-accent)]" />
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {item.href === "/dashboard/takvim" && hasSettingsSection ? (
              <SidebarMenuItem key="settings-section">
                <Collapsible
                  defaultOpen={settingsIsActive}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={`
    relative group flex items-center h-12 px-4 rounded-xl
    ${
      settingsIsActive
        ? "border border-[var(--retina-border)] bg-[#edf5ff] text-[var(--retina-primary-deep)]"
        : "text-[#5f7482] hover:bg-[#f2f7ff] hover:text-[var(--retina-primary-deep)]"
    }
  `}
                    >
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Settings
                            className={`h-5 w-5 ${
                              settingsIsActive
                                ? "text-[var(--retina-primary)]"
                                : "text-[#7f98a6] group-hover:text-[var(--retina-primary)]"
                            }`}
                          />
                          <span className="font-semibold tracking-wide text-[14px]">
                            Ayarlar
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </div>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleSettingsSubItems.map((subItem) => {
                        const isSubActive = pathname.startsWith(subItem.href);
                        return (
                          <SidebarMenuSubItem key={subItem.href}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isSubActive}
                            >
                              <Link href={subItem.href}>
                                <subItem.icon className="h-4 w-4" />
                                <span>{subItem.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            ) : null}
          </Fragment>
        );
      })}
    </SidebarMenu>
  );
}
