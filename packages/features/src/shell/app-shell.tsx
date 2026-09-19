import {
  startTransition,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { LifecyclePort, NavigationPort } from "@ritmo/platform";
import { Icon, IconButton, ThemeToggle } from "@ritmo/ui";

import { Sidebar, type SidebarProps } from "./sidebar";

export interface AppShellProps extends Omit<
  SidebarProps,
  "collapsed" | "mobileOpen" | "onCloseMobile" | "onToggleCollapsed"
> {
  readonly children: ReactNode;
  readonly lifecycle: LifecyclePort;
  readonly navigation: NavigationPort;
}

export function AppShell({
  children,
  lifecycle,
  navigation,
  ...sidebarProps
}: AppShellProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState<{
    readonly open: boolean;
    readonly pathname: string;
  }>({ open: false, pathname: "" });
  const mobileOpen = drawer.open && drawer.pathname === location.pathname;

  useEffect(() => {
    if (!drawer.open || drawer.pathname === location.pathname) return;
    startTransition(() => {
      setDrawer({ open: false, pathname: location.pathname });
    });
  }, [drawer.open, drawer.pathname, location.pathname]);

  useEffect(() => {
    const stopDrawer = lifecycle.subscribe(
      (event) => {
        if (event !== "back-requested" || !mobileOpen) return "continue";
        setDrawer({ open: false, pathname: location.pathname });
        return "handled";
      },
      { priority: 50 },
    );
    const stopNavigation = lifecycle.subscribe((event) => {
      if (event !== "back-requested") return;
      const current = navigation.current().split("?")[0];
      if (current !== "/" && current !== "/hoy") {
        navigation.back();
        return "handled";
      }
      return "continue";
    });
    return () => {
      stopNavigation();
      stopDrawer();
    };
  }, [lifecycle, location.pathname, mobileOpen, navigation]);

  const closeDrawer = useCallback(() => {
    setDrawer({ open: false, pathname: location.pathname });
  }, [location.pathname]);

  return (
    <div className="app-shell" data-collapsed={collapsed || undefined}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <Sidebar
        {...sidebarProps}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeDrawer}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
      />
      {mobileOpen ? (
        <button
          aria-label="Cerrar menu por fuera"
          className="sidebar-backdrop"
          onClick={closeDrawer}
          tabIndex={-1}
          type="button"
        />
      ) : null}
      <div className="app-main-area">
        <header className="mobile-bar">
          <div>
            <IconButton
              aria-controls="app-sidebar"
              aria-expanded={mobileOpen}
              label="Abrir menu"
              onClick={() =>
                setDrawer({ open: true, pathname: location.pathname })
              }
            >
              <Icon height="20" name="menu" width="20" />
            </IconButton>
            <strong>Ritmo</strong>
          </div>
          <ThemeToggle />
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
