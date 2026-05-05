import { Button, Card, Typography } from 'antd';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl border border-slate-200 text-center shadow-sm dark:border-slate-800/70">
        <Text className="text-slate-500 dark:text-slate-400">404</Text>
        <Title level={2} className="!mb-2 !mt-2">
          Sahifa topilmadi
        </Title>
        <Text className="block text-slate-500 dark:text-slate-400">
          So‘ralgan route mavjud emas yoki hali ishlab chiqilmagan.
        </Text>
        <Link to="/dashboard">
          <Button type="primary" className="!mt-6">
            Bosh sahifaga qaytish
          </Button>
        </Link>
      </Card>
    </div>
  );
}
