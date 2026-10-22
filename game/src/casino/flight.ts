import type {CasinoSocial} from '../sim/CityPlay';

export type CrashFlight=NonNullable<CasinoSocial['flight']>;
export function flightMultiplier(f:CrashFlight,now=Date.now()):number {
  return Math.exp(Math.max(0,((f.endedAt??now)-f.start)/1000)*.16);
}
/** One settlement path for the cash-out button, the live scene and resumed saves. */
export function finishFlight(f:CrashFlight,cashOut:boolean,now=Date.now()):number|null {
  if(f.paid)return null;
  const multiplier=flightMultiplier(f,now),won=cashOut&&multiplier<f.bust;
  if(!cashOut&&multiplier<f.bust)return null;
  f.paid=true;
  f.endedAt=won?Math.max(f.start,now):f.start+Math.log(f.bust)/.16*1000;
  f.returned=won?Math.floor(f.stake*multiplier):0;
  return f.returned;
}
