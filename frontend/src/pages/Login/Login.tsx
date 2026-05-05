import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import apiService from '@/services/api';

const { Title, Text } = Typography;

type LoginForm = {
  username: string;
  password: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isLoggedIn =
      localStorage.getItem('isLoggedIn') === 'true' ||
      sessionStorage.getItem('isLoggedIn') === 'true';
    const token =
      localStorage.getItem('accessToken') ||
      sessionStorage.getItem('accessToken');

    if (isLoggedIn && token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (values: LoginForm) => {
    setSubmitting(true);
    setError(null);

    try {
      await apiService.login(values.username, values.password);
      navigate('/dashboard', { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Kirish amalga oshmadi. Maʼlumotlarni tekshirib qayta urinib ko‘ring.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border border-slate-200 shadow-sm dark:border-slate-800/70">
        <div className="mb-6">
      
          <Title level={2} className="!mb-1 !mt-2">
            Tizimga kirish
          </Title>
          
        </div>

        {error ? <Alert type="error" showIcon className="mb-4" message={error} /> : null}

        <Form<LoginForm> layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            label="Login"
            name="username"
            rules={[{ required: true, message: 'Login kiriting' }]}
          >
            <Input placeholder="username" size="large" />
          </Form.Item>

          <Form.Item
            label="Parol"
            name="password"
            rules={[{ required: true, message: 'Parol kiriting' }]}
          >
            <Input.Password placeholder="••••••••" size="large" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            Kirish
          </Button>
        </Form>
      </Card>
    </div>
  );
}
