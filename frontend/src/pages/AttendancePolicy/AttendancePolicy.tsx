import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Spin,
  Switch,
  Typography
} from 'antd';
import apiService from '@/services/api';
import type { AttendancePolicy } from '@/services/api';
import { canWrite } from '@/utils/can';

const { Title, Paragraph } = Typography;

export default function AttendancePolicyPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const writable = canWrite();

  useEffect(() => {
    const loadPolicy = async () => {
      setLoading(true);
      try {
        const data = await apiService.getAttendancePolicy();
        setPolicy(data);
        form.setFieldsValue({
          work_start_time: data?.work_start_time?.slice(0, 5) ?? '09:00',
          work_end_time: data?.work_end_time?.slice(0, 5) ?? '18:00',
          lunch_start_time: data?.lunch_start_time?.slice(0, 5) ?? '13:00',
          lunch_end_time: data?.lunch_end_time?.slice(0, 5) ?? '14:00',
          late_grace_minutes: data?.late_grace_minutes ?? 10,
          early_leave_grace_minutes: data?.early_leave_grace_minutes ?? 10,
          is_active: data?.is_active ?? true
        });
      } catch (error) {
        message.error('Attendance policyni yuklashda xato yuz berdi.');
      } finally {
        setLoading(false);
      }
    };

    void loadPolicy();
  }, [form]);

  const handleFinish = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = {
        work_start_time: `${String(values.work_start_time ?? '09:00')}:00`,
        work_end_time: `${String(values.work_end_time ?? '18:00')}:00`,
        lunch_start_time: values.lunch_start_time
          ? `${String(values.lunch_start_time)}:00`
          : null,
        lunch_end_time: values.lunch_end_time
          ? `${String(values.lunch_end_time)}:00`
          : null,
        late_grace_minutes: Number(values.late_grace_minutes ?? 0),
        early_leave_grace_minutes: Number(
          values.early_leave_grace_minutes ?? 0
        ),
        is_active: Boolean(values.is_active)
      };

      const result = await apiService.upsertAttendancePolicy(payload);
      setPolicy(result);
      message.success('Attendance policy saqlandi.');
    } catch (error) {
      message.error('Attendance policyni saqlashda xato yuz berdi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Title level={2}>Attendance Policy</Title>
        <Paragraph>
          Ish boshlanishi, ish tugashi, tushlik va kechikish uchun ruxsat
          berilgan vaqtlarni backend API orqali sozlash.
        </Paragraph>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          disabled={!writable}
          initialValues={{
            work_start_time: policy?.work_start_time?.slice(0, 5) ?? '09:00',
            work_end_time: policy?.work_end_time?.slice(0, 5) ?? '18:00',
            lunch_start_time: policy?.lunch_start_time?.slice(0, 5) ?? '13:00',
            lunch_end_time: policy?.lunch_end_time?.slice(0, 5) ?? '14:00',
            late_grace_minutes: policy?.late_grace_minutes ?? 10,
            early_leave_grace_minutes: policy?.early_leave_grace_minutes ?? 10,
            is_active: policy?.is_active ?? true
          }}
        >
          <Form.Item
            label="Kelish vaqti"
            name="work_start_time"
            rules={[{ required: true, message: 'Kelish vaqtini kiriting' }]}
          >
            <Input type="time" />
          </Form.Item>

          <Form.Item
            label="Ketish vaqti"
            name="work_end_time"
            rules={[{ required: true, message: 'Ketish vaqtini kiriting' }]}
          >
            <Input type="time" />
          </Form.Item>

          <Form.Item label="Tushlik boshlanish vaqti" name="lunch_start_time">
            <Input type="time" />
          </Form.Item>

          <Form.Item label="Tushlik tugash vaqti" name="lunch_end_time">
            <Input type="time" />
          </Form.Item>

          <Form.Item
            label="Kechikishga ruxsat (daqiqa)"
            name="late_grace_minutes"
            rules={[
              {
                required: true,
                message: 'Kechikish uchun ruxsat daqiqasini kiriting'
              }
            ]}
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>

          <Form.Item
            label="Erta ketishga ruxsat (daqiqa)"
            name="early_leave_grace_minutes"
            rules={[
              {
                required: true,
                message: 'Erta ketish uchun ruxsat daqiqasini kiriting'
              }
            ]}
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>

          <Form.Item
            label="Faol"
            name="is_active"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            {writable ? (
              <Button type="primary" htmlType="submit" loading={saving}>
                Saqlash
              </Button>
            ) : null}
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
