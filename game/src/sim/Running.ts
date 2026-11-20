/** Fixed-step movement tuning. Keep the avatar's saved base speed unchanged. */
export class Running {
 private charge=0;
 private speed=0;
 reset(){this.charge=0;this.speed=0;}
 step(base:number,sprint:boolean,energy:number,effort:number,dt:number){
  if(!Number.isFinite(base)||!Number.isFinite(dt)||!Number.isFinite(effort)||base<=0||dt<=0){this.reset();return{speed:0,energyCost:0,multiplier:1};}
  const elapsed=Math.min(dt,.1),input=Math.max(0,Math.min(1,effort)),running=sprint&&energy>.1&&input>.7;
  if(input===0){this.reset();return{speed:0,energyCost:0,multiplier:1};}
  this.charge=running?Math.min(1.4,this.charge+elapsed):0;
  const multiplier=running?1.75+.65*this.charge/1.4:1.25,target=base*input*multiplier;
  this.speed=target<this.speed?target:Math.min(target,this.speed+base*16*elapsed);
  return{speed:this.speed,energyCost:running?elapsed*(.008+.003*this.charge/1.4):0,multiplier};
 }
}
