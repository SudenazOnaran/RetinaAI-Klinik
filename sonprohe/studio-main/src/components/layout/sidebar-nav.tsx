"use client";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Settings,
  UserRound,
  ChevronRight,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/dashboard/hastalar", label: "Hasta Kayıtları", icon: Users },
  {
    href: "/dashboard/profil-bilgileri",
    label: "Profil Bilgileri",
    icon: UserRound,
  },
  { href: "/dashboard/ayarlar", label: "Sistem Ayarları", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu className="gap-3">
      {menuItems.map((item) => {
        const isActive =
          pathname.startsWith(item.href) &&
          (item.href !== "/dashboard" || pathname === "/dashboard");

        return (
          <SidebarMenuItem key={item.href}>
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
        );
      })}
    </SidebarMenu>
  );
}
