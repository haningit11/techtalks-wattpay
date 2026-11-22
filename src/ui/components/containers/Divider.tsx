
interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export default function Divider({
  orientation = "horizontal",
  className = "",
}: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={[
        "bg-[var(--color-border)]",
        orientation === "horizontal"
          ? "h-px w-full"
          : "h-full w-px self-stretch",
        className,
      ].join(" ")}
    />
  );
}
