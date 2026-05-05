import { Card, Empty } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { DASHBOARD_CHART_COLORS } from '@/features/dashboard/constants';
import type { DashboardChartDatum } from '@/features/dashboard/types';

type DashboardChartProps = {
  data: DashboardChartDatum[];
};

export function DashboardChart({ data }: DashboardChartProps) {
  const hasData = data.some((item) => item.value > 0);

  return (
    <Card title="Davomat taqsimoti" className="rounded-lg">
      {hasData ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20, right: 16, top: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, index) => (
                  <Cell
                    key={index}
                    fill={DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Davomat yo'q" />
      )}
    </Card>
  );
}
