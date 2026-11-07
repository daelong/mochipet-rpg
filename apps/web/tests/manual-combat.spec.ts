import { test, expect, type Page } from '@playwright/test';
import { defaults } from '@mochi/shared';

type Monster = { uid: number; x: number; y: number; hp: number; id: string };
const monsters = async (page: Page): Promise<Monster[]> =>
  JSON.parse((await page.locator('.game-canvas').getAttribute('data-monsters'))!);
const tap = async (page: Page, mobile: boolean, x: number, y: number) => {
  if (mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
};
async function boot(page: Page) {
  await page.setViewportSize({ width: 1800, height: 1300 });
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    defenseBonus: 30,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await page.getByRole('button', { name: '사냥터', exact: true }).click();
  await page.getByRole('button', { name: /^풀잎 초원 입장/ }).click();
  await expect(page.locator('main')).toHaveAttribute('data-place', 'adventure');
  await page.waitForTimeout(350);
}
async function clickMonster(page: Page, mobile: boolean, monster: Monster) {
  await tap(page, mobile, monster.x, monster.y - 36);
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-target-uid',
    String(monster.uid),
  );
}
test('click a monster, approach, manually cast, earn one reward and stop without automatic hunting', async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  const host = page.locator('.game-canvas');
  await expect(page.getByTestId('hunt')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('cast-skill')).toBeDisabled();
  const initial = await monsters(page);
  const target = [...initial].sort(
    (a, b) => Math.hypot(b.x - 840, b.y - 690) - Math.hypot(a.x - 840, a.y - 690),
  )[0];
  await clickMonster(page, isMobile, target);
  await expect(host).toHaveAttribute('data-manual-combat', 'true');
  await expect(page.getByTestId('hunt')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('cast-skill').click();
  await expect(page.getByTestId('cast-skill')).toContainText('재사용', { timeout: 10000 });
  await expect
    .poll(async () => (await monsters(page)).some((m) => m.uid === target.uid), { timeout: 15000 })
    .toBe(false);
  await expect(host).toHaveAttribute('data-manual-combat', 'false');
  const coins = await page.getByTestId('coins').innerText();
  expect(Number(coins)).toBeGreaterThan(60);
  const others = (await monsters(page)).filter((m) => initial.some((old) => old.uid === m.uid));
  for (const enemy of others)
    expect(enemy.hp).toBe(initial.find((old) => old.uid === enemy.uid)!.hp);
  await page.waitForTimeout(3100);
  expect(await page.getByTestId('coins').innerText()).toBe(coins);
  await expect(host).toHaveAttribute('data-target-uid', '');
  await page.screenshot({ path: testInfo.outputPath('manual-combat-wide.png') });
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    const controls = await page.getByRole('region', { name: '전투 조작' }).boundingBox();
    expect(controls!.x).toBeGreaterThanOrEqual(0);
    expect(controls!.y).toBeGreaterThanOrEqual(0);
    expect(controls!.x + controls!.width).toBeLessThanOrEqual(size.width);
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(size.height);
    expect((await page.getByTestId('cast-skill').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const button of await page
      .locator('.menu-rail button, .cast-skill, .auto-skill-option')
      .all()) {
      expect(
        await button.evaluate((element) => {
          const r = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`manual-controls-${size.width}.png`) });
  }
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard');
  await expect(host).toHaveAttribute('data-manual-combat', 'false');
  expect(errors).toEqual([]);
});
test('retargeting and a ground click cancel a pending manual skill without hitting another monster', async ({
  page,
  isMobile,
}) => {
  await boot(page);
  const initial = await monsters(page);
  const sorted = [...initial].sort(
    (a, b) => Math.hypot(b.x - 840, b.y - 690) - Math.hypot(a.x - 840, a.y - 690),
  );
  const start = { x: sorted[0].x, y: sorted[0].y - 36 };
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.x + 90, y: start.y + 30 }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.y + 30, { steps: 8 });
    await page.mouse.up();
  }
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-manual-combat', 'false');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-camera-mode', 'free');
  await clickMonster(page, isMobile, sorted[0]);
  await page.getByTestId('cast-skill').click();
  await clickMonster(page, isMobile, sorted[1]);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-skill-queued', 'false');
  await tap(page, isMobile, 400, 1030);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-manual-combat', 'false');
  await expect(page.getByTestId('cast-skill')).toBeDisabled();
  await page.waitForTimeout(1600);
  expect(await page.getByTestId('coins').innerText()).toBe('60');
  expect((await monsters(page)).map((m) => m.hp)).toEqual(initial.map((m) => m.hp));
});
test('automatic basic attacks can use a manually pressed skill with automatic skills switched off', async ({
  page,
}, testInfo) => {
  await boot(page);
  await page.getByRole('checkbox', { name: '자동사냥 시 스킬 자동 사용' }).uncheck();
  await page.getByTestId('hunt').click();
  await expect(page.locator('main')).toHaveAttribute('data-combat-mode', 'auto');
  await expect(page.getByTestId('cast-skill')).toBeEnabled();
  await page.getByTestId('cast-skill').click();
  await expect(page.getByTestId('cast-skill')).toContainText('재사용', { timeout: 10000 });
  await expect(page.getByTestId('hunt')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('manual-skill-with-auto-attacks.png') });
  await page.getByRole('button', { name: '공격 중단', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-combat-mode', 'none');
});
