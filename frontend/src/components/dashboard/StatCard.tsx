import { Card } from 'antd';
import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone: string;
};

export function StatCard({ icon: Icon, label, value, hint, tone }: StatCardProps) {
  return (
    <Card className="rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-950 dark:text-white">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {hint}
            </p>
          )}
        </div>
        <div className={`shrink-0 rounded-lg p-3 ${tone}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}
