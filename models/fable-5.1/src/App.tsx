import { Scene } from './render/Scene'
import { useStore } from './state/store'
import { DebugPanel } from './ui/DebugPanel'
import { Hud } from './ui/Hud'
import { Loading } from './ui/Loading'
import { Menu } from './ui/Menu'
import { EndOverlay, FlyoverBanner, PauseOverlay } from './ui/Overlays'
import { useInput } from './ui/useInput'

const DEBUG_ALLOWED = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')

export default function App() {
  useInput()
  const phase = useStore((s) => s.phase)
  const paused = useStore((s) => s.paused)
  const debugOpen = useStore((s) => s.debugOpen)
  const inWorld = phase !== 'menu' && phase !== 'loading'
  return (
    <div className="app">
      {phase !== 'menu' && <Scene />}
      {phase === 'menu' && <Menu />}
      {phase === 'loading' && <Loading />}
      {phase === 'flyover' && <FlyoverBanner />}
      {inWorld && phase !== 'flyover' && phase !== 'over' && <Hud />}
      {phase === 'over' && <EndOverlay />}
      {paused && inWorld && <PauseOverlay />}
      {DEBUG_ALLOWED && debugOpen && <DebugPanel />}
    </div>
  )
}
