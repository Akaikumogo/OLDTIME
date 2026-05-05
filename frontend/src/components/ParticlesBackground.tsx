// components/ParticlesBackground.tsx
import { useCallback } from 'react';
import Particles from 'react-tsparticles';
import type { Engine } from 'tsparticles-engine';
import { loadSlim } from 'tsparticles-slim'; // eng yengil versiyasi

const ParticlesBackground = () => {
  const init = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <Particles
      id="tsparticles"
      init={init}
      options={{
        fullScreen: { enable: false },
        background: { color: { value: 'transparent' } },
        particles: {
          number: { value: 30 },
          color: { value: '#3d57c4' },
          shape: { type: 'circle' },
          opacity: { value: 0.6 },
          size: { value: 3 },
          move: { enable: true, speed: 1.5 }
        },
        interactivity: {
          events: { onHover: { enable: true, mode: 'repulse' } },
          modes: { repulse: { distance: 80 } }
        }
      }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0
      }}
    />
  );
};

export default ParticlesBackground;
