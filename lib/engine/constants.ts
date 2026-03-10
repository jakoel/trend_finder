// Fixed parameters — mirror Pine Script defaults exactly.
export const P = {
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  rsiLen: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  emaLen: 200,
  adxLen: 14,
  adxThreshold: 20,
  divLookback: 14,
  accelLookback: 8,
  volMALen: 20,
  volSurge: 1.5,
  atrLen: 10,
  atrMult: 3.0,
  minHistStrength: 0.0001,
  confirmBars: 2,
  cooldown: 5,
  rsiStrength: 10,   // RSI must be this far from 50
  macdCrossLB: 3,
  minScore: 4,
} as const;

// Signal colours — match Pine Script color constants.
export const C: Record<string, string> = {
  confirmedBuy: "#00E676",
  standardBuy: "#81C784",
  pullbackWarn: "#FFB74D",
  counterBull: "#4FC3F7",
  confirmedSell: "#F44336",
  standardSell: "#E57373",
  rallyWarn: "#FF8A65",
  counterBear: "#BA68C8",
  neutral: "#9E9E9E",
};
