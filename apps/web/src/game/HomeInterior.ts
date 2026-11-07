import Phaser from 'phaser';
import { HOME_ACTIVITIES, type HomeActivityId } from '@mochi/game-data';
import { isMapClick } from './mapPan';
import { DOORS } from '@mochi/shared';

/** Furniture is drawn in the same world coordinates as the pet and its camera. */
export function drawHomeInterior(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  decorations: Phaser.GameObjects.Container,
  dirty: boolean,
  onActivity: (id: string) => void,
  onExit: () => void,
  active: HomeActivityId | null = null,
  doorOpen = false,
) {
  g.fillStyle(0xcda777).fillRect(-600, -300, 3000, 1900);
  for (let y = 240; y < 1600; y += 80) {
    for (let x = -600; x < 2400; x += 250) {
      const offset = (y / 80) % 2 ? 125 : 0;
      g.fillStyle((x / 250) % 2 ? 0xe0c193 : 0xdbc093).fillRect(x + offset, y, 248, 78);
      g.lineStyle(1, 0xa88256, 0.16).lineBetween(x + offset + 15, y + 50, x + offset + 210, y + 50);
    }
  }
  g.fillStyle(0xe9e2c7).fillRect(-600, -300, 3000, 560);
  for (let x = -600; x < 2400; x += 52) g.fillStyle(0xd4d9bb, 0.35).fillRect(x, -300, 24, 544);
  g.fillStyle(0x9c7d56).fillRect(-600, 245, 3000, 15);
  g.fillStyle(0x615e43, 0.12).fillRect(-600, 260, 3000, 18);
  // Window, curtains, plants and a wall clock.
  g.fillStyle(0xf6eed3).fillRoundedRect(430, 55, 230, 153, 8);
  g.fillStyle(0xb7d6cf).fillRect(446, 70, 198, 120);
  g.fillStyle(0xe6eabb).fillEllipse(560, 170, 190, 65);
  g.lineStyle(8, 0xf6eed3).lineBetween(545, 65, 545, 198).lineBetween(438, 128, 652, 128);
  for (const x of [408, 644]) g.fillStyle(0xa1b28b).fillRoundedRect(x, 45, 40, 175, 8);
  g.fillStyle(0x927451).fillCircle(900, 128, 47);
  g.fillStyle(0xf6edcd).fillCircle(900, 128, 39);
  g.lineStyle(4, 0x586650).lineBetween(900, 128, 900, 101).lineBetween(900, 128, 922, 137);
  g.fillStyle(0xb48460).fillRoundedRect(1280, 184, 55, 62, 12);
  g.fillStyle(0x759659)
    .fillEllipse(1308, 144, 36, 90)
    .fillEllipse(1278, 153, 43, 70)
    .fillEllipse(1333, 149, 40, 72);
  // Kitchen counter, stove, sink and dining table.
  g.fillStyle(0xa57c53, 0.2).fillRoundedRect(355, 315, 332, 128, 14);
  g.fillStyle(0xa7845b).fillRoundedRect(350, 294, 330, 122, 12);
  g.fillStyle(0xf2e3bd).fillRoundedRect(343, 284, 344, 55, 12);
  g.fillStyle(0x788b83).fillRoundedRect(386, 294, 95, 31, 10);
  g.lineStyle(6, 0x70827b).lineBetween(432, 298, 432, 277).lineBetween(432, 277, 451, 277);
  for (const x of [555, 611]) g.lineStyle(4, 0x666d5c).strokeCircle(x, 309, 16);
  g.lineStyle(3, 0xc9ae7d).lineBetween(510, 349, 510, 406).lineBetween(358, 374, 670, 374);
  if (active !== 'meal') {
    g.fillStyle(0xa17d53, 0.18).fillEllipse(572, 561, 237, 84);
    g.fillStyle(0xb58e60).fillRoundedRect(479, 455, 190, 112, 21);
    g.fillStyle(0xe8d3a4).fillRoundedRect(472, 440, 204, 110, 21);
    g.fillStyle(0xf5efda).fillEllipse(576, 492, 69, 43);
    g.fillStyle(0x90a576).fillEllipse(576, 499, 47, 23);
    g.fillStyle(0xf9f2db).fillEllipse(576, 489, 43, 19);
    g.fillStyle(0xb99368).fillRoundedRect(544, 566, 68, 40, 13);
  }
  // Bookcase and reading cushion.
  g.fillStyle(0xb08b5e).fillRoundedRect(746, 282, 222, 126, 10);
  for (let i = 0; i < 10; i++)
    g.fillStyle([0x93a584, 0xd0a48c, 0xd7c288, 0x8da8a4][i % 4]).fillRoundedRect(
      760 + i * 19,
      300 + (i % 3) * 5,
      14,
      75 - (i % 3) * 5,
      2,
    );
  g.fillStyle(0xd4bf91).fillRoundedRect(751, 383, 212, 12, 3);
  if (active !== 'read') {
    g.fillStyle(0xa8b295).fillEllipse(857, 467, 133, 78);
    g.fillStyle(0xc7ceb0).fillEllipse(850, 457, 108, 61);
  }
  // Bath tiles and an oval tub with water.
  g.fillStyle(0xaec6bc).fillRoundedRect(1050, 287, 347, 338, 20);
  g.lineStyle(2, 0xe1e6ce, 0.6);
  for (let x = 1060; x < 1390; x += 55) g.lineBetween(x, 294, x, 617);
  for (let y = 294; y < 620; y += 55) g.lineBetween(1058, y, 1390, y);
  if (active !== 'bath') {
    g.fillStyle(0x7c9b91, 0.3).fillEllipse(1210, 469, 253, 70);
    g.fillStyle(0xf8f0d8).fillRoundedRect(1088, 350, 237, 130, 52);
    g.fillStyle(0x93c5c0).fillRoundedRect(1108, 362, 197, 86, 40);
    g.lineStyle(7, 0x738c84).lineBetween(1291, 368, 1291, 337).lineBetween(1291, 337, 1265, 337);
    g.fillStyle(0xd7e2be).fillRoundedRect(1155, 488, 100, 61, 13);
  }
  // Bathroom nook.
  g.fillStyle(0xc5cdb0).fillRoundedRect(1180, 655, 217, 179, 18);
  if (active !== 'toilet') {
    g.fillStyle(0xf5edd4).fillRoundedRect(1248, 657, 89, 54, 13).fillEllipse(1292, 731, 100, 72);
    g.fillStyle(0xa3b6aa).fillEllipse(1292, 727, 62, 40);
  }
  g.fillStyle(0xe9dfc2).fillRoundedRect(1155, 640, 13, 210, 5);
  g.fillStyle(0xf7efd5).fillRoundedRect(1354, 689, 25, 37, 6);
  // Sleeping area, quilt, pillow and bedside lamp.
  if (active !== 'sleep') {
    g.fillStyle(0xa38363, 0.2).fillRoundedRect(416, 750, 239, 255, 22);
    g.fillStyle(0xb19065).fillRoundedRect(405, 730, 238, 253, 18);
    g.fillStyle(0xf5e4ba).fillRoundedRect(418, 740, 211, 221, 18);
    g.fillStyle(0xc0b1b6).fillRoundedRect(423, 814, 202, 143, 15);
    g.fillStyle(0xd8c8ca).fillRoundedRect(424, 811, 200, 31, 9);
    g.fillStyle(0xfff6df).fillRoundedRect(445, 753, 154, 59, 20);
    for (let i = 0; i < 4; i++) g.fillStyle(0xf0dba9, 0.6).fillCircle(456 + i * 43, 882, 4);
    g.fillStyle(0xb28e63).fillRoundedRect(338, 795, 61, 63, 9);
    g.fillStyle(0xf0d493).fillTriangle(331, 791, 369, 739, 405, 791);
  }
  // Central rug and toys.
  g.fillStyle(0xb38e67, 0.2).fillEllipse(858, 746, 391, 231);
  g.fillStyle(0xb2be9b).fillEllipse(850, 725, 385, 224);
  g.lineStyle(4, 0xe6ddaf, 0.7).strokeEllipse(850, 725, 352, 194);
  if (active !== 'play') {
    g.fillStyle(0xd2b088)
      .fillCircle(744, 689, 24)
      .fillCircle(727, 668, 11)
      .fillCircle(761, 668, 11)
      .fillEllipse(744, 727, 47, 53);
    g.fillStyle(0x5a5948).fillCircle(736, 686, 2).fillCircle(752, 686, 2).fillCircle(744, 694, 3);
    g.fillStyle(0xd5a592).fillRoundedRect(926, 739, 32, 30, 5);
    g.fillStyle(0xe2cf93).fillRoundedRect(957, 721, 30, 30, 5);
    g.fillStyle(0x91aba8).fillCircle(933, 667, 20);
  }
  // Cleaning corner and the door back to the yard.
  if (active !== 'clean') {
    g.fillStyle(0xa2b5a4).fillRoundedRect(1064, 871, 60, 56, 13);
    g.lineStyle(6, 0xb89b69).lineBetween(1150, 827, 1119, 914);
    g.fillStyle(0xc7ac73).fillTriangle(1119, 899, 1089, 943, 1138, 951);
  }
  if (dirty && active !== 'clean')
    for (let i = 0; i < 20; i++)
      g.fillStyle(0x8c7958, 0.4).fillEllipse(410 + ((i * 137) % 960), 430 + ((i * 83) % 580), 8, 4);

  const labelStyle = {
    fontFamily: 'system-ui',
    fontSize: '15px',
    color: '#fff3d3',
    backgroundColor: '#455d43cc',
    padding: { x: 12, y: 7 },
  };
  for (const activity of HOME_ACTIVITIES) {
    const label = scene.add
      .text(activity.x, activity.y + 58, `${activity.icon} ${activity.furniture}`, labelStyle)
      .setOrigin(0.5);
    const hit = scene.add
      .zone(activity.x, activity.y - 15, 150, 165)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (isMapClick(scene, pointer)) onActivity(activity.id);
    });
    decorations.add([label, hit]);
  }
  const doorX = DOORS.homeExit.threshold.x;
  g.fillStyle(0x806047).fillRoundedRect(doorX - 100, 1080, 200, 108, 8);
  g.fillStyle(doorOpen ? 0x66855c : 0xa9855b).fillRoundedRect(doorX - 86, 1090, 172, 86, 5);
  if (!doorOpen) g.lineStyle(3, 0x806047).lineBetween(doorX, 1090, doorX, 1176);
  g.fillStyle(0xd6c096).fillRoundedRect(doorX - 96, 1175, 192, 14, 3);
  const exitLabel = scene.add.text(doorX, 1210, '마당으로 나가기 ↓', labelStyle).setOrigin(0.5);
  const exit = scene.add.zone(doorX, 1130, 200, 140).setInteractive({ useHandCursor: true });
  exit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (isMapClick(scene, pointer)) onExit();
  });
  decorations.add([exitLabel, exit]);
}
