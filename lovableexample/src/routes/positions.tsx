import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/DataTable";
import { positions as initial, type Position, departments } from "@/lib/mock";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/positions")({
  head: () => ({
    meta: [
      { title: "Positions — WorkPlus" },
      { name: "description", content: "Define job positions and seniority levels." },
      { property: "og:title", content: "Positions — WorkPlus" },
      { property: "og:description", content: "Define job positions and seniority levels." },
    ],
  }),
  component: PositionsPage,
});

const LEVELS: Position["level"][] = ["Junior", "Mid", "Senior", "Lead", "Manager"];

function PositionsPage() {
  const [rows, setRows] = useState<Position[]>(initial);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);

  const filtered = useMemo(
    () => (deptFilter === "all" ? rows : rows.filter((r) => r.departmentId === deptFilter)),
    [rows, deptFilter],
  );

  const columns: Column<Position>[] = [
    { key: "title", header: "Title", cell: (r) => <span className="text-sm font-medium">{r.title}</span> },
    {
      key: "department",
      header: "Department",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {departments.find((d) => d.id === r.departmentId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "level",
      header: "Level",
      cell: (r) => (
        <span className="inline-flex rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium">
          {r.level}
        </span>
      ),
    },
    { key: "openings", header: "Openings", cell: (r) => <span className="tabular-nums text-sm">{r.openings}</span> },
    {
      key: "actions",
      header: "",
      width: "80px",
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(r);
            setOpen(true);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Positions"
        description="Roles available across all departments."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add position
          </Button>
        }
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            searchKeys={["title"]}
            searchPlaceholder="Search positions..."
            toolbar={
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </Card>
      </div>

      <PositionDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        record={editing}
        onSave={(form) => {
          if (editing) {
            setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
            toast.success("Position updated");
          } else {
            setRows((rs) => [...rs, { ...form, id: `pos_${Date.now()}` }]);
            toast.success("Position created");
          }
          setOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function PositionDialog({
  open,
  onOpenChange,
  record,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: Position | null;
  onSave: (form: Omit<Position, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<Position, "id">>({
    title: record?.title ?? "",
    departmentId: record?.departmentId ?? departments[0]!.id,
    level: record?.level ?? "Mid",
    openings: record?.openings ?? 0,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setForm({
            title: record?.title ?? "",
            departmentId: record?.departmentId ?? departments[0]!.id,
            level: record?.level ?? "Mid",
            openings: record?.openings ?? 0,
          });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? "Edit position" : "New position"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Level</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as Position["level"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Openings</Label>
            <Input
              type="number"
              min={0}
              value={form.openings}
              onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.title}>
            {record ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
