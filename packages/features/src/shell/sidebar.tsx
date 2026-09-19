import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { RoutineMetadata } from "@ritmo/core";
import { Button, Icon, IconButton, ThemeToggle } from "@ritmo/ui";

import type { AuthUser, SidebarDataPort } from "../contracts";

export type SidebarStatus = "loading" | "ready" | "error" | "session-expired";

export interface SidebarProps {
  readonly collapsed: boolean;
  readonly data?: SidebarDataPort;
  readonly mobileOpen: boolean;
  readonly onCloseMobile: () => void;
  readonly onLogout?: () => Promise<void>;
  readonly onRetry?: () => void;
  readonly onToggleCollapsed: () => void;
  readonly routines?: readonly RoutineMetadata[];
  readonly status?: SidebarStatus;
  readonly user?: AuthUser;
}

type ReorderState = "idle" | "pending" | "error";

function withPositions(routines: readonly RoutineMetadata[]) {
  return routines.map((routine, position) => ({ ...routine, position }));
}

function moveItem<T>(items: readonly T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function routineSignature(routines: readonly RoutineMetadata[]) {
  return routines
    .map((routine) =>
      [
        routine.id,
        routine.name,
        routine.icon ?? "",
        routine.position,
        routine.recurrenceType,
        routine.specificDate ?? "",
      ].join(":"),
    )
    .join("|");
}

function routineDateLabel(routine: RoutineMetadata) {
  if (routine.recurrenceType === "daily") return "Cada dia";
  const [year, month, day] = routine.specificDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day, 12));
}

function focusableElements(root: HTMLElement | null) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function Sidebar({
  collapsed,
  data,
  mobileOpen,
  onCloseMobile,
  onLogout,
  onRetry,
  onToggleCollapsed,
  routines = [],
  status = "ready",
  user,
}: SidebarProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [optimistic, setOptimistic] = useState<{
    readonly source: string;
    readonly routines: readonly RoutineMetadata[];
  } | null>(null);
  const [reorderState, setReorderState] = useState<ReorderState>("idle");
  const [announcement, setAnnouncement] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("Nueva pagina");
  const [createError, setCreateError] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const source = routineSignature(routines);
  const ordered =
    optimistic?.source === source
      ? optimistic.routines
      : [...routines].sort((left, right) => left.position - right.position);

  useEffect(() => {
    if (!mobileOpen) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseMobile();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusableElements(panelRef.current);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [mobileOpen, onCloseMobile]);

  async function commitOrder(next: readonly RoutineMetadata[]) {
    const previous = ordered;
    const positioned = withPositions(next);
    setOptimistic({ source, routines: positioned });
    setAnnouncement("Orden actualizado localmente.");
    if (!data) return;

    setReorderState("pending");
    try {
      await data.reorderRoutines(positioned.map((routine) => routine.id));
      setReorderState("idle");
      setAnnouncement("Orden guardado.");
    } catch {
      setOptimistic({ source, routines: withPositions(previous) });
      setReorderState("error");
      setAnnouncement(
        "No se pudo guardar el orden. Restauramos el orden anterior.",
      );
    }
  }

  function move(routineId: string, direction: -1 | 1) {
    if (reorderState === "pending") return;
    const from = ordered.findIndex((routine) => routine.id === routineId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    void commitOrder(moveItem(ordered, from, to));
  }

  function handleDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    if (!draggingId || draggingId === targetId || reorderState === "pending")
      return;
    const from = ordered.findIndex((routine) => routine.id === draggingId);
    const to = ordered.findIndex((routine) => routine.id === targetId);
    setDraggingId(null);
    setOverId(null);
    if (from >= 0 && to >= 0) void commitOrder(moveItem(ordered, from, to));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = createName.trim();
    if (!name) {
      setCreateError("Escribe un nombre para la rutina.");
      return;
    }
    if (!data) return;

    setCreateError("");
    setCreatePending(true);
    try {
      const routine = await data.createRoutine(name);
      setCreateOpen(false);
      setCreateName("Nueva pagina");
      onCloseMobile();
      navigate(`/rutinas/${encodeURIComponent(routine.id)}`);
    } catch {
      setCreateError("No se pudo crear la pagina. Intenta nuevamente.");
    } finally {
      setCreatePending(false);
    }
  }

  async function handleLogout() {
    if (!onLogout || logoutPending) return;
    setLogoutPending(true);
    try {
      await onLogout();
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <aside
      aria-label="Barra lateral de Ritmo"
      aria-modal={mobileOpen || undefined}
      className="app-sidebar"
      data-collapsed={collapsed || undefined}
      data-mobile-open={mobileOpen || undefined}
      id="app-sidebar"
      ref={panelRef}
      role={mobileOpen ? "dialog" : undefined}
    >
      <header className="sidebar-header">
        <NavLink
          aria-label="Ritmo, ir a Hoy"
          className="sidebar-brand"
          onClick={onCloseMobile}
          to="/hoy"
        >
          <span aria-hidden="true">R</span>
          <strong>Ritmo</strong>
        </NavLink>
        <div className="sidebar-header-actions">
          <IconButton
            className="sidebar-mobile-close"
            label="Cerrar menu"
            onClick={onCloseMobile}
            ref={closeRef}
          >
            <Icon height="19" name="close" width="19" />
          </IconButton>
          <IconButton
            label={
              collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"
            }
            onClick={onToggleCollapsed}
          >
            <Icon
              height="18"
              name={collapsed ? "chevron-right" : "chevron-left"}
              width="18"
            />
          </IconButton>
        </div>
      </header>

      <div className="sidebar-scroll">
        <nav aria-label="Navegacion principal">
          <NavLink
            className="sidebar-nav-link"
            onClick={onCloseMobile}
            to="/hoy"
          >
            <Icon height="18" name="calendar" width="18" />
            <span>Hoy</span>
          </NavLink>
        </nav>

        <section
          aria-labelledby="sidebar-routines-title"
          className="sidebar-routines"
        >
          <h2 id="sidebar-routines-title">Rutinas</h2>
          {status === "loading" ? (
            <div
              aria-busy="true"
              aria-label="Cargando rutinas"
              className="sidebar-loading"
            >
              <span />
              <span />
              <span />
            </div>
          ) : null}
          {status === "error" ? (
            <div className="sidebar-state" role="alert">
              <strong>No se pudieron cargar</strong>
              <p>Revisa tu conexion e intenta otra vez.</p>
              {onRetry ? (
                <Button compact onClick={onRetry}>
                  Reintentar
                </Button>
              ) : null}
            </div>
          ) : null}
          {status === "session-expired" ? (
            <div className="sidebar-state" role="alert">
              <strong>Sesion expirada</strong>
              <p>Tu borrador local sigue protegido.</p>
              <NavLink onClick={onCloseMobile} to="/login">
                Entrar de nuevo
              </NavLink>
            </div>
          ) : null}
          {status === "ready" && ordered.length === 0 ? (
            <div className="sidebar-state">
              <strong>Aun no hay paginas</strong>
              <p>Crea una rutina para empezar.</p>
            </div>
          ) : null}

          {status === "ready" && ordered.length > 0 ? (
            <ul
              aria-busy={reorderState === "pending"}
              aria-label="Rutinas"
              className="routine-list"
            >
              {ordered.map((routine, index) => (
                <li
                  className="routine-row"
                  data-drag-over={overId === routine.id || undefined}
                  key={routine.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOverId(routine.id);
                  }}
                  onDrop={(event) => handleDrop(event, routine.id)}
                >
                  <NavLink
                    onClick={onCloseMobile}
                    to={`/rutinas/${encodeURIComponent(routine.id)}`}
                  >
                    <span aria-hidden="true" className="routine-icon">
                      {routine.icon?.trim().charAt(0) || "R"}
                    </span>
                    <span className="routine-copy">
                      <strong>{routine.name}</strong>
                      <small>{routineDateLabel(routine)}</small>
                    </span>
                  </NavLink>
                  <div className="routine-actions">
                    <button
                      aria-label={`Arrastrar ${routine.name}`}
                      className="routine-drag"
                      disabled={reorderState === "pending"}
                      draggable={reorderState !== "pending"}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverId(null);
                      }}
                      onDragStart={() => setDraggingId(routine.id)}
                      type="button"
                    >
                      <Icon height="17" name="grip" width="17" />
                    </button>
                    <button
                      aria-label={`Mover ${routine.name} arriba`}
                      disabled={reorderState === "pending" || index === 0}
                      onClick={() => move(routine.id, -1)}
                      type="button"
                    >
                      <Icon height="17" name="chevron-up" width="17" />
                    </button>
                    <button
                      aria-label={`Mover ${routine.name} abajo`}
                      disabled={
                        reorderState === "pending" ||
                        index === ordered.length - 1
                      }
                      onClick={() => move(routine.id, 1)}
                      type="button"
                    >
                      <Icon height="17" name="chevron-down" width="17" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {createOpen ? (
            <form className="new-routine-form" onSubmit={handleCreate}>
              <label htmlFor="new-routine-name">Nueva pagina</label>
              <input
                autoFocus
                id="new-routine-name"
                maxLength={120}
                onChange={(event) => setCreateName(event.target.value)}
                value={createName}
              />
              {createError ? <p role="alert">{createError}</p> : null}
              <div>
                <Button
                  compact
                  onClick={() => setCreateOpen(false)}
                  type="button"
                  variant="quiet"
                >
                  Cancelar
                </Button>
                <Button
                  compact
                  disabled={createPending}
                  type="submit"
                  variant="primary"
                >
                  {createPending ? "Creando..." : "Crear"}
                </Button>
              </div>
            </form>
          ) : (
            <Button
              className="new-routine-button"
              compact
              disabled={!data}
              onClick={() => setCreateOpen(true)}
              variant="quiet"
            >
              <Icon height="18" name="plus" width="18" />
              <span>Nueva pagina</span>
            </Button>
          )}
          {reorderState === "error" ? (
            <p className="sidebar-error" role="alert">
              No se pudo guardar el orden.
            </p>
          ) : null}
        </section>
      </div>

      <footer className="sidebar-footer">
        <div className="sidebar-user">
          <span aria-hidden="true">
            {user?.displayName?.trim().charAt(0) ||
              user?.email?.trim().charAt(0).toUpperCase() ||
              "R"}
          </span>
          <span>
            <strong>{user?.displayName || "Tu espacio"}</strong>
            {user?.email ? <small>{user.email}</small> : null}
          </span>
        </div>
        <div className="sidebar-footer-actions">
          <ThemeToggle />
          {onLogout ? (
            <IconButton
              disabled={logoutPending}
              label="Cerrar sesion"
              onClick={() => void handleLogout()}
            >
              <Icon height="18" name="logout" width="18" />
            </IconButton>
          ) : null}
        </div>
        <p aria-live="polite" className="visually-hidden">
          {announcement}
        </p>
      </footer>
    </aside>
  );
}
