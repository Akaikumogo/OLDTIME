import { useState } from 'react';
import { Button, Card, DatePicker, Empty, Statistic } from 'antd';
import { RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import dayjs from 'dayjs';

const Reports = () => {
  const [dateFrom, setDateFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', dateFrom, dateTo],
    queryFn: () =>
      apiService.getAttendanceSummary({
        date_from: dateFrom,
        date_to: dateTo
      })
  });

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Hisobotlar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Davomat hisobotlari
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DatePicker
            value={dayjs(dateFrom)}
            onChange={(date) => setDateFrom(date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'))}
            format="DD.MM.YYYY"
          />
          <DatePicker
            value={dayjs(dateTo)}
            onChange={(date) => setDateTo(date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'))}
            format="DD.MM.YYYY"
          />
          <Button
            icon={<RefreshCw size={16} />}
            loading={isLoading}
            onClick={() => void refetch()}
          >
            Yangilash
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {data ? (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Card>
              <Statistic
                title="Jami hodisalar"
                value={data.total_events}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Aktiv xodimlar"
                value={data.active_employees}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Vaqtida kelgan"
                value={data.on_time}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Kechikkanlar"
                value={data.late}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Erta chiqqan"
                value={data.early_exit}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Vaqtida chiqqan"
                value={data.on_time_exit}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Tushlikka chiqqan"
                value={data.lunch_out}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
            <Card>
              <Statistic
                title="Tushlikdan qaytgan"
                value={data.lunch_return}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </div>
        ) : isLoading ? (
          <Card loading />
        ) : (
          <Empty description="Ma'lumot topilmadi" />
        )}
      </motion.div>
    </div>
  );
};

export default Reports;
