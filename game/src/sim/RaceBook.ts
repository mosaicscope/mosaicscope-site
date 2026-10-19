import type { ExpansionState } from "./Expansion";
export interface Runner { name:string; skill:number; fitness:number; owned:boolean; weight:number; winReturn:number }
export function raceRoster(horse:ExpansionState['horse'],sport='Horse'):Runner[]{
 const names=["Nor'wester","Rent Arrears","Pie Runner","Ilam Flash","Cone Ranger","Last Bus"];
 const runners=names.map((name,i)=>{const owned=i===0&&sport==='Horse'&&!!horse,skill=owned?horse!.skill:40+i*5,fitness=owned?horse!.fitness:82-i*3;return{name:owned?horse!.name:name,skill,fitness,owned,weight:Math.max(8,skill*.65+fitness*.35),winReturn:0};});
 const total=runners.reduce((s,r)=>s+r.weight,0);for(const r of runners)r.winReturn=Math.max(1.1,Math.round(.9*total/r.weight*100)/100);return runners;
}
/** Weighted finishing order: every runner can win, condition changes the chance. */
export function raceOrder(runners:readonly Runner[],random= Math.random):number[]{
 const remaining=runners.map((_,i)=>i),order:number[]=[];
 while(remaining.length){let draw=random()*remaining.reduce((s,i)=>s+runners[i].weight,0),at=0;while(at<remaining.length-1&&(draw-=runners[remaining[at]].weight)>=0)at++;order.push(remaining.splice(at,1)[0]);}return order;
}
export function raceReturn(runners:readonly Runner[],runner:number,bet:string){
 const first=runners[runner],total=runners.reduce((s,r)=>s+r.weight,0),next=runners[(runner+1)%runners.length];
 const probability=bet==='Exacta'?first.weight/total*next.weight/(total-first.weight):bet==='Place'?first.weight/total+runners.reduce((s,r,i)=>i===runner?s:s+r.weight/total*first.weight/(total-r.weight),0):first.weight/total;
 return Math.max(1.01,Math.floor(.9/probability*100)/100);
}
