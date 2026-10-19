export interface ScreenRect { x:number; y:number; w:number; h:number }
export const overlaps=(a:ScreenRect,b:ScreenRect,gap=4)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
/** Deterministic screen-space reservations shared by labels, bubbles and markers. */
export class ScreenBounds {
  private rects:ScreenRect[]=[];
  constructor(readonly width:number,readonly height:number,readonly margin=6){}
  reserve(r:ScreenRect):boolean {
    if(r.x<this.margin||r.y<this.margin||r.x+r.w>this.width-this.margin||r.y+r.h>this.height-this.margin||this.rects.some(p=>overlaps(p,r)))return false;
    this.rects.push(r);return true;
  }
  place(x:number,y:number,w:number,h:number):ScreenRect|null {
    if(w>this.width-this.margin*2||h>this.height-this.margin*2)return null;
    const cx=Math.max(this.margin,Math.min(this.width-w-this.margin,x));
    for(const [dx,dy]of[[0,0],[0,-h-16],[-w-12,0],[w+12,0],[0,-2*h-28],[0,h+16]]){
      const r={x:Math.max(this.margin,Math.min(this.width-w-this.margin,cx+dx)),y:Math.max(this.margin,Math.min(this.height-h-this.margin,y+dy)),w,h};
      if(this.reserve(r))return r;
    }
    return null;
  }
}
let signs=new ScreenBounds(100000,100000,-100000);
const decisions=new Map<string,boolean>();
export function beginSignFrame(w:number,h:number){signs=new ScreenBounds(w,h,2);decisions.clear();}
export function reserveSign(key:string,r:ScreenRect):boolean {
  if(decisions.has(key))return decisions.get(key)!;
  const accepted=signs.reserve(r);decisions.set(key,accepted);return accepted;
}
