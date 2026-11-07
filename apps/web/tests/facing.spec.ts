import { test, expect, type Page } from '@playwright/test';
import { defaults } from '@mochi/shared';

interface Pose {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  moving: boolean;
  facing: 'left' | 'right';
  flipX: boolean;
  texture: string;
  opponent: { uid: number; x: number; y: number } | null;
}
async function pose(page: Page): Promise<Pose> {
  return JSON.parse((await page.locator('.game-canvas').getAttribute('data-pet-pose'))!);
}
async function boot(page: Page) {
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    characterId: 'z_horse',
    defenseBonus: 30,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-pet-pose');
  // Camera bounds and zoom settle on the first rendered frames, after the scene-ready signal.
  await page.waitForTimeout(150);
}
async function tapMap(page: Page, x: number, y: number, touch: boolean) {
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('walking and changing direction mirror the left-facing PNG toward the actual path', async ({
  page,
  isMobile,
}, testInfo) => {
  await boot(page);
  for (const offset of [90, -90, 90, -90]) {
    const before = await pose(page);
    await tapMap(page, before.screenX + offset, before.screenY + 20, isMobile);
    const facing = offset > 0 ? 'right' : 'left';
    await expect
      .poll(async () => {
        const p = await pose(page);
        return {
          moving: p.moving,
          facing: p.facing,
          flipX: p.flipX,
          walking: p.texture.includes('-walk-'),
          forward: (p.x - before.x) * Math.sign(offset) > 0,
        };
      })
      .toEqual({ moving: true, facing, flipX: facing === 'right', walking: true, forward: true });
    await page.screenshot({ path: testInfo.outputPath(`walk-${facing}.png`) });
  }
});

for (const side of ['left', 'right'] as const) {
  test(`a stopped hunter faces its ${side} opponent rather than its last walking direction`, async ({
    page,
    isMobile,
  }, testInfo) => {
    // Show the complete field so real clicks can place the pet beyond every possible spawn X.
    await page.setViewportSize({ width: 1800, height: 1300 });
    await boot(page);
    await page.getByRole('button', { name: '사냥터', exact: true }).click();
    await page.getByRole('button', { name: /^풀잎 초원 입장/ }).click();
    await expect(page.locator('main')).toHaveAttribute('data-place', 'adventure');
    // React changes place before the next Phaser frame resets the scene's movement target.
    await page.waitForTimeout(300);
    const edge = side === 'left' ? 1380 : 400;
    await tapMap(page, edge, 1000, isMobile);
    await expect
      .poll(
        async () => {
          const p = await pose(page);
          return !p.moving && Math.abs(p.x - edge) < 5 && Math.abs(p.y - 1000) < 5;
        },
        { timeout: 12000 },
      )
      .toBe(true);
    await page.getByTestId('hunt').click();
    await expect
      .poll(
        async () => {
          const p = await pose(page);
          if (p.moving || !p.opponent || !p.texture.includes('-play-')) return null;
          return {
            facing: p.facing,
            flipX: p.flipX,
            opponentSide: p.opponent.x > p.x ? 'right' : 'left',
          };
        },
        { timeout: 15000 },
      )
      .toEqual({ facing: side, flipX: side === 'right', opponentSide: side });
    await page.screenshot({ path: testInfo.outputPath(`attack-${side}.png`) });
    await page.getByTestId('hunt').click();
    expect((await pose(page)).facing).toBe(side);
  });
}
