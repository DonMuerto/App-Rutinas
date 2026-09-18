"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { AutosaveController } from "./autosave";

interface ActiveNavigationGuard {
  readonly flush: () => Promise<void>;
}

let activeNavigationGuard: ActiveNavigationGuard | undefined;

export function flushActiveEditor() {
  return activeNavigationGuard?.flush() ?? Promise.resolve();
}

export function useSafeNavigation<Value>(
  controller: AutosaveController<Value>,
  onSaveError?: (error: Error) => void,
) {
  const router = useRouter();

  useEffect(() => {
    activeNavigationGuard = controller;
    let restoringHistory = false;
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const reportError = (error: unknown) => {
      onSaveError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    };

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !controller.getSnapshot().hasUnsavedChanges
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) {
        return;
      }

      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void controller
        .flush()
        .then(() =>
          router.push(
            `${destination.pathname}${destination.search}${destination.hash}`,
          ),
        )
        .catch(reportError);
    };

    const handlePopState = () => {
      if (
        restoringHistory ||
        !controller.getSnapshot().hasUnsavedChanges
      ) {
        return;
      }

      const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      restoringHistory = true;
      window.history.pushState(window.history.state, "", currentLocation);
      router.replace(currentLocation);

      void controller.flush().then(
        () => {
          restoringHistory = false;
          router.push(destination);
        },
        (error: unknown) => {
          restoringHistory = false;
          reportError(error);
        },
      );
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      if (activeNavigationGuard === controller) {
        activeNavigationGuard = undefined;
      }
    };
  }, [controller, onSaveError, router]);
}
