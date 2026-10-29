import type {Vehicle} from '../entities/types';
import {VEHICLES} from '../content/vehicles';
import {utilityDynamics} from './VehicleUtility';
import {vehicleGeometry} from './VehicleGeometry';
import {impactComponents} from './VehicleDamage';
import {facadeResponse,FACADE_RESPONSE,materialOf} from './FacadeImpact';
import type {CivicDamage} from './CivicDamage';

export interface DamageFootprint {id:number|string;points:readonly (readonly number[])[];height?:number;kind?:string;tags?:Record<string,string>}
export interface MappedFacadeContact {x:number;y:number;edge:number;u:number;nx:number;ny:number;speed:number;t?:number}
export interface MappedFacadeRecord extends CivicDamage {
  buildingId:number|string;edge:number;a:[number,number];b:[number,number];normal:[number,number];units:number;opening?:boolean;openingHeight?:number;openingContour?:number[][];
}
export interface MappedFacadeImpact extends MappedFacadeContact {building:DamageFootprint;damage?:MappedFacadeRecord}
const cross=(ax:number,ay:number,bx:number,by:number)=>ax*by-ay*bx;
function polygonArea(points:DamageFootprint['points']){let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=cross(a[0],a[1],b[0],b[1]);}return area;}
function intersect(ax:number,ay:number,dx:number,dy:number,a:readonly number[],b:readonly number[]):{t:number;u:number}|null{
  const ex=b[0]-a[0],ey=b[1]-a[1],den=cross(dx,dy,ex,ey);if(Math.abs(den)<1e-9)return null;
  const t=cross(a[0]-ax,a[1]-ay,ex,ey)/den,u=cross(a[0]-ax,a[1]-ay,dx,dy)/den;
  return t>=-1e-7&&t<=1+1e-7&&u>=-1e-7&&u<=1+1e-7?{t:Math.max(0,t),u:Math.max(0,Math.min(1,u))}:null;
}

/** Sweep all chassis corners plus edge centres. A vertex/box sweep also catches narrow posts
 * and small footprint corners between those probes. Polygons may have either winding. */
export function sweptMappedFacade(building:DamageFootprint,v:Vehicle,units=2):MappedFacadeContact|null{
  if(!Number.isFinite(units)||units<=0||building.points.length<3)return null;
  const geometry=vehicleGeometry(v),c=Math.cos(v.heading),s=Math.sin(v.heading),length=geometry.length*units/2,width=geometry.width*units/2;
  const ox=v.px*units,oy=v.py*units,dx=(v.x-v.px)*units,dy=(v.y-v.py)*units;
  if(Math.hypot(dx,dy)<1e-8)return null;
  const vx=v.vx??Math.cos(v.heading)*v.speed,vy=v.vy??Math.sin(v.heading)*v.speed;
  const radius=Math.hypot(length,width),xs=building.points.map(p=>p[0]),ys=building.points.map(p=>p[1]);
  if(Math.max(ox,ox+dx)+radius<Math.min(...xs)||Math.min(ox,ox+dx)-radius>Math.max(...xs)||Math.max(oy,oy+dy)+radius<Math.min(...ys)||Math.min(oy,oy+dy)-radius>Math.max(...ys))return null;
  const winding=polygonArea(building.points)>=0?1:-1;
  let best:MappedFacadeContact|null=null;
  const accept=(edge:number,u:number,t:number,nx:number,ny:number)=>{
    const speed=vx*nx+vy*ny;if(speed<0||dx*nx+dy*ny<=0||best&&t>=best.t!-1e-8)return;
    const a=building.points[edge],b=building.points[(edge+1)%building.points.length];
    best={edge,u,t,nx,ny,speed,x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u};
  };
  const probes=[[-length,-width],[-length,width],[length,-width],[length,width],[length,0],[-length,0],[0,width],[0,-width]];
  for(let edge=0;edge<building.points.length;edge++){
    const a=building.points[edge],b=building.points[(edge+1)%building.points.length],ex=b[0]-a[0],ey=b[1]-a[1],len=Math.hypot(ex,ey);if(len<1e-8)continue;
    let nx=-ey/len*winding,ny=ex/len*winding;
    // Use a contact normal along travel for both entries and exits.
    if(dx*nx+dy*ny<0){nx=-nx;ny=-ny;}
    for(const [fx,fy]of probes){const hit=intersect(ox+fx*c-fy*s,oy+fx*s+fy*c,dx,dy,a,b);if(hit)accept(edge,hit.u,hit.t,nx,ny);}
    // The building vertex entering the swept oriented chassis catches corner-only contacts.
    const rx=(a[0]-ox)*c+(a[1]-oy)*s,ry=-(a[0]-ox)*s+(a[1]-oy)*c,ddx=-(dx*c+dy*s),ddy=-(-dx*s+dy*c);
    let enter=0,leave=1,valid=true;
    for(const [p,d,half]of [[rx,ddx,length],[ry,ddy,width]]){
      if(Math.abs(d)<1e-9){if(Math.abs(p)>half)valid=false;continue;}
      const t0=(-half-p)/d,t1=(half-p)/d;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));
    }
    if(valid&&enter<=leave&&enter>=0&&enter<=1)accept(edge,0,enter,nx,ny);
  }
  return best;
}

/** City-owned, serializable facade damage, including bounded vehicle-sized openings. */
export class MappedFacadeDamage {
  private records=new Map<string,MappedFacadeRecord>();
  snapshot():MappedFacadeRecord[]{return structuredClone([...this.records.values()]);}
  restore(records:readonly MappedFacadeRecord[]):void{
    this.records.clear();for(const d of records.slice(-256)){
      if(!d||!d.key||!['glass','timber','brick','metal','concrete','stone'].includes(d.material??'')||!Number.isFinite(d.at)||!Number.isFinite(d.severity)||!Number.isFinite(d.repairBy)||!Array.isArray(d.a)||d.a.length!==2||!Array.isArray(d.b)||d.b.length!==2||!Array.isArray(d.normal)||d.normal.length!==2||![...d.a,...d.b,...d.normal,d.units].every(Number.isFinite)||d.units<=0)continue;
      const copy=structuredClone(d);copy.severity=Math.max(0,Math.min(1,copy.severity));this.records.set(copy.key,copy);
    }
  }
  /** Draw the returned references, never mutate them; snapshot is for save boundaries. */
  values():IterableIterator<MappedFacadeRecord>{return this.records.values();}
  hit(building:DamageFootprint,contact:MappedFacadeContact,v:Vehicle,seconds:number,units=2):MappedFacadeRecord|undefined{
    if(!Number.isFinite(seconds)||!Number.isFinite(contact.speed)||contact.speed<.8||!Number.isFinite(units)||units<=0)return;
    const a=building.points[contact.edge],b=building.points[(contact.edge+1)%building.points.length];if(!a||!b)return;
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-8)return;
    const along=Math.max(0,Math.min(1,contact.u))*len,key=`mapped:${building.id}:${contact.edge}:${Math.floor(along/(2*units))}`,old=this.records.get(key);
    // A sustained push is one collision; subsequent genuine impacts can extend the damage.
    if(old&&seconds-old.at<.75)return old;
    const material=materialOf(building.tags,building.kind,Math.max(1,(building.height??3.2)/3.2)),response=facadeResponse(material,contact.speed,utilityDynamics(v).mass,old?.severity);
    const g=vehicleGeometry(v),tx=(b[0]-a[0])/len,ty=(b[1]-a[1])/len,forwardX=Math.cos(v.heading),forwardY=Math.sin(v.heading);
    const projected=(Math.abs(tx*forwardX+ty*forwardY)*g.length+Math.abs(-tx*forwardY+ty*forwardX)*g.width)*units;
    const hitTime=contact.t??1,cx=(v.px+(v.x-v.px)*hitTime)*units,cy=(v.py+(v.y-v.py)*hitTime)*units,carCentre=(cx-a[0])*tx+(cy-a[1])*ty;
    const opening=response.energy>=FACADE_RESPONSE[material].resistance*.13&&contact.speed>=5.5&&carCentre>=projected*.55&&len-carCentre>=projected*.55;
    const centre=opening?carCentre:along,half=Math.max(units*1.05,projected*.58),start=Math.max(0,centre-half),end=Math.min(len,centre+half),point=(distance:number):[number,number]=>[a[0]+(b[0]-a[0])*distance/len,a[1]+(b[1]-a[1])*distance/len];
    const base=VEHICLES[v.cls].design?.base??v.cls,boxy=['van','panelvan','stepvan','microvan','suv','box_suv','lift_suv','bus','fire','ambulance','tank'].includes(base),sideOn=Math.abs(tx*forwardX+ty*forwardY)>.55;
    const roofInset=boxy?.06:sideOn?.18:.13,openingContour=[[.04,0],[.04,.65],[roofInset,.94],[.5,1],[1-roofInset,.94],[.96,.65],[.96,0]];
    const d:MappedFacadeRecord={key,kind:'building',buildingId:building.id,building:typeof building.id==='number'?building.id:undefined,edge:contact.edge,a:point(start),b:point(end),normal:[-ty*(polygonArea(building.points)>=0?1:-1),tx*(polygonArea(building.points)>=0?1:-1)],units,
      x:contact.x-contact.nx*units*.7,y:contact.y-contact.ny*units*.7,tx:Math.floor(contact.x),ty:Math.floor(contact.y),impactU:(along-start)/(end-start),severity:response.severity,material,energy:response.energy,variant:Math.abs(Math.floor(contact.x*17+contact.y*31))%12,
      opening:opening||old?.opening,openingHeight:opening?g.height/1.625:old?.openingHeight,openingContour:opening?openingContour:old?.openingContour,at:seconds,phase:'reported',repairProgress:0,repairBy:seconds+(opening?120:22)+FACADE_RESPONSE[material].repair*(.5+response.severity*.5)};
    this.records.set(key,d);if(this.records.size>256)this.records.delete(this.records.keys().next().value!);
    const targetMass=VEHICLES[v.cls].mass*(.25+FACADE_RESPONSE[material].hardness*1.75);
    impactComponents(v,contact.nx,contact.ny,contact.speed,targetMass,Math.round(seconds*60),{x:contact.x/units,y:contact.y/units});
    v.damage=Math.min(1,v.damage+response.carDamage);
    return d;
  }
  private openingFits(building:DamageFootprint,hit:MappedFacadeContact,v:Vehicle,units:number):boolean{
    const geom=vehicleGeometry(v),a=building.points[hit.edge],b=building.points[(hit.edge+1)%building.points.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)return false;
    const tx=dx/len,ty=dy/len,c=Math.cos(v.heading),s=Math.sin(v.heading),half=(Math.abs(tx*c+ty*s)*geom.length+Math.abs(-tx*s+ty*c)*geom.width)*units*.5;
    for(const d of this.records.values()){if(!d.opening||d.buildingId!==building.id||d.edge!==hit.edge)continue;const start=(d.a[0]-a[0])*tx+(d.a[1]-a[1])*ty,end=(d.b[0]-a[0])*tx+(d.b[1]-a[1])*ty,t=hit.t??1,cx=(v.px+(v.x-v.px)*t)*units,cy=(v.py+(v.y-v.py)*t)*units,centre=(cx-a[0])*tx+(cy-a[1])*ty;if(centre-half>=Math.min(start,end)-.04&&centre+half<=Math.max(start,end)+.04&&geom.height<=(d.openingHeight??0)*1.625+.04)return true;}return false;
  }
  contact(buildings:readonly DamageFootprint[],v:Vehicle,seconds:number,metresPerVehicleUnit=2):MappedFacadeImpact|null{
    if(v.burnt||v.state==='parked')return null;
    let closest:MappedFacadeImpact|null=null;
    for(const building of buildings){const hit=sweptMappedFacade(building,v,metresPerVehicleUnit);if(hit&&!this.openingFits(building,hit,v,metresPerVehicleUnit)&&(!closest||hit.t!<closest.t!))closest={...hit,building};}
    if(!closest)return null;
    closest.damage=this.hit(closest.building,closest,v,seconds,metresPerVehicleUnit);
    if(closest.damage?.opening&&this.openingFits(closest.building,closest,v,metresPerVehicleUnit)){
      const vx=v.vx??Math.cos(v.heading)*v.speed,vy=v.vy??Math.sin(v.heading)*v.speed,loss=Math.min(.7,.22+FACADE_RESPONSE[closest.damage.material??'concrete'].hardness*.32);
      v.vx=vx*(1-loss);v.vy=vy*(1-loss);v.speed=v.vx*Math.cos(v.heading)+v.vy*Math.sin(v.heading);v.slip=-v.vx*Math.sin(v.heading)+v.vy*Math.cos(v.heading);return closest;
    }
    const t=Math.max(0,(closest.t??0)-.002),nx=closest.nx,ny=closest.ny;
    v.x=v.px+(v.x-v.px)*t-nx*.012;v.y=v.py+(v.y-v.py)*t-ny*.012;
    const vx=v.vx??Math.cos(v.heading)*v.speed,vy=v.vy??Math.sin(v.heading)*v.speed,inward=Math.max(0,vx*nx+vy*ny);
    const hardness=FACADE_RESPONSE[closest.damage?.material??'concrete'].hardness;
    v.vx=vx-nx*inward*(1+.08+hardness*.1);v.vy=vy-ny*inward*(1+.08+hardness*.1);
    v.speed=v.vx*Math.cos(v.heading)+v.vy*Math.sin(v.heading);v.slip=-v.vx*Math.sin(v.heading)+v.vy*Math.cos(v.heading);
    v.yaw=(v.yaw??0)*.4;v.stuck=(v.stuck??0)+1/60;
    return closest;
  }
  update(seconds:number,vehicles:readonly Vehicle[]=[]):void{
    for(const [key,d]of this.records){
      if(seconds>=d.repairBy){
        // Do not rebuild a wall around a car occupying its opening.
        const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1],length2=dx*dx+dy*dy;
        const occupied=d.opening&&vehicles.some(v=>{const x=v.x*d.units,y=v.y*d.units,t=length2?Math.max(0,Math.min(1,((x-d.a[0])*dx+(y-d.a[1])*dy)/length2)):0;return Math.hypot(x-d.a[0]-t*dx,y-d.a[1]-t*dy)<vehicleGeometry(v).radius*d.units+.5;});
        if(occupied){d.repairBy=seconds+2;continue;}
        this.records.delete(key);continue;
      }
      const age=seconds-d.at;
      if(age>=(d.opening?120:22)){d.phase='working';d.workStarted=d.at+(d.opening?120:22);d.workUntil=d.repairBy;d.repairProgress=Math.max(0,Math.min(1,(seconds-d.workStarted)/(d.repairBy-d.workStarted)));}
      else if(age>=8)d.phase='travelling';
    }
  }
}
