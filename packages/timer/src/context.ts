import { createContext } from "react";

import type { TimerController } from "./controller";

export const TimerControllerContext = createContext<TimerController | null>(
  null,
);
