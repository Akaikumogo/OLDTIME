import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { admins as initial, type Admin, type AdminRole } from "@/lib/mock";
import { formatDateTime } from "@/lib/format";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";

export const Route = createFileRoute("/admins")({
  head: () => ({
    meta: [
      { title: "Admins — WorkPlus" },
      { name: "description", content: "Manage admin accounts, roles, and access in WorkPlus." },
      { property: "og:title", content: "Admins — WorkPlus" },
      { property: "og:description", content: "Manage admin accounts, roles, and access in WorkPlus." },
    ],
  }),
  component: AdminsPage,
});

const ROLES: AdminRole[] = ["Owner", "Admin", "Manager", "Viewer"];

function AdminsPage() {
  const [rows, setRows] = useState<Admin[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);

  const columns: Column<Admin>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <div>
          <div className="text-sm font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">@{r.username}</div>
        </div>
      ),
    },
    { key: "email", header: "Email", cell: (r) => <span className="text-sm">{r.email}</span> },
    { key: "role", header: "Role", cell: (r) => <StatusBadge value={r.role} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "lastLogin",
      header: "Last login",
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDateTime(r.lastLogin)}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(r);
            setOpen(true);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  function handleSave(form: Omit<Admin, "id" | "lastLogin">) {
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
      toast.success("Admin updated");
    } else {
      setRows((rs) => [
        ...rs,
        { ...form, id: `adm_${Date.now()}`, lastLogin: new Date() } as Admin,
      ]);
      toast.success("Admin created");
    }
    setOpen(false);
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        title="Admins"
        description="Manage who can access the WorkPlus admin console."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add admin
          </Button>
        }
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(r) => r.id}
            searchKeys={["name", "email", "username"]}
            searchPlaceholder="Search admins..."
          />
        </Card>
      </div>

      <AdminDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        admin={editing}
        onSave={handleSave}
      />
    </div>
  );
}

function AdminDialog({
  open,
  onOpenChange,
  admin,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  admin: Admin | null;
  onSave: (a: Omit<Admin, "id" | "lastLogin">) => void;
}) {
  const [form, setForm] = useState<Omit<Admin, "id" | "lastLogin">>({
    name: admin?.name ?? "",
    username: admin?.username ?? "",
    email: admin?.email ?? "",
    role: admin?.role ?? "Viewer",
    status: admin?.status ?? "active",
  });

  // reset on open
  useState(() => undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setForm({
            name: admin?.name ?? "",
            username: admin?.username ?? "",
            email: admin?.email ?? "",
            role: admin?.role ?? "Viewer",
            status: admin?.status ?? "active",
          });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{admin ? "Edit admin" : "New admin"}</DialogTitle>
          <DialogDescription>
            {admin ? "Update the admin's details and role." : "Invite a new admin to WorkPlus."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AdminRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as Admin["status"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name || !form.email}>
            {admin ? "Save changes" : "Create admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
