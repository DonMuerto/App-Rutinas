import type { TimerPhaseKind } from "./engine";

export type TimerAudioSignal = TimerPhaseKind | "done";

export interface TimerAudioAdapter {
  prepare(): void;
  play(signal: TimerAudioSignal): void;
}

export const silentTimerAudio: TimerAudioAdapter = {
  prepare() {},
  play() {},
};

export function createBrowserTimerAudio(): TimerAudioAdapter {
  let context: AudioContext | null = null;

  function getContext(): AudioContext | null {
    if (typeof window === "undefined" || window.AudioContext === undefined) {
      return null;
    }

    context ??= new window.AudioContext();
    return context;
  }

  return {
    prepare() {
      try {
        const audioContext = getContext();

        if (audioContext?.state === "suspended") {
          void audioContext.resume().catch(() => undefined);
        }
      } catch {
        context = null;
      }
    },
    play(signal) {
      try {
        const audioContext = getContext();

        if (audioContext === null) {
          return;
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const startsAt = audioContext.currentTime;
        const frequency =
          signal === "done"
            ? 880
            : signal === "work"
              ? 660
              : signal === "prepare"
                ? 520
                : 440;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startsAt);
        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(0.16, startsAt + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.2);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startsAt);
        oscillator.stop(startsAt + 0.21);
      } catch {
        context = null;
      }
    },
  };
}
