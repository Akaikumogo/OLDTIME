import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import { routes } from './Router';

import { ConfigProvider } from 'antd';
import { getAntdTheme } from './theme/colors';
import { useApp } from './Providers/Configuration';

const router = createBrowserRouter(routes);

const App = () => {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const splashAlreadyShown = sessionStorage.getItem('splashShown') === 'true';
    if (!splashAlreadyShown) {
      setTimeout(() => {
        setShowSplash(true);
      }, 1000);
    }
  }, []);
  const { theme: darkOrLight } = useApp();
  return (
    <>
      <AnimatePresence mode="sync">
        {showSplash && (
          <SplashScreen key="splash" onFinish={() => setShowSplash(false)} />
        )}
        <ConfigProvider key="app-shell" theme={getAntdTheme(darkOrLight)}>
          {!showSplash && (
            <RouterProvider router={router} />
          )}
        </ConfigProvider>
      </AnimatePresence>
    </>
  );
};

export default App;
