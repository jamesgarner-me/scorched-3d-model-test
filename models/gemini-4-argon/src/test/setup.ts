import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('not wrapped in act(')) {
      throw new Error(`React act() warning detected: ${msg}`);
    }
    originalConsoleError(...args);
  });

  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('not wrapped in act(')) {
      throw new Error(`React act() warning detected: ${msg}`);
    }
    originalConsoleWarn(...args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
