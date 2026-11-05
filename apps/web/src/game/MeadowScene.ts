import Phaser from 'phaser';
import { characterById, monsterById, petAsset, ZONES } from '@mochi/game-data';
import { maxHp, type GameEngine } from '@mochi/shared';
import { useGame } from '../state/game';
const W = 960,
  H = 530;
export class MeadowScene extends Phaser.Scene {
  private pet!: Phaser.GameObjects.Image;
  private mob!: Phaser.GameObjects.Image;
  private bars!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private petLabel!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private background!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Ellipse;
  private target = 470;
  private age = 0;
  private wander = 0;
  private lastEvent = 0;
  private currentCharacter = '';
  private currentZone = '';
  private mobId = '';
  private prevEnemy = false;
  private lastEngine: GameEngine | null = null;
  private loadingId = '';
  private effects: Phaser.GameObjects.Text[] = [];
  private lastX = 300;
  private observer?: ResizeObserver;
  constructor() {
    super('meadow');
  }
  preload() {
    this.loadCharacter(useGame.getState().engine.pet.characterId);
    for (const id of ['slime', 'mushroom', 'bat', 'foxfire', 'golem', 'shade', 'ghost', 'moon'])
      this.load.image(`mob-${id}`, `/game-assets/monsters/${id}.png`);
  }
  private loadCharacter(id: string) {
    for (const action of ['idle', 'walk', 'play', 'eat', 'happy', 'sleep'])
      for (let f = 0; f < 2; f++) {
        const key = `${id}-${action}-${f}`;
        if (!this.textures.exists(key)) this.load.image(key, petAsset(id, action, f));
      }
  }
  create() {
    this.background = this.add.graphics();
    this.drawLandscape('meadow');
    this.ground = this.add.ellipse(300, 398, 102, 15, 0x4c724f, 0.13);
    this.pet = this.add
      .image(300, 340, `${useGame.getState().engine.pet.characterId}-idle-0`)
      .setDisplaySize(155, 155)
      .setInteractive({ useHandCursor: true });
    this.pet.on('pointerdown', () => {
      if (useGame.getState().access === 'ready') useGame.getState().engine.care('pet');
    });
    this.mob = this.add.image(730, 340, 'mob-slime').setDisplaySize(132, 132).setVisible(false);
    this.label = this.add
      .text(730, 243, '', {
        fontFamily: 'system-ui',
        fontSize: '16px',
        color: '#46564c',
        backgroundColor: '#ffffffcc',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);
    this.petLabel = this.add
      .text(300, 426, '모찌', {
        fontFamily: 'system-ui',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#456349',
      })
      .setOrigin(0.5);
    this.hpText = this.add
      .text(730, 282, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#4e6655' })
      .setOrigin(0.5);
    this.bars = this.add.graphics();
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.observer?.disconnect();
      useGame.setState({ readyScene: false });
    });
    useGame.setState({ readyScene: true });
  }
  private drawLandscape(zone: string) {
    const g = this.background;
    g.clear();
    const night = zone === 'moonhill',
      cave = zone === 'cave';
    g.fillStyle(night ? 0xdce3f5 : cave ? 0xe8e6f0 : 0xeaf3e7).fillRect(0, 0, W, H);
    g.fillStyle(night ? 0xf8f5db : 0xfff8d9, 0.9).fillCircle(770, 85, 39);
    g.fillStyle(0xffffff, 0.65);
    for (const [x, y] of [
      [140, 78],
      [450, 58],
      [840, 135],
    ]) {
      g.fillEllipse(x, y, 110, 25)
        .fillCircle(x - 24, y - 9, 22)
        .fillCircle(x + 8, y - 17, 28);
    }
    g.fillStyle(night ? 0xbac9dd : 0xccdfc3)
      .fillEllipse(140, 322, 650, 284)
      .fillEllipse(690, 306, 700, 260);
    g.fillStyle(night ? 0xb1c6cc : cave ? 0xc7d3c6 : 0xbcd5b1)
      .fillEllipse(320, 415, 830, 360)
      .fillEllipse(930, 393, 740, 350);
    g.fillStyle(night ? 0xc6d8cd : 0xd7e6bf).fillRect(0, 324, W, 206);
    // The winding walking path is part of the scene, never a React coordinate.
    g.fillStyle(0xf3ebd2).fillEllipse(440, 449, 1120, 148);
    g.fillStyle(0xf8f1dc, 0.8).fillEllipse(470, 439, 1060, 112);
    for (const [x, y, s] of [
      [55, 264, 1.0],
      [890, 250, 1.1],
      [110, 294, 0.55],
      [812, 291, 0.65],
    ]) {
      g.fillStyle(0x9cae87).fillRoundedRect(x - 6 * s, y - 30 * s, 12 * s, 80 * s, 5);
      g.fillStyle(night ? 0x9cb6ad : 0xa5c49a)
        .fillCircle(x, y - 49 * s, 43 * s)
        .fillCircle(x - 30 * s, y - 22 * s, 35 * s)
        .fillCircle(x + 29 * s, y - 18 * s, 38 * s);
      g.fillStyle(0xc2d5a6, 0.8).fillCircle(x - 9 * s, y - 57 * s, 27 * s);
    }
    g.fillStyle(0xaebc9c).fillEllipse(850, 386, 50, 21).fillEllipse(877, 391, 29, 14);
    for (let i = 0; i < 37; i++) {
      const x = (i * 173 + 47) % W,
        y = 350 + ((i * 43) % 170);
      if (y < 409 && x > 180 && x < 790) continue;
      g.lineStyle(2, 0x9bb788, 0.7)
        .lineBetween(x, y, x + 3, y - 8)
        .lineBetween(x + 3, y - 8, x + 7, y - 1);
      if (i % 3 === 0) {
        g.fillStyle(i % 2 ? 0xfff8e7 : 0xe5bdca).fillCircle(x + 3, y - 10, 4);
        g.fillStyle(0xe9c66c).fillCircle(x + 3, y - 10, 1.6);
      }
    }
    if (cave) {
      g.fillStyle(0x9eaca7).fillEllipse(880, 290, 190, 165);
      g.fillStyle(0x6e7c7d).fillEllipse(880, 308, 90, 100);
    }
    if (zone === 'forest') {
      g.fillStyle(0xa4bf98, 0.6).fillCircle(425, -18, 120).fillCircle(570, -25, 160);
    }
  }
  update(_time: number, delta: number) {
    if (!this.pet) return;
    const state = useGame.getState(),
      engine = state.engine;
    const dt = Math.min(delta / 1000, 0.1);
    this.age += dt;
    if (this.lastEngine !== engine) {
      this.lastEngine = engine;
      this.lastEvent = 0;
      this.prevEnemy = false;
    }
    if (this.currentZone !== engine.pet.zoneId) {
      this.currentZone = engine.pet.zoneId;
      this.drawLandscape(this.currentZone);
    }
    if (
      this.currentCharacter !== engine.pet.characterId &&
      this.loadingId !== engine.pet.characterId
    ) {
      const id = engine.pet.characterId;
      if (this.textures.exists(`${id}-idle-0`)) {
        this.currentCharacter = id;
        this.loadingId = '';
      } else {
        this.loadingId = id;
        this.loadCharacter(id);
        this.load.once('complete', () => {
          this.currentCharacter = id;
          this.loadingId = '';
        });
        this.load.start();
      }
    }
    const enemy = engine.enemy;
    if (enemy && !this.prevEnemy) {
      this.mob.setX(700 + Math.random() * 110);
    }
    this.prevEnemy = Boolean(enemy);
    const distance = Math.abs(this.pet.x - this.mob.x);
    const canRun = state.access === 'ready' && !document.hidden && !engine.paused;
    if (canRun) {
      if (engine.hunting && enemy) {
        this.target = this.mob.x - 100;
      } else if (
        engine.action === 'sleep' ||
        engine.action === 'eat' ||
        engine.action === 'play' ||
        engine.action === 'happy'
      ) {
        this.target = this.pet.x;
      } else {
        this.wander -= dt;
        if (this.wander <= 0) {
          this.wander = 3 + Math.random() * 4;
          this.target = 180 + Math.random() * 430;
        }
      }
      const dx = this.target - this.pet.x;
      const moving = Math.abs(dx) > 5;
      if (moving)
        this.pet.x += Math.sign(dx) * Math.min(Math.abs(dx), (engine.hunting ? 125 : 39) * dt);
      this.pet.setFlipX(this.pet.x < this.lastX);
      if (!moving) this.pet.setFlipX(false);
      this.lastX = this.pet.x;
      engine.step(dt, enemy !== null && distance <= 112);
      let animation =
        engine.action === 'attack'
          ? 'play'
          : engine.action === 'idle' && moving
            ? 'walk'
            : engine.action;
      if (!['idle', 'walk', 'play', 'eat', 'happy', 'sleep'].includes(animation))
        animation = 'idle';
      const frame = Math.floor(this.age * (moving ? 6 : 2)) % 2;
      const key = `${this.currentCharacter}-${animation}-${frame}`;
      if (this.textures.exists(key)) this.pet.setTexture(key);
      this.pet.y = 340 + (moving ? Math.sin(this.age * 11) * 3 : Math.sin(this.age * 2) * 1.5);
    }
    this.ground.x = this.pet.x;
    this.petLabel
      .setText(`${engine.pet.name}${engine.action === 'sleep' ? '  ᶻ ᶻ' : ''}`)
      .setX(this.pet.x);
    this.bars.clear();
    this.mob.setVisible(Boolean(engine.enemy));
    this.label.setVisible(Boolean(engine.enemy));
    this.hpText.setVisible(Boolean(engine.enemy));
    if (engine.enemy) {
      const m = engine.enemy;
      if (this.mobId !== m.id) {
        this.mobId = m.id;
        this.mob.setTexture(`mob-${m.id}`);
      }
      this.mob.y = 345 + Math.sin(this.age * 3) * 3;
      this.label.setText(monsterById(m.id).name).setX(this.mob.x);
      this.hpText.setText(`${m.hp} / ${m.maxHp}`).setX(this.mob.x);
      this.bars.fillStyle(0xffffff, 0.85).fillRoundedRect(this.mob.x - 52, 266, 104, 8, 4);
      this.bars
        .fillStyle(0xd8a38d)
        .fillRoundedRect(this.mob.x - 52, 266, Math.max(1, (104 * m.hp) / m.maxHp), 8, 4);
    }
    this.bars.fillStyle(0xffffff, 0.8).fillRoundedRect(this.pet.x - 39, 409, 78, 5, 2);
    this.bars
      .fillStyle(0x86ae88)
      .fillRoundedRect(
        this.pet.x - 39,
        409,
        Math.max(1, (78 * engine.pet.hp) / maxHp(engine.pet)),
        5,
        2,
      );
    for (const event of state.snapshot.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const x = event.target === 'monster' ? this.mob.x : this.pet.x;
      const color =
        event.kind === 'damage'
          ? '#a46f56'
          : event.kind === 'hurt'
            ? '#b75e6d'
            : event.kind === 'reward'
              ? '#8c7936'
              : '#58885c';
      const text =
        event.amount && ['damage', 'hurt'].includes(event.kind)
          ? `−${event.amount}`
          : event.message;
      if (['damage', 'hurt', 'reward', 'level', 'skill', 'care'].includes(event.kind)) {
        const float = this.add
          .text(x, 210 + Math.random() * 30, text, {
            fontFamily: 'system-ui',
            fontSize: event.kind === 'level' ? '24px' : '19px',
            fontStyle: 'bold',
            color,
            stroke: '#fffdf5',
            strokeThickness: 4,
          })
          .setOrigin(0.5);
        this.effects.push(float);
        if (this.effects.length > 16) this.effects.shift()?.destroy();
        this.tweens.add({
          targets: float,
          y: float.y - 58,
          alpha: 0,
          duration: 1500,
          onComplete: () => {
            float.destroy();
            this.effects = this.effects.filter((f) => f !== float);
          },
        });
        if (event.kind === 'damage') {
          this.mob.setTint(0xffbbbb);
          this.time.delayedCall(130, () => this.mob?.clearTint());
        }
        if (event.kind === 'hurt') {
          this.pet.setTint(0xffbcbc);
          this.time.delayedCall(130, () => this.pet?.clearTint());
        }
        if (event.kind === 'skill') {
          const ring = this.add
            .circle(this.pet.x, 343, 26, 0xf4da9b, 0.3)
            .setStrokeStyle(3, 0xf4da9b);
          this.tweens.add({
            targets: ring,
            scale: 2.5,
            alpha: 0,
            duration: 700,
            onComplete: () => ring.destroy(),
          });
        }
      }
    }
  }
}
export function makeGame(parent: HTMLDivElement) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: '#eaf3e7',
    scene: MeadowScene,
    render: { antialias: true, roundPixels: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 30, limit: 30 },
    audio: { noAudio: true },
    banner: false,
  });
}
