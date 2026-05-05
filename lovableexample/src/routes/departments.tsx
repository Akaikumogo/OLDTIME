import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/DataTable";
import { departments as initial, type Department, employees } from "@/lib/mock";
import { formatDate } from "@/lib/format";
import { Plus, Users } from "lucide-react";
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

export const Route = createFileRoute("/departments")({
  head: () => ({
    meta: [
      { title: "Departments — WorkPlus" },
      { name: "description", content: "Manage organisational departments and managers." },
      { property: "og:title", content: "Departments — WorkPlus" },
      { property: "og:description", content: "Manage organisational departments and managers." },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const [rows, setRows] = useState<Department[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const columns: Column<Department>[] = [
    {
      key: "name",
      header: "Department",
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs">
            {r.code}
          </div>
          <div>
            <div className="text-sm font-medium">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.code}</div>
          </div>
        </div>
      ),
    },
    { key: "manager", header: "Manager", cell: (r) => <span className="text-sm">{r.manager}</span> },
    {
      key: "headcount",
      header: "Headcount",
      cell: (r) => {
        const real = employees.filter((e) => e.departmentId === r.id).length;
        return (
          <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {real}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
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
        title="Departments"
        description="Organize the company structure."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add department
          </Button>
        }
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(r) => r.id}
            searchKeys={["name", "manager", "code"]}
            searchPlaceholder="Search departments..."
          />
        </Card>
      </div>

      <DepartmentDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        record={editing}
        onSave={(form) => {
          if (editing) {
            setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
            toast.success("Department updated");
          } else {
            setRows((rs) => [
              ...rs,
              {
                ...form,
                id: `dep_${Date.now()}`,
                createdAt: new Date(),
                headcount: 0,
              },
            ]);
            toast.success("Department created");
          }
          setOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function DepartmentDialog({
  open,
  onOpenChange,
  record,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: Department | null;
  onSave: (form: { name: string; code: string; manager: string }) => void;
}) {
  const [form, setForm] = useState({
    name: record?.name ?? "",
    code: record?.code ?? "",
    manager: record?.manager ?? "",
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setForm({
            name: record?.name ?? "",
            code: record?.code ?? "",
            manager: record?.manager ?? "",
          });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? "Edit department" : "New department"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={4}
              />
            </div>
            <div className="grid gap-2">
              <Label>Manager</Label>
              <Input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name || !form.code}>
            {record ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
