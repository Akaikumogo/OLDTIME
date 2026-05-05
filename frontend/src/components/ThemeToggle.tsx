import { useApp } from '@/Providers/Configuration';
import { Button } from 'antd';

import { Moon, Sun } from 'lucide-react';
import {
  ThemeAnimationType,
  useModeAnimation
} from 'react-theme-switch-animation';

export const ThemeToggle = () => {
  const { theme, setTheme } = useApp();
  const isDark = theme === 'dark';

  const { ref, toggleSwitchTheme } = useModeAnimation({
    animationType: ThemeAnimationType.CIRCLE
  });

  const handleClick = () => {
    toggleSwitchTheme().then(() => {
      setTheme(isDark ? 'light' : 'dark');
    });
  };

  return (
    <Button
      ref={ref}
      type="default"
      size="large"
      onClick={handleClick}
      icon={isDark ? <Sun size={16} /> : <Moon size={16} />}
    />
  );
};
