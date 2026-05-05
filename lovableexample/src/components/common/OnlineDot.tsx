import { cn } from "@/lib/utils";

export function OnlineDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      {online && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
      )}
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          online ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
    </span>
  );
}
