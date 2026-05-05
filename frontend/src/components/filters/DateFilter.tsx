import { DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

type DateFilterProps = {
  value?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
  allowClear?: boolean;
};

export function DateFilter({
  value,
  onChange,
  placeholder = 'Sanani tanlang',
  allowClear = false
}: DateFilterProps) {
  const handleChange = (date: Dayjs | null) => {
    if (onChange) {
      onChange(date ? date.format('YYYY-MM-DD') : '');
    }
  };

  return (
    <DatePicker
      value={value ? dayjs(value) : null}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear={allowClear}
      format="DD.MM.YYYY"
      className="w-full"
    />
  );
}
