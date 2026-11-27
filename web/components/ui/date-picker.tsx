import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  className,
}: DatePickerProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = event.target.value;

    if (!dateValue) {
      onChange(undefined);
      return;
    }

    const [year, month, day] = dateValue.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);

    if (!Number.isNaN(selectedDate.getTime())) {
      onChange(selectedDate);
    }
  };

  return (
    <input
      type="date"
      value={value ? format(value, "yyyy-MM-dd") : ""}
      onChange={handleChange}
      aria-label="Select date"
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