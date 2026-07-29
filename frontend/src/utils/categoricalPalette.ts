// Paleta categórica validada (colorblind-safe, orden fijo — ver skill de dataviz).
// El slot 1 coincide con --color-primary de la marca. No reordenar: el orden es
// justamente lo que garantiza la separación bajo daltonismo entre colores adyacentes.
export const CATEGORICAL_PALETTE = [
  '#2a78d6', // 1 azul
  '#eb6834', // 2 naranja
  '#1baf7a', // 3 aqua
  '#eda100', // 4 amarillo
  '#e87ba4', // 5 magenta
  '#008300', // 6 verde
  '#4a3aa7', // 7 violeta
  '#e34948', // 8 rojo
] as const;

export function colorForIndex(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}
