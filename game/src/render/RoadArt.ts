/** Shared road paint and arrow geometry. Destinations use the same materials and markings as town. */
export const ROAD_PAINT={edge:'rgba(238,228,211,.35)',lane:'rgba(238,228,211,.5)',centre:'rgba(246,182,44,.7)',stop:'rgba(238,228,211,.75)',zebra:'rgba(238,228,211,.55)'};
export function paintRoadArrow(g:CanvasRenderingContext2D,P:(x:number,y:number)=>number[],x:number,y:number,dx:number,dy:number,size=1,zoom=1):void{
 const tip=[x+dx*.32*size,y+dy*.32*size],tail=[x-dx*.32*size,y-dy*.32*size],px=-dy*.14*size,py=dx*.14*size;
 const a=P(tail[0],tail[1]),b=P(tip[0],tip[1]),l=P(tip[0]-dx*.16*size+px,tip[1]-dy*.16*size+py),r=P(tip[0]-dx*.16*size-px,tip[1]-dy*.16*size-py);
 g.strokeStyle=ROAD_PAINT.lane;g.lineWidth=2*zoom;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.moveTo(l[0],l[1]);g.lineTo(b[0],b[1]);g.lineTo(r[0],r[1]);g.stroke();
}
