export interface SeaState {x:number;y:number;heading:number;speed:number;rudder:number;travelled:number}
export interface Hull {length:number;speed:number;mass:number}
export const newSea=():SeaState=>({x:28,y:45,heading:0,speed:0,rudder:0,travelled:0});
/** Game hull model: bounded acceleration, quadratic water drag and speed-dependent rudder authority. */
export function stepSea(s:SeaState,h:Hull,throttle:number,steer:number,dt:number):void {
 dt=Math.max(0,Math.min(.05,dt));throttle=Math.max(-1,Math.min(1,throttle));steer=Math.max(-1,Math.min(1,steer));
 const top=h.speed*.35,mass=Math.max(1,h.mass),accel=3/Math.pow(mass,.18);
 s.rudder+=(steer-s.rudder)*Math.min(1,dt*4);
 s.speed+=throttle*accel*dt-s.speed*Math.abs(s.speed)*.12/Math.max(1,top)*dt;
 s.speed=Math.max(-top*.25,Math.min(top,s.speed));
 s.heading+=s.rudder*s.speed/Math.max(3,h.length*.32)*dt;
 const dx=Math.cos(s.heading)*s.speed*dt,dy=Math.sin(s.heading)*s.speed*dt;
 s.x=Math.max(15,Math.min(300,s.x+dx));s.y=Math.max(12,Math.min(180,s.y+dy));s.travelled+=Math.hypot(dx,dy);
 if(s.x===15||s.x===300||s.y===12||s.y===180)s.speed*=.7;
}
