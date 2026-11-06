import type Phaser from 'phaser';
import { locateMealFace, type FaceProfile } from './mealMotion';
const profiles = new WeakMap<Phaser.Textures.Texture, FaceProfile>();
export function petFigure(pet: Phaser.GameObjects.Image, character: string) {
  let face = profiles.get(pet.texture);
  if (!face) {
    const source = pet.texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);
    face = locateMealFace(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
      character,
    );
    profiles.set(pet.texture, face);
  }
  // This source frame lowers the glasses and muzzle as the cat curls up to sleep.
  const faceOffset = character === 'm_INTJ' && pet.texture.key.includes('-sleep-') ? 12 : 0;
  const point = (x: number, y: number) =>
    pet
      .getWorldTransformMatrix()
      .transformPoint(x - pet.displayOriginX, y - pet.displayOriginY + faceOffset);
  return {
    tint: face.tint,
    mouth: point(face.x, face.y),
    eyes: (face.eyes ?? []).map((eye) => point(eye.x, eye.y)),
    root: (side: number) => point(face.x + side * 24, face.y + 9),
  };
}
export type Point = { x: number; y: number };
export function paw(g: Phaser.GameObjects.Graphics, root: Point, hand: Point, tint: number) {
  g.lineStyle(8, 0x665b50).lineBetween(root.x, root.y, hand.x, hand.y);
  g.lineStyle(5.5, tint).lineBetween(root.x, root.y, hand.x, hand.y);
  g.fillStyle(tint).fillEllipse(hand.x, hand.y, 13, 10);
  g.lineStyle(1.4, 0x665b50).strokeEllipse(hand.x, hand.y, 13, 10);
}
