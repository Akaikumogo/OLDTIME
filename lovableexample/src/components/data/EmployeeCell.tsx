import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function EmployeeCell({
  name,
  initials,
  subtitle,
}: {
  name: string;
  initials: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium leading-tight">{name}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}
