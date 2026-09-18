"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { IconButton } from "@/components/ui";

import { Sidebar, type SidebarDataProps } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme";

import styles from "./shell.module.css";

export interface AppShellProps extends SidebarDataProps {
  readonly children: ReactNode;
}

export function AppShell({ children, ...sidebarProps }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenu, setMobileMenu] = useState<{
    readonly open: boolean;
    readonly pathname: string | null;
  }>({ open: false, pathname: null });
  const [collapsed, setCollapsed] = useState(false);
  const mobileOpen = mobileMenu.open && mobileMenu.pathname === pathname;

  function openMobileMenu() {
    setMobileMenu({ open: true, pathname });
  }

  function closeMobileMenu() {
    setMobileMenu({ open: false, pathname });
  }

  return (
    <div
      className={styles.appShell}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <Sidebar
        {...sidebarProps}
        isCollapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileMenu}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
      />

      {mobileOpen ? (
        <button
          aria-label="Cerrar menú"
          className={styles.mobileBackdrop}
          onClick={closeMobileMenu}
          type="button"
        />
      ) : null}

      <div className={styles.mainArea}>
        <header className={styles.mobileBar}>
          <div className={styles.mobileBarLeading}>
            <IconButton
              aria-controls="ritmo-sidebar"
              aria-expanded={mobileOpen}
              label="Abrir menú"
              onClick={openMobileMenu}
            >
              <Menu aria-hidden="true" size={19} />
            </IconButton>
            <span className={styles.mobileBarTitle}>Ritmo</span>
          </div>
          <div className={styles.mobileBarTrailing}>
            <ThemeToggle />
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
