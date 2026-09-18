import type { ButtonHTMLAttributes, Ref } from "react";

import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  readonly label: string;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  className,
  label,
  ref,
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn("ui-icon-button", className)}
      ref={ref}
      title={title ?? label}
      {...props}
    />
  );
}
