import Phaser from 'phaser';
import { monsterById, petAsset, homeActivityById } from '@mochi/game-data';
import { maxHp, type GameEngine } from '@mochi/shared';
import { useGame } from '../state/game';
import { drawHomeInterior } from './HomeInterior';
import { activityShot } from './activityCamera';
import { MealAnimation } from './MealAnimation';
import { mealMotion } from './mealMotion';
import { CareAnimation } from './CareAnimation';
import { careMotion } from './careMotion';
import { PAN_THRESHOLD, panMap, isMapClick, type PanOrigin } from './mapPan';

const W = 1800,
  H = 1300;
export class MeadowScene extends Phaser.Scene {
  private pet!: Phaser.GameObjects.Image;
  private mob!: Phaser.GameObjects.Image;
  private bars!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private petLabel!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private background!: Phaser.GameObjects.Graphics;
  private scenery!: Phaser.GameObjects.Container;
  private ground!: Phaser.GameObjects.Ellipse;
  private mobGround!: Phaser.GameObjects.Ellipse;
  private destination!: Phaser.GameObjects.Arc;
  private cameraShotKey = '';
  private panGesture: (PanOrigin & { id: number; dragged: boolean }) | null = null;
  private mealAnimation!: MealAnimation;
  private careAnimation!: CareAnimation;
  private position = new Phaser.Math.Vector2(840, 690);
  private target = new Phaser.Math.Vector2(840, 690);
  private enemyPosition = new Phaser.Math.Vector2(1020, 660);
  private age = 0;
  private wander = 0;
  private manual = false;
  private lastEvent = 0;
  private currentCharacter = '';
  private currentZone = '';
  private currentPlace = '';
  private mobId = '';
  private prevEnemy = false;
  private lastEngine: GameEngine | null = null;
  private loadingId = '';
  private effects: Phaser.GameObjects.Text[] = [];
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
    this.background = this.add.graphics().setDepth(-100);
    this.scenery = this.add.container(0, 0).setDepth(-50);
    this.drawLandscape(useGame.getState().engine.pet.zoneId);
    this.ground = this.add.ellipse(840, 690, 72, 20, 0x233b2a, 0.2);
    this.mobGround = this.add.ellipse(1020, 660, 64, 18, 0x233b2a, 0.18).setVisible(false);
    this.destination = this.add.circle(0, 0, 15).setStrokeStyle(2, 0xfff1bd, 0.7).setVisible(false);
    this.pet = this.add
      .image(840, 650, `${useGame.getState().engine.pet.characterId}-idle-0`)
      .setDisplaySize(132, 132)
      .setInteractive({ useHandCursor: true });
    this.pet.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!isMapClick(this, pointer)) return;
      if (useGame.getState().access === 'ready') useGame.getState().engine.care('pet');
    });
    this.input.setDefaultCursor('grab');
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.event.target !== this.game.canvas || !pointer.leftButtonDown()) return;
      const camera = this.cameras.main;
      this.game.canvas.dataset.pointerDragged = 'false';
      this.panGesture = {
        id: pointer.id,
        x: pointer.x,
        y: pointer.y,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        dragged: false,
      };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const gesture = this.panGesture;
      if (!gesture || gesture.id !== pointer.id || !pointer.isDown) return;
      if (
        !gesture.dragged &&
        Math.hypot(pointer.x - gesture.x, pointer.y - gesture.y) < PAN_THRESHOLD
      )
        return;
      const camera = this.cameras.main;
      if (!gesture.dragged) {
        gesture.dragged = true;
        camera.stopFollow();
        camera.panEffect.reset();
        camera.zoomEffect.reset();
        gesture.scrollX = camera.scrollX;
        gesture.scrollY = camera.scrollY;
        this.cameraShotKey = 'free';
        useGame.setState({ cameraMode: 'free', activityCamera: false });
        this.game.canvas.dataset.pointerDragged = 'true';
        this.game.canvas.parentElement?.setAttribute('data-panning', 'true');
      }
      const bounds = this.mapBounds();
      const scroll = panMap(
        gesture,
        pointer,
        camera.zoom,
        { width: this.scale.width, height: this.scale.height },
        bounds,
      );
      camera.setScroll(scroll.scrollX, scroll.scrollY);
      this.publishCameraView();
    });
    this.input.on('pointerupoutside', () => this.endPan());
    this.input.on(
      'pointerup',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        // Phaser also receives window mouse events from the HTML overlay menus.
        const dragged = this.panGesture?.dragged;
        this.endPan();
        if (dragged || !isMapClick(this, pointer)) return;
        const { access, engine } = useGame.getState();
        if (
          access !== 'ready' ||
          !engine.pet.chosen ||
          engine.hunting ||
          engine.homeActivity ||
          over.length > 0
        )
          return;
        this.target.set(
          Phaser.Math.Clamp(pointer.worldX, 400, 1380),
          Phaser.Math.Clamp(pointer.worldY, engine.place === 'home' ? 430 : 390, 1040),
        );
        this.manual = true;
        this.destination.setPosition(this.target.x, this.target.y).setVisible(true);
      },
    );
    this.mob = this.add.image(1020, 620, 'mob-slime').setDisplaySize(110, 110).setVisible(false);
    const textStyle = {
      fontFamily: 'system-ui',
      color: '#fff6dd',
      stroke: '#324d36',
      strokeThickness: 4,
    };
    this.label = this.add
      .text(0, 0, '', { ...textStyle, fontSize: '14px' })
      .setOrigin(0.5)
      .setDepth(3000);
    this.petLabel = this.add
      .text(0, 0, '', { ...textStyle, fontSize: '15px', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(3000);
    this.hpText = this.add
      .text(0, 0, '', { ...textStyle, fontSize: '11px' })
      .setOrigin(0.5)
      .setDepth(3000);
    this.bars = this.add.graphics().setDepth(3000);
    this.mealAnimation = new MealAnimation(this);
    this.careAnimation = new CareAnimation(this);
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.ground, true, 0.04, 0.04);
    this.resize();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resize, this);
    });
    this.game.events.emit('mochi-scene-ready');
  }
  private endPan() {
    this.panGesture = null;
    this.game.canvas.parentElement?.removeAttribute('data-panning');
  }
  private publishCameraView() {
    const host = this.game.canvas.parentElement;
    host?.setAttribute('data-camera-x', this.cameras.main.scrollX.toFixed(2));
    host?.setAttribute('data-camera-y', this.cameras.main.scrollY.toFixed(2));
  }
  private mapBounds() {
    return useGame.getState().engine.place === 'home'
      ? { x: -600, y: -300, width: W + 1200, height: H + 600 }
      : { x: 0, y: 0, width: W, height: H };
  }
  private resize() {
    const camera = this.cameras.main;
    camera.panEffect.reset();
    camera.zoomEffect.reset();
    if (useGame.getState().cameraMode === 'free') {
      this.endPan();
      const bounds = this.mapBounds();
      camera.stopFollow().setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
      camera.setZoom(
        Math.max(camera.zoom, this.scale.width / bounds.width, this.scale.height / bounds.height),
      );
      this.cameraShotKey = 'free';
      return;
    }
    this.cameraShotKey = '';
    if (useGame.getState().engine.place === 'home' && this.scale.width >= 900) {
      camera.stopFollow();
      camera.setBounds(-600, -300, W + 1200, H + 600);
      camera.setZoom(Math.min(this.scale.width / 1500, this.scale.height / 1150));
      camera.centerOn(880, 620);
    } else {
      camera.setBounds(0, 0, W, H);
      camera.setZoom(
        Math.max(
          this.scale.width / W,
          this.scale.height / H,
          useGame.getState().engine.place === 'home' ? 0.7 : 0.8,
        ),
      );
      camera.startFollow(this.ground, true, 0.04, 0.04);
    }
  }
  private directActivityCamera(engine: GameEngine) {
    const camera = this.cameras.main;
    if (useGame.getState().cameraMode === 'free') {
      this.cameraShotKey = 'free';
      return;
    }
    const active =
      engine.place === 'home' && engine.homeActivity && useGame.getState().activityCamera;
    const key = active ? `${engine.homeActivity!.id}:${engine.homeActivity!.started}` : '';
    if (key === this.cameraShotKey) return;
    this.cameraShotKey = key;
    camera.panEffect.reset();
    camera.zoomEffect.reset();
    camera.stopFollow();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 700;
    if (active) {
      const activity = engine.homeActivity!;
      const shot = activityShot(
        this.scale.width,
        this.scale.height,
        homeActivityById(activity.id)!,
        activity.started,
      );
      camera.setBounds(-600, -300, W + 1200, H + 600);
      camera.zoomTo(shot.zoom, duration, 'Sine.easeInOut', true);
      if (activity.started) camera.pan(shot.x, shot.y, duration, 'Sine.easeInOut', true);
      else camera.startFollow(this.ground, true, 0.08, 0.08, 0, 45);
    } else if (engine.place === 'home') {
      const wide = this.scale.width >= 900;
      const zoom = wide
        ? Math.min(this.scale.width / 1500, this.scale.height / 1150)
        : Math.max(this.scale.width / W, this.scale.height / H, 0.7);
      camera.zoomTo(zoom, duration, 'Sine.easeInOut', true);
      camera.pan(
        wide ? 880 : this.position.x,
        wide ? 620 : this.position.y,
        duration,
        'Sine.easeInOut',
        true,
        (_camera, progress) => {
          if (progress === 1 && !this.cameraShotKey) this.resize();
        },
      );
    } else this.resize();
  }
  private drawLandscape(zone: string) {
    const g = this.background;
    g.clear();
    this.scenery.each((object: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(object));
    this.scenery.removeAll(true);
    const { engine } = useGame.getState();
    if (engine.place === 'home') {
      drawHomeInterior(
        this,
        g,
        this.scenery,
        engine.pet.roomCleanliness <= 30,
        (id) => {
          if (useGame.getState().access === 'ready')
            useGame.getState().engine.startHomeActivity(id);
        },
        () => {
          if (useGame.getState().access === 'ready') useGame.getState().engine.setPlace('yard');
        },
        engine.homeActivity?.started ? engine.homeActivity.id : null,
      );
      return;
    }
    const night = zone === 'moonhill',
      cave = zone === 'cave',
      forest = zone === 'forest';
    const grass = night ? 0x526e72 : cave ? 0x748372 : forest ? 0x6a9459 : 0x8cab69;
    g.fillStyle(grass).fillRect(0, 0, W, H);
    let seed = 711;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 140; i++) {
      g.fillStyle(i % 2 ? 0xd2e2a2 : 0x426e48, 0.07).fillEllipse(
        random() * W,
        random() * H,
        30 + random() * 200,
        20 + random() * 100,
      );
    }
    const river = new Phaser.Curves.Spline([
      1490, -100, 1390, 180, 1470, 440, 1510, 730, 1440, 990, 1570, 1400,
    ]).getPoints(100);
    g.lineStyle(167, night ? 0x637b7a : 0xb2bf88).strokePoints(river);
    g.lineStyle(139, night ? 0x5b8190 : 0x82b9b1).strokePoints(river);
    g.lineStyle(105, night ? 0x7094a1 : 0x9ccac0, 0.55).strokePoints(river);
    const path = new Phaser.Curves.Spline([
      -100, 790, 310, 780, 660, 650, 940, 700, 1220, 750, 1510, 715, 1900, 560,
    ]).getPoints(140);
    const branch = new Phaser.Curves.Spline([
      430, 320, 560, 470, 660, 650, 770, 930, 700, 1400,
    ]).getPoints(100);
    for (const points of [path, branch]) {
      g.lineStyle(127, night ? 0x969c87 : 0xb6b17e).strokePoints(points);
      g.lineStyle(112, night ? 0xb0b49a : 0xd9cb99).strokePoints(points);
      g.lineStyle(84, night ? 0xb6baa1 : 0xe4d8ac, 0.7).strokePoints(points);
    }
    // Planks across the stream and a small cottage give the map recognizable landmarks.
    g.fillStyle(0x536443, 0.25).fillRoundedRect(1395, 662, 209, 135, 12);
    for (let i = 0; i < 11; i++) {
      g.fillStyle(i % 2 ? 0xb99a68 : 0xc6aa78).fillRoundedRect(1390 + i * 19, 668, 17, 114, 3);
      g.lineStyle(1, 0x806b48, 0.35).lineBetween(1396 + i * 19, 680, 1396 + i * 19, 766);
    }
    for (const y of [665, 782]) {
      g.fillStyle(0x7b6749).fillRoundedRect(1382, y, 225, 8, 3);
      for (const x of [1380, 1493, 1600]) g.fillRoundedRect(x, y - 8, 9, 25, 3);
    }
    g.fillStyle(0x354b33, 0.2).fillEllipse(445, 389, 254, 70);
    g.fillStyle(0xded7ae).fillRoundedRect(345, 241, 190, 140, 8);
    g.fillStyle(0xb66f50).fillTriangle(320, 255, 440, 147, 560, 255);
    g.fillStyle(0xcd8660).fillTriangle(336, 246, 440, 164, 540, 246);
    g.fillStyle(0x7b8d83).fillRoundedRect(367, 278, 43, 42, 6);
    g.lineStyle(4, 0xf0e7c4)
      .strokeRect(367, 278, 43, 42)
      .lineBetween(388, 278, 388, 320)
      .lineBetween(367, 299, 410, 299);
    g.fillStyle(0x786344).fillRoundedRect(449, 289, 48, 92, 16);
    g.fillStyle(0xf0d99a).fillCircle(484, 340, 3);
    g.fillStyle(0xd7c498).fillRoundedRect(439, 377, 69, 15, 4);
    if (engine.place === 'yard') {
      const label = this.add
        .text(447, 433, '우리 집 · 들어가기', {
          fontFamily: 'system-ui',
          fontSize: '16px',
          color: '#fff4d5',
          backgroundColor: '#3c5844bb',
          padding: { x: 12, y: 7 },
        })
        .setOrigin(0.5);
      const door = this.add.zone(445, 335, 240, 200).setInteractive({ useHandCursor: true });
      door.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (isMapClick(this, pointer) && useGame.getState().access === 'ready')
          useGame.getState().engine.setPlace('home');
      });
      this.scenery.add([label, door]);
    }
    for (let i = 0; i < 650; i++) {
      const x = random() * W,
        y = random() * H;
      if ((x > 340 && x < 580 && y > 150 && y < 400) || x > 1330) continue;
      g.lineStyle(1.5, i % 3 ? 0x507c48 : 0xb8cf85, 0.48)
        .lineBetween(x, y, x - 3, y - 7)
        .lineBetween(x, y, x + 4, y - 5);
      if (i % 7 === 0) {
        g.fillStyle(i % 2 ? 0xf2e5bc : 0xdba9a0).fillCircle(x, y - 8, 3);
        g.fillStyle(0xe6c978).fillCircle(x, y - 8, 1.4);
      }
    }
    // Trees stay around the walking space so the pet remains legible at phone sizes.
    const trees: [number, number, number][] = [];
    for (let x = 60; x < W; x += 125) {
      trees.push([x + random() * 55, 110 + random() * 100, 0.85 + random() * 0.4]);
      trees.push([x + random() * 55, 1220 + random() * 100, 1 + random() * 0.35]);
    }
    for (let y = 270; y < 1150; y += 160) {
      trees.push([100 + random() * 140, y, 1 + random() * 0.4]);
      trees.push([1690 + random() * 90, y, 1 + random() * 0.4]);
    }
    trees.push(
      [290, 530, 1],
      [1190, 370, 1.15],
      [1240, 1080, 1.1],
      [390, 1060, 0.9],
      [1020, 270, 0.8],
    );
    if (forest) trees.push([280, 720, 1.3], [1290, 510, 1.1], [990, 1130, 1.2]);
    for (const [x, y, s] of trees.sort((a, b) => a[1] - b[1])) {
      g.fillStyle(0x304c31, 0.17).fillEllipse(x + 18, y + 10, 140 * s, 53 * s);
      g.fillStyle(0x786b48).fillRoundedRect(x - 12 * s, y - 65 * s, 24 * s, 85 * s, 7);
      g.fillStyle(night ? 0x416b61 : 0x527a46)
        .fillCircle(x, y - 114 * s, 62 * s)
        .fillCircle(x - 43 * s, y - 72 * s, 52 * s)
        .fillCircle(x + 43 * s, y - 68 * s, 53 * s);
      g.fillStyle(night ? 0x5f8976 : 0x739b53)
        .fillCircle(x - 15 * s, y - 126 * s, 48 * s)
        .fillCircle(x - 45 * s, y - 83 * s, 37 * s)
        .fillCircle(x + 27 * s, y - 99 * s, 42 * s);
      g.fillStyle(night ? 0x82a58c : 0x91b76c, 0.65).fillEllipse(
        x - 23 * s,
        y - 148 * s,
        48 * s,
        25 * s,
      );
    }
    for (const [x, y] of [
      [340, 900],
      [1130, 470],
      [1210, 920],
      [820, 360],
    ]) {
      g.fillStyle(0x40593b, 0.15).fillEllipse(x + 7, y + 9, 54, 22);
      g.fillStyle(cave ? 0x8c9591 : 0xa4ad8b).fillRoundedRect(x - 20, y - 17, 44, 31, 12);
      g.fillStyle(0xc9ceb0, 0.55).fillEllipse(x - 4, y - 12, 28, 10);
    }
    g.fillStyle(0x7d6c47).fillRoundedRect(1050, 782, 8, 59, 3);
    g.fillStyle(0xc0a472).fillRoundedRect(1025, 773, 67, 31, 5);
    g.lineStyle(2, 0x6c7049)
      .lineBetween(1040, 788, 1075, 788)
      .lineBetween(1068, 783, 1075, 788)
      .lineBetween(1068, 793, 1075, 788);
    if (cave) {
      g.fillStyle(0x8e9690).fillEllipse(1110, 300, 230, 180);
      g.fillStyle(0x485b57).fillEllipse(1110, 330, 106, 120);
      g.fillStyle(0xb2c0ac).fillTriangle(1015, 280, 1070, 200, 1090, 277);
    }
    for (let i = 0; i < 22; i++) {
      const x = 330 + random() * 980,
        y = 350 + random() * 720;
      const light = this.add.circle(x, y, night ? 2.5 : 2, night ? 0xf4e5a6 : 0xfff5d5, 0.5);
      this.scenery.add(light);
      this.tweens.add({
        targets: light,
        x: x + 15,
        y: y - 25,
        alpha: 0.1,
        duration: 2300 + random() * 3000,
        yoyo: true,
        repeat: -1,
        delay: random() * 2000,
      });
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
      this.position.set(840, 690);
      this.target.copy(this.position);
      this.manual = false;
    }
    if (this.currentPlace !== engine.place) {
      this.endPan();
      useGame.setState({ cameraMode: 'follow' });
      this.currentPlace = engine.place;
      this.position.set(engine.place === 'home' ? 900 : 840, engine.place === 'home' ? 960 : 690);
      this.target.copy(this.position);
      this.manual = false;
      this.wander = 4;
      this.resize();
      this.cameras.main.fadeIn(250, 42, 52, 35);
      this.currentZone = '';
    }
    const sceneKey = `${engine.place}:${engine.pet.zoneId}:${engine.place === 'home' && engine.pet.roomCleanliness <= 30}:${engine.homeActivity?.started ? engine.homeActivity.id : ''}`;
    if (this.currentZone !== sceneKey) {
      this.currentZone = sceneKey;
      this.drawLandscape(engine.place === 'yard' ? 'meadow' : engine.pet.zoneId);
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
      const direction = this.position.x > 1100 ? -1 : 1;
      this.enemyPosition.set(
        Phaser.Math.Clamp(this.position.x + direction * 160, 500, 1300),
        Phaser.Math.Clamp(this.position.y + Math.random() * 70 - 35, 440, 980),
      );
    }
    this.prevEnemy = Boolean(enemy);
    const canRun = state.access === 'ready' && !document.hidden && !engine.paused;
    let moving = false;
    if (canRun) {
      if (engine.homeActivity) {
        const activity = homeActivityById(engine.homeActivity.id)!;
        this.target.set(activity.x, activity.y);
        this.manual = false;
      } else if (engine.hunting && enemy) {
        const direction = this.position.x < this.enemyPosition.x ? -1 : 1;
        this.target.set(this.enemyPosition.x + direction * 88, this.enemyPosition.y);
        this.manual = false;
      } else if (['sleep', 'eat', 'play', 'happy'].includes(engine.action)) {
        this.target.copy(this.position);
        this.manual = false;
      } else if (!this.manual) {
        this.wander -= dt;
        if (this.wander <= 0) {
          this.wander = 4 + Math.random() * 4;
          this.target.set(
            700 + Math.random() * 400,
            (engine.place === 'home' ? 660 : 570) + Math.random() * 200,
          );
        }
      }
      const dx = this.target.x - this.position.x,
        dy = this.target.y - this.position.y;
      const distance = Math.hypot(dx, dy);
      moving = distance > 4;
      if (moving) {
        const step = Math.min(
          distance,
          (engine.homeActivity ? 240 : engine.hunting || this.manual ? 135 : 42) * dt,
        );
        this.position.x += (dx / distance) * step;
        this.position.y += (dy / distance) * step;
        if (Math.abs(dx) > 1) this.pet.setFlipX(dx < 0);
      } else if (this.manual) {
        this.manual = false;
        this.wander = 4;
      }
      if (engine.homeActivity && !moving) engine.arriveHomeActivity();
      engine.step(dt, enemy !== null && this.position.distance(this.enemyPosition) <= 104);
      let animation =
        engine.action === 'attack'
          ? 'play'
          : engine.action === 'idle' && moving
            ? 'walk'
            : engine.action;
      if (!['idle', 'walk', 'play', 'eat', 'happy', 'sleep'].includes(animation))
        animation = 'idle';
      const active = engine.homeActivity?.started ? engine.homeActivity : null;
      if (active) {
        animation =
          active.id === 'meal'
            ? 'idle'
            : careMotion(active.id, homeActivityById(active.id)!.seconds - active.remaining)
                .texture;
        this.pet.setFlipX(false);
      }
      const key = `${this.currentCharacter}-${animation}-${active ? 0 : Math.floor(this.age * (moving ? 6 : 2)) % 2}`;
      if (this.textures.exists(key)) this.pet.setTexture(key);
    }
    this.directActivityCamera(engine);
    this.publishCameraView();
    this.destination.setVisible(this.manual && moving);
    this.ground.setPosition(this.position.x, this.position.y + 3).setDepth(this.position.y - 1);
    const eating = engine.homeActivity?.id === 'meal' && engine.homeActivity.started;
    const mealElapsed = eating
      ? homeActivityById('meal')!.seconds - engine.homeActivity!.remaining
      : 0;
    const pose = mealMotion(mealElapsed);
    const active = engine.homeActivity?.started ? engine.homeActivity : null;
    const care =
      active && active.id !== 'meal'
        ? careMotion(active.id, homeActivityById(active.id)!.seconds - active.remaining)
        : null;
    this.pet
      .setDisplaySize(
        132 * (eating ? 1 + pose.chew * 0.025 : (care?.scale ?? 1)),
        132 * (eating ? 1 - pose.chew * 0.018 : (care?.scale ?? 1)),
      )
      .setAngle(eating ? pose.lean : (care?.angle ?? 0));
    this.pet
      .setPosition(
        this.position.x + (care?.x ?? 0),
        this.position.y -
          43 +
          (eating
            ? pose.lean * 0.7 + Math.sin(mealElapsed * 24) * pose.chew * 0.6
            : care
              ? care.y
              : Math.sin(this.age * (moving ? 11 : 2)) * (moving ? 2.5 : 1)),
      )
      .setDepth(this.position.y);
    this.petLabel
      .setText(`${engine.pet.name}${engine.action === 'sleep' ? '  ᶻ ᶻ' : ''}`)
      .setPosition(this.position.x, this.position.y + 27);
    this.ground.setVisible(!active);
    if (eating)
      this.mealAnimation.render(
        this.pet,
        engine.pet.characterId,
        this.position.x,
        this.position.y,
        mealElapsed,
      );
    else this.mealAnimation.hide();
    if (care)
      this.careAnimation.render(
        this.pet,
        engine.pet.characterId,
        this.position.x,
        this.position.y,
        care,
      );
    else this.careAnimation.hide();
    const focused =
      engine.place === 'home' && Boolean(engine.homeActivity) && useGame.getState().activityCamera;
    this.scenery.setVisible(!focused);
    this.petLabel.setVisible(!focused);
    this.bars.setVisible(!focused);
    this.bars.clear();
    this.mob.setVisible(Boolean(engine.enemy));
    this.mobGround.setVisible(Boolean(engine.enemy));
    this.label.setVisible(Boolean(engine.enemy));
    this.hpText.setVisible(Boolean(engine.enemy));
    if (engine.enemy) {
      const m = engine.enemy,
        x = this.enemyPosition.x,
        y = this.enemyPosition.y;
      if (this.mobId !== m.id) {
        this.mobId = m.id;
        this.mob.setTexture(`mob-${m.id}`);
      }
      this.mob.setPosition(x, y - 36 + Math.sin(this.age * 3) * 2).setDepth(y);
      this.mobGround.setPosition(x, y + 4).setDepth(y - 1);
      this.label.setText(monsterById(m.id).name).setPosition(x, y - 106);
      this.hpText.setText(`${m.hp} / ${m.maxHp}`).setPosition(x, y - 71);
      this.bars.fillStyle(0x243e30, 0.6).fillRoundedRect(x - 42, y - 90, 84, 6, 3);
      this.bars
        .fillStyle(0xe6a38c)
        .fillRoundedRect(x - 42, y - 90, Math.max(1, (84 * m.hp) / m.maxHp), 6, 3);
    }
    this.bars
      .fillStyle(0x243e30, 0.5)
      .fillRoundedRect(this.position.x - 32, this.position.y + 11, 64, 4, 2);
    this.bars
      .fillStyle(0xe0e8a9)
      .fillRoundedRect(
        this.position.x - 32,
        this.position.y + 11,
        Math.max(1, (64 * engine.pet.hp) / maxHp(engine.pet)),
        4,
        2,
      );
    for (const event of state.snapshot.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (!['damage', 'hurt', 'reward', 'level', 'skill', 'care'].includes(event.kind)) continue;
      const target = event.target === 'monster' ? this.enemyPosition : this.position;
      const color =
        event.kind === 'hurt' ? '#ffc3ad' : event.kind === 'damage' ? '#fff0d0' : '#f6e99b';
      const text =
        event.amount && ['damage', 'hurt'].includes(event.kind)
          ? `−${event.amount}`
          : event.message;
      const float = this.add
        .text(target.x, target.y - 130 - Math.random() * 20, text, {
          fontFamily: 'system-ui',
          fontSize: event.kind === 'level' ? '24px' : '18px',
          fontStyle: 'bold',
          color,
          stroke: '#3c5032',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(4000);
      this.effects.push(float);
      if (this.effects.length > 16) this.effects.shift()?.destroy();
      this.tweens.add({
        targets: float,
        y: float.y - 50,
        alpha: 0,
        duration: 1500,
        onComplete: () => {
          float.destroy();
          this.effects = this.effects.filter((f) => f !== float);
        },
      });
      if (event.kind === 'damage' || event.kind === 'hurt') {
        const image = event.kind === 'damage' ? this.mob : this.pet;
        image.setTint(0xffbbbb);
        this.time.delayedCall(130, () => image?.clearTint());
      }
      if (event.kind === 'skill') {
        const ring = this.add
          .circle(this.position.x, this.position.y - 30, 26, 0xf4da9b, 0.25)
          .setStrokeStyle(2, 0xf4da9b)
          .setDepth(2500);
        this.tweens.add({
          targets: ring,
          scale: 2.3,
          alpha: 0,
          duration: 700,
          onComplete: () => ring.destroy(),
        });
      }
    }
  }
}
export function makeGame(parent: HTMLDivElement, onReady: () => void) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: '#8cab69',
    scene: MeadowScene,
    render: { antialias: true, roundPixels: true },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 30, limit: 30 },
    audio: { noAudio: true },
    banner: false,
    callbacks: {
      preBoot: (game) => {
        game.events.once('mochi-scene-ready', onReady);
      },
    },
  });
}
