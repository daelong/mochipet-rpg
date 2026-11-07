import Phaser from 'phaser';
import { monsterById } from '@mochi/game-data';
import type { Enemy } from '@mochi/shared';
interface MonsterView {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
}
/** At most five instances share the same eight monster textures. */
export class MonsterField {
  private views = new Map<number, MonsterView>();
  private bars: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.bars = scene.add.graphics().setDepth(2900);
  }
  render(enemies: readonly Enemy[], targetUid: number | null, age: number) {
    const alive = new Set(enemies.map((e) => e.uid));
    for (const [uid, view] of this.views)
      if (!alive.has(uid)) {
        Object.values(view).forEach((object) => object.destroy());
        this.views.delete(uid);
      }
    this.bars.clear();
    for (const enemy of enemies) {
      let view = this.views.get(enemy.uid);
      if (!view) {
        const style = {
          fontFamily: 'system-ui',
          color: '#fff6dd',
          stroke: '#324d36',
          strokeThickness: 4,
        };
        view = {
          image: this.scene.add
            .image(enemy.x, enemy.y - 36, `mob-${enemy.id}`)
            .setDisplaySize(110, 110),
          shadow: this.scene.add.ellipse(enemy.x, enemy.y + 4, 64, 18, 0x233b2a, 0.18),
          name: this.scene.add
            .text(enemy.x, enemy.y - 106, monsterById(enemy.id).name, {
              ...style,
              fontSize: '14px',
            })
            .setOrigin(0.5)
            .setDepth(3000),
          hp: this.scene.add
            .text(enemy.x, enemy.y - 71, '', { ...style, fontSize: '11px' })
            .setOrigin(0.5)
            .setDepth(3000),
        };
        this.views.set(enemy.uid, view);
      }
      const { x, y } = enemy;
      view.image.setPosition(x, y - 36 + Math.sin(age * 3 + enemy.uid) * 2).setDepth(y);
      view.shadow.setDepth(y - 1);
      view.hp.setText(`${enemy.hp} / ${enemy.maxHp}`);
      view.name.setColor(targetUid === enemy.uid ? '#ffeb98' : '#fff6dd');
      if (targetUid === enemy.uid)
        this.bars.lineStyle(2, 0xf3dc8c, 0.8).strokeEllipse(x, y + 4, 82, 27);
      this.bars.fillStyle(0x243e30, 0.6).fillRoundedRect(x - 42, y - 90, 84, 6, 3);
      this.bars
        .fillStyle(0xe6a38c)
        .fillRoundedRect(x - 42, y - 90, Math.max(1, (84 * enemy.hp) / enemy.maxHp), 6, 3);
    }
  }
  flash(uid: number) {
    const image = this.views.get(uid)?.image;
    if (!image) return;
    image.setTint(0xffbbbb);
    this.scene.time.delayedCall(130, () => {
      if (image.active) image.clearTint();
    });
  }
}
