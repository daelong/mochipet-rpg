import type { Point } from './hunting';
export type TravelDestination = 'home' | 'yard';
export const DOORS = {
  house: {
    approach: { x: 473, y: 415 },
    threshold: { x: 473, y: 365 },
    arrival: { x: 1250, y: 1040 },
  },
  homeExit: {
    approach: { x: 1250, y: 1040 },
    threshold: { x: 1250, y: 1150 },
    arrival: { x: 473, y: 415 },
  },
  fieldExit: {
    approach: { x: 760, y: 1050 },
    threshold: { x: 760, y: 1140 },
    arrival: { x: 760, y: 1040 },
  },
} as const;
export interface DoorTravel {
  destination: TravelDestination;
  door: keyof typeof DOORS;
  stage: 'approach' | 'cross';
}
export interface DoorArrival {
  destination: TravelDestination;
  position: Point;
}
export function doorTravel(
  from: 'yard' | 'home' | 'adventure',
  destination: TravelDestination,
): DoorTravel | null {
  if (from === destination) return null;
  return {
    destination,
    door: destination === 'home' ? 'house' : from === 'home' ? 'homeExit' : 'fieldExit',
    stage: 'approach',
  };
}
export const travelPoint = (travel: DoorTravel): Point =>
  DOORS[travel.door][travel.stage === 'approach' ? 'approach' : 'threshold'];
