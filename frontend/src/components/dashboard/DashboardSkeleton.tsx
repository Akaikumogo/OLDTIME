import { Card, Skeleton } from 'antd';

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index} className="rounded-lg">
            <Skeleton active paragraph={{ rows: 2 }} title={{ width: '45%' }} />
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card className="rounded-lg">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
        <Card className="rounded-lg">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
      <Card className="rounded-lg">
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    </div>
  );
}
