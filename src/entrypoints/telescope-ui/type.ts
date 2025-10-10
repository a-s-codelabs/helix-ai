export const StateValues = ["empty", "filled", "search", "summary"] as const;
export const DirectionValues = ["up", "down"] as const;

export type State = (typeof StateValues)[number];
export type Direction = (typeof DirectionValues)[number];
