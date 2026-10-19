/** A round has betting, waiting, reveal and reaction phases; patrons remain at their station. */
export function casinoPose(role:'slots'|'dealer'|'table',time:number):string{
 const phase=((time%18)+18)%18;
 if(role==='dealer')return phase<4?'watch':phase<10?'deal':phase<14?'watch':'give';
 if(role==='slots')return phase<2?'bet':phase<12?'sit':phase<14?'watch':phase<15.5?'cheer':'sit';
 return phase<4?'bet':phase<10?'watch':phase<13?'read':phase<15?'cheer':'sit';
}
