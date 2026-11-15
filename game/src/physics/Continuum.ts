/** SI kernels. These are reduced constitutive models, not a FEM/CFD or MF-Tyre 6.1 solver. */
export interface Soil {
  kc: number; kphi: number; n: number; cohesion: number; phi: number; K: number; density: number;
}
export const SAND: Soil = { kc: 1000, kphi: 800000, n: 1.1, cohesion: 500, phi: .52, K: .025, density: 1600 };
export const LOAM: Soil = { kc: 15000, kphi: 1200000, n: 1, cohesion: 3000, phi: .45, K: .018, density: 1700 };

/** Flat rectangular patch closure: p=Fz/(b*l), invert Bekker; use measured coefficients in SI. */
export function soilContact(soil: Soil, load: number, width: number, length: number, shear: number) {
  const b = Math.max(.01, width), l = Math.max(.01, length), pressure = Math.max(0, load) / (b * l);
  const stiffness = soil.kc / b + soil.kphi;
  const sinkage = Math.pow(pressure / stiffness, 1 / soil.n);
  const tau = (soil.cohesion + pressure * Math.tan(soil.phi)) * -Math.expm1(-Math.abs(shear) / soil.K);
  // Compaction work per unit distance: b integral_0^z p(s) ds [N].
  const compaction = b * stiffness * Math.pow(sinkage, soil.n + 1) / (soil.n + 1);
  // Passive earth pressure wedge approximation, not the full Wong sidewall solution.
  const kp = Math.tan(Math.PI / 4 + soil.phi / 2) ** 2;
  const bulldozing = b * (.5 * soil.density * 9.81 * sinkage ** 2 * kp + 2 * soil.cohesion * sinkage * Math.sqrt(kp));
  return { pressure, sinkage, shearForce: tau * b * l, compaction, bulldozing };
}

/** Generic four-coefficient pure-slip Magic Formula; coefficients require tire measurements. */
export function magicForce(slip: number, peak: number, B = 10, C = 1.3, E = .97): number {
  const bx = B * slip;
  return peak * Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
}

/** Dimensionless ellipse <=1. Fmax already contains mu*Fz; do not multiply the RHS by force again. */
export function frictionEllipse(fx: number, fy: number, maxX: number, maxY: number) {
  if (maxX <= 0 || maxY <= 0) return { fx: 0, fy: 0 };
  const scale = Math.max(1, Math.hypot(fx / maxX, fy / maxY));
  return { fx: fx / scale, fy: fy / scale };
}

/** Exact constant-input relaxation, stable in reverse. Zero speed freezes the carcass state. */
export function relaxForce(current: number, target: number, speed: number, sigma: number, dt: number): number {
  return current + (target - current) * -Math.expm1(-Math.abs(speed) * dt / Math.max(.001, sigma));
}

export function vonMises(xx: number, yy: number, zz: number, xy: number, yz: number, zx: number): number {
  return Math.sqrt(.5 * ((xx - yy) ** 2 + (yy - zz) ** 2 + (zz - xx) ** 2 + 6 * (xy ** 2 + yz ** 2 + zx ** 2)));
}

/** Normal effective mass includes the contact lever arms and world-space inverse inertia tensors. */
export function normalImpulse(closing: number, inverseEffectiveMass: number, restitution: number): number {
  return closing < 0 && inverseEffectiveMass > 0 ? -(1 + Math.max(0, Math.min(1, restitution))) * closing / inverseEffectiveMass : 0;
}

/** Energy removed by a scalar impulse, including rotational work via the effective mass. */
export function impulseLoss(closing: number, impulse: number, inverseEffectiveMass: number): number {
  return Math.max(0, -impulse * closing - .5 * impulse ** 2 * inverseEffectiveMass);
}
