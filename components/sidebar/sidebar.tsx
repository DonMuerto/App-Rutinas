"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { RoutineMetadata } from "@/lib/contracts";

import { ThemeToggle } from "@/components/theme";
import { Button, IconButton } from "@/components/ui";

import styles from "./sidebar.module.css";

export type SidebarStatus = "loading" | "ready" | "error" | "session-expired";

export interface SidebarUser {
  readonly displayName?: string;
  readonly email?: string;
}

export interface SidebarDataProps {
  readonly routines?: readonly RoutineMetadata[];
  readonly status?: SidebarStatus;
  readonly user?: SidebarUser;
  readonly onCreateRoutine?: (name: string) => Promise<RoutineMetadata>;
  readonly onReorderRoutines?: (routineIds: readonly string[]) => Promise<void>;
  readonly onRetry?: () => void;
  readonly onLogout?: () => Promise<void>;
}

export interface SidebarProps extends SidebarDataProps {
  readonly activeRoutineId?: string;
  readonly isCollapsed: boolean;
  readonly mobileOpen: boolean;
  readonly onCloseMobile: () => void;
  readonly onToggleCollapsed: () => void;
}

type ReorderState =
  | { readonly status: "idle" }
  | { readonly status: "pending" }
  | { readonly status: "error"; readonly message: string };

interface OptimisticOrder {
  readonly sourceSignature: string;
  readonly routines: readonly RoutineMetadata[];
}

const EMPTY_ROUTINES: readonly RoutineMetadata[] = [];

function orderRoutines(
  routines: readonly RoutineMetadata[],
): RoutineMetadata[] {
  return [...routines].sort((left, right) => left.position - right.position);
}

function withPositions(
  routines: readonly RoutineMetadata[],
): RoutineMetadata[] {
  return routines.map((routine, position) => ({ ...routine, position }));
}

function routineSignature(routines: readonly RoutineMetadata[]): string {
  return routines
    .map((routine) =>
      [
        routine.id,
        routine.name,
        routine.icon ?? "",
        routine.position,
        routine.recurrenceType,
        routine.specificDate ?? "",
      ].join("~"),
    )
    .join("|");
}

function routineHref(routineId: string): string {
  return `/rutinas/${encodeURIComponent(routineId)}`;
}

function routineIdFromPath(pathname: string | null): string | undefined {
  const match = pathname?.match(/^\/rutinas\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function routineDateLabel(routine: RoutineMetadata): string {
  if (routine.recurrenceType === "daily") {
    return "Cada día";
  }

  const [year, month, day] = routine.specificDate.split("-").map(Number);
  const civilDate = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(civilDate);
}

function initialFor(value: string | undefined, fallback: string): string {
  const firstCharacter = value?.trim().charAt(0);
  return firstCharacter ? firstCharacter.toUpperCase() : fallback;
}

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function SortableRoutine({
  active,
  disabled,
  index,
  onMoveDown,
  onMoveUp,
  onNavigate,
  routine,
  total,
  destination,
}: {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly destination: boolean;
  readonly index: number;
  readonly onMoveDown: () => void;
  readonly onMoveUp: () => void;
  readonly onNavigate: () => void;
  readonly routine: RoutineMetadata;
  readonly total: number;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled,
    id: routine.id,
  });
  const label = routine.name.trim();
  const displayName = label || "Rutina sin nombre";
  const icon = initialFor(routine.icon ?? undefined, "R");

  return (
    <li
      className={styles.routineItem}
      data-destination={destination ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className={styles.routineRow}>
        <Link
          aria-current={active ? "page" : undefined}
          className={styles.routineLink}
          data-active={active ? "true" : undefined}
          href={routineHref(routine.id)}
          onClick={onNavigate}
        >
          <span aria-hidden="true" className={styles.routineIcon}>
            {icon}
          </span>
          <span className={styles.routineCopy}>
            <span className={styles.routineName}>{displayName}</span>
            <span className={styles.routineMeta}>
              {routineDateLabel(routine)}
            </span>
          </span>
        </Link>
        <div className={styles.routineActions}>
          <button
            aria-label={`Reordenar ${displayName}`}
            className={styles.dragHandle}
            disabled={disabled}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={`Mover ${displayName} arriba`}
            className={styles.moveButton}
            disabled={disabled || index === 0}
            onClick={onMoveUp}
            type="button"
          >
            <ChevronUp aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={`Mover ${displayName} abajo`}
            className={styles.moveButton}
            disabled={disabled || index === total - 1}
            onClick={onMoveDown}
            type="button"
          >
            <ChevronDown aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}

export function Sidebar({
  activeRoutineId,
  isCollapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapsed,
  onCreateRoutine,
  onLogout,
  onReorderRoutines,
  onRetry,
  routines = EMPTY_ROUTINES,
  status = "ready",
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeMobileRef = useRef(onCloseMobile);
  const [optimisticOrder, setOptimisticOrder] =
    useState<OptimisticOrder | null>(null);
  const [reorderState, setReorderState] = useState<ReorderState>({
    status: "idle",
  });
  const [draggedRoutineId, setDraggedRoutineId] = useState<string | null>(null);
  const [overRoutineId, setOverRoutineId] = useState<string | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("Nueva página");
  const [createError, setCreateError] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const resolvedActiveRoutineId =
    activeRoutineId ?? routineIdFromPath(pathname);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    closeMobileRef.current = onCloseMobile;
  }, [onCloseMobile]);

  const sourceSignature = routineSignature(routines);
  const orderedRoutines =
    optimisticOrder?.sourceSignature === sourceSignature
      ? optimisticOrder.routines
      : orderRoutines(routines);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = focusableElements(sidebarRef.current);
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }

      const first = controls[0];
      const last = controls.at(-1);
      if (!last) {
        return;
      }

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
  }, [mobileOpen]);

  async function commitOrder(
    nextRoutines: readonly RoutineMetadata[],
    previousRoutines: readonly RoutineMetadata[],
  ) {
    const nextIds = nextRoutines.map((routine) => routine.id);
    setOptimisticOrder({
      routines: withPositions(nextRoutines),
      sourceSignature,
    });
    setReorderAnnouncement("Orden actualizado localmente.");

    if (!onReorderRoutines) {
      return;
    }

    setReorderState({ status: "pending" });

    try {
      await onReorderRoutines(nextIds);
      setReorderState({ status: "idle" });
      setReorderAnnouncement("Orden guardado.");
    } catch {
      setOptimisticOrder({
        routines: withPositions(previousRoutines),
        sourceSignature,
      });
      setReorderState({
        message:
          "No se pudo guardar el orden. Restauramos la posición anterior.",
        status: "error",
      });
      setReorderAnnouncement(
        "No se pudo guardar el orden; se restauró la posición anterior.",
      );
    }
  }

  function moveRoutine(routineId: string, direction: -1 | 1) {
    if (reorderState.status === "pending") {
      return;
    }

    const currentIndex = orderedRoutines.findIndex(
      (routine) => routine.id === routineId,
    );
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= orderedRoutines.length
    ) {
      return;
    }

    const previousRoutines = orderedRoutines;
    const nextRoutines = arrayMove(
      [...orderedRoutines],
      currentIndex,
      nextIndex,
    );
    void commitOrder(nextRoutines, previousRoutines);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setDraggedRoutineId(null);
    setOverRoutineId(null);

    if (!overId || activeId === overId || reorderState.status === "pending") {
      return;
    }

    const currentIndex = orderedRoutines.findIndex(
      (routine) => routine.id === activeId,
    );
    const nextIndex = orderedRoutines.findIndex(
      (routine) => routine.id === overId,
    );

    if (currentIndex < 0 || nextIndex < 0) {
      return;
    }

    const previousRoutines = orderedRoutines;
    const nextRoutines = arrayMove(
      [...orderedRoutines],
      currentIndex,
      nextIndex,
    );
    void commitOrder(nextRoutines, previousRoutines);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = createName.trim();

    if (!normalizedName) {
      setCreateError("Escribe un nombre para la rutina.");
      return;
    }

    if (!onCreateRoutine) {
      setCreateError("La creación no está disponible en este momento.");
      return;
    }

    setCreatePending(true);
    setCreateError("");

    try {
      const createdRoutine = await onCreateRoutine(normalizedName);
      setCreateOpen(false);
      setCreateName("Nueva página");
      onCloseMobile();
      router.push(routineHref(createdRoutine.id));
    } catch {
      setCreateError("No se pudo crear la página. Inténtalo de nuevo.");
    } finally {
      setCreatePending(false);
    }
  }

  async function handleLogout() {
    if (!onLogout || logoutPending) {
      return;
    }

    setLogoutPending(true);
    try {
      await onLogout();
    } catch {
      setLogoutPending(false);
    }
  }

  const userName = user?.displayName?.trim() || "Tu espacio";
  const userEmail = user?.email?.trim();
  const showRoutines = status === "ready" && orderedRoutines.length > 0;

  return (
    <aside
      aria-label="Barra lateral de Ritmo"
      className={styles.sidebar}
      data-collapsed={isCollapsed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
      id="ritmo-sidebar"
      ref={sidebarRef}
    >
      <header className={styles.sidebarHeader}>
        <Link
          aria-label="Ritmo, ir a Hoy"
          className={`${styles.brand} shell-brand`}
          href="/hoy"
          onClick={onCloseMobile}
        >
          <span aria-hidden="true" className="shell-brand-mark">
            R
          </span>
          <span className={styles.brandText}>Ritmo</span>
        </Link>
        <div className={styles.headerActions}>
          <IconButton
            className={styles.mobileClose}
            label="Cerrar menú"
            onClick={onCloseMobile}
            ref={closeButtonRef}
          >
            <X aria-hidden="true" size={18} />
          </IconButton>
          <IconButton
            className={styles.collapseButton}
            label={
              isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"
            }
            onClick={onToggleCollapsed}
          >
            {isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" size={17} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={17} />
            )}
          </IconButton>
        </div>
      </header>

      <div className={styles.sidebarBody}>
        <nav aria-label="Navegación principal" className={styles.primaryNav}>
          <Link
            aria-current={pathname === "/hoy" ? "page" : undefined}
            className={styles.navLink}
            data-active={pathname === "/hoy" ? "true" : undefined}
            href="/hoy"
            onClick={onCloseMobile}
          >
            <span aria-hidden="true" className={styles.navIcon}>
              <CalendarDays size={17} />
            </span>
            <span className={styles.navText}>Hoy</span>
          </Link>
        </nav>

        <section aria-labelledby="routines-heading" className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="routines-heading">
              Rutinas
            </h2>
          </div>

          {status === "loading" ? (
            <div
              aria-busy="true"
              aria-label="Cargando rutinas"
              className={styles.loadingRows}
            >
              <span className={styles.loadingRow} />
              <span className={styles.loadingRow} />
              <span className={styles.loadingRow} />
            </div>
          ) : null}

          {status === "error" ? (
            <div className={styles.errorState} role="alert">
              <strong>No se pudieron cargar</strong>
              <p>Revisa tu conexión e inténtalo otra vez.</p>
              {onRetry ? (
                <Button onClick={onRetry} size="md" variant="quiet">
                  Reintentar
                </Button>
              ) : null}
            </div>
          ) : null}

          {status === "session-expired" ? (
            <div className={styles.expiredState} role="alert">
              <strong>Sesión expirada</strong>
              <p>Vuelve a entrar para ver tus rutinas.</p>
              <Link
                className={styles.navLink}
                href="/login"
                onClick={onCloseMobile}
              >
                Entrar de nuevo
              </Link>
            </div>
          ) : null}

          {status === "ready" && !showRoutines ? (
            <div className={styles.emptyState}>
              <strong>Aún no hay páginas</strong>
              <p>Crea una rutina para empezar a escribir.</p>
            </div>
          ) : null}

          {showRoutines ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragCancel={() => {
                setDraggedRoutineId(null);
                setOverRoutineId(null);
              }}
              onDragEnd={handleDragEnd}
              onDragOver={(event) =>
                setOverRoutineId(event.over ? String(event.over.id) : null)
              }
              onDragStart={(event) => {
                setDraggedRoutineId(String(event.active.id));
                setOverRoutineId(String(event.active.id));
              }}
              sensors={sensors}
            >
              <SortableContext
                items={orderedRoutines.map((routine) => routine.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul
                  aria-busy={reorderState.status === "pending"}
                  aria-label="Rutinas"
                  className={styles.routineList}
                >
                  {orderedRoutines.map((routine, index) => (
                    <SortableRoutine
                      active={routine.id === resolvedActiveRoutineId}
                      destination={
                        draggedRoutineId !== null &&
                        overRoutineId === routine.id &&
                        draggedRoutineId !== routine.id
                      }
                      disabled={reorderState.status === "pending"}
                      index={index}
                      key={routine.id}
                      onMoveDown={() => moveRoutine(routine.id, 1)}
                      onMoveUp={() => moveRoutine(routine.id, -1)}
                      onNavigate={onCloseMobile}
                      routine={routine}
                      total={orderedRoutines.length}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : null}

          <div className={styles.newPageArea}>
            {createOpen ? (
              <form className={styles.newPageForm} onSubmit={handleCreate}>
                <label
                  className={styles.newPageLabel}
                  htmlFor="new-routine-name"
                >
                  Nueva página
                </label>
                <input
                  aria-describedby={
                    createError ? "new-routine-error" : undefined
                  }
                  autoFocus
                  className={styles.newPageInput}
                  id="new-routine-name"
                  maxLength={120}
                  onChange={(event) => setCreateName(event.target.value)}
                  value={createName}
                />
                {createError ? (
                  <p
                    className={styles.newPageError}
                    id="new-routine-error"
                    role="alert"
                  >
                    {createError}
                  </p>
                ) : null}
                <div className={styles.newPageFormActions}>
                  <Button
                    onClick={() => {
                      setCreateOpen(false);
                      setCreateError("");
                    }}
                    size="md"
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={createPending}
                    size="md"
                    type="submit"
                    variant="primary"
                  >
                    {createPending ? "Creando..." : "Crear"}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                className={styles.newPageButton}
                disabled={!onCreateRoutine}
                onClick={() => {
                  setCreateOpen(true);
                  setCreateError("");
                }}
                size="md"
                variant="ghost"
              >
                <span aria-hidden="true" className={styles.navIcon}>
                  <Plus size={17} />
                </span>
                <span className={styles.navText}>Nueva página</span>
              </Button>
            )}
            {reorderState.status === "pending" ? (
              <p aria-live="polite" className={styles.reorderStatus}>
                Guardando orden...
              </p>
            ) : null}
            {reorderState.status === "error" ? (
              <p className={styles.reorderError} role="alert">
                {reorderState.message}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <footer className={styles.sidebarFooter}>
        <div className={styles.footerControls}>
          <div className={styles.userIdentity} title={userEmail ?? userName}>
            <span aria-hidden="true" className={styles.userMark}>
              {initialFor(userName, "R")}
            </span>
            <span className={styles.userCopy}>
              <span className={styles.userName}>{userName}</span>
              {userEmail ? (
                <span className={styles.userEmail}>{userEmail}</span>
              ) : null}
            </span>
          </div>
          <div className={styles.footerActions}>
            <span className={styles.themeControl}>
              <ThemeToggle />
            </span>
            {onLogout ? (
              <IconButton
                className={styles.logoutButton}
                disabled={logoutPending}
                label="Cerrar sesión"
                onClick={() => void handleLogout()}
              >
                <LogOut aria-hidden="true" size={17} />
              </IconButton>
            ) : null}
          </div>
        </div>
        <div aria-live="polite" className={styles.liveRegion}>
          {reorderAnnouncement}
        </div>
      </footer>
    </aside>
  );
}
