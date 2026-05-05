import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const Navigator = () => {
  const navigate = useNavigate();
  const isLoggedIn =
    localStorage.getItem('isLoggedIn') === 'true' ||
    sessionStorage.getItem('isLoggedIn') === 'true';
  const token =
    localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/') {
      if (isLoggedIn && token) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }

    if (!isLoggedIn || !token) {
      if (pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    }

    if (isLoggedIn && token && pathname === '/login') {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoggedIn, token, navigate, pathname]);

  return (
    <div className="w-screen h-screen">
      <Outlet />
    </div>
  );
};

export default Navigator;
