export const StateValues = ["ask", "search"] as const;
export const DirectionValues = ["up", "down"] as const;

export type State = (typeof StateValues)[number];
export type Direction = (typeof DirectionValues)[number];
