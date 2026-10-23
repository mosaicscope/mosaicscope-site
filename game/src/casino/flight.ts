import type {CasinoSocial} from '../sim/CityPlay';

export type CrashFlight=NonNullable<CasinoSocial['flight']>;
export interface FlightPreferences{autoCash:number;alert:number;day:'day'|'sunset'|'night';weather:'clear'|'rain'|'snow';camera:'journey'|'fixed';units:'kmh'|'knots';effects:boolean;hud:boolean;practice:boolean;favouriteModel:number;favouriteScene:number}
export interface FlightRecord{start:number;stake:number;returned:number;model:number;scene:number;multiplier:number;duration:number;outcome:'landed'|'crashed';practice:boolean}
export const FLIGHT_ROUTES=['City lights','Pacific coast','Southern Alps','Island chain','Desert crossing','Northern lights','Rainforest river','Harbour approach','Farmland express'] as const;
export function flightPreferences(raw?:Partial<FlightPreferences>):FlightPreferences{return{autoCash:Math.max(0,Math.min(1000,Number(raw?.autoCash)||0)),alert:Math.max(1.1,Math.min(1000,Number(raw?.alert)||2)),day:['day','sunset','night'].includes(raw?.day??'')?raw!.day!:'sunset',weather:['clear','rain','snow'].includes(raw?.weather??'')?raw!.weather!:'clear',camera:raw?.camera==='fixed'?'fixed':'journey',units:raw?.units==='knots'?'knots':'kmh',effects:raw?.effects!==false,hud:raw?.hud!==false,practice:raw?.practice===true,favouriteModel:Math.max(0,Math.min(59,Math.floor(raw?.favouriteModel??0)||0)),favouriteScene:Math.max(0,Math.min(8,Math.floor(raw?.favouriteScene??0)||0))};}
export const flightRate=(f:CrashFlight)=>f.rate??.16;
export function flightMultiplier(f:CrashFlight,now=Date.now()):number {
  return Math.exp(Math.max(0,((f.endedAt??now)-f.start)/1000)*flightRate(f));
}
/** One settlement path for the cash-out button, the live scene and resumed saves. */
export function finishFlight(f:CrashFlight,cashOut:boolean,now=Date.now()):number|null {
  if(f.paid)return null;
  const automatic=f.autoCash&&f.autoCash>1?f.start+Math.log(f.autoCash)/flightRate(f)*1000:Infinity;
  const settleAt=Math.max(f.start,Math.min(now,automatic)),multiplier=flightMultiplier(f,settleAt),won=(cashOut||now>=automatic)&&multiplier<f.bust;
  if(!cashOut&&now<automatic&&multiplier<f.bust)return null;
  f.paid=true;
  f.endedAt=won?settleAt:f.start+Math.log(f.bust)/flightRate(f)*1000;
  f.outcome=won?'landed':'crashed';f.cashMultiplier=won?multiplier:f.bust;
  f.returned=won?Math.floor(f.stake*multiplier):0;
  return f.returned;
}
export function recordFlight(f:CrashFlight):FlightRecord{return{start:f.start,stake:f.stake,returned:f.returned??0,model:f.model,scene:f.scene,multiplier:f.cashMultiplier??flightMultiplier(f),duration:Math.max(0,((f.endedAt??f.start)-f.start)/1000),outcome:f.outcome??(f.returned?'landed':'crashed'),practice:f.practice===true};}
/** Cosmetic instruments are deterministic and never influence the random end point. */
export function flightInstruments(seconds:number):{distance:number;altitude:number;speed:number;vertical:number;phase:string}{const speed=110+Math.min(680,seconds*19),distance=(110*seconds+9.5*Math.min(seconds,35)**2+665*Math.max(0,seconds-35))/3600,altitude=seconds<3?seconds*28:84+Math.min(10500,(seconds-3)*270);return{distance,altitude,speed,vertical:seconds<3?28:seconds<42?270:0,phase:seconds<3?'TAKEOFF':seconds<18?'CLIMB':seconds<42?'AIRWAY':'CRUISE'};}
