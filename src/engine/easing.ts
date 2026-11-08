export const EASINGS = ['linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic'] as const;
export type EasingName = (typeof EASINGS)[number];

export type EasingFn = (p: number) => number;

const fns: Record<EasingName, EasingFn> = {
  linear: (p) => p,
  easeInCubic: (p) => p * p * p,
  easeOutCubic: (p) => 1 - Math.pow(1 - p, 3),
  easeInOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
};

export function getEasing(name: string | undefined): EasingFn {
  return fns[(name as EasingName) ?? 'easeInOutCubic'] ?? fns.easeInOutCubic;
}
