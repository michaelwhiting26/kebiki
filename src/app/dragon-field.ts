/**
 * The dragon's body this frame, as circles in viewport px, for anything else on the page that
 * should move out of its way (the dot map). Empty when there is no dragon about.
 */
export type FieldCircle = { x: number; y: number; r: number };

export const dragonField = {
  circles: [] as FieldCircle[],
  /** Called after the circles change. */
  listeners: new Set<() => void>(),
};
