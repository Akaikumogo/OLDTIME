import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmployeeCell } from "@/components/data/EmployeeCell";
import {
  workPermissions as initial,
  type WorkPermission,
  type PermissionStatus,
  employeeById,
} from "@/lib/mock";
import { formatDate } from "@/lib/format";
import { Check, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/work-permissions")({
  head: () => ({
    meta: [
      { title: "Work Permissions — WorkPlus" },
      { name: "description", content: "Approve or reject leave, remote, overtime, and trip requests." },
      { property: "og:title", content: "Work Permissions — WorkPlus" },
      { property: "og:description", content: "Approve or reject leave, remote, overtime, and trip requests." },
    ],
  }),
  component: WorkPermissionsPage,
});

function WorkPermissionsPage() {
  const [rows, setRows] = useState<WorkPermission[]>(initial);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (typeFilter === "all" || r.type === typeFilter) &&
          (statusFilter === "all" || r.status === statusFilter),
      ),
    [rows, typeFilter, statusFilter],
  );

  function setStatus(id: string, status: PermissionStatus) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success(`Request ${status}`);
  }

  const columns: Column<WorkPermission>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => {
        const e = employeeById(r.employeeId);
        return <EmployeeCell name={e?.fullName ?? "—"} initials={e?.initials ?? "?"} />;
      },
    },
    { key: "type", header: "Type", cell: (r) => <StatusBadge value={r.type} /> },
    {
      key: "dates",
      header: "Dates",
      cell: (r) => (
        <span className="text-sm tabular-nums">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (r) => <span className="text-sm text-muted-foreground">{r.reason}</span>,
    },
    { key: "approver", header: "Approver", cell: (r) => <span className="text-sm">{r.approver}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions",
      header: "",
      width: "150px",
      cell: (r) =>
        r.status === "pending" ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" className="h-7" onClick={() => setStatus(r.id, "approved")}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setStatus(r.id, "rejected")}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Work Permissions"
        description={`${rows.filter((r) => r.status === "pending").length} pending requests need attention.`}
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            searchKeys={[(r) => employeeById(r.employeeId)?.fullName ?? "", "reason"]}
            searchPlaceholder="Search permissions..."
            toolbar={
              <>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="overtime">Overtime</SelectItem>
                    <SelectItem value="business_trip">Business trip</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        </Card>
      </div>
    </div>
  );
}
