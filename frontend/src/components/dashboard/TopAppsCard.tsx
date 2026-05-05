import { Card, Empty } from 'antd';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { DASHBOARD_CHART_COLORS } from '@/features/dashboard/constants';
import type { DashboardTopApp } from '@/features/dashboard/types';

type TopAppsCardProps = {
  apps: DashboardTopApp[];
};

export function TopAppsCard({ apps }: TopAppsCardProps) {
  const data = apps.slice(0, 8).map((item) => ({
    name: item.name,
    hours: Number((item.duration_seconds / 3600).toFixed(1))
  }));

  return (
    <Card title="Top ilovalar" className="rounded-lg">
      {data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="hours"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={index}
                      fill={DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} soat`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 self-center">
            {apps.slice(0, 5).map((item, index) => (
              <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length]
                    }}
                  />
                  {item.name}
                </span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400">
                  {Math.round(item.duration_seconds / 60)} daq
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kompyuter faolligi yo'q" />
      )}
    </Card>
  );
}
