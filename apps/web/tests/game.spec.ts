import { test, expect, type Page } from '@playwright/test';
import { defaults, xpForLevel } from '@mochi/shared';
async function nav(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).click();
}
async function choose(page: Page) {
  await page.getByRole('button', { name: '친구 선택하기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.character-option')).toHaveCount(28);
  await dialog.getByRole('button', { name: '토끼 선택', exact: true }).click();
  await dialog.getByRole('button', { name: '함께 모험하기' }).click();
  await expect(dialog).not.toBeVisible();
}
async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mochipet.web.v1') ?? 'null'));
}
test('play, shop, rename, reload, protected reset, and responsive layout', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await choose(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  const frame = await page.locator('canvas').screenshot();
  await page.waitForTimeout(1300);
  expect((await page.locator('canvas').screenshot()).equals(frame)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/mochipet-${testInfo.project.name}.png`, fullPage: true });
  await page.getByTestId('hunt').click();
  await expect(page.getByTestId('hunt')).toHaveText('사냥 OFF');
  await expect
    .poll(async () => Number((await page.getByTestId('coins').innerText()).replaceAll(',', '')), {
      timeout: 30000,
    })
    .toBeGreaterThan(60);
  await page.getByTestId('hunt').click();
  await expect(page.getByTestId('hunt')).toHaveText('사냥 ON');
  await nav(page, '모찌 상점');
  await page.getByRole('button', { name: '따끈한 주먹밥 구매 15 코인' }).click();
  await expect(page.locator('.feedback')).toHaveText('따끈한 주먹밥 구매 완료!');
  const bought = await saved(page);
  expect(bought.purchases.rice).toBe(1);
  expect(bought.hunger).toBe(100);
  expect(bought.kills).toBeGreaterThan(0);
  await nav(page, '나의 친구');
  await page.getByLabel('친구의 이름').fill('구름이');
  await page.getByRole('button', { name: '이름 바꾸기', exact: true }).click();
  await expect(page.locator('.pet-identity h3')).toContainText('구름이');
  const before = await saved(page);
  await page.reload();
  await expect(page.locator('.pet-identity h3')).toContainText('구름이');
  await expect(page.getByTestId('hunt')).toHaveText('사냥 ON');
  const after = await saved(page);
  expect(after.coins).toBe(before.coins);
  expect(after.kills).toBe(before.kills);
  expect(after.purchases).toEqual(before.purchases);
  await nav(page, '설정');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await page.getByRole('button', { name: '돌아가기', exact: true }).click();
  expect((await saved(page)).name).toBe('구름이');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await page.getByRole('button', { name: '백업 후 초기화', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await saved(page)).chosen).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('mochipet.web.v1.before-reset'))).toContain(
    '구름이',
  );
  expect(errors).toEqual([]);
});
test('a second tab cannot play or overwrite the first tab', async ({ context, page }) => {
  await page.goto('/');
  await choose(page);
  const original = await saved(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('status').first()).toContainText('다른 탭');
  await expect(second.getByTestId('hunt')).toBeDisabled();
  await second.waitForTimeout(1000);
  expect((await saved(page)).characterId).toBe(original.characterId);
  await page.close();
  await second.reload();
  await expect(second.getByTestId('hunt')).toBeEnabled();
  await second.close();
});
test('future saves are read only and are never silently overwritten', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('mochipet.web.v1', JSON.stringify({ schema: 99, marker: 'do-not-touch' })),
  );
  await page.goto('/');
  await expect(page.getByRole('status').first()).toContainText('더 새로운 버전');
  await expect(page.getByTestId('hunt')).toBeDisabled();
  expect(await saved(page)).toEqual({ schema: 99, marker: 'do-not-touch' });
});
test('level 20 stops XP growth while hunting still grants coins', async ({ page }) => {
  const fixture = { ...defaults(), chosen: true, level: 19, xp: xpForLevel(19) - 1, hp: 186 };
  await page.addInitScript(
    (p) => localStorage.setItem('mochipet.web.v1', JSON.stringify(p)),
    fixture,
  );
  await page.goto('/');
  await expect(page.getByTestId('hunt')).toBeEnabled();
  await page.getByTestId('hunt').click();
  await expect(page.locator('.portrait>span')).toHaveText('Lv.20', { timeout: 30000 });
  await expect(page.locator('.xp-label')).toContainText('싱글 최고 레벨');
  await expect
    .poll(async () => Number((await page.getByTestId('coins').innerText()).replaceAll(',', '')), {
      timeout: 15000,
    })
    .toBeGreaterThan(78);
  await page.getByTestId('hunt').click();
  await nav(page, '설정');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const result = await saved(page);
  expect(result.level).toBe(20);
  expect(result.xp).toBe(0);
  expect(result.kills).toBeGreaterThan(1);
});
