import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode
} from 'react';
import type { RouteObject } from 'react-router-dom';
import Navigator from './Providers/Navigator';
import NotFoundPage from './pages/NotFounds/NotFoundPage';

import DashboardLayout from './Layout/Layout';

import AnimateWrapper from './components/AnimateWrapper';

const LoginPage = lazy(() => import('./pages/Login/Login'));
const Home = lazy(() => import('./pages/Home'));
const Employees = lazy(() => import('./pages/Employees'));
const Departments = lazy(() => import('./pages/Departments'));
const AttendanceEvents = lazy(() => import('./pages/AttendanceEvents'));
const AttendancePolicy = lazy(
  () => import('./pages/AttendancePolicy/AttendancePolicy')
);
const Reports = lazy(() => import('./pages/Reports'));
const WorkPermissions = lazy(() => import('./pages/WorkPermissions'));
const DailyAttendance = lazy(() => import('./pages/DailyAttendance'));
const ComputerActivity = lazy(() => import('./pages/ComputerActivity'));
const Computers = lazy(() => import('./pages/Computers'));
const Doors = lazy(() => import('./pages/Doors'));
const Positions = lazy(() => import('./pages/Positions'));
const Admins = lazy(() => import('./pages/Admins'));

const withPage = (page: ReactNode) => <AnimateWrapper>{page}</AnimateWrapper>;

const withSuspense = (Component: LazyExoticComponent<ComponentType>) =>
  withPage(<Component />);

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigator />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: withSuspense(Home)
          },
          {
            path: 'dashboard',
            element: withSuspense(Home)
          },
          {
            path: 'analytics',
            element: withSuspense(Home)
          },
          {
            path: 'employees',
            element: withSuspense(Employees)
          },
          {
            path: 'departments',
            element: withSuspense(Departments)
          },
          {
            path: 'attendance-events',
            element: withSuspense(AttendanceEvents)
          },
          {
            path: 'attendance-policy',
            element: withSuspense(AttendancePolicy)
          },
          {
            path: 'reports',
            element: withSuspense(Reports)
          },
          {
            path: 'work-permissions',
            element: withSuspense(WorkPermissions)
          },
          {
            path: 'daily-attendance',
            element: withSuspense(DailyAttendance)
          },
          {
            path: 'computer-activity',
            element: withSuspense(ComputerActivity)
          },
          {
            path: 'computers',
            element: withSuspense(Computers)
          },
          {
            path: 'doors',
            element: withSuspense(Doors)
          },
          {
            path: 'positions',
            element: withSuspense(Positions)
          },
          {
            path: 'admins',
            element: withSuspense(Admins)
          }
        ]
      }
    ]
  },
  {
    path: 'login',
    element: withSuspense(LoginPage)
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
];
