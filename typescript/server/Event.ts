export type EventError = { error: string };
export type EventMessage =  { message: string };
export type EventTurn = { turn: { player: string, said: string } };
export type EventEvt = { event: "start" | "turn" | "timedout" | "win" | "lose" };

export type SocEvent = 
 | EventError
 | EventMessage
 | EventTurn
 | EventEvt

export const createErrorEvent = (msg: string): EventError => ({ error: msg })
export const createMessageEvent = (msg: string): EventMessage => ({ message: msg })
export const createTurnEvent = (player: string, said: string): EventTurn => ({ turn: { player, said } })
export const createEvtEvent = (event: "start" | "turn" | "timedout" | "win" | "lose"): EventEvt => ({ event })