import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/data/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeAllEfficiencies, defaultRange, type Range } from "@/lib/productivity";
import { computers, departments, employees } from "@/lib/mock";
import { EmployeeCell } from "@/components/data/EmployeeCell";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function EfficiencyRanking() {
  const initial = defaultRange();
  const [from, setFrom] = useState(toInputDate(initial.from));
  const [to, setTo] = useState(toInputDate(initial.to));
  const [dept, setDept] = useState("all");
  const [empId, setEmpId] = useState("all");
  const [minEff, setMinEff] = useState(0);

  const range: Range = useMemo(
    () => ({ from: new Date(from), to: new Date(to) }),
    [from, to],
  );

  const rows = useMemo(() => {
    return computeAllEfficiencies(range)
      .filter((r) => (dept === "all" ? true : r.employee.departmentId === dept))
      .filter((r) => (empId === "all" ? true : r.employee.id === empId))
      .filter((r) => r.efficiency >= minEff)
      .sort((a, b) => b.efficiency - a.efficiency);
  }, [range, dept, empId, minEff]);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <EmployeeCell name={r.employee.fullName} initials={r.employee.initials} subtitle={r.employee.email} />
      ),
    },
    {
      key: "dept",
      header: "Department",
      cell: (r) => (
        <span className="text-sm">{departments.find((d) => d.id === r.employee.departmentId)?.name}</span>
      ),
    },
    {
      key: "computer",
      header: "Computer",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {computers.find((c) => c.id === r.computerId)?.hostname ?? "—"}
        </span>
      ),
    },
    { key: "expected", header: "Expected", cell: (r) => <Cell value={formatDuration(r.expectedMinutes)} /> },
    { key: "productive", header: "Productive", cell: (r) => <Cell value={formatDuration(r.productiveMinutes)} /> },
    { key: "permission", header: "Permission", cell: (r) => <Cell value={formatDuration(r.permissionMinutes)} /> },
    { key: "late", header: "Late", cell: (r) => <Cell value={`${r.lateMinutes}m`} tone={r.lateMinutes > 0 ? "destructive" : undefined} /> },
    { key: "early", header: "Early leave", cell: (r) => <Cell value={`${r.earlyLeaveMinutes}m`} tone={r.earlyLeaveMinutes > 0 ? "destructive" : undefined} /> },
    {
      key: "eff",
      header: "Efficiency",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.efficiency} className="h-1.5 w-20" />
          <span
            className={cn(
              "tabular-nums text-sm font-semibold",
              r.efficiency >= 80 ? "text-success" : r.efficiency >= 60 ? "text-warning" : "text-destructive",
            )}
          >
            {r.efficiency.toFixed(1)}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <Card className="p-0">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold">Efficiency ranking</p>
          <p className="text-xs text-muted-foreground">
            Composite score across attendance, computer activity, and permissions.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[140px]" />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[140px]" />
          </Field>
          <Field label="Department">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employee">
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees
                  .filter((e) => e.status === "active")
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Min eff. %">
            <Input
              type="number"
              min={0}
              max={100}
              value={minEff}
              onChange={(e) => setMinEff(Number(e.target.value) || 0)}
              className="h-9 w-24"
            />
          </Field>
        </div>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.employee.id}
        searchKeys={[(r) => r.employee.fullName, (r) => r.employee.email]}
        searchPlaceholder="Search employees..."
        pageSize={8}
      />
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Cell({ value, tone }: { value: string; tone?: "destructive" }) {
  return (
    <span className={cn("tabular-nums text-sm", tone === "destructive" && "text-destructive")}>{value}</span>
  );
}
