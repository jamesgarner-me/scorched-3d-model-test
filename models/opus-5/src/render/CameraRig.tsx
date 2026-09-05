import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { tuning } from '../game/tuning';
import { surfaceFrame } from '../game/vec';
import { focus } from './focus';

const MIN_POLAR = 0.14;
const MAX_POLAR = 1.48;

/**
 * Orbit / pan / zoom camera that orbits in the *local* frame of whatever it is
 * watching, so the horizon stays level whether you are looking at a tank near the
 * pole or chasing a shell across the terminator.
 */
export function CameraRig({ maxDistance }: { maxDistance: number }) {
  const { camera, gl } = useThree();
  const az = useRef(Math.PI);
  const pol = useRef(0.95);
  const dist = useRef(focus.distance);
  const target = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));
  const pan = useRef(new THREE.Vector3());
  const panEpoch = useRef(focus.panEpoch);
  const drag = useRef<{ mode: 'orbit' | 'pan'; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      const isPan = e.button === 2 || e.button === 1 || e.shiftKey;
      drag.current = { mode: isPan ? 'pan' : 'orbit', x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (d.mode === 'orbit') {
        az.current -= dx * 0.006;
        pol.current = THREE.MathUtils.clamp(pol.current - dy * 0.005, MIN_POLAR, MAX_POLAR);
      } else {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const upAxis = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const k = dist.current * 0.0016;
        pan.current.addScaledVector(right, -dx * k).addScaledVector(upAxis, dy * k);
        pan.current.clampLength(0, dist.current * 1.4);
      }
    };
    const onUp = (e: PointerEvent) => {
      drag.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dist.current = THREE.MathUtils.clamp(
        dist.current * Math.exp(e.deltaY * 0.0012),
        6,
        maxDistance,
      );
    };
    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContext);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContext);
    };
  }, [camera, gl, maxDistance]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    if (focus.snapAzimuth !== null) {
      az.current = focus.snapAzimuth;
      focus.snapAzimuth = null;
    }
    if (focus.snapPolar !== null) {
      pol.current = focus.snapPolar;
      focus.snapPolar = null;
    }
    if (panEpoch.current !== focus.panEpoch) {
      panEpoch.current = focus.panEpoch;
      pan.current.set(0, 0, 0);
    }

    const ease = focus.immediate
      ? 1
      : 1 - Math.pow(1 - THREE.MathUtils.clamp(tuning.cameraDamping * focus.urgency, 0.01, 0.95), dt * 60);
    focus.immediate = false;

    target.current.lerp(focus.target, ease);
    up.current.lerp(focus.up, ease).normalize();
    dist.current += (focus.distance - dist.current) * ease * 0.6;

    const frame = surfaceFrame({ x: up.current.x, y: up.current.y, z: up.current.z });
    const north = new THREE.Vector3(frame.north.x, frame.north.y, frame.north.z);
    const east = new THREE.Vector3(frame.east.x, frame.east.y, frame.east.z);
    const sinP = Math.sin(pol.current);
    const offset = new THREE.Vector3()
      .addScaledVector(up.current, Math.cos(pol.current))
      .addScaledVector(north, Math.cos(az.current) * sinP)
      .addScaledVector(east, Math.sin(az.current) * sinP)
      .multiplyScalar(dist.current);

    const look = target.current.clone().add(pan.current);
    camera.up.copy(up.current);
    camera.position.copy(look).add(offset);

    if (focus.shake > 0.0001) {
      const s = focus.shake;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      focus.shake = Math.max(0, focus.shake - dt * 2.2);
    }
    camera.lookAt(look);
  });

  return null;
}
