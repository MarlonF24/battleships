/** Compact visual primitives translated directly from the retained interface. */

import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional and Tailwind utility classes without conflicting tokens. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

type ButtonVariant = "primary" | "success" | "danger" | "neutral";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Readonly<{ variant?: ButtonVariant }>;

const buttonColours: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-primary hover:bg-primary-hover",
  success: "bg-success hover:bg-success-hover",
  danger: "bg-danger hover:bg-danger-hover",
  neutral: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
};

/** Render the original four-pixel button shape with one explicit colour role. */
export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-sm px-4 py-2 text-base font-bold text-white transition-[background-color,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        buttonColours[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Preserve the original white surface, radius, and restrained shadow. */
export function Panel({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-xl bg-white px-4 py-4 shadow-[0_2px_12px_rgb(0_0_0/0.08)] sm:px-8 sm:py-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Render safe user-facing error text as an accessible inline alert. */
export function ErrorMessage({ message }: Readonly<{ message: string }>) {
  return (
    <div
      role="alert"
      className="border-danger text-danger my-2 flex w-fit max-w-full items-center gap-2 rounded-sm border bg-red-50 px-4 py-3 text-sm"
    >
      <i>{message}</i>
    </div>
  );
}

/** Add an accessible Radix tooltip without imposing library visual styling. */
export function HelpTip({
  label,
  children,
}: PropsWithChildren<{ label: ReactNode }>) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="bg-header z-50 max-w-64 rounded-sm px-3 py-2 text-xs whitespace-pre-line text-white shadow-lg"
          >
            {label}
            <Tooltip.Arrow className="fill-header" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
