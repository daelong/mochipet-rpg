import { test, expect, type Page } from '@playwright/test';
import { defaults } from '@mochi/shared';
async function settings(page: Page) {
  await page.getByRole('button', { name: '설정', exact: true }).click();
}
test('PiP unsupported fallback keeps the normal game playable', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await settings(page);
  await expect(page.getByRole('button', { name: '미니 창 열기', exact: true })).toBeDisabled();
  await expect(page.locator('.mini-setting')).toContainText('지원하지 않아요');
  await page.getByRole('button', { name: '패널 닫기' }).click();
  await expect(page.locator('canvas')).toBeVisible();
});
test('PiP permission failure leaves the same canvas and save in the main window', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: {
        requestWindow: () => Promise.reject(new DOMException('Blocked', 'NotAllowedError')),
      },
      configurable: true,
    }),
  );
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  const canvas = await page.locator('canvas').elementHandle();
  await settings(page);
  await page.getByRole('button', { name: '미니 창 열기', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText('미니 창을 열지 못했어요');
  expect(await canvas!.evaluate((e) => e.isConnected && e.ownerDocument === document)).toBe(true);
  await expect(page.locator('.mini-placeholder')).toHaveCount(0);
});
test('native PiP keeps one game, permits hunting and feeding, and restores the original canvas', async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  test.skip(
    isMobile,
    'Native Document PiP is a desktop capability; mobile fallback is tested separately.',
  );
  test.setTimeout(90000);
  await page.addInitScript((p) => localStorage.setItem('mochipet.web.v1', JSON.stringify(p)), {
    ...defaults(),
    chosen: true,
    level: 8,
    hp: 109,
    defenseBonus: 30,
    hunger: 30,
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  expect(
    await page.evaluate(() => typeof (window as any).documentPictureInPicture?.requestWindow),
  ).toBe('function');
  await page.getByRole('button', { name: '사냥터', exact: true }).click();
  await page.getByRole('button', { name: /^풀잎 초원 입장/ }).click();
  const canvas = await page.locator('canvas').elementHandle();
  await settings(page);
  const popupEvent = context.waitForEvent('page', { timeout: 7000 }).catch(() => null);
  await page.getByRole('button', { name: '미니 창 열기', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as any).documentPictureInPicture.window?.document.querySelector('#root canvas'),
        ),
      ),
    )
    .toBe(true);
  const mini = await popupEvent;
  console.log('Native Document PiP target:', mini?.url() ?? 'not exposed by Playwright');
  expect(mini, 'The browser must expose the native PiP page for input verification').not.toBeNull();
  mini!.on('pageerror', (e) => errors.push(e.message));
  await mini!.setViewportSize({ width: 420, height: 600 });
  await expect
    .poll(async () => Math.round((await mini!.locator('canvas').boundingBox())!.width))
    .toBe(420);
  await expect(mini!.getByRole('navigation', { name: '미니 창 조작' })).toBeVisible();
  await expect
    .poll(() => mini!.locator('canvas').evaluate((e) => (e as HTMLCanvasElement).width))
    .toBe(420);
  await mini!.mouse.move(270, 350);
  await mini!.mouse.down();
  await mini!.mouse.move(130, 260, { steps: 12 });
  await mini!.mouse.up();
  await expect(mini!.locator('.game-canvas')).toHaveAttribute('data-camera-mode', 'free');
  await mini!.getByRole('button', { name: '친구 따라가기', exact: true }).click();
  await expect(mini!.locator('.game-canvas')).toHaveAttribute('data-camera-mode', 'follow');
  await expect(page.getByRole('region', { name: '미니 펫 창 안내' })).toBeVisible();
  expect(
    await canvas!.evaluate(
      (e) => e === (window as any).documentPictureInPicture.window.document.querySelector('canvas'),
    ),
  ).toBe(true);
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  console.log(
    'Opener hidden:',
    await page.evaluate(() => document.hidden),
    'PiP hidden:',
    await mini!.evaluate(() => document.hidden),
  );
  // Chromium can keep the opener 'visible' while a native PiP window is open.
  // The child remains the authoritative surface either way (unit-tested with a hidden opener).
  await expect.poll(() => mini!.evaluate(() => document.hidden)).toBe(false);
  await mini!
    .getByRole('button', { name: '자동사냥 ON', exact: true })
    .filter({ visible: true })
    .click();
  await expect
    .poll(async () => Number(await mini!.getByTestId('coins').innerText()), { timeout: 25000 })
    .toBeGreaterThan(60);
  await mini!
    .getByRole('button', { name: '자동사냥 OFF', exact: true })
    .filter({ visible: true })
    .click();
  const beforeFood = Number(await mini!.getByTestId('coins').innerText());
  await mini!.getByRole('button', { name: '먹이 · 15코인', exact: true }).click();
  await expect(mini!.getByTestId('coins')).toHaveText(String(beforeFood - 15));
  await mini!.screenshot({ path: testInfo.outputPath('native-pip.png') });
  await mini!.setViewportSize({ width: 360, height: 480 });
  expect(
    await mini!.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await other.close();
  await mini!
    .getByRole('button', { name: '본 화면으로', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(await canvas!.evaluate((e) => e.isConnected && e.ownerDocument === document)).toBe(true);
  await expect(page.locator('.mini-placeholder')).toHaveCount(0);
  await settings(page);
  await page.getByRole('button', { name: '미니 창 열기', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as any).documentPictureInPicture.window?.document.querySelector('canvas')),
      ),
    )
    .toBe(true);
  await page.evaluate(() => (window as any).documentPictureInPicture.window.close());
  await expect(page.locator('canvas')).toBeVisible();
  expect(await canvas!.evaluate((e) => e.isConnected && e.ownerDocument === document)).toBe(true);
  expect(errors).toEqual([]);
});
