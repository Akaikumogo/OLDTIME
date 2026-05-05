import { Radio } from 'antd';
import { Calendar } from 'lucide-react';
import dayjs from 'dayjs';

export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month';

type DateRangeFilterProps = {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
};

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const presets = [
    { key: 'today' as const, label: 'Bugun' },
    { key: 'yesterday' as const, label: 'Kecha' },
    { key: 'week' as const, label: 'Hafta' },
    { key: 'month' as const, label: 'Oy' }
  ];

  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
      <Calendar size={18} className="text-slate-500 dark:text-slate-400" />
      <Radio.Group
        value={value}
        onChange={(e) => onChange(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        size="small"
      >
        {presets.map((preset) => (
          <Radio.Button key={preset.key} value={preset.key}>
            {preset.label}
          </Radio.Button>
        ))}
      </Radio.Group>
    </div>
  );
}

export function useDateRange(preset: DateRangePreset): { from: string; to: string } {
  const today = dayjs();
  switch (preset) {
    case 'today':
      return {
        from: today.format('YYYY-MM-DD'),
        to: today.format('YYYY-MM-DD')
      };
    case 'yesterday':
      return {
        from: today.subtract(1, 'day').format('YYYY-MM-DD'),
        to: today.subtract(1, 'day').format('YYYY-MM-DD')
      };
    case 'week':
      return {
        from: today.startOf('week').format('YYYY-MM-DD'),
        to: today.endOf('week').format('YYYY-MM-DD')
      };
    case 'month':
      return {
        from: today.startOf('month').format('YYYY-MM-DD'),
        to: today.endOf('month').format('YYYY-MM-DD')
      };
  }
}
