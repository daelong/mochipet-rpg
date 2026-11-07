import { test, expect, type Page } from '@playwright/test';
import { defaults } from '@mochi/shared';
interface Pose {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  moving: boolean;
  texture: string;
}
const pose = async (page: Page): Promise<Pose> =>
  JSON.parse((await page.locator('.game-canvas').getAttribute('data-pet-pose'))!);
const tap = async (page: Page, mobile: boolean, x: number, y: number) => {
  if (mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
};
async function worldTap(page: Page, mobile: boolean, x: number, y: number) {
  const p = await pose(page);
  const zoom = Number(await page.locator('.game-canvas').getAttribute('data-camera-zoom'));
  await tap(page, mobile, p.screenX + (x - p.x) * zoom, p.screenY + (y - p.y) * zoom);
}
async function boot(page: Page, wide = true) {
  if (wide) await page.setViewportSize({ width: 1800, height: 1300 });
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    defenseBonus: 30,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await page.waitForTimeout(150);
}
test('house and interior doors require walking across them, with petting during the trip', async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await worldTap(page, isMobile, 473, 335);
  const host = page.locator('.game-canvas');
  await expect(host).toHaveAttribute('data-travel-destination', 'home');
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard');
  const before = await pose(page);
  await page.getByRole('button', { name: '쓰다듬기', exact: true }).click();
  await expect(host).toHaveAttribute('data-petting', 'true');
  await expect.poll(async () => before.x - (await pose(page)).x).toBeGreaterThan(30);
  expect((await pose(page)).moving).toBe(true);
  await page.screenshot({ path: info.outputPath('petting-while-walking-to-door.png') });
  await expect(page.locator('main')).toHaveAttribute('data-place', 'home', { timeout: 10000 });
  await expect.poll(async () => (await pose(page)).y).toBeCloseTo(1040, 0);
  await page.waitForTimeout(300);
  await worldTap(page, isMobile, 1250, 1130);
  await expect(host).toHaveAttribute('data-travel-destination', 'yard');
  await expect(page.locator('main')).toHaveAttribute('data-place', 'home');
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard', { timeout: 10000 });
  await expect
    .poll(async () => Math.hypot((await pose(page)).x - 473, (await pose(page)).y - 415))
    .toBeLessThan(5);
  await page.screenshot({ path: info.outputPath('outside-house-after-door-exit.png') });
  expect(errors).toEqual([]);
});
test('petting keeps a manual walk and accepts a new walking direction immediately', async ({
  page,
  isMobile,
}, info) => {
  await boot(page, false);
  const host = page.locator('.game-canvas');
  const initial = await pose(page);
  await tap(page, isMobile, initial.screenX + 90, initial.screenY + 20);
  await page.getByRole('button', { name: '쓰다듬기', exact: true }).click();
  await expect(host).toHaveAttribute('data-petting', 'true');
  const before = await pose(page);
  await expect.poll(async () => (await pose(page)).x - before.x).toBeGreaterThan(15);
  expect((await pose(page)).texture).toContain('-walk-');
  await page.screenshot({ path: info.outputPath('petting-keeps-manual-walk.png') });
  const redirect = await pose(page);
  await tap(page, isMobile, redirect.screenX - 100, redirect.screenY + 20);
  await expect.poll(async () => redirect.x - (await pose(page)).x).toBeGreaterThan(20);
  expect((await pose(page)).moving).toBe(true);
  await expect(host).toHaveAttribute('data-petting', 'false');
});
test('door button movement can be cancelled by the ground and a pending route is not restored on reload', async ({
  page,
  isMobile,
}) => {
  await boot(page);
  const host = page.locator('.game-canvas');
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await expect(host).toHaveAttribute('data-travel-destination', 'home');
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard');
  await worldTap(page, isMobile, 1050, 650);
  await expect(host).toHaveAttribute('data-travel-destination', '');
  await page.waitForTimeout(2500);
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard');
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await expect(host).toHaveAttribute('data-travel-destination', 'home');
  await page.reload();
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await expect(host).toHaveAttribute('data-travel-destination', '');
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard');
});
test('leaving a hunting field walks to the exit and stops combat and pending skills', async ({
  page,
}, info) => {
  await boot(page);
  await page.getByRole('button', { name: '사냥터', exact: true }).click();
  await page.getByRole('button', { name: /^풀잎 초원 입장/ }).click();
  await expect(page.locator('main')).toHaveAttribute('data-place', 'adventure');
  await page.waitForTimeout(300);
  await page.getByTestId('hunt').click();
  await page.getByTestId('cast-skill').click();
  await page.getByRole('button', { name: '마당으로', exact: true }).click();
  const host = page.locator('.game-canvas');
  await expect(host).toHaveAttribute('data-travel-destination', 'yard');
  await expect(host).toHaveAttribute('data-skill-queued', 'false');
  await expect(page.locator('main')).toHaveAttribute('data-combat-mode', 'none');
  await expect(page.locator('main')).toHaveAttribute('data-place', 'adventure');
  await page.screenshot({ path: info.outputPath('walking-to-field-exit.png') });
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard', { timeout: 10000 });
  await expect(host).toHaveAttribute('data-enemy-count', '0');
  await expect
    .poll(async () => Math.hypot((await pose(page)).x - 760, (await pose(page)).y - 1040))
    .toBeLessThan(5);
});
