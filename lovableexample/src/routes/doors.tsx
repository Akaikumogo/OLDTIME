import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { OnlineDot } from "@/components/common/OnlineDot";
import { doors as initial, type Door, type DoorType } from "@/lib/mock";
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

export const Route = createFileRoute("/doors")({
  head: () => ({
    meta: [
      { title: "Doors — WorkPlus" },
      { name: "description", content: "Manage access-controlled doors and their status." },
      { property: "og:title", content: "Doors — WorkPlus" },
      { property: "og:description", content: "Manage access-controlled doors and their status." },
    ],
  }),
  component: DoorsPage,
});

const TYPES: DoorType[] = ["entry", "exit", "bidirectional"];

function DoorsPage() {
  const [rows, setRows] = useState<Door[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Door | null>(null);

  const columns: Column<Door>[] = [
    {
      key: "name",
      header: "Door",
      cell: (r) => (
        <div>
          <div className="text-sm font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">{r.location}</div>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (r) => <StatusBadge value={r.type} /> },
    { key: "ip", header: "IP", cell: (r) => <span className="font-mono text-xs">{r.ip}</span> },
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
      key: "lastEvent",
      header: "Last event",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(r.lastEventAt, { addSuffix: true })}
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
        title="Doors"
        description={`${rows.filter((d) => d.online).length}/${rows.length} doors online`}
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add door
          </Button>
        }
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(r) => r.id}
            searchKeys={["name", "ip", "location"]}
            searchPlaceholder="Search doors..."
          />
        </Card>
      </div>

      <DoorDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        record={editing}
        onSave={(form) => {
          if (editing) {
            setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
            toast.success("Door updated");
          } else {
            setRows((rs) => [
              ...rs,
              { ...form, id: `door_${Date.now()}`, lastEventAt: new Date() },
            ]);
            toast.success("Door added");
          }
          setOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function DoorDialog({
  open,
  onOpenChange,
  record,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: Door | null;
  onSave: (form: Omit<Door, "id" | "lastEventAt">) => void;
}) {
  const [form, setForm] = useState<Omit<Door, "id" | "lastEventAt">>({
    name: record?.name ?? "",
    location: record?.location ?? "",
    type: record?.type ?? "bidirectional",
    ip: record?.ip ?? "",
    online: record?.online ?? true,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setForm({
            name: record?.name ?? "",
            location: record?.location ?? "",
            type: record?.type ?? "bidirectional",
            ip: record?.ip ?? "",
            online: record?.online ?? true,
          });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? "Edit door" : "New door"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as DoorType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>IP address</Label>
              <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Online</Label>
              <p className="text-xs text-muted-foreground">Reachable on the network</p>
            </div>
            <Switch checked={form.online} onCheckedChange={(v) => setForm({ ...form, online: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name || !form.ip}>
            {record ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
