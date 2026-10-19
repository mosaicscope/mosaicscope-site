export interface LifeEvent {
  type: string;
  summary: string;
  cashDelta?: number;
  savingsDelta?: number;
  fineAmount?: number;
}

export interface LifeStep<S> {
  state: S;
  events: LifeEvent[];
}