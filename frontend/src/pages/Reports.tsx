import { useState } from 'react';
import {
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Download, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import apiService from '@/services/api';
import type { AttendanceDailyRow } from '@/services/api';
import { formatDisplayDate } from '@/utils/date';

const STATUS_LABELS: Record<string, string> = {
  on_time: 'Vaqtida',
  late: 'Kechikdi',
  entry: 'Kirish',
  exit: 'Chiqish',
  lunch_out: 'Tushlikka',
  lunch_return: 'Qaytdi',
  early_exit: 'Erta ketdi',
  on_time_exit: 'Vaqtida ketdi',
  unmatched_employee: 'Topilmadi',
  ambiguous_employee: 'Shubhali',
  holiday: 'Bayram',
  weekend: 'Dam olish'
};

const STATUS_COLORS: Record<string, string> = {
  on_time: 'green',
  late: 'red',
  entry: 'blue',
  exit: 'default',
  lunch_out: 'gold',
  lunch_return: 'cyan',
  early_exit: 'volcano',
  on_time_exit: 'green',
  unmatched_employee: 'magenta',
  ambiguous_employee: 'purple'
};

const Reports = () => {
  const [dateFrom, setDateFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [employeeName, setEmployeeName] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.listDepartments()
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports-daily', dateFrom, dateTo, debouncedName, departmentId, statusFilter],
    queryFn: () =>
      apiService.listAttendanceDaily({
        page: 1,
        limit: 200,
        date_from: dateFrom,
        date_to: dateTo,
        employee_name: debouncedName || undefined,
        department_id: departmentId,
        status: statusFilter,
        sort: 'employee_name',
        order: 'asc'
      })
  });

  const rows = data?.data ?? [];

  const handleSearch = (value: string) => {
    setEmployeeName(value);
    const timer = setTimeout(() => setDebouncedName(value), 400);
    return () => clearTimeout(timer);
  };

  const buildExcelRows = (sourceRows: AttendanceDailyRow[]) => {
    return sourceRows.map((row) => {
      const entries = row.markers
        .filter((m) => m.type === 'entry')
        .map((m) => m.full_time || m.time);
      const exits = row.markers
        .filter((m) => m.type === 'exit')
        .map((m) => m.full_time || m.time);

      const maxLen = Math.max(entries.length, exits.length, 1);
      const entryExitPairs: Record<string, string> = {};
      for (let i = 0; i < maxLen; i++) {
        entryExitPairs[`Kirish ${i + 1}`] = entries[i] ?? '-';
        entryExitPairs[`Chiqish ${i + 1}`] = exits[i] ?? '-';
      }

      return {
        'Xodim': row.employee.full_name,
        'Sana': formatDisplayDate(row.date),
        ...entryExitPairs,
        'Holat': row.statuses.map((s) => STATUS_LABELS[s] || s).join(', ') || '-'
      };
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let allRows: AttendanceDailyRow[] = [];

      if ((data?.meta.total ?? 0) <= 200) {
        allRows = rows;
      } else {
        const fullData = await apiService.listAttendanceDaily({
          page: 1,
          limit: 2000,
          date_from: dateFrom,
          date_to: dateTo,
          employee_name: debouncedName || undefined,
          department_id: departmentId,
          status: statusFilter,
          sort: 'employee_name',
          order: 'asc'
        });
        allRows = fullData.data;
      }

      const excelRows = buildExcelRows(allRows);
      const ws = XLSX.utils.json_to_sheet(excelRows);

      const colWidths = Object.keys(excelRows[0] ?? {}).map((key) => ({
        wch: Math.max(
          key.length,
          ...excelRows.map((r) => String((r as Record<string, string>)[key] ?? '').length)
        ) + 2
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Davomat');

      const fileName = `davomat_${dateFrom}_${dateTo}.xlsx`;
      XLSX.writeFile(wb, fileName);
      void message.success(`${fileName} yuklandi`);
    } catch {
      void message.error('Excel yuklashda xato yuz berdi');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: ColumnsType<AttendanceDailyRow> = [
    {
      title: 'Xodim',
      dataIndex: ['employee', 'full_name'],
      fixed: 'left',
      width: 220
    },
    {
      title: 'Sana',
      dataIndex: 'date',
      width: 110,
      render: (v: string) => formatDisplayDate(v)
    },
    {
      title: 'Kirdi',
      dataIndex: 'first_entry',
      width: 100,
      render: (v?: string | null) => v || '-'
    },
    {
      title: 'Ketdi',
      dataIndex: 'last_exit',
      width: 100,
      render: (v?: string | null) => v || '-'
    },
    {
      title: 'Barcha vaqtlar',
      key: 'all_times',
      render: (_, row) => (
        <div className="flex flex-wrap gap-1">
          {row.markers.map((m, i) => (
            <Tag
              key={i}
              color={m.type === 'entry' ? 'blue' : 'orange'}
              className="font-mono text-xs"
            >
              {m.type === 'entry' ? '↓' : '↑'} {m.full_time || m.time}
            </Tag>
          ))}
          {row.markers.length === 0 && (
            <span className="text-slate-400">-</span>
          )}
        </div>
      )
    },
    {
      title: 'Holat',
      dataIndex: 'statuses',
      width: 160,
      render: (statuses: string[]) => (
        <div className="flex flex-wrap gap-1">
          {statuses.map((s) => (
            <Tag key={s} color={STATUS_COLORS[s] || 'default'}>
              {STATUS_LABELS[s] || s}
            </Tag>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-none flex-col gap-5 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
              Hisobotlar
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Davomat hisobotlari — Excel yuklab olish
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              icon={<RefreshCw size={16} />}
              loading={isLoading}
              onClick={() => void refetch()}
            >
              Yangilash
            </Button>
            <Button
              type="primary"
              icon={<Download size={16} />}
              loading={isExporting}
              disabled={rows.length === 0}
              onClick={() => void handleExport()}
            >
              Excel yuklab olish
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_160px_160px_200px_200px]">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Xodim ismi
              </label>
              <Input.Search
                size="large"
                placeholder="Xodim qidirish..."
                value={employeeName}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
                className="[&_.ant-input-affix-wrapper]:rounded-[10px] [&_.ant-input-group-addon_.ant-btn]:rounded-r-[10px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Boshlanish
              </label>
              <DatePicker
                size="large"
                value={dayjs(dateFrom)}
                onChange={(d) => setDateFrom(d?.format('YYYY-MM-DD') ?? dateFrom)}
                format="DD.MM.YYYY"
                className="w-full rounded-[10px]"
                allowClear={false}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tugash
              </label>
              <DatePicker
                size="large"
                value={dayjs(dateTo)}
                onChange={(d) => setDateTo(d?.format('YYYY-MM-DD') ?? dateTo)}
                format="DD.MM.YYYY"
                className="w-full rounded-[10px]"
                allowClear={false}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Bo'lim
              </label>
              <Select
                size="large"
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="Barcha bo'limlar"
                allowClear
                className="w-full [&_.ant-select-selector]:!rounded-[10px]"
                options={departments?.map((d) => ({ value: d.id, label: d.name })) ?? []}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Holat
              </label>
              <Select
                size="large"
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Barcha holatlar"
                allowClear
                className="w-full [&_.ant-select-selector]:!rounded-[10px]"
                options={Object.entries(STATUS_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l
                }))}
              />
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950"
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={isLoading}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{
              emptyText: (
                <div className="flex min-h-[240px] items-center justify-center">
                  <Empty description="Ma'lumot topilmadi" />
                </div>
              )
            }}
            title={() => (
              <div className="flex items-center justify-between px-2 py-1">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Natijalar:{' '}
                  <Tag>{data?.meta.total ?? rows.length} ta yozuv</Tag>
                </span>
                <span className="text-xs text-slate-400">
                  {dateFrom === dateTo ? formatDisplayDate(dateFrom) : `${formatDisplayDate(dateFrom)} – ${formatDisplayDate(dateTo)}`}
                </span>
              </div>
            )}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default Reports;
