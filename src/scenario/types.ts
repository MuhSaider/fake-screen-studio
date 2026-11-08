export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Anchor =
  | 'body'
  | 'titlebar'
  | 'caption:minimize'
  | 'caption:maximize'
  | 'caption:close';

export interface TargetRef {
  window: string;
  anchor?: Anchor;
}

export interface WindowDef {
  id: string;
  template: string;
  title: string;
  rect: Rect;
  z?: number;
  hidden?: boolean;
  content?: { lines?: string[] };
}

export interface ActionDef {
  type: string;
  at: number;
  window?: string;
  text?: string;
  target?: TargetRef;
}

export interface ZoomShotDef {
  preset?: string;
  start: number;
  duration?: number;
  scale?: number;
  easing?: string;
  target?: TargetRef | null;
}

export interface Scenario {
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  windows: WindowDef[];
  actions: ActionDef[];
  zoomShots: ZoomShotDef[];
}
