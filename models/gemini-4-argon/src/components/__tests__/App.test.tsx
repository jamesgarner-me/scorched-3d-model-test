import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../App';

afterEach(() => {
  cleanup();
});

describe('Planetary Artillery UI & Turn Loop', () => {
  // Core happy-path test: player aims, charges power, fires a shot, and AI takes the following turn
  it('allows the player to aim, charge, fire a shot, and transitions through the AI turn', async () => {
    const user = userEvent.setup();
    render(
      <App initialSeed="TEST-SEED-101" instantStartForTest disableCanvasForTest />,
    );

    // Verify initial HUD telemetry is rendered
    expect(screen.getByTestId('player-hp-text')).toHaveTextContent('400 / 400 HP');
    expect(screen.getByTestId('ai-hp-text')).toHaveTextContent('400 / 400 HP');
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('TURN 1');
    expect(screen.getByTestId('wind-readout')).toHaveTextContent(/Wind:/i);

    // Adjust turret bearing and elevation using UI step controls
    const initialBearing = screen.getByTestId('bearing-value').textContent;
    await user.click(screen.getByRole('button', { name: 'Increase Bearing' }));
    expect(screen.getByTestId('bearing-value').textContent).not.toBe(initialBearing);

    const initialElevation = screen.getByTestId('elevation-value').textContent;
    await user.click(screen.getByRole('button', { name: 'Increase Elevation' }));
    expect(screen.getByTestId('elevation-value').textContent).not.toBe(
      initialElevation,
    );

    // Hold and release the fire button to launch a projectile and advance through AI turn to Turn 2
    const fireButton = screen.getByTestId('fire-button');
    await user.pointer([{ keys: '[MouseLeft>]', target: fireButton }]);
    await user.pointer([{ keys: '[/MouseLeft]', target: fireButton }]);

    await waitFor(
      () => {
        expect(screen.getByTestId('turn-indicator')).toHaveTextContent('TURN 2');
      },
      { timeout: 3000 },
    );

    expect(screen.getByTestId('damage-readout')).toBeInTheDocument();
  });

  // Edge-case test: switching planet preset to Mars-like and using the developer debug panel to regenerate from a custom seed
  it('supports switching presets and regenerating a deterministic seed via the debug panel', async () => {
    const user = userEvent.setup();
    render(
      <App initialSeed="TEST-SEED-202" instantStartForTest disableCanvasForTest />,
    );

    // Switch world preset from Earth-like to Mars-like
    const presetSelect = screen.getByLabelText('Planet Preset');
    await user.selectOptions(presetSelect, 'mars');
    expect(presetSelect).toHaveValue('mars');

    // Open Developer Debug & Tuning Panel
    await user.click(screen.getByRole('button', { name: 'Toggle Debug Panel' }));
    const seedInput = screen.getByTestId('debug-seed-input');
    expect(seedInput).toBeInTheDocument();

    // Enter a custom seed and regenerate planet
    await user.clear(seedInput);
    await user.type(seedInput, 'CUSTOM-MARS-77');
    await user.click(screen.getByTestId('debug-regenerate-btn'));

    expect(screen.getByTestId('debug-seed-input')).toHaveValue('CUSTOM-MARS-77');
  });

  // Edge-case test: computer-vs-computer demo mode (?mode=demo) disables manual controls and advances turns autonomously
  it('runs autonomous AI-vs-AI turns in demo mode while locking manual aiming and firing controls', async () => {
    render(
      <App
        initialSeed="DEMO-SEED-303"
        instantStartForTest
        disableCanvasForTest
        initialDemoMode
      />,
    );

    expect(screen.getByTestId('demo-badge')).toHaveTextContent('DEMO');
    expect(screen.getByTestId('player-health-card')).toHaveTextContent(
      'Vanguard-1 (AI)',
    );
    expect(screen.getByTestId('fire-button')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase Bearing' })).toBeDisabled();

    // Both Vanguard-1 (player slot) and Ares Automaton (ai slot) fire autonomously to reach Turn 2
    await waitFor(
      () => {
        expect(screen.getByTestId('turn-indicator')).toHaveTextContent('TURN 2');
      },
      { timeout: 4000 },
    );
  });
});
