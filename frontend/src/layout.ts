export interface NodePos { x: number; y: number; w: number; h: number }

export const LAYOUT: Record<string, NodePos> = {
  feedTank:    { x: 30,  y: 220, w: 80,  h: 130 },
  pump:        { x: 175, y: 295, w: 58,  h: 58  },
  filter:      { x: 300, y: 295, w: 58,  h: 58  },
  boiler:      { x: 430, y: 160, w: 110, h: 170 },
  reliefValve: { x: 488, y: 80,  w: 36,  h: 36  },
  steamValve:  { x: 610, y: 230, w: 52,  h: 52  },
  steamEngine: { x: 730, y: 200, w: 110, h: 80  },
  condenser:   { x: 660, y: 380, w: 80,  h: 70  },
  battery:     { x: 860, y: 270, w: 60,  h: 110 },
}

// SVG canvas
export const SVG_W = 1000
export const SVG_H = 520
