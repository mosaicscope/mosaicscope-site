import type {Vehicle} from '../entities/types';
import {VEHICLES,type BaseVehicleClass} from '../content/vehicles';
import {fleetBody} from '../content/vehicleBodies';

/** Shape of each class, as fractions of the car's length (x, front = +0.5) and height. */
export interface Shape {
  cf: number; cr: number;           // plan-view chamfer at the nose / tail (fraction of width)
  hood: number; deck: number;       // body top height at the nose / tail
  cab: [number, number];            // glasshouse base: rear, front (x fraction)
  roof: [number, number];           // roof: rear, front
  cw: number; rw: number;           // glasshouse base / roof width (fraction of width)
  wheel: number;                    // wheel radius (fraction of height)
  boxy?: boolean;                   // vans: painted glasshouse with only front windows
  tray?: boolean; wing?: boolean; scoop?: boolean;
  rh?: number;                      // roof height as a fraction of the car's height (default 1)
  open?: boolean;                   // convertible: windscreen only, seats showing
  pill?: number;                    // extra pillars along each side window (default 1)
  wb?: number;                      // wheel position as a fraction of length (default 0.31)
  bed?: string;                     // colour of the tray floor
  box?: { a: number; b: number; h: number; col: string };  // cargo body behind the cab (fraction of length, fraction of height)
}
const SEDAN: Shape = { cf: 0.24, cr: 0.16, hood: 0.5, deck: 0.56, cab: [-0.27, 0.17], roof: [-0.15, -0.02], cw: 0.88, rw: 0.74, wheel: 0.27 };
const SHAPES: Record<BaseVehicleClass, Shape> = {
motorcycle:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
sportbike:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
cruiser:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
bicycle:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
ebike:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
escooter:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
kei_coupe:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
retro_micro:{...SEDAN,hood:.45,cab:[-.32,.2],roof:[-.22,.08],cw:.9,rw:.8},
euro_hatch:{...SEDAN,hood:.45,cab:[-.32,.2],roof:[-.22,.08],cw:.9,rw:.8},
fast_sedan:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
box_suv:{...SEDAN,boxy:true,cab:[-.4,.16],roof:[-.35,.07],rh:1.1},
offroad_wagon:{...SEDAN,boxy:true,cab:[-.4,.16],roof:[-.35,.07],rh:1.1},
rally_sedan:{...SEDAN,hood:.35,deck:.44,cab:[-.25,.12],roof:[-.13,.02],wing:true},
retro_ute:{...SEDAN,cab:[-.23,.24],roof:[-.15,.1]},
lift_suv:{...SEDAN,boxy:true,cab:[-.4,.16],roof:[-.35,.07],rh:1.1},
compact_ev:{...SEDAN,hood:.45,cab:[-.32,.2],roof:[-.22,.08],cw:.9,rw:.8},
estate_ev:{...SEDAN,hood:.45,cab:[-.32,.2],roof:[-.22,.08],cw:.9,rw:.8},
super_wedge:{...SEDAN,hood:.35,deck:.44,cab:[-.25,.12],roof:[-.13,.02],wing:true},
  tank:{...SEDAN,boxy:true},
  hatch: { cf: 0.28, cr: 0.12, hood: 0.5, deck: 0.6, cab: [-0.47, 0.19], roof: [-0.43, -0.03], cw: 0.88, rw: 0.76, wheel: 0.27 },
  sedan: SEDAN,
  taxi: SEDAN,
  police: { ...SEDAN, hood: 0.52, deck: 0.58 },
  suv: { cf: 0.2, cr: 0.12, hood: 0.56, deck: 0.62, cab: [-0.46, 0.2], roof: [-0.44, 0.0], cw: 0.9, rw: 0.82, wheel: 0.26 },
  ute: { cf: 0.18, cr: 0.06, hood: 0.56, deck: 0.58, cab: [-0.1, 0.19], roof: [-0.08, 0.04], cw: 0.9, rw: 0.82, wheel: 0.25, tray: true },
  van: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true },
  ambulance: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.18], cw: 0.98, rw: 0.96, wheel: 0.2, boxy: true },
  jdm: { cf: 0.26, cr: 0.16, hood: 0.5, deck: 0.58, cab: [-0.3, 0.15], roof: [-0.2, -0.03], cw: 0.86, rw: 0.72, wheel: 0.3, wing: true },
  muscle: { cf: 0.14, cr: 0.12, hood: 0.58, deck: 0.58, cab: [-0.34, 0.05], roof: [-0.24, -0.09], cw: 0.84, rw: 0.72, wheel: 0.31, scoop: true },
  sports: { cf: 0.34, cr: 0.26, hood: 0.42, deck: 0.6, cab: [-0.4, 0.12], roof: [-0.2, -0.03], cw: 0.82, rw: 0.66, wheel: 0.33 },
  super: { cf: 0.4, cr: 0.2, hood: 0.36, deck: 0.56, cab: [-0.3, 0.24], roof: [-0.12, 0.03], cw: 0.8, rw: 0.62, wheel: 0.36, wing: true },
  mini: { cf: 0.3, cr: 0.14, hood: 0.46, deck: 0.62, cab: [-0.44, 0.14], roof: [-0.4, -0.02], cw: 0.9, rw: 0.8, wheel: 0.3 },
  wagon: { cf: 0.22, cr: 0.1, hood: 0.5, deck: 0.62, cab: [-0.47, 0.18], roof: [-0.46, -0.02], cw: 0.88, rw: 0.78, wheel: 0.26 },
  hothatch: { cf: 0.28, cr: 0.12, hood: 0.46, deck: 0.58, cab: [-0.46, 0.19], roof: [-0.42, -0.03], cw: 0.88, rw: 0.76, wheel: 0.31, wing: true },
  coupe: { cf: 0.3, cr: 0.2, hood: 0.46, deck: 0.56, cab: [-0.32, 0.1], roof: [-0.2, -0.04], cw: 0.84, rw: 0.68, wheel: 0.29 },
  roadster: { cf: 0.3, cr: 0.2, hood: 0.44, deck: 0.5, cab: [-0.2, 0.1], roof: [-0.18, 0.06], cw: 0.86, rw: 0.8, wheel: 0.3, rh: 0.74, open: true },
  limo: { cf: 0.2, cr: 0.12, hood: 0.5, deck: 0.54, cab: [-0.4, 0.2], roof: [-0.32, 0.0], cw: 0.88, rw: 0.8, wheel: 0.22, pill: 3, wb: 0.34 },
  hearse: { cf: 0.2, cr: 0.06, hood: 0.5, deck: 0.66, cab: [-0.5, 0.18], roof: [-0.5, 0.0], cw: 0.88, rw: 0.84, wheel: 0.25, boxy: true },
  minivan: { cf: 0.22, cr: 0.08, hood: 0.5, deck: 0.7, cab: [-0.48, 0.22], roof: [-0.47, 0.0], cw: 0.9, rw: 0.84, wheel: 0.24, pill: 2 },
  camper: { cf: 0.2, cr: 0.06, hood: 0.46, deck: 0.6, cab: [-0.5, 0.26], roof: [-0.5, 0.12], cw: 0.96, rw: 0.92, wheel: 0.21, boxy: true, wb: 0.33 },
  dcute: { cf: 0.18, cr: 0.06, hood: 0.56, deck: 0.58, cab: [-0.22, 0.19], roof: [-0.2, 0.04], cw: 0.9, rw: 0.82, wheel: 0.26, tray: true, pill: 2 },
  flatdeck: { cf: 0.16, cr: 0.04, hood: 0.6, deck: 0.62, cab: [0.0, 0.2], roof: [0.02, 0.08], cw: 0.94, rw: 0.88, wheel: 0.22, tray: true, bed: "#8a6a3a", wb: 0.33 },
  tradie: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true, wb: 0.33 },
  icecream: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true, wb: 0.33 },
  post: { cf: 0.2, cr: 0.06, hood: 0.44, deck: 0.52, cab: [-0.5, 0.3], roof: [-0.5, 0.18], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true, wb: 0.33 },
  bus: { cf: 0.12, cr: 0.06, hood: 0.55, deck: 0.55, cab: [-0.5, 0.5], roof: [-0.5, 0.48], cw: 0.98, rw: 0.96, wheel: 0.17, pill: 6, wb: 0.32 },
  tow: { cf: 0.18, cr: 0.06, hood: 0.54, deck: 0.56, cab: [0.0, 0.2], roof: [0.0, 0.06], cw: 0.9, rw: 0.82, wheel: 0.24, tray: true, bed: "#3a3430", wb: 0.33 },
  fire: { cf: 0.14, cr: 0.04, hood: 0.55, deck: 0.6, cab: [0.1, 0.5], roof: [0.1, 0.46], cw: 0.96, rw: 0.94, wheel: 0.2, pill: 2, wb: 0.34, box: { a: -0.5, b: 0.08, h: 0.98, col: "#d4382a" } },
  bin: { cf: 0.14, cr: 0.04, hood: 0.55, deck: 0.6, cab: [0.12, 0.5], roof: [0.12, 0.46], cw: 0.96, rw: 0.94, wheel: 0.2, pill: 1, wb: 0.34, box: { a: -0.5, b: 0.1, h: 1.02, col: "#2d6b24" } },
  banger: SEDAN,
  retro: { cf: 0.36, cr: 0.34, hood: 0.4, deck: 0.5, cab: [-0.3, 0.22], roof: [-0.2, 0.05], cw: 0.9, rw: 0.72, wheel: 0.3 },
  lowrider: { ...SEDAN, hood: 0.44, deck: 0.48, wheel: 0.24 },
  fourby: { cf: 0.1, cr: 0.06, hood: 0.58, deck: 0.68, cab: [-0.48, 0.12], roof: [-0.47, 0.06], cw: 0.94, rw: 0.88, wheel: 0.3, pill: 2 },
  ev: { cf: 0.3, cr: 0.18, hood: 0.44, deck: 0.6, cab: [-0.44, 0.2], roof: [-0.4, 0.0], cw: 0.88, rw: 0.74, wheel: 0.27 },
  rally: { cf: 0.28, cr: 0.12, hood: 0.5, deck: 0.6, cab: [-0.46, 0.19], roof: [-0.42, -0.03], cw: 0.88, rw: 0.76, wheel: 0.31, wing: true, scoop: true },
  hotrod: { cf: 0.18, cr: 0.12, hood: 0.46, deck: 0.52, cab: [-0.22, 0.06], roof: [-0.14, -0.04], cw: 0.8, rw: 0.66, wheel: 0.33, scoop: true },
  compact_sedan:{...SEDAN,cab:[-0.440,0.140],roof:[-0.370,0.010],wb:0.290,cf:0.18},
  executive:{...SEDAN,cab:[-0.385,0.165],roof:[-0.315,0.035],wb:0.305,cf:0.23},
  liftback:{...{ cf: 0.28, cr: 0.12, hood: 0.5, deck: 0.6, cab: [-0.47, 0.19], roof: [-0.43, -0.03], cw: 0.88, rw: 0.76, wheel: 0.27 },cab:[-0.330,0.190],roof:[-0.260,0.060],wb:0.320,cf:0.28},
  fastback:{...{ cf: 0.3, cr: 0.2, hood: 0.46, deck: 0.56, cab: [-0.32, 0.1], roof: [-0.2, -0.04], cw: 0.84, rw: 0.68, wheel: 0.29 },cab:[-0.275,0.140],roof:[-0.205,0.010],wb:0.290,cf:0.33},
  shootingbrake:{...{ cf: 0.22, cr: 0.1, hood: 0.5, deck: 0.62, cab: [-0.47, 0.18], roof: [-0.46, -0.02], cw: 0.88, rw: 0.78, wheel: 0.26 },cab:[-0.440,0.165],roof:[-0.370,0.035],wb:0.305,cf:0.18},
  microvan:{...{ cf: 0.22, cr: 0.08, hood: 0.5, deck: 0.7, cab: [-0.48, 0.22], roof: [-0.47, 0.0], cw: 0.9, rw: 0.84, wheel: 0.24, pill: 2 },cab:[-0.385,0.190],roof:[-0.315,0.060],wb:0.320,cf:0.23},
  deliveryev:{...{ cf: 0.2, cr: 0.06, hood: 0.44, deck: 0.52, cab: [-0.5, 0.3], roof: [-0.5, 0.18], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true, wb: 0.33 },cab:[-0.330,0.140],roof:[-0.260,0.010],wb:0.290,cf:0.28},
  panelvan:{...{ cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true },cab:[-0.275,0.165],roof:[-0.205,0.035],wb:0.305,cf:0.33},
  stepvan:{...{ cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true },cab:[-0.440,0.190],roof:[-0.370,0.060],wb:0.320,cf:0.18},
  pickup_single:{...{ cf: 0.18, cr: 0.06, hood: 0.56, deck: 0.58, cab: [-0.1, 0.19], roof: [-0.08, 0.04], cw: 0.9, rw: 0.82, wheel: 0.25, tray: true },cab:[-0.385,0.140],roof:[-0.315,0.010],wb:0.290,cf:0.23},
  sportwagon:{...{ cf: 0.22, cr: 0.1, hood: 0.5, deck: 0.62, cab: [-0.47, 0.18], roof: [-0.46, -0.02], cw: 0.88, rw: 0.78, wheel: 0.26 },cab:[-0.330,0.165],roof:[-0.260,0.035],wb:0.305,cf:0.28},
  crossover:{...{ cf: 0.2, cr: 0.12, hood: 0.56, deck: 0.62, cab: [-0.46, 0.2], roof: [-0.44, 0.0], cw: 0.9, rw: 0.82, wheel: 0.26 },cab:[-0.275,0.190],roof:[-0.205,0.060],wb:0.320,cf:0.33},
  ranger:{...{ cf: 0.1, cr: 0.06, hood: 0.58, deck: 0.68, cab: [-0.48, 0.12], roof: [-0.47, 0.06], cw: 0.94, rw: 0.88, wheel: 0.3, pill: 2 },cab:[-0.440,0.140],roof:[-0.370,0.010],wb:0.290,cf:0.18},
  limousine:{...{ cf: 0.2, cr: 0.12, hood: 0.5, deck: 0.54, cab: [-0.4, 0.2], roof: [-0.32, 0.0], cw: 0.88, rw: 0.8, wheel: 0.22, pill: 3, wb: 0.34 },cab:[-0.385,0.165],roof:[-0.315,0.035],wb:0.305,cf:0.23},
  trackcoupe:{...{ cf: 0.34, cr: 0.26, hood: 0.42, deck: 0.6, cab: [-0.4, 0.12], roof: [-0.2, -0.03], cw: 0.82, rw: 0.66, wheel: 0.33 },cab:[-0.330,0.190],roof:[-0.260,0.060],wb:0.320,cf:0.28},
  grandtourer:{...{ cf: 0.3, cr: 0.2, hood: 0.46, deck: 0.56, cab: [-0.32, 0.1], roof: [-0.2, -0.04], cw: 0.84, rw: 0.68, wheel: 0.29 },cab:[-0.275,0.140],roof:[-0.205,0.010],wb:0.290,cf:0.33},
};

export function vehicleBodyShape(v:Vehicle):Shape{
 const mods=v.lifeMods??[],shapeClass=mods.includes('Hearse body')?'hearse':mods.includes('Limousine chassis')?'limo':v.cls,d=VEHICLES[v.cls],base=SHAPES[d.design?.base??shapeClass as BaseVehicleClass],authored=mods.includes('Hearse body')||mods.includes('Limousine chassis')?undefined:fleetBody(v.cls)?.shape;
 return d.design?{...base,...authored,wb:d.design.wb,wing:d.design.trim==='wing'||base.wing}:base;
}

/** Front bay remains positive even on forward-cab bodies. */
export function bonnetSection(shape:Shape,length:number):[number,number]{const front=length*.5;return[Math.min(Math.max(shape.cab[1]*length,length*.12),front-Math.max(.12,length*.28)),front-.04];}
