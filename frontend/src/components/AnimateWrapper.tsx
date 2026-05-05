import { memo } from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';

const AnimateWrapper = memo(({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();

  return (
    <motion.div
      initial={{ x: -10, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 10, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      key={pathname}
    >
      {children}
    </motion.div>
  );
});

export default AnimateWrapper;
