import type { SVGProps } from "react";

export type IconName =
  | "calendar"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "close"
  | "grip"
  | "logout"
  | "menu"
  | "moon"
  | "plus"
  | "sun"
  | "timer"
  | "warning";

const paths: Record<IconName, readonly string[]> = {
  calendar: ["M5 3v3M15 3v3M3 8h14M4 5h12a1 1 0 0 1 1 1v11H3V6a1 1 0 0 1 1-1Z"],
  check: ["m4 10 4 4 8-8"],
  "chevron-down": ["m6 8 4 4 4-4"],
  "chevron-left": ["m12 5-5 5 5 5"],
  "chevron-right": ["m8 5 5 5-5 5"],
  "chevron-up": ["m6 12 4-4 4 4"],
  close: ["M5 5l10 10M15 5 5 15"],
  grip: ["M7 5h.01M13 5h.01M7 10h.01M13 10h.01M7 15h.01M13 15h.01"],
  logout: ["M8 4H4v12h4M12 6l4 4-4 4M7 10h9"],
  menu: ["M4 6h12M4 10h12M4 14h12"],
  moon: ["M16 13.5A7 7 0 0 1 6.5 4 6 6 0 1 0 16 13.5Z"],
  plus: ["M10 4v12M4 10h12"],
  sun: [
    "M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4",
  ],
  timer: [
    "M10 6v4l3 2M7 2h6M10 3v2M16 5l1 1M10 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z",
  ],
  warning: ["M10 3 2.5 17h15L10 3ZM10 8v4M10 15h.01"],
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { readonly name: IconName }) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox="0 0 20 20"
    >
      {paths[name].map((path) => (
        <path
          d={path}
          key={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      ))}
    </svg>
  );
}
