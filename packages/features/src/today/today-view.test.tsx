import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakePlatformServices } from "@ritmo/platform/fakes";

import { CompletionProvider } from "../completions/completion-provider-component";
import { CompletionStore } from "../completions/completion-store";
import { LocalDateObserver } from "../dates/local-date-observer";
import {
  FixtureCompletionRepository,
  FixtureTimerController,
  FixtureTodayDataSource,
} from "../fixtures";
import { TodayView } from "./today-view";

afterEach(cleanup);

function renderToday() {
  const platform = createFakePlatformServices();
  const completions = new FixtureCompletionRepository();
  const store = new CompletionStore(completions);
  const source = new FixtureTodayDataSource(completions);
  const load = vi.spyOn(source, "load");
  const timer = new FixtureTimerController();
  const dateObserver = new LocalDateObserver({
    lifecycle: platform.lifecycle,
    getDate: () => "2026-09-18",
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CompletionProvider store={store}>
        <TodayView
          dataSource={source}
          dateObserver={dateObserver}
          navigation={platform.navigation}
          timer={timer}
          userId="user-a"
        />
      </CompletionProvider>
    </QueryClientProvider>,
  );
  return { load, platform };
}

describe("TodayView", () => {
  it("renders ordered activities and performs completion, timer and origin actions", async () => {
    const user = userEvent.setup();
    const { platform } = renderToday();
    const list = await screen.findByRole("list", {
      name: "Actividades de hoy",
    });
    const rows = within(list).getAllByRole("article");

    expect(within(rows[0]).getByRole("heading")).toHaveTextContent(
      "Circuito de movilidad",
    );
    expect(within(rows[1]).getByRole("heading")).toHaveTextContent("Lectura");

    const completion = within(rows[0]).getByRole("checkbox", {
      name: /Marcar Circuito de movilidad/,
    });
    await user.click(completion);
    await waitFor(() => expect(completion).toBeChecked());

    await user.click(
      within(rows[0]).getByRole("button", { name: "Iniciar timer" }),
    );
    expect(
      within(rows[0]).getByRole("button", { name: "Abrir timer" }),
    ).toBeInTheDocument();

    await user.click(
      within(rows[0]).getByRole("button", { name: "Abrir origen" }),
    );
    expect(platform.navigationHistory.at(-1)).toContain(
      "/rutinas/3947f2ca-d682-42f5-b62f-493a588321ef?activity=activity-mobility",
    );
  });

  it("revalidates Today when the application resumes", async () => {
    const { load, platform } = renderToday();
    await screen.findByRole("list", { name: "Actividades de hoy" });
    expect(load).toHaveBeenCalledOnce();

    await platform.emitLifecycle("resume");

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
