import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/DataTable";
import { OnlineDot } from "@/components/common/OnlineDot";
import { computers as initial, employeeById, type Computer, employees } from "@/lib/mock";
import { formatDistanceToNow } from "date-fns";
import { Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/computers")({
  head: () => ({
    meta: [
      { title: "Computers — WorkPlus" },
      { name: "description", content: "Manage workstations, assignments, and connectivity." },
      { property: "og:title", content: "Computers — WorkPlus" },
      { property: "og:description", content: "Manage workstations, assignments, and connectivity." },
    ],
  }),
  component: ComputersPage,
});

function ComputersPage() {
  const [rows, setRows] = useState<Computer[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Computer | null>(null);

  const columns: Column<Computer>[] = [
    {
      key: "host",
      header: "Hostname",
      cell: (r) => <span className="font-mono text-sm">{r.hostname}</span>,
    },
    {
      key: "user",
      header: "Assigned to",
      cell: (r) => {
        const e = r.assignedTo ? employeeById(r.assignedTo) : null;
        return <span className="text-sm">{e?.fullName ?? "—"}</span>;
      },
    },
    { key: "ip", header: "IP", cell: (r) => <span className="font-mono text-xs">{r.ip}</span> },
    { key: "os", header: "OS", cell: (r) => <span className="text-sm">{r.os}</span> },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <OnlineDot online={r.online} />
          <span className="text-sm">{r.online ? "Online" : "Offline"}</span>
        </div>
      ),
    },
    {
      key: "hb",
      header: "Last heartbeat",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(r.lastHeartbeat, { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true); }}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Computers"
        description={`${rows.filter((c) => c.online).length}/${rows.length} workstations online`}
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add computer
          </Button>
        }
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(r) => r.id}
            searchKeys={["hostname", "ip", (r) => (r.assignedTo ? employeeById(r.assignedTo)?.fullName ?? "" : "")]}
            searchPlaceholder="Search computers..."
          />
        </Card>
      </div>

      <ComputerDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        record={editing}
        onSave={(form) => {
          if (editing) {
            setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
            toast.success("Computer updated");
          } else {
            setRows((rs) => [
              ...rs,
              { ...form, id: `cmp_${Date.now()}`, lastHeartbeat: new Date() },
            ]);
            toast.success("Computer added");
          }
          setOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function ComputerDialog({
  open,
  onOpenChange,
  record,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: Computer | null;
  onSave: (form: Omit<Computer, "id" | "lastHeartbeat">) => void;
}) {
  const [form, setForm] = useState<Omit<Computer, "id" | "lastHeartbeat">>({
    hostname: record?.hostname ?? "",
    assignedTo: record?.assignedTo ?? null,
    ip: record?.ip ?? "",
    os: record?.os ?? "Windows 11",
    online: record?.online ?? true,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setForm({
            hostname: record?.hostname ?? "",
            assignedTo: record?.assignedTo ?? null,
            ip: record?.ip ?? "",
            os: record?.os ?? "Windows 11",
            online: record?.online ?? true,
          });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? "Edit computer" : "New computer"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Hostname</Label>
            <Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>IP address</Label>
              <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>OS</Label>
              <Select value={form.os} onValueChange={(v) => setForm({ ...form, os: v as Computer["os"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Windows 11">Windows 11</SelectItem>
                  <SelectItem value="macOS 14">macOS 14</SelectItem>
                  <SelectItem value="Ubuntu 22.04">Ubuntu 22.04</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Assigned employee</Label>
            <Select
              value={form.assignedTo ?? "none"}
              onValueChange={(v) => setForm({ ...form, assignedTo: v === "none" ? null : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label>Online</Label>
            <Switch checked={form.online} onCheckedChange={(v) => setForm({ ...form, online: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.hostname || !form.ip}>
            {record ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
