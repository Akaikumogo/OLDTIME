import noDataImg from '@/assets/no-data.png';

interface Props {
  text?: string;
}

const NoData = ({ text }: Props) => (
  <div className="flex flex-col items-center justify-center py-16 select-none">
    <img
      src={noDataImg}
      alt="No data"
      className="w-50 h-50 object-contain mb-4 opacity-90"
      draggable={false}
    />
    {text && (
      <p className="text-sm text-slate-400 dark:text-slate-500">{text}</p>
    )}
  </div>
);

export default NoData;
