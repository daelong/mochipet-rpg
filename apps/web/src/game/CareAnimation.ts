import Phaser from 'phaser';
import { type CarePose, smooth } from './careMotion';
import { paw, petFigure, type Point } from './petFigure';

/** Layer furniture around the real pet, with hand contact and changing physical props. */
export class CareAnimation {
  private back: Phaser.GameObjects.Graphics;
  private front: Phaser.GameObjects.Graphics;
  private acting: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.back = scene.add.graphics();
    this.front = scene.add.graphics();
    this.acting = scene.add.graphics();
  }
  hide() {
    this.back.clear();
    this.front.clear();
    this.acting.clear();
  }
  render(pet: Phaser.GameObjects.Image, character: string, x: number, y: number, pose: CarePose) {
    const back = this.back.clear().setDepth(y - 2);
    const front = this.front.clear().setDepth(y + 2);
    const g = this.acting.clear().setDepth(y + 3);
    const figure = petFigure(pet, character);
    const hand = (side: number, at: Point) => paw(g, figure.root(side), at, figure.tint);
    const { mouth } = figure;
    const { phase, time, local, stroke } = pose;
    if (pose.id === 'bath') {
      back.fillStyle(0x638b81, 0.2).fillEllipse(x, y + 53, 228, 66);
      back.fillStyle(0xf4eddb).fillRoundedRect(x - 110, y - 38, 220, 106, 42);
      back.fillStyle(0x8bbfbd).fillEllipse(x, y - 10, 197, 72);
      back.lineStyle(7, 0xfdf8e9).strokeEllipse(x, y - 9, 203, 78);
      back
        .lineStyle(6, 0x6e8c87)
        .lineBetween(x + 83, y - 31, x + 83, y - 62)
        .lineBetween(x + 83, y - 62, x + 64, y - 62);
      front.fillStyle(0x9bcfcb, 0.93).fillEllipse(x, y + 6, 181, 32);
      front.fillStyle(0xf7f0de).fillRoundedRect(x - 108, y + 9, 216, 57, 24);
      front.lineStyle(4, 0xfff9eb).lineBetween(x - 82, y + 12, x + 82, y + 12);
      front
        .lineStyle(2, 0xb8ddcf, 0.8)
        .strokeEllipse(x - 42 + stroke * 5, y + 3, 47, 9)
        .strokeEllipse(x + 40 - stroke * 5, y + 5, 36, 6);
      if (phase === 'scrub' || phase === 'soak') {
        const sponge = { x: mouth.x + 28 + stroke * 12, y: mouth.y - 16 + Math.cos(time * 8) * 12 };
        hand(1, { x: sponge.x + 7, y: sponge.y + 6 });
        hand(-1, { x: x - 56, y: y + 6 });
        g.fillStyle(0xf4d387).fillRoundedRect(sponge.x - 15, sponge.y - 10, 28, 18, 7);
        for (let i = 0; i < 5; i++)
          g.fillStyle(0xd9b16b).fillCircle(
            sponge.x - 10 + ((i * 7) % 22),
            sponge.y - 5 + (i % 2) * 8,
            1.5,
          );
      } else if (phase === 'rinse') {
        const shower = { x: mouth.x + 49 + stroke * 5, y: mouth.y - 45 };
        hand(1, { x: shower.x + 17, y: shower.y + 23 });
        g.lineStyle(5, 0x6f9692).lineBetween(
          shower.x + 18,
          shower.y + 24,
          shower.x + 7,
          shower.y + 5,
        );
        g.fillStyle(0xb0cbc4).fillEllipse(shower.x, shower.y, 29, 13);
        for (let i = 0; i < 16; i++) {
          const t = (time * 2.1 + i / 16) % 1;
          g.lineStyle(2, 0xe6ffff, 0.75).lineBetween(
            shower.x - 6 - t * (30 + (i % 4) * 8),
            shower.y + 7 + t * 55,
            shower.x - 9 - t * (30 + (i % 4) * 8),
            shower.y + 13 + t * 55,
          );
        }
      } else {
        const tx = mouth.x + stroke * 10,
          ty = mouth.y + 17 + Math.cos(time * 9) * 4;
        g.fillStyle(0xe8d5b9).fillRoundedRect(tx - 35, ty - 9, 70, 25, 7);
        g.lineStyle(2, 0xc5ae91)
          .lineBetween(tx - 24, ty - 6, tx - 24, ty + 12)
          .lineBetween(tx + 24, ty - 6, tx + 24, ty + 12);
        hand(-1, { x: tx - 31, y: ty + 1 });
        hand(1, { x: tx + 31, y: ty + 1 });
      }
      for (let i = 0; i < Math.ceil(pose.foam * 19); i++) {
        const top = i < 7;
        const bx = top ? mouth.x - 24 + i * 8 : x - 65 + ((i * 19) % 130);
        const by = top ? mouth.y - 45 - Math.sin(i * 0.6) * 6 : y - 3 + Math.sin(i + time * 3) * 3;
        g.fillStyle(0xf9fff3, 0.9).fillCircle(bx, by, 5 + (i % 4));
        g.lineStyle(1, 0xc3e3da).strokeCircle(bx, by, 5 + (i % 4));
      }
    } else if (pose.id === 'toilet') {
      back.fillStyle(0xe6deca).fillRoundedRect(x - 42, y - 83, 84, 91, 14);
      back.fillStyle(0xfff7e8).fillRoundedRect(x - 34, y - 78, 68, 50, 9);
      back.fillStyle(0xa7b7a8).fillRoundedRect(x + 17, y - 55, 17, 7, 3);
      front.fillStyle(0xf6efdf).fillRoundedRect(x - 32, y + 17, 64, 41, 15);
      front.fillStyle(0xfff7e8).fillEllipse(x, y + 9, 107, 43);
      front.fillStyle(0xa1c4ba).fillEllipse(x, y + 9, 73, 24);
      if (phase === 'flush') {
        for (let i = 0; i < 3; i++)
          front
            .lineStyle(2, 0xe2f4e6, 0.8)
            .strokeEllipse(x + Math.sin(time * 12 + i) * 8, y + 9, 58 - i * 13, 18 - i * 4);
      }
      front.fillStyle(0xa7b5a0).fillRoundedRect(x - 60, y + 21, 120, 26, 7);
      front.lineStyle(2, 0xd8dfc2).lineBetween(x - 53, y + 26, x + 53, y + 26);
      for (const side of [-1, 1]) {
        back.lineStyle(4, 0xb79c75).lineBetween(x + side * 90, y - 86, x + side * 90, y + 38);
        back.fillStyle(0xbdc9af).fillRoundedRect(x + side * 90 - 8, y - 85, 16, 98, 5);
      }
      if (phase === 'wipe') {
        const tissue = { x: mouth.x - 36, y: mouth.y + 7 + stroke * 3 };
        g.fillStyle(0xfffaed).fillRoundedRect(
          tissue.x - 7,
          tissue.y - 4,
          22,
          31 * smooth(local) + 7,
          2,
        );
        g.lineStyle(1, 0xdddbc7).lineBetween(
          tissue.x - 2,
          tissue.y + 8,
          tissue.x + 10,
          tissue.y + 8,
        );
        hand(-1, tissue);
      } else if (phase === 'flush')
        hand(1, { x: x + 26, y: y - 51 + Math.sin(local * Math.PI) * 5 });
      else if (phase !== 'wash') {
        hand(-1, { x: x - 37, y: y + 1 });
        hand(1, { x: x + 37, y: y + 1 });
      }
      if (phase === 'wash') {
        front.fillStyle(0xe5ede0).fillRoundedRect(x + 62, y - 6, 68, 43, 13);
        front.fillStyle(0x9fc9c0).fillEllipse(x + 96, y + 5, 45, 17);
        front
          .lineStyle(5, 0x76948b)
          .lineBetween(x + 112, y - 5, x + 112, y - 33)
          .lineBetween(x + 112, y - 33, x + 94, y - 33);
        for (let i = 0; i < 5; i++) {
          const t = (time * 3 + i / 5) % 1;
          g.fillStyle(0xd5f6ee).fillEllipse(x + 94 + (i % 2) * 3, y - 27 + t * 29, 2, 5);
        }
        hand(-1, { x: x + 89 + stroke * 3, y: y + 2 });
        hand(1, { x: x + 99 - stroke * 3, y: y + 5 });
      }
    } else if (pose.id === 'play') {
      back.fillStyle(0xd4d5ae).fillEllipse(x, y + 21, 235, 98);
      back.lineStyle(3, 0xf6e7bd).strokeEllipse(x, y + 21, 214, 79);
      if (phase === 'hug') {
        const tx = mouth.x,
          ty = mouth.y + 19;
        g.fillStyle(0xb99067)
          .fillCircle(tx, ty, 21)
          .fillCircle(tx - 16, ty - 17, 9)
          .fillCircle(tx + 16, ty - 17, 9)
          .fillEllipse(tx, ty + 27, 37, 39);
        g.fillStyle(0xe7c69a).fillEllipse(tx, ty + 4, 17, 11);
        g.fillStyle(0x665344)
          .fillCircle(tx - 7, ty - 3, 2)
          .fillCircle(tx + 7, ty - 3, 2)
          .fillCircle(tx, ty + 3, 2.5);
        hand(-1, { x: tx - 21 + stroke * 2, y: ty + 14 });
        hand(1, { x: tx + 21 - stroke * 2, y: ty + 14 });
      } else {
        const bx = x + pose.ballX,
          by = y + pose.ballY;
        back
          .fillStyle(0x8b8d72, 0.18)
          .fillEllipse(bx, y + 23, 26 - Math.max(0, -pose.ballY) * 0.12, 8);
        g.fillStyle(0x91bfc2).fillCircle(bx, by, 16);
        g.lineStyle(2, 0xe8f0d6)
          .strokeCircle(bx, by, 16)
          .lineBetween(bx - 14, by - 4, bx + 14, by + 4);
        const reach =
          phase === 'toss' ? Math.min(1, ((time % 2.8) - 0.45) / 0.3) : phase === 'catch' ? 0 : 1;
        hand(-1, { x: x - 32 - reach * 11, y: y + 8 - reach * 20 });
        hand(1, { x: mouth.x + 26, y: mouth.y + 11 - reach * 9 });
      }
    } else if (pose.id === 'read') {
      back.fillStyle(0xaaba98).fillEllipse(x, y + 9, 150, 56);
      back.fillStyle(0xc8d1b0).fillEllipse(x, y + 2, 133, 46);
      const spread = phase === 'open' ? smooth(local) : phase === 'close' ? 1 - smooth(local) : 1;
      const w = 12 + 41 * spread,
        top = y + 7;
      g.fillStyle(0x8eaaa2).fillRoundedRect(x - w - 4, top - 3, w * 2 + 8, 43, 5);
      g.fillStyle(0xfff3d4).fillRoundedRect(x - w, top, w * 2, 34, 3);
      g.lineStyle(2, 0xc4b893).lineBetween(x, top + 1, x, top + 33);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++)
          g.lineStyle(1, 0xaea989, 0.7).lineBetween(
            x + side * 7,
            top + 8 + i * 6,
            x + side * (w - 7),
            top + 8 + i * 6,
          );
        g.fillStyle([0xd9a887, 0x91aa82, 0x91b7bc, 0xc7b183, 0xaba2b8][pose.page]).fillCircle(
          x + side * w * 0.6,
          top + 12,
          Math.max(1, w * 0.12),
        );
      }
      hand(-1, { x: x - w + 3, y: top + 22 });
      if (phase === 'turn') {
        const edge = x + Math.cos(pose.pageTurn * Math.PI) * w;
        const lift = Math.sin(pose.pageTurn * Math.PI) * 24;
        g.fillStyle(0xfff9e5).fillTriangle(x, top + 1, edge, top - lift, x, top + 33);
        g.lineStyle(1, 0xc9bc98)
          .lineBetween(x, top + 1, edge, top - lift)
          .lineBetween(edge, top - lift, x, top + 33);
        hand(1, { x: edge, y: top + 15 - lift });
      } else hand(1, { x: x + w - 3, y: top + 22 });
    } else if (pose.id === 'sleep') {
      if (phase === 'sleep')
        for (const eye of figure.eyes) {
          g.fillStyle(figure.tint).fillEllipse(eye.x, eye.y, 11, 10);
          g.lineStyle(1.8, 0x64525a)
            .lineBetween(eye.x - 4, eye.y, eye.x, eye.y + 2)
            .lineBetween(eye.x, eye.y + 2, eye.x + 4, eye.y);
        }
      back.fillStyle(0x8e7150, 0.18).fillRoundedRect(x - 82, y - 56, 164, 145, 19);
      back.fillStyle(0xac8b63).fillRoundedRect(x - 82, y - 66, 164, 144, 16);
      back.fillStyle(0xf2dfb3).fillRoundedRect(x - 74, y - 56, 148, 125, 13);
      back.fillStyle(0xfff6de).fillRoundedRect(x - 61, y - 37, 116, 39, 15);
      back.lineStyle(2, 0xe6d4b4).strokeRoundedRect(x - 61, y - 37, 116, 39, 15);
      const top = y + 55 - pose.blanket * 58 + Math.sin(time * 2) * pose.blanket * 1.5;
      front.fillStyle(0xada8bf).fillRoundedRect(x - 73, top, 146, y + 69 - top, 11);
      front.fillStyle(0xccc3d3).fillRoundedRect(x - 73, top, 146, 16, 8);
      for (let i = 0; i < 7; i++)
        front
          .fillStyle(0xf2dfb4, 0.8)
          .fillCircle(x - 55 + ((i * 37) % 110), top + 28 + (i % 2) * 14, 2);
      if (phase === 'settle' || phase === 'wake') {
        hand(-1, { x: x - 43, y: top + 2 });
        hand(1, { x: x + 43, y: top + 2 });
      }
      back.fillStyle(0xf0d492, 0.3).fillCircle(x - 108, y - 55, 33);
      back.fillStyle(0xaf8860).fillRoundedRect(x - 128, y - 17, 43, 55, 6);
      back.fillStyle(0xf1d394).fillTriangle(x - 134, y - 18, x - 107, y - 57, x - 80, y - 18);
    } else if (pose.id === 'clean') {
      const pan = { x: x - 66, y: y + 41 };
      back
        .fillStyle(0x8faeaa)
        .fillTriangle(pan.x - 25, pan.y + 12, pan.x + 23, pan.y + 12, pan.x, pan.y - 12);
      back.lineStyle(5, 0x668c86).lineBetween(pan.x, pan.y - 8, pan.x, pan.y - 38);
      for (let i = 0; i < pose.dust; i++) {
        const gather = smooth(pose.progress / 0.9);
        const px = x - 72 + i * 23,
          py = y + 27 + (i % 3) * 11;
        const dx = px + (pan.x - px) * gather,
          dy = py + (pan.y - py) * gather;
        back.fillStyle(0x9b8870, 0.75).fillEllipse(dx, dy, 10, 5);
        back.fillStyle(0xb8a58a).fillCircle(dx + 3, dy - 2, 3);
      }
      if (pose.progress > 0.4)
        back.fillStyle(0xab957b).fillEllipse(pan.x, pan.y + 3, Math.min(27, pose.progress * 30), 8);
      const bx =
        phase === 'sweep'
          ? x + stroke * 64
          : phase === 'collect'
            ? pan.x + Math.sin(local * Math.PI * 4) * 8
            : x + 64;
      const by = phase === 'shine' ? y + 15 : y + 42;
      const grip = { x: mouth.x + 19 + stroke * 6, y: mouth.y + 9 };
      g.lineStyle(5, 0xb49769).lineBetween(
        grip.x - (bx - grip.x) * 0.45,
        grip.y - (by - grip.y) * 0.45,
        bx,
        by,
      );
      g.fillStyle(0xd8be7e).fillTriangle(bx - 18, by + 10, bx + 18, by + 10, bx, by - 18);
      for (let i = 0; i < 5; i++)
        g.lineStyle(1, 0xa78c59).lineBetween(bx - 13 + i * 6, by + 8, bx - 8 + i * 4, by - 7);
      hand(1, grip);
      hand(-1, { x: grip.x + (bx - grip.x) * 0.3, y: grip.y + (by - grip.y) * 0.3 });
      if (phase === 'shine')
        for (let i = 0; i < 5; i++) {
          const sx = x - 75 + i * 35,
            sy = y + 19 + (i % 2) * 26,
            r = 3 + Math.sin(time * 6 + i) * 2;
          back
            .lineStyle(1.5, 0xfff5c7)
            .lineBetween(sx - r, sy, sx + r, sy)
            .lineBetween(sx, sy - r, sx, sy + r);
        }
    }
  }
}
