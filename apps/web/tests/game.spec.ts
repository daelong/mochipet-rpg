import { test, expect, type Page } from '@playwright/test';
import { defaults, xpForLevel } from '@mochi/shared';
import { writeFile } from 'node:fs/promises';
import { homeActivityById } from '@mochi/game-data';
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
async function startCare(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true }).filter({ visible: true });
  if (!(await button.isVisible()))
    await page.getByRole('button', { name: '집 안 활동', exact: true }).click();
  await button.click();
}
async function dragMap(
  page: Page,
  touch: boolean,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let i = 1; i <= 12; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 },
        ],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
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
  await page.screenshot({ path: testInfo.outputPath('game-world.png'), fullPage: true });
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
  await expect(page.locator('.player-name')).toContainText('구름이');
  const before = await saved(page);
  await page.reload();
  await expect(page.locator('.player-name')).toContainText('구름이');
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
  await expect
    .poll(async () =>
      second.evaluate(async () => {
        const locks = await navigator.locks.query();
        return locks.held?.some((lock) => lock.name === 'mochipet.web.session') ?? false;
      }),
    )
    .toBe(false);
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

test('the map fills the viewport and side menus toggle without replacing the canvas', async ({
  page,
}, testInfo) => {
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    name: '아주아주긴친구이름모찌모찌',
    coins: 1000000,
  });
  await page.goto('/');
  await choose(page);
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  const canvas = await page.locator('canvas').elementHandle();
  const originalBond = (await saved(page)).bond;
  const menu = page.getByRole('navigation', { name: '게임 메뉴' });
  for (const label of ['사냥터', '나의 친구', '모찌 상점', '스킬 도감', '모험 기록', '설정']) {
    const button = menu.getByRole('button', { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
    await button.click();
    await expect(page.locator('#game-panel')).toHaveCount(0);
    await expect(button).toBeFocused();
  }
  await nav(page, '모찌 상점');
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-panel')).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '모찌 상점', exact: true })).toBeFocused();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () => {
        const box = await page.locator('canvas').boundingBox();
        return (
          box &&
          Math.abs(box.width - size.width) < 2 &&
          Math.abs(box.height - size.height) < 2 &&
          box.x === 0 &&
          box.y === 0
        );
      })
      .toBe(true);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const boxes = await page
      .locator(
        '.menu-rail button, .action-rail button, .player-hud, .coin-wallet, .location-button, .world-hint, .activity-badge, .game-meta > span, .game-meta button',
      )
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(size.width);
      expect(box.bottom).toBeLessThanOrEqual(size.height);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        const overlap =
          Math.min(a.right, b.right) > Math.max(a.x, b.x) &&
          Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y);
        expect(overlap, `controls ${i} and ${j} overlap at ${size.width}x${size.height}`).toBe(
          false,
        );
      }
    }
    await nav(page, '설정');
    await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`panel-${size.width}x${size.height}.png`) });
    await page.getByRole('button', { name: '패널 닫기' }).click();
    await page.screenshot({ path: testInfo.outputPath(`world-${size.width}x${size.height}.png`) });
  }
  await nav(page, '설정');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  expect((await saved(page)).bond).toBe(originalBond);
});

test('zone and character changes remain available from the floating menus', async ({ page }) => {
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    level: 8,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await nav(page, '사냥터');
  for (const name of ['반짝 숲', '바위 동굴', '달빛 언덕', '풀잎 초원']) {
    await page.getByRole('button', { name: new RegExp(name + '.*Lv') }).click();
    await expect(page.locator('.location-button')).toContainText(name);
    await expect(page.getByRole('button', { name: new RegExp(name + '.*Lv') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await nav(page, '나의 친구');
  await page.getByRole('button', { name: '친구 바꾸기', exact: true }).click();
  await page.getByRole('button', { name: '용 선택', exact: true }).click();
  await page.getByRole('button', { name: '함께 모험하기' }).click();
  await expect(page.locator('.player-name')).toContainText('용');
  await page.getByRole('button', { name: '패널 닫기' }).click();
  await page.getByTestId('hunt').click();
  await expect(page.getByTestId('hunt')).toHaveText('사냥 OFF');
  await expect.poll(async () => (await saved(page)).kills, { timeout: 30000 }).toBeGreaterThan(0);
});

test('yard, home furniture, timed care and saved needs', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (pet) => {
      if (!localStorage.getItem('mochipet.web.v1'))
        localStorage.setItem('mochipet.web.v1', JSON.stringify(pet));
    },
    {
      ...defaults(),
      chosen: true,
      hunger: 45,
      hygiene: 30,
      toilet: 80,
      roomCleanliness: 40,
      energy: 45,
    },
  );
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await expect(page.locator('.location-button')).toContainText('집 앞 마당');
  const home = page.getByRole('button', { name: '집 들어가기', exact: true });
  if (isMobile) await home.tap();
  else await home.click();
  await expect(page.locator('main')).toHaveAttribute('data-place', 'home');
  await expect(page.locator('.location-button')).toContainText('우리 집');
  await page.getByRole('button', { name: '집 안 활동', exact: true }).click();
  await expect(page.locator('.home-activity-list > button')).toHaveCount(7);
  await page.screenshot({ path: testInfo.outputPath('home-activities.png') });
  await page.getByRole('button', { name: '밥 먹기', exact: true }).click();
  await expect(page.getByRole('group', { name: '집 안 활동 진행' })).toBeVisible();
  await expect(page.locator('.broadcast-caption h2')).toContainText('밥 먹기', { timeout: 10000 });
  await page.waitForTimeout(850); // Camera pan and zoom settle while the activity continues.
  await page.screenshot({ path: testInfo.outputPath('camera-meal.png') });
  await expect
    .poll(async () => (await saved(page)).homeActivities.meal ?? 0, { timeout: 25000 })
    .toBe(1);
  expect((await saved(page)).hunger).toBeGreaterThanOrEqual(70);
  await page.getByRole('button', { name: '목욕하기', exact: true }).click();
  await expect(page.locator('.broadcast-caption h2')).toContainText('목욕하기', { timeout: 10000 });
  await page.waitForTimeout(850);
  await page.screenshot({ path: testInfo.outputPath('camera-bath.png') });
  await expect
    .poll(async () => (await saved(page)).homeActivities.bath ?? 0, { timeout: 25000 })
    .toBe(1);
  const completed = await saved(page);
  expect(completed.hygiene).toBeGreaterThanOrEqual(70);
  expect(completed.schema).toBe(2);
  expect(completed.kills).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('home-room.png') });
  await page.getByRole('button', { name: '집 안 활동', exact: true }).click();
  await page.getByRole('button', { name: '책 읽기', exact: true }).click();
  await page.getByRole('button', { name: '활동 취소', exact: true }).click();
  expect((await saved(page)).homeActivities.read).toBeUndefined();
  await page.getByRole('button', { name: '마당으로', exact: true }).click();
  await expect(page.locator('.location-button')).toContainText('집 앞 마당');
  await page.reload();
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  expect((await saved(page)).homeActivities).toMatchObject({ meal: 1, bath: 1 });
  await expect(page.locator('main')).toHaveAttribute('data-place', 'yard');
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await page.getByRole('button', { name: '잠자기', exact: true }).click();
  await expect(page.getByRole('group', { name: '집 안 활동 진행' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await expect(page.getByRole('group', { name: '집 안 활동 진행' })).toHaveCount(0);
  expect((await saved(page)).homeActivities.sleep).toBeUndefined();
  await expect(page.getByTestId('hunt')).toHaveText('사냥 ON');
  expect(errors).toEqual([]);
});

test('activity camera zooms, allows a room view and restores after cancellation', async ({
  page,
}, testInfo) => {
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    energy: 30,
    hp: 30,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await page.getByRole('button', { name: '잠자기', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-activity-camera', 'true');
  await expect(page.getByRole('navigation', { name: '게임 메뉴' })).toBeHidden();
  await expect(page.locator('.broadcast-caption h2')).toContainText('잠자기', { timeout: 10000 });
  await page.waitForTimeout(850);
  await page.screenshot({ path: testInfo.outputPath('camera-closeup.png') });
  await page.getByRole('button', { name: '방 전체 보기', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-activity-camera', 'false');
  await expect(page.getByRole('group', { name: '집 안 활동 진행' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '게임 메뉴' })).toBeVisible();
  await page.waitForTimeout(850);
  await page.screenshot({ path: testInfo.outputPath('camera-room-view.png') });
  await page.getByRole('button', { name: '집 안 활동', exact: true }).click();
  await expect(page.getByRole('heading', { name: '집 안 활동', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '활동 카메라', exact: true }).click();
  await expect(page.locator('#game-panel')).toHaveCount(0);
  await expect(page.locator('main')).toHaveAttribute('data-activity-camera', 'true');
  await page.getByRole('button', { name: '활동 취소', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-activity-camera', 'false');
  await expect(page.locator('.activity-broadcast')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '게임 메뉴' })).toBeVisible();
  await page.waitForTimeout(850);
  await page.screenshot({ path: testInfo.outputPath('camera-restored.png') });
  await nav(page, '설정');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  expect((await saved(page)).homeActivities.sleep).toBeUndefined();
});

test('activity camera controls remain visible through portrait and landscape resizing', async ({
  page,
}, testInfo) => {
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    energy: 30,
    hp: 30,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await page.getByRole('button', { name: '잠자기', exact: true }).click();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.locator('main')).toHaveAttribute('data-activity-camera', 'true');
    const boxes = await page
      .locator('.home-progress button, .broadcast-top, .broadcast-caption')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(size.width + 1);
      expect(box.bottom).toBeLessThanOrEqual(size.height + 1);
    }
    const cancel = await page.getByRole('button', { name: '활동 취소', exact: true }).boundingBox();
    const view = await page
      .getByRole('button', { name: '방 전체 보기', exact: true })
      .boundingBox();
    expect(cancel!.y + cancel!.height).toBeLessThan(view!.y);
    await page.screenshot({ path: testInfo.outputPath(`camera-${size.width}x${size.height}.png`) });
    await page.getByRole('button', { name: '방 전체 보기', exact: true }).click();
    const exit = await page.getByRole('button', { name: '마당으로', exact: true }).boundingBox();
    const progress = await page.getByRole('group', { name: '집 안 활동 진행' }).boundingBox();
    expect(
      Math.min(exit!.x + exit!.width, progress!.x + progress!.width) >
        Math.max(exit!.x, progress!.x) &&
        Math.min(exit!.y + exit!.height, progress!.y + progress!.height) >
          Math.max(exit!.y, progress!.y),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`camera-wide-${size.width}x${size.height}.png`),
    });
    await page.getByRole('button', { name: '활동 카메라', exact: true }).click();
  }
  await page.getByRole('button', { name: '활동 취소', exact: true }).click();
});

test('old v1 progress receives home defaults without losing its raw backup', async ({ page }) => {
  const { hygiene, toilet, roomCleanliness, homeActivities, ...legacy } = defaults();
  const fixture = { ...legacy, schema: 1, chosen: true, coins: 123, name: '옛 친구' };
  await page.addInitScript(
    (pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)),
    fixture,
  );
  await page.goto('/');
  await expect(page.getByTestId('hunt')).toBeEnabled();
  await expect(page.locator('.player-name')).toContainText('옛 친구');
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await expect(page.getByTestId('hygiene')).toHaveText('80');
  await nav(page, '설정');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  expect((await saved(page)).schema).toBe(2);
  expect((await saved(page)).coins).toBe(123);
  const previous = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('mochipet.web.v1.previous')!),
  );
  expect(previous).toMatchObject(fixture);
  expect(previous.hygiene).toBeUndefined();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('mochipet.web.v1.before-home-upgrade')!),
    ),
  ).toEqual(fixture);
});

test('home furniture responds to the canvas and care controls fit small screens', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    hygiene: 30,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await page.waitForTimeout(400); // Let the 250 ms room fade and camera settle.
  // The visible bathtub in the desktop room overview, away from the pet and HUD.
  if (isMobile) await page.touchscreen.tap(970, 355);
  else await page.mouse.click(970, 355);
  await expect(page.getByRole('group', { name: '집 안 활동 진행' })).toContainText('목욕하기');
  await page.getByRole('button', { name: '활동 취소', exact: true }).click();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () => (await page.locator('canvas').boundingBox())?.width)
      .toBeCloseTo(size.width, 0);
    const boxes = await page
      .locator(
        '.menu-rail button, .action-rail button, .player-hud, .coin-wallet, .location-button, .home-dock button:visible, .yard-return, .home-needs > span:visible, .game-meta > span, .game-meta button, .feedback:visible',
      )
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
    for (const r of boxes) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(size.width + 1);
      expect(r.bottom).toBeLessThanOrEqual(size.height + 1);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        expect(
          Math.min(a.right, b.right) > Math.max(a.x, b.x) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y),
          `home controls ${i}/${j} overlap at ${size.width}x${size.height}`,
        ).toBe(false);
      }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`room-${size.width}x${size.height}.png`) });
  }
});

test('meal visibly lifts spoonfuls, chews and leaves an empty bowl', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    characterId: testInfo.project.name === 'mobile' ? 'm_INTJ' : 'z_dragon',
    hunger: 45,
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await page.getByRole('button', { name: '밥 먹기', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-meal-stage', /reach|scoop|lift/);
  const recording = page.evaluate(async () => {
    const canvas = document.querySelector('canvas')!;
    const host = document.querySelector('.game-canvas')!;
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm;codecs=vp8';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const observations: { stage: string; servings: number; bites: number }[] = [];
    const sample = () => {
      if (host.hasAttribute('data-meal-stage'))
        observations.push({
          stage: host.getAttribute('data-meal-stage')!,
          servings: Number(host.getAttribute('data-meal-servings')),
          bites: Number(host.getAttribute('data-meal-bites')),
        });
    };
    sample();
    const interval = window.setInterval(sample, 75);
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const finished = new Promise<number[]>((resolve) => {
      recorder.onstop = async () => {
        clearInterval(interval);
        stream.getTracks().forEach((track) => track.stop());
        resolve(
          Array.from(new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer())),
        );
      };
    });
    recorder.start(200);
    await new Promise((resolve) => setTimeout(resolve, 7300));
    recorder.stop();
    return { video: await finished, observations };
  });
  for (const stage of ['lift', 'chew', 'finished']) {
    await page.waitForFunction(
      (wanted) =>
        document.querySelector('.game-canvas')?.getAttribute('data-meal-stage') === wanted,
      stage,
      { polling: 20, timeout: 10000 },
    );
    await page.screenshot({ path: testInfo.outputPath(`meal-${stage}.png`) });
  }
  const recorded = await recording;
  await writeFile(testInfo.outputPath('meal-animation.webm'), Buffer.from(recorded.video));
  const stages = recorded.observations.map((o) => o.stage);
  expect(stages).toContain('lift');
  expect(stages).toContain('chew');
  expect(stages).toContain('finished');
  expect(Math.max(...recorded.observations.map((o) => o.servings))).toBeGreaterThanOrEqual(3);
  expect(Math.min(...recorded.observations.map((o) => o.servings))).toBe(0);
  expect(Math.max(...recorded.observations.map((o) => o.bites))).toBe(4);
  await expect.poll(async () => (await saved(page)).homeActivities.meal ?? 0).toBe(1);
  await expect(page.locator('.game-canvas')).not.toHaveAttribute('data-meal-stage');
  await page.screenshot({ path: testInfo.outputPath('meal-complete.png') });
  expect((await saved(page)).hunger).toBeGreaterThanOrEqual(70);
  expect(errors).toEqual([]);
});

for (const scenario of [
  { id: 'bath', phases: ['scrub', 'rinse', 'dry'] },
  { id: 'toilet', phases: ['wait', 'wipe', 'flush', 'wash'] },
  { id: 'play', phases: ['toss', 'bounce', 'hug'] },
  { id: 'read', phases: ['turn', 'read', 'close'] },
  { id: 'sleep', phases: ['settle', 'sleep', 'wake'] },
  { id: 'clean', phases: ['sweep', 'collect', 'shine'] },
]) {
  test(`physical care ${scenario.id} uses props through completion and cancellation`, async ({
    page,
  }, testInfo) => {
    const activity = homeActivityById(scenario.id)!;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      (pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)),
      {
        ...defaults(),
        chosen: true,
        characterId: testInfo.project.name === 'mobile' ? 'm_INTJ' : 'z_dragon',
        hp: 30,
        hunger: 45,
        hygiene: 25,
        toilet: 85,
        roomCleanliness: 30,
        energy: 40,
      },
    );
    await page.goto('/');
    await expect(page.locator('.scene-loading')).not.toBeVisible();
    await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
    await startCare(page, activity.name);
    const host = page.locator('.game-canvas');
    await expect(host).toHaveAttribute('data-care-activity', scenario.id, { timeout: 10000 });
    // Cancel before completion, then start again while care is still needed.
    await page.getByRole('button', { name: '활동 취소', exact: true }).click();
    await expect(host).not.toHaveAttribute('data-care-activity');
    expect((await saved(page)).homeActivities[scenario.id] ?? 0).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`${scenario.id}-restored.png`) });
    await startCare(page, activity.name);
    await expect(host).toHaveAttribute('data-care-activity', scenario.id, { timeout: 10000 });
    // Record the actual rendered canvas while checking the visible activity phases.
    const recording = page.evaluate(async (seconds) => {
      const stream = document.querySelector('canvas')!.captureStream(24);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm;codecs=vp8';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const ended = new Promise<number[]>((resolve) => {
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(
            Array.from(new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer())),
          );
        };
      });
      recorder.start(250);
      await new Promise((resolve) => setTimeout(resolve, (seconds - 0.35) * 1000));
      recorder.stop();
      return ended;
    }, activity.seconds);
    await page.waitForTimeout(750); // Let the activity camera settle before visual captures.
    let first: Buffer | undefined;
    for (const phase of scenario.phases) {
      await page.waitForFunction(
        (wanted) =>
          document.querySelector('.game-canvas')?.getAttribute('data-care-phase') === wanted,
        phase,
        { polling: 20, timeout: 20000 },
      );
      const frame = await page.screenshot({
        path: testInfo.outputPath(`${scenario.id}-${phase}.png`),
      });
      if (!first) first = frame;
      else expect(frame.equals(first)).toBe(false);
    }
    await writeFile(
      testInfo.outputPath(`${scenario.id}-animation.webm`),
      Buffer.from(await recording),
    );
    await expect
      .poll(async () => (await saved(page)).homeActivities[scenario.id] ?? 0, { timeout: 10000 })
      .toBe(1);
    await expect(host).not.toHaveAttribute('data-care-activity');
    const complete = await saved(page);
    if (scenario.id === 'bath') expect(complete.hygiene).toBeGreaterThan(60);
    if (scenario.id === 'toilet') expect(complete.toilet).toBeLessThan(25);
    if (scenario.id === 'clean') expect(complete.roomCleanliness).toBeGreaterThan(65);
    if (scenario.id === 'sleep') expect(complete.energy).toBeGreaterThan(65);
    await page.screenshot({ path: testInfo.outputPath(`${scenario.id}-complete.png`) });
    expect(errors).toEqual([]);
  });
}

test('map dragging explores freely, ignores furniture clicks and resumes following on request', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.addInitScript((pet) => localStorage.setItem('mochipet.web.v1', JSON.stringify(pet)), {
    ...defaults(),
    chosen: true,
    characterId: 'z_dragon',
  });
  await page.goto('/');
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  const host = page.locator('.game-canvas');
  await page.waitForTimeout(700);
  const camera = async () => ({
    x: Number(await host.getAttribute('data-camera-x')),
    y: Number(await host.getAttribute('data-camera-y')),
  });
  const before = await camera();
  await dragMap(page, isMobile, { x: 560, y: 330 }, { x: 350, y: 200 });
  await expect(host).toHaveAttribute('data-camera-mode', 'free');
  const after = await camera();
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(60);
  await page.mouse.click(520, 410); // Walk while retaining the chosen camera position.
  await page.waitForTimeout(1400);
  expect(await camera()).toEqual(after);
  const overlay = await page
    .locator('.world-hint, .game-meta > span, .game-meta button')
    .evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    );
  for (let i = 0; i < overlay.length; i++)
    for (let j = i + 1; j < overlay.length; j++)
      expect(
        Math.min(overlay[i].right, overlay[j].right) > Math.max(overlay[i].x, overlay[j].x) &&
          Math.min(overlay[i].bottom, overlay[j].bottom) > Math.max(overlay[i].y, overlay[j].y),
      ).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('free-map.png') });
  await page.getByRole('button', { name: '친구 따라가기', exact: true }).click();
  await expect(host).toHaveAttribute('data-camera-mode', 'follow');
  await expect
    .poll(async () => {
      const p = await camera();
      return Math.hypot(p.x - after.x, p.y - after.y);
    })
    .toBeGreaterThan(20);
  await page.getByRole('button', { name: '집 들어가기', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-place', 'home');
  await page.waitForTimeout(700);
  await dragMap(page, isMobile, { x: 642, y: 290 }, { x: 480, y: 360 });
  await expect(host).toHaveAttribute('data-camera-mode', 'free');
  await expect(page.getByRole('group', { name: '집 안 활동 진행' })).toHaveCount(0);
  expect((await saved(page)).homeActivities).toEqual({});
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect(host).toHaveAttribute('data-camera-mode', 'free');
    const boxes = await page.locator('.game-meta > span, .game-meta button').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    );
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(size.width);
      expect(box.bottom).toBeLessThanOrEqual(size.height);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        expect(
          Math.min(boxes[i].right, boxes[j].right) > Math.max(boxes[i].x, boxes[j].x) &&
            Math.min(boxes[i].bottom, boxes[j].bottom) > Math.max(boxes[i].y, boxes[j].y),
        ).toBe(false);
  }
  await page.screenshot({ path: testInfo.outputPath('free-room.png') });
});

test('a failed scene download offers reconnection without erasing the pet', async ({ page }) => {
  const pet = { ...defaults(), chosen: true, coins: 123 };
  await page.addInitScript((value) => {
    if (!localStorage.getItem('mochipet.web.v1'))
      localStorage.setItem('mochipet.web.v1', JSON.stringify(value));
  }, pet);
  await page.route(
    /(?:\/src\/game\/MeadowScene\.ts|\/assets\/MeadowScene-[^/]+\.js)(?:\?.*)?$/,
    (route) => route.abort(),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('게임 화면을 불러오지 못했어요');
  await expect(page.getByRole('button', { name: '화면 다시 연결', exact: true })).toBeVisible();
  expect((await saved(page)).coins).toBe(123);
  await page.unrouteAll();
  await page.getByRole('button', { name: '화면 다시 연결', exact: true }).click();
  await expect(page.locator('.scene-loading')).not.toBeVisible();
  expect((await saved(page)).coins).toBe(123);
});
