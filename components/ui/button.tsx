import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
}

export function Button({
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("ui-button", className)}
      data-size={size}
      data-variant={variant}
      {...props}
    />
  );
}
