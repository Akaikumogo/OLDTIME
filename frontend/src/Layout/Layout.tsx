import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  BarChart2,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  ClipboardList,
  DoorOpen,
  FileText,
  Home,
  Languages,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  Users
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from '@/hooks/useTranslation';
import { latinTextToCyrillic } from '@/utils/latinToCyrillic';
import { Button, Select, Spin } from 'antd';
import { Sidebar } from './SideBar';
import apiService, { type AuthUser } from '@/services/api';
import { cacheModeratorPermissions } from '@/utils/permissions';

const navItems: {
  path: string;
  label: { uz: string; en: string; ru: string };
  icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    path: '/dashboard',
    label: { uz: 'Dashboard', en: 'Dashboard', ru: 'Панель' },
    icon: Home
  },
  {
    path: '/admins',
    label: { uz: 'Admins', en: 'Admins', ru: 'Админлар' },
    icon: Users
  },
  {
    path: '/employees',
    label: { uz: 'Employees', en: 'Employees', ru: 'Ходимлар' },
    icon: Users
  },
  {
    path: '/departments',
    label: { uz: 'Departments', en: 'Departments', ru: 'Бўлимлар' },
    icon: Building2
  },
  {
    path: '/positions',
    label: { uz: 'Positions', en: 'Positions', ru: 'Лавозимлар' },
    icon: Briefcase
  },
  {
    path: '/doors',
    label: { uz: 'Doors', en: 'Doors', ru: 'Эшиклар' },
    icon: DoorOpen
  },
  {
    path: '/computers',
    label: { uz: 'Computers', en: 'Computers', ru: 'Компьютерлар' },
    icon: Monitor
  },
  {
    path: '/computer-activity',
    label: { uz: 'Computer Activity', en: 'Computer Activity', ru: 'Фаолият' },
    icon: Activity
  },
  {
    path: '/attendance-events',
    label: {
      uz: 'Attendance Events',
      en: 'Attendance Events',
      ru: 'Attendance Events'
    },
    icon: CalendarDays
  },
  {
    path: '/attendance-policy',
    label: {
      uz: 'Time Management',
      en: 'Time Management',
      ru: 'Управление временем'
    },
    icon: Clock
  },
  {
    path: '/daily-attendance',
    label: { uz: 'Daily Attendance', en: 'Daily Attendance', ru: 'Кунлик' },
    icon: CalendarDays
  },
  {
    path: '/analytics',
    label: { uz: 'Analytics', en: 'Analytics', ru: 'Аналитика' },
    icon: BarChart2
  },
  {
    path: '/reports',
    label: { uz: 'Reports', en: 'Reports', ru: 'Ҳисоботлар' },
    icon: FileText
  },
  {
    path: '/work-permissions',
    label: { uz: 'Work Permissions', en: 'Work Permissions', ru: 'Рухсатлар' },
    icon: ClipboardList
  }
];

const Layout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  );
  const { t, lang, setLang } = useTranslation();
  const colorFrom = '#3B82F6';
  const colorTo = '#0a36ad';
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* brauzer rad etishi mumkin */
    }
  };

  const getCurrentPageTitle = () => {
    const currentItem = navItems.find((item) => {
      if (item.path === location.pathname) return true;
      return location.pathname.startsWith(item.path + '/');
    });
    return (
      currentItem?.label || { uz: 'Bosh sahifa', en: 'Home', ru: 'Главная' }
    );
  };

  const getCurrentDate = () => {
    const now = new Date();
    const day = now.getDate();
    const year = now.getFullYear();

    if (lang === 'en') {
      return now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }
    if (lang === 'ru') {
      return now.toLocaleDateString('ru-RU', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }

    const uzWeekdays = [
      'Yakshanba',
      'Dushanba',
      'Seshanba',
      'Chorshanba',
      'Payshanba',
      'Juma',
      'Shanba'
    ];
    const uzMonths = [
      'yanvar',
      'fevral',
      'mart',
      'aprel',
      'may',
      'iyun',
      'iyul',
      'avgust',
      'sentabr',
      'oktabr',
      'noyabr',
      'dekabr'
    ];
    const weekday = uzWeekdays[now.getDay()];
    const month = uzMonths[now.getMonth()];

    if (lang === 'uz-cyrl') {
      return latinTextToCyrillic(`${weekday}, ${day} ${month}, ${year}`);
    }
    return `${weekday}, ${day} ${month}, ${year}`;
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    // Header profile info
    apiService
      .me()
      .then((res) => setMe(res))
      .catch(() => setMe(null))
      .finally(() => setMeLoading(false));
  }, []);

  useEffect(() => {
    cacheModeratorPermissions(null);
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;

    if (!me.is_active) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('isLoggedIn');
      sessionStorage.removeItem('user');
      navigate('/login');
    }
  }, [me, meLoading, navigate]);

  const visibleNavItems = useMemo(() => {
    if (!me) return [];
    const role = me.role.toLowerCase();
    if (role === 'superadmin' || role === 'admin') return navItems;
    if (role === 'hr') {
      const allowed = new Set([
        '/dashboard',
        '/employees',
        '/departments',
        '/positions',
        '/doors',
        '/computers',
        '/computer-activity',
        '/attendance-events',
        '/daily-attendance',
        '/analytics',
        '/reports',
        '/work-permissions'
      ]);
      return navItems.filter((item) => allowed.has(item.path));
    }
    return navItems.filter((item) => item.path === '/dashboard');
  }, [me]);

  const isModeratorForbiddenRoute = false;

  useEffect(() => {
    if (meLoading || !me) return;
    // Moderatorlar uchun /dashboard/moderators va /dashboard/users yo'q.
    if (isModeratorForbiddenRoute) {
      navigate('/dashboard');
    }
  }, [meLoading, me, isModeratorForbiddenRoute, navigate]);

  const initials = useMemo(() => {
    const n = (me?.full_name || '').trim();
    if (!n) return 'U';
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0]?.toUpperCase() ?? '';
    const b =
      (parts.length > 1 ? parts[parts.length - 1]?.[0] : '')?.toUpperCase() ??
      '';
    return a + b || a || 'U';
  }, [me?.full_name]);

  if (meLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="min-h-screen bg-transparent transition-colors duration-300">
        <div className="flex min-h-screen w-screen">
          {/* Sidebar */}
          <aside
            style={{ width: isCollapsed ? 100 : 340 }}
            className="row-span-2 w-full h-screen max-h-screen shrink-0 flex flex-col overflow-hidden bg-white/80 dark:bg-[#121314]/80 backdrop-blur-sm border-r border-slate-200/80 dark:border-slate-700/60 transition-all duration-300"
          >
            <div className="flex flex-col h-full min-h-0 w-full">
              {/* Logo */}
              <div className="h-18 w-full shrink-0 flex items-center justify-center px-6 border-b border-slate-200/80 dark:border-slate-700/60">
                <AnimatePresence mode="popLayout">
                  <div className="w-full flex items-center justify-start">
                    <motion.div
                      key="expanded-logo"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={toggleSidebar}
                      layout
                    >
                      <motion.div
                        layoutId="c"
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})`
                        }}
                      >
                        <motion.span className="text-white dark:text-slate-900 font-bold text-lg">
                          <LayoutDashboard
                            color="#DBEAFE"
                            className="font-extrabold text-2xl "
                          />
                        </motion.span>
                      </motion.div>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.6 }}
                          className="flex flex-col overflow-auto"
                        >
                          <h1 className="min-w-[200px] font-bold text-lg text-slate-900 dark:text-white">
                            Work Plus
                          </h1>
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Nazorat paneli
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <Sidebar
                navItems={visibleNavItems}
                isCollapsed={isCollapsed}
                themeColors={{ colorFrom, colorTo }}
              />

              {/* Logout */}
              <div className="p-4 min-h-[50px] shrink-0">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-black/45">
                  <button
                    onClick={() => {
                      localStorage.removeItem('accessToken');
                      localStorage.removeItem('refreshToken');
                      localStorage.removeItem('isLoggedIn');
                      localStorage.removeItem('user');
                      sessionStorage.removeItem('accessToken');
                      sessionStorage.removeItem('refreshToken');
                      sessionStorage.removeItem('isLoggedIn');
                      sessionStorage.removeItem('user');
                      navigate('/login');
                    }}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'flex-start'
                    }}
                    className="flex items-center gap-2 text-sm font-semibold transition-colors duration-200 w-full"
                  >
                    <LogOut size={20} className="dark:text-slate-300" />
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="font-medium whitespace-nowrap overflow-hidden z-10 dark:text-slate-300 text-slate-600"
                      >
                        {t({
                          uz: 'Chiqish',
                          en: 'Logout',
                          ru: 'Выход'
                        })}
                      </motion.span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="w-full">
            {/* Header */}
            <header
              className="h-18 bg-white/80 dark:bg-[#121314]/80 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-700/60"
              style={{
                transition: 'margin-left 0.3s ease-in-out'
              }}
            >
              <div className="flex items-center justify-between px-8 h-full">
                {/* Left Section */}
                <div className="flex items-center gap-6 min-w-0">
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                      {t(getCurrentPageTitle())}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {getCurrentDate()}
                    </p>
                  </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Button
                    type="default"
                    size="large"
                    onClick={toggleFullscreen}
                    title={t({
                      uz: isFullscreen
                        ? 'To‘liq ekrandan chiqish'
                        : 'To‘liq ekran',
                      en: isFullscreen ? 'Exit fullscreen' : 'Fullscreen',
                      ru: isFullscreen
                        ? 'Выйти из полноэкранного режима'
                        : 'Полный экран'
                    })}
                    aria-label={t({
                      uz: isFullscreen
                        ? 'To‘liq ekrandan chiqish'
                        : 'To‘liq ekran',
                      en: isFullscreen ? 'Exit fullscreen' : 'Fullscreen',
                      ru: isFullscreen
                        ? 'Выйти из полноэкранного режима'
                        : 'Полный экран'
                    })}
                    icon={
                      isFullscreen ? (
                        <Minimize2 size={16} strokeWidth={2} />
                      ) : (
                        <Maximize2 size={16} strokeWidth={2} />
                      )
                    }
                  />
                  <ThemeToggle />
                  <Select
                    value={lang}
                    style={{ width: 150 }}
                    size="large"
                    prefix={<Languages />}
                    onChange={(value) => setLang(value as typeof lang)}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'ru', label: 'Русский' },
                      { value: 'uz', label: "O'zbekcha" },
                      { value: 'uz-cyrl', label: 'Ўзбекча' }
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/profile')}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-black/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                        {me?.full_name || '---'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {me?.role || ''}
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        style={{
                          background: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)`
                        }}
                        className="w-full h-full flex items-center justify-center rounded-full"
                      >
                        <span className="text-white font-bold text-xs tracking-wide select-none">
                          {initials}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </header>
            {/* Main Content */}
            <main className="overflow-y-auto bg-transparent">
              <div className=" grid grid-cols-1 grid-row-1">
                <div className="col-span-1 row-span-1 rounded-lg w-full h-[calc(100vh-100px)]">
                  <AnimatePresence mode="sync">
                    {me?.is_active && !isModeratorForbiddenRoute ? (
                      <Outlet />
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
