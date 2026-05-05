import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmployeeCell } from "@/components/data/EmployeeCell";
import {
  employees as initial,
  type Employee,
  departments,
  positions,
  attendanceEvents,
  computers,
  computerActivity,
  workPermissions,
} from "@/lib/mock";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Plus, Mail, Phone, Calendar, Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EfficiencyCard } from "@/components/data/EfficiencyCard";
import {
  appBreakdownFor,
  computeEfficiency,
  dailyEfficiencySeries,
  defaultRange,
} from "@/lib/productivity";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/employees")({
  head: () => ({
    meta: [
      { title: "Employees — WorkPlus" },
      { name: "description", content: "Browse and manage employees, departments, and roles." },
      { property: "og:title", content: "Employees — WorkPlus" },
      { property: "og:description", content: "Browse and manage employees, departments, and roles." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>(initial);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (deptFilter === "all" || r.departmentId === deptFilter) &&
          (statusFilter === "all" || r.status === statusFilter),
      ),
    [rows, deptFilter, statusFilter],
  );

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      cell: (r) => <EmployeeCell name={r.fullName} initials={r.initials} subtitle={r.email} />,
    },
    {
      key: "department",
      header: "Department",
      cell: (r) => (
        <span className="text-sm">{departments.find((d) => d.id === r.departmentId)?.name}</span>
      ),
    },
    {
      key: "position",
      header: "Position",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {positions.find((p) => p.id === r.positionId)?.title ?? "—"}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "lastSeen",
      header: "Last seen",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(r.lastSeen, { addSuffix: true })}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`${rows.length} people across ${departments.length} departments.`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setEditOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add employee
          </Button>
        }
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={setSelected}
            searchKeys={["fullName", "email"]}
            searchPlaceholder="Search employees..."
            toolbar={
              <>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On leave</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        </Card>
      </div>

      <EmployeeDrawer
        employee={selected}
        onClose={() => setSelected(null)}
        onEdit={(e) => {
          setEditing(e);
          setSelected(null);
          setEditOpen(true);
        }}
      />

      <EmployeeDialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditing(null);
        }}
        employee={editing}
        onSave={(form) => {
          if (editing) {
            setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...form, fullName: `${form.firstName} ${form.lastName}`, initials: `${form.firstName[0]}${form.lastName[0]}`.toUpperCase() } : r)));
            toast.success("Employee updated");
          } else {
            const id = `emp_${Date.now()}`;
            setRows((rs) => [
              {
                ...form,
                id,
                fullName: `${form.firstName} ${form.lastName}`,
                initials: `${form.firstName[0]}${form.lastName[0]}`.toUpperCase(),
                hiredAt: new Date(),
                lastSeen: new Date(),
              },
              ...rs,
            ]);
            toast.success("Employee added");
          }
          setEditOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EmployeeDrawer({
  employee,
  onClose,
  onEdit,
}: {
  employee: Employee | null;
  onClose: () => void;
  onEdit: (e: Employee) => void;
}) {
  const dept = employee && departments.find((d) => d.id === employee.departmentId);
  const pos = employee && positions.find((p) => p.id === employee.positionId);
  const recent = employee
    ? attendanceEvents.filter((e) => e.employeeId === employee.id).slice(0, 6)
    : [];
  const computer = employee && computers.find((c) => c.assignedTo === employee.id);
  const perms = employee ? workPermissions.filter((p) => p.employeeId === employee.id).slice(0, 3) : [];

  return (
    <Sheet open={!!employee} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto">
        {employee && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {employee.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-base">{employee.fullName}</div>
                  <div className="text-xs font-normal text-muted-foreground">{pos?.title}</div>
                </div>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 pt-1">
                <StatusBadge value={employee.status} />
                <span className="text-xs">{dept?.name}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="px-4 pb-6">
              <div className="mb-4">
                <Button size="sm" variant="outline" onClick={() => onEdit(employee)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              </div>

              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 pt-4">
                  <Section title="Contact">
                    <Row icon={<Mail className="h-3.5 w-3.5" />} label={employee.email} />
                    <Row icon={<Phone className="h-3.5 w-3.5" />} label={employee.phone} />
                    <Row icon={<Calendar className="h-3.5 w-3.5" />} label={`Hired ${formatDate(employee.hiredAt)}`} />
                  </Section>

                  <Section title="Recent attendance">
                    {recent.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No recent events.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {recent.map((ev) => (
                          <div key={ev.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <StatusBadge value={ev.direction} />
                              <span className="text-xs text-muted-foreground">{formatDateTime(ev.at)}</span>
                            </div>
                            <StatusBadge value={ev.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>

                  <Section title="Computer">
                    {computer ? (
                      <div className="rounded-lg border border-border p-3 text-sm">
                        <div className="font-medium">{computer.hostname}</div>
                        <div className="text-xs text-muted-foreground">{computer.ip} · {computer.os}</div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No computer assigned.</p>
                    )}
                  </Section>

                  <Section title="Permissions">
                    {perms.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No requests.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {perms.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="text-sm capitalize">{p.type.replace("_", " ")}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(p.startDate)} – {formatDate(p.endDate)}
                              </div>
                            </div>
                            <StatusBadge value={p.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                </TabsContent>

                <TabsContent value="efficiency" className="space-y-6 pt-4">
                  <EfficiencyTab employeeId={employee.id} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function EfficiencyTab({ employeeId }: { employeeId: string }) {
  const range = defaultRange();
  const data = computeEfficiency(employeeId, range);
  const series = dailyEfficiencySeries(employeeId, range);
  const apps = appBreakdownFor(employeeId, range).slice(0, 8).map((a) => ({
    app: a.app,
    minutes: a.minutes,
    fill: a.productive ? "var(--color-success)" : "var(--color-destructive)",
  }));
  const computer = computers.find((c) => c.assignedTo === employeeId);
  const events = attendanceEvents
    .filter((e) => e.employeeId === employeeId)
    .slice(0, 8);
  const sessions = computer
    ? [...computerActivity]
        .filter((a) => a.computerId === computer.id)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 8)
    : [];

  return (
    <>
      <EfficiencyCard data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Daily efficiency</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: -16, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="efficiency" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Productive vs unproductive apps</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apps} layout="vertical" margin={{ left: 8, right: 16, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="app" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Productive</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Unproductive</span>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">Activity timeline</p>
        <div className="space-y-2">
          {[
            ...events.map((e) => ({ kind: "att" as const, at: e.at, item: e })),
            ...sessions.map((s) => ({ kind: "act" as const, at: s.startedAt, item: s })),
          ]
            .sort((a, b) => b.at.getTime() - a.at.getTime())
            .slice(0, 12)
            .map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  {row.kind === "att" ? (
                    <StatusBadge value={row.item.direction} />
                  ) : (
                    <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {row.item.category}
                    </span>
                  )}
                  <span>{row.kind === "att" ? `Door ${row.item.direction}` : row.item.app}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {row.kind === "att" ? formatDateTime(row.at) : `${formatTime(row.at)} · ${row.item.durationMinutes}m`}
                </span>
              </div>
            ))}
          {events.length === 0 && sessions.length === 0 && (
            <p className="text-xs text-muted-foreground">No activity captured for this period.</p>
          )}
        </div>
      </Card>
    </>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee | null;
  onSave: (form: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    departmentId: string;
    positionId: string;
    status: Employee["status"];
  }) => void;
}) {
  const [form, setForm] = useState({
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    departmentId: employee?.departmentId ?? departments[0]!.id,
    positionId: employee?.positionId ?? positions[0]!.id,
    status: (employee?.status ?? "active") as Employee["status"],
  });
  const deptPositions = positions.filter((p) => p.departmentId === form.departmentId);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setForm({
            firstName: employee?.firstName ?? "",
            lastName: employee?.lastName ?? "",
            email: employee?.email ?? "",
            phone: employee?.phone ?? "",
            departmentId: employee?.departmentId ?? departments[0]!.id,
            positionId: employee?.positionId ?? positions[0]!.id,
            status: (employee?.status ?? "active") as Employee["status"],
          });
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "New employee"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>First name</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Last name</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => {
                  const first = positions.find((p) => p.departmentId === v);
                  setForm({ ...form, departmentId: v, positionId: first?.id ?? form.positionId });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Position</Label>
              <Select value={form.positionId} onValueChange={(v) => setForm({ ...form, positionId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {deptPositions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Employee["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On leave</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.firstName || !form.lastName || !form.email}>
            {employee ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
