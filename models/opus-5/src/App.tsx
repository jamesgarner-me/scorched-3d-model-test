import { Canvas } from '@react-three/fiber';
import { DebugPanel } from './ui/DebugPanel';
import { Hud } from './ui/Hud';
import { FlyoverOverlay, LoadingScreen, PauseMenu, StartMenu, WinnerOverlay } from './ui/Screens';
import { useInput } from './ui/useInput';
import { Scene } from './render/Scene';
import { useGame } from './state/store';

export function App() {
  useInput();
  const phase = useGame((s) => s.phase);
  const match = useGame((s) => s.match);
  const paused = useGame((s) => s.paused);
  const debugOpen = useGame((s) => s.debugOpen);

  const showHud = match !== null && ['aim', 'charging', 'flight', 'impact', 'aiThink'].includes(phase);

  return (
    <div className="app">
      {match && (
        <div className="canvas-host">
          <Canvas
            dpr={[1, 2]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            camera={{ fov: 55, near: 0.5, far: match.planet.radius * 60, position: [0, 0, match.planet.radius * 3] }}
          >
            <Scene />
          </Canvas>
        </div>
      )}

      {phase === 'menu' && <StartMenu />}
      {phase === 'loading' && <LoadingScreen />}
      {phase === 'flyover' && <FlyoverOverlay />}
      {showHud && <Hud />}
      {paused && <PauseMenu />}
      {phase === 'gameover' && <WinnerOverlay />}
      {import.meta.env.DEV && debugOpen && <DebugPanel />}
    </div>
  );
}
