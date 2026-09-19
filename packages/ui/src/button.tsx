import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly compact?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className = "", compact = false, variant = "secondary", ...props },
    ref,
  ) {
    return (
      <button
        {...props}
        className={`ui-button ${className}`.trim()}
        data-compact={compact || undefined}
        data-variant={variant}
        ref={ref}
      />
    );
  },
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ children, className = "", label, ...props }, ref) {
    return (
      <button
        {...props}
        aria-label={label}
        className={`ui-icon-button ${className}`.trim()}
        ref={ref}
      >
        {children}
      </button>
    );
  },
);
