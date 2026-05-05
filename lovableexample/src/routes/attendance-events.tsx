import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmployeeCell } from "@/components/data/EmployeeCell";
import { attendanceEvents, doors, employeeById, type AttendanceEvent } from "@/lib/mock";
import { formatDateTime } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/attendance-events")({
  head: () => ({
    meta: [
      { title: "Attendance Events — WorkPlus" },
      { name: "description", content: "Door swipe history with employee, time, and status." },
      { property: "og:title", content: "Attendance Events — WorkPlus" },
      { property: "og:description", content: "Door swipe history with employee, time, and status." },
    ],
  }),
  component: AttendanceEventsPage,
});

function AttendanceEventsPage() {
  const [doorFilter, setDoorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dirFilter, setDirFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      attendanceEvents.filter(
        (e) =>
          (doorFilter === "all" || e.doorId === doorFilter) &&
          (statusFilter === "all" || e.status === statusFilter) &&
          (dirFilter === "all" || e.direction === dirFilter),
      ),
    [doorFilter, statusFilter, dirFilter],
  );

  const columns: Column<AttendanceEvent>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => {
        const e = employeeById(r.employeeId);
        return <EmployeeCell name={e?.fullName ?? "—"} initials={e?.initials ?? "?"} subtitle={e?.email} />;
      },
    },
    {
      key: "door",
      header: "Door",
      cell: (r) => (
        <span className="text-sm">{doors.find((d) => d.id === r.doorId)?.name ?? "—"}</span>
      ),
    },
    { key: "direction", header: "Direction", cell: (r) => <StatusBadge value={r.direction} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "at",
      header: "Time",
      cell: (r) => <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(r.at)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance Events"
        description={`${attendanceEvents.length.toLocaleString()} events recorded across all doors.`}
      />
      <div className="px-6 py-6">
        <Card className="p-0">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            pageSize={15}
            searchKeys={[(r) => employeeById(r.employeeId)?.fullName ?? ""]}
            searchPlaceholder="Search by employee..."
            toolbar={
              <>
                <Select value={doorFilter} onValueChange={setDoorFilter}>
                  <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Door" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All doors</SelectItem>
                    {doors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dirFilter} onValueChange={setDirFilter}>
                  <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Direction" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Both</SelectItem>
                    <SelectItem value="in">Entry</SelectItem>
                    <SelectItem value="out">Exit</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="on_time">On time</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="early_leave">Early leave</SelectItem>
                    <SelectItem value="overtime">Overtime</SelectItem>
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
