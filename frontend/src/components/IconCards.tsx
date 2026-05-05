import { motion } from 'motion/react';
import { MousePointerClick, SmilePlus, ZapIcon } from 'lucide-react';

const icons = [MousePointerClick, ZapIcon, SmilePlus];

const IconCards = () => {
  return (
    <div className="flex justify-center gap-12 mt-8">
      {icons.map((Icon, index) => (
        <motion.div
          key={index}
          className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-2xl bg-white dark:bg-[#2d3748] shadow-md dark:shadow-sm border border-[#2563eb] dark:border-[#2563eb] cursor-pointer"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.2, duration: 0.4 }}
          whileHover={{ scale: 1.1, rotate: [0, 2, -2, 0] }}
        >
          <Icon className="w-7 h-7 text-[#3b82f6]" />
        </motion.div>
      ))}
    </div>
  );
};

export default IconCards;
