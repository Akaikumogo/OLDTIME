import { useEffect, useState } from 'react';

interface RecentEvent {
  timestamp: string;
  type: 'PROCESSED' | 'SKIPPED_NO_ID' | string;
  event_id?: string;
  employee_name?: string;
  card_id?: string;
  device_ip?: string;
  door_id?: string;
  reason?: string;
  raw_data?: Record<string, unknown>;
}

interface DeviceHealth {
  status: 'online' | 'offline' | 'unknown';
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

interface HikvisionStatus {
  running: boolean;
  poll_interval_seconds: number;
  active_doors: number;
  last_tick_at: string | null;
  last_error: string | null;
  stats: {
    total_events_processed: number;
    total_events_skipped: number;
    total_errors: number;
  };
  recent_events: RecentEvent[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useHikvisionStatus(pollInterval: number = 5000) {
  const [status, setStatus] = useState<HikvisionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/hikvision/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: HikvisionStatus = await response.json();
      setStatus(data);
      setLoading(false);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to fetch status';
      setError(errorMsg);
      setLoading(false);
      console.error('Hikvision status error:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  return { status, loading, error, refetch: fetchStatus };
}

export function useDeviceHealth(
  ipAddress: string,
  pollInterval: number = 10000
) {
  const [health, setHealth] = useState<DeviceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_URL}/hikvision/device-health/${ipAddress}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: DeviceHealth = await response.json();
      setHealth(data);
      setLoading(false);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to fetch device health';
      setError(errorMsg);
      setLoading(false);
      console.error('Device health error:', err);
    }
  };

  useEffect(() => {
    if (!ipAddress) {
      setLoading(false);
      return;
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, pollInterval);
    return () => clearInterval(interval);
  }, [ipAddress, pollInterval]);

  return { health, loading, error, refetch: fetchHealth };
}
