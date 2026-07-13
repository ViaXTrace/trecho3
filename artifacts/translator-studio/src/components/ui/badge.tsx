import * as React from "react"
import { cn } from "./button"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "info" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground",
    outline: "text-foreground border-border",
    success: "border-transparent bg-success text-success-foreground",
    info: "border-transparent bg-info text-info-foreground",
    warning: "border-transparent bg-warning text-warning-foreground",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center border px-2.5 py-0.5 text-xs font-mono font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
