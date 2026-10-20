import type {SkillGame} from '../content/worldFun';
export interface SkillRound{id:SkillGame;t:number;last:number;progress:number;attempts:number;score:number;done:boolean;claimed:boolean;value:number;downAt:number;grid:number[];x:number;y:number;vx:number;message:string}
export function newSkillRound(id:SkillGame):SkillRound{const s:SkillRound={id,t:0,last:0,progress:0,attempts:0,score:0,done:false,claimed:false,value:.5,downAt:-1,grid:Array(9).fill(0),x:0,y:0,vx:0,message:'Ready'};if(id==='repair'){for(const cell of[0,4,8])toggle(s.grid,cell);}return s;}
const toggle=(grid:number[],cell:number)=>{for(const n of[cell,cell%3?cell-1:-1,cell%3<2?cell+1:-1,cell-3,cell+3])if(n>=0&&n<9)grid[n]=1-grid[n];};
const win=(s:SkillRound,score:number,message:string)=>{s.score=Math.max(0,Math.min(100,Math.round(score)));s.done=true;s.message=message;};
export const keeperLane=(t:number)=>Math.min(2,Math.floor((Math.sin(t*.8)+1)*1.5));
export const fishingTarget=(t:number)=>.5+Math.sin(t*.9)*.28;
export const dartTarget=(t:number)=>({x:690+Math.sin(t*.7)*85,y:230+Math.cos(t*.9)*60});
export function advanceSkill(s:SkillRound,time:number):void{if(s.done)return;const dt=Math.max(0,Math.min(.05,time-s.last));s.last=time;s.t=time;
 if(s.id==='fishing'){s.progress=Math.max(0,s.progress+dt*(Math.abs(s.value-fishingTarget(time))<.14?1:-.5));if(s.progress>=3)win(s,100,'Catch landed.');}
 if(s.id==='garden'){for(let i=0;i<3;i++)if(s.grid[i]>1&&s.grid[i]<5)s.grid[i]=Math.min(5,s.grid[i]+dt);}
 if(s.id==='skate'){s.x+=dt*115;const obstacle=Math.floor(s.x/230);if(obstacle>s.attempts){s.attempts=obstacle;if(time-s.downAt>.75){win(s,Math.min(100,(obstacle-1)*33),'You clipped a cone. Try a better jump timing.');}else if(obstacle>=3)win(s,100,'Three clean jumps.');}}
 if(s.id==='shuffle'&&s.vx>0){s.x+=s.vx*dt;s.vx=Math.max(0,s.vx-150*dt);if(!s.vx)win(s,Math.max(0,100-Math.abs(s.x-615)*.7),'The puck has stopped.');}
 if(time>90&&!s.done)win(s,s.progress*20,'Practice round finished.');
}
export function skillInput(s:SkillRound,x:number,y:number,type='tap'):void{if(s.done)return;const f=Math.max(0,Math.min(1,x/960)),lane=Math.min(2,Math.floor(f*3));s.value=f;
 if(s.id==='fishing'){s.value=Math.max(0,Math.min(1,(x-160)/640));return;}
 if(s.id==='basketball'){const quality=Math.max(0,1-Math.abs(Math.sin(s.t*2.1))*1.4);s.attempts++;s.score+=quality*100;s.message=quality>.75?'Clean basket!':'Rim bounce. Watch the release mark.';if(s.attempts>=3)win(s,s.score/3,'Three-shot practice finished.');}
 else if(s.id==='penalty'){const saved=lane===keeperLane(s.t);s.attempts++;if(!saved)s.score+=100;s.message=saved?'Keeper saved it.':'Goal!';if(s.attempts>=3)win(s,s.score/3,'Shootout complete.');}
 else if(s.id==='darts'){const p=dartTarget(s.t),distance=Math.hypot(x-p.x,y-p.y);s.attempts++;s.score+=Math.max(0,100-distance);s.message=distance<20?'Bullseye!':'Dart landed.';if(s.attempts===3)win(s,s.score/3,'Three darts thrown.');}
 else if(s.id==='rhythm'){const beat=Math.round(s.t/.7),phase=Math.abs(s.t-beat*.7),expected=[0,2,1,0,2,1][s.attempts%6];if(lane===expected&&phase<.23){s.score+=100;s.message='On the beat.';}else s.message='Missed beat. Watch the line.';s.attempts++;if(s.attempts===6)win(s,s.score/6,'The busking set is complete.');}
 else if(s.id==='focus'){const target=.5+Math.sin(s.t*.5)*.25,quality=Math.max(0,100-Math.abs((x-80)/800-target)*300);s.attempts++;s.score+=quality;s.message=quality>80?'Sharp focus.':'Focus needs adjusting.';if(s.attempts===3)win(s,s.score/3,'Three frames captured.');}
 else if(s.id==='repair'){const col=Math.floor((x-300)/100),row=Math.floor((y-100)/90);if(col<0||col>2||row<0||row>2)return;toggle(s.grid,row*3+col);s.attempts++;if(s.grid.every(v=>v===0))win(s,Math.max(20,110-s.attempts*2),'Circuit restored.');}
 else if(s.id==='garden'){const i=Math.floor((x-160)/220);if(i<0||i>2)return;if(s.grid[i]===0){s.grid[i]=1;s.message='Seed planted.';}else if(s.grid[i]===1){s.grid[i]=2;s.message='Watered. Allow a few seconds to grow.';}else if(s.grid[i]>=5&&s.grid[i]<6){s.grid[i]=6;s.progress++;s.message='Harvest collected.';if(s.progress===3)win(s,100,'All three plants harvested.');}}
 else if(s.id==='delivery'){const nx=Math.floor((x-240)/75),ny=Math.floor((y-80)/75);if(nx<0||nx>5||ny<0||ny>3||Math.abs(nx-s.x)+Math.abs(ny-s.y)!==1||[[1,1],[2,1],[4,2]].some(([a,b])=>a===nx&&b===ny))return;s.x=nx;s.y=ny;s.attempts++;if(nx===5&&ny===3)win(s,Math.max(20,120-s.attempts*2),'Delivery arrived.');}
 else if(s.id==='skate'){s.downAt=s.t;s.message='Jump!';}
 else if(s.id==='rings'){if(type==='down'||type==='tap'&&s.downAt<0){s.downAt=s.t;s.message='Hold… release in the gold band.';}else if(s.downAt>=0){const power=Math.min(1,(s.t-s.downAt)/1.5);s.downAt=-1;s.attempts++;s.score+=Math.max(0,100-Math.abs(power-.65)*300);if(s.attempts===3)win(s,s.score/3,'Three rings tossed.');}}
 else if(s.id==='shuffle'&&!s.vx&&s.x===0){s.vx=f*650;s.message='Puck sliding…';}
}
