import { useEffect, useRef } from 'react';
import { audio } from '../audio/audio';
import { tuning } from '../game/tuning';
import { useGame } from '../state/store';

const AIM_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/**
 * Keyboard control. Arrow keys adjust the turret continuously while held; Space
 * charges and releases. Everything is gated on the phase, so input is locked while a
 * shot is in flight or resolving.
 */
export function useInput(): void {
  const held = useRef(new Set<string>());
  const frame = useRef(0);

  useEffect(() => {
    const store = useGame.getState;

    const onKeyDown = (e: KeyboardEvent) => {
      audio.unlock();
      const { phase, paused } = store();

      if (e.code === 'Backquote') {
        e.preventDefault();
        store().toggleDebug();
        return;
      }
      if (e.code === 'KeyM') {
        store().toggleMute();
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (phase === 'menu' || phase === 'loading' || phase === 'gameover') return;
        store().setPaused(!paused);
        return;
      }
      if (paused) return;

      if (phase === 'flyover' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        store().skipFlyover();
        return;
      }
      if (AIM_KEYS.has(e.key)) {
        e.preventDefault();
        held.current.add(e.key);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        store().beginCharge();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (AIM_KEYS.has(e.key)) {
        held.current.delete(e.key);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (store().charging) store().releaseCharge();
      }
    };

    const onBlur = () => {
      held.current.clear();
      if (store().charging) store().releaseCharge();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', audio.unlock.bind(audio), { once: true });

    let last = performance.now();
    const tick = (time: number) => {
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;
      const state = store();

      if (!state.paused && (state.phase === 'aim' || state.phase === 'charging')) {
        const rate = tuning.aimRate * dt;
        let dBearing = 0;
        let dElevation = 0;
        if (held.current.has('ArrowLeft')) dBearing -= rate;
        if (held.current.has('ArrowRight')) dBearing += rate;
        if (held.current.has('ArrowUp')) dElevation += rate;
        if (held.current.has('ArrowDown')) dElevation -= rate;
        if (dBearing !== 0 || dElevation !== 0) state.adjustAim(dBearing, dElevation);

        if (state.charging) {
          state.setPower(Math.min(100, state.power + tuning.chargeRate * dt));
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      cancelAnimationFrame(frame.current);
    };
  }, []);
}
