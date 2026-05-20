import { Tag } from 'antd';
import type { CameraStatus } from '@/services/api';

const statusMap: Record<CameraStatus, { color: string; label: string }> = {
  online: { color: 'green', label: 'Online' },
  offline: { color: 'red', label: 'Offline' },
  error: { color: 'volcano', label: 'Xato' },
  testing: { color: 'blue', label: 'Test' },
  unknown: { color: 'default', label: "Noma'lum" }
};

export function CameraStatusBadge({ status }: { status?: CameraStatus }) {
  const item = statusMap[status || 'unknown'] || statusMap.unknown;
  return <Tag color={item.color}>{item.label}</Tag>;
}
