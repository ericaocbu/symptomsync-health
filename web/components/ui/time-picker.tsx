import * as React from "react";
import { cn } from "@/lib/utils";

interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CustomTimePicker({
  value,
  onChange,
  className,
}: CustomTimePickerProps) {
  return (
    <input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Select time"
      step="60"
      className={cn(
        "flex h-11 w-full cursor-pointer rounded-xl border border-[#dce4e8] bg-[#e6edf2] px-3 text-sm font-medium text-[#405f73] shadow-none outline-none transition-colors",
        "hover:border-[#b9cbd5] hover:bg-[#dfe9ef]",
        "focus-visible:border-[#718b9b] focus-visible:ring-2 focus-visible:ring-[#718b9b]/20",
        "[color-scheme:light]",
        className,
      )}
    />
  );
}