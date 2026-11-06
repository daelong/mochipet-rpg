import Phaser from 'phaser';
import { mealMotion, locateMealFace, type FaceProfile } from './mealMotion';

export class MealAnimation {
  private table: Phaser.GameObjects.Graphics;
  private acting: Phaser.GameObjects.Graphics;
  private profiles = new Map<string, FaceProfile>();
  constructor(private scene: Phaser.Scene) {
    this.table = scene.add.graphics();
    this.acting = scene.add.graphics();
  }
  hide() {
    this.table.clear();
    this.acting.clear();
  }
  private face(pet: Phaser.GameObjects.Image, character: string) {
    const key = pet.texture.key;
    let profile = this.profiles.get(key);
    if (!profile) {
      const source = pet.texture.getSourceImage() as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(source, 0, 0);
      profile = locateMealFace(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
        character,
      );
      this.profiles.set(key, profile);
    }
    return profile;
  }
  render(pet: Phaser.GameObjects.Image, character: string, x: number, y: number, elapsed: number) {
    const pose = mealMotion(elapsed),
      face = this.face(pet, character);
    const point = (sx: number, sy: number) =>
      pet
        .getWorldTransformMatrix()
        .transformPoint(sx - pet.displayOriginX, sy - pet.displayOriginY);
    const mouth = point(face.x, face.y);
    const bowl = { x: x + (face.x - pet.displayOriginX) * pet.scaleX, y: y + 33 };
    const table = this.table.clear().setDepth(y + 2);
    const g = this.acting.clear().setDepth(y + 3);
    // A real foreground table covers the lower body: the pet is seated behind its meal.
    table.fillStyle(0x8c6848, 0.18).fillEllipse(x + 4, y + 80, 229, 59);
    table.fillStyle(0xa77b50).fillRoundedRect(x - 105, y + 22, 210, 64, 15);
    table.fillStyle(0xe9c995).fillRoundedRect(x - 111, y + 7, 222, 66, 18);
    table.lineStyle(2, 0xf8e5bd, 0.7).strokeRoundedRect(x - 105, y + 10, 210, 56, 14);
    table.fillStyle(0xe2dec1).fillRoundedRect(x + 51, y + 23, 35, 33, 6);
    table.fillStyle(0xf8f0d7).fillEllipse(x + 66, y + 39, 35, 21);
    table.fillStyle(0x91ae6b).fillEllipse(x + 67, y + 39, 19, 9);
    table.fillStyle(0xe3a16e).fillEllipse(x + 62, y + 37, 12, 5);
    table.fillStyle(0x8db8b6, 0.7).fillRoundedRect(x - 88, y + 20, 21, 28, 5);
    table.lineStyle(2, 0xe8f4e5, 0.8).strokeRoundedRect(x - 88, y + 20, 21, 28, 5);
    table.fillStyle(0x927454, 0.16).fillEllipse(bowl.x + 2, bowl.y + 14, 65, 18);
    table.fillStyle(0x688f83).fillEllipse(bowl.x, bowl.y + 7, 63, 32);
    table.fillStyle(0xf8f0d6).fillEllipse(bowl.x, bowl.y, 65, 29);
    table.fillStyle(0x54796b).fillEllipse(bowl.x, bowl.y + 1, 51, 19);
    const fill = pose.servings / 4;
    if (fill > 0) {
      table.fillStyle(0xfff9e3).fillEllipse(bowl.x, bowl.y - 2 - fill * 5, 43, 4 + fill * 19);
      for (let i = 0; i < pose.servings * 5; i++)
        table
          .fillStyle(i % 3 ? 0xf5e8c6 : 0xffffff)
          .fillEllipse(
            bowl.x - 17 + ((i * 13) % 34),
            bowl.y - 2 - fill * 9 + ((i * 7) % Math.max(3, fill * 9)),
            3,
            1.5,
          );
    }
    // A resting paw and a second paw holding the spoon, joined to the body.
    const root = point(face.x + 24, face.y + 10);
    const rest = { x: mouth.x - 28, y: y + 12 };
    g.lineStyle(2, 0x585044)
      .fillStyle(face.tint)
      .fillEllipse(rest.x, rest.y, 15, 10)
      .strokeEllipse(rest.x, rest.y, 15, 10);
    const spoon = {
      x: bowl.x + (mouth.x - bowl.x) * pose.lifted + Math.sin(pose.lifted * Math.PI) * 22,
      y: bowl.y - 3 + (mouth.y - bowl.y + 3) * pose.lifted,
    };
    const hand = { x: spoon.x + 20, y: spoon.y + 12 };
    g.lineStyle(9, 0x585044).lineBetween(root.x, root.y, hand.x, hand.y);
    g.lineStyle(6, face.tint).lineBetween(root.x, root.y, hand.x, hand.y);
    g.lineStyle(4, 0x9c734c).lineBetween(spoon.x + 2, spoon.y + 2, spoon.x + 28, spoon.y + 18);
    g.fillStyle(0xc9a071).fillEllipse(spoon.x, spoon.y, 15, 9);
    g.lineStyle(1, 0x8e6947).strokeEllipse(spoon.x, spoon.y, 15, 9);
    if (pose.loaded) g.fillStyle(0xfff9e6).fillEllipse(spoon.x, spoon.y - 2, 11, 6);
    g.fillStyle(face.tint).fillEllipse(hand.x, hand.y, 13, 10);
    g.lineStyle(1.5, 0x585044).strokeEllipse(hand.x, hand.y, 13, 10);
    // Replace the small static smile with an opening mouth, chewing jaw and puffed cheeks.
    const faceScale = pet.scaleX;
    g.fillStyle(face.tint).fillEllipse(mouth.x, mouth.y, 13 * faceScale, 10 * faceScale);
    if (pose.mouthOpen > 0.1) {
      g.fillStyle(0x754344).fillEllipse(mouth.x, mouth.y, 8, 2 + pose.mouthOpen * 6);
      g.fillStyle(0xe6a49e).fillEllipse(mouth.x, mouth.y + 2, 4, 2);
    } else {
      g.lineStyle(1.5, 0xb97573)
        .lineBetween(mouth.x - 3, mouth.y, mouth.x, mouth.y + 1.5)
        .lineBetween(mouth.x, mouth.y + 1.5, mouth.x + 3, mouth.y);
    }
    if (pose.chew > 0)
      for (const side of [-1, 1]) {
        g.fillStyle(face.tint).fillEllipse(mouth.x + side * 13, mouth.y + 1, 9 + pose.chew * 4, 8);
        g.fillStyle(0xedb0a8, 0.45).fillEllipse(mouth.x + side * 15, mouth.y, 5 + pose.chew * 2, 4);
      }
    if (pose.stage === 'bite' && pose.loaded)
      g.fillStyle(0xfff8db).fillEllipse(mouth.x, mouth.y, 4, 3);
  }
}
