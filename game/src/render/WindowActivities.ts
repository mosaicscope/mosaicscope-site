/** Authored indoor animation tracks. Positions are relative to one pane of glass. */
type PoseName = keyof typeof POSES;
// Head height, left hand x/y, right hand x/y, left foot x/y, right foot x/y.
const POSES = {
  stand: [.7,-.17,.36,.17,.36,-.08,.03,.08,.03],
  step: [.72,-.23,.48,.22,.32,-.17,.03,.16,.08],
  back: [.69,-.22,.32,.23,.48,-.16,.08,.17,.03],
  reach: [.72,-.16,.4,.2,.85,-.08,.03,.1,.03],
  both: [.73,-.23,.89,.23,.89,-.12,.03,.12,.03],
  bend: [.44,-.19,.14,.23,.12,-.1,.03,.14,.03],
  low: [.49,-.23,.26,.24,.29,-.17,.03,.17,.03],
  sit: [.51,-.15,.28,.23,.29,-.2,.03,.22,.03],
  type: [.52,.06,.3,.27,.31,-.18,.03,.21,.03],
  phone: [.69,-.17,.35,.11,.66,-.08,.03,.08,.03],
  drink: [.69,-.17,.35,.13,.62,-.08,.03,.08,.03],
  pour: [.67,-.05,.36,.3,.51,-.08,.03,.08,.03],
  left: [.69,-.33,.55,.05,.43,-.1,.03,.1,.03],
  right: [.69,-.05,.43,.33,.55,-.1,.03,.1,.03],
  clap: [.72,.02,.6,.07,.6,-.09,.03,.09,.03],
  open: [.72,-.32,.62,.32,.62,-.13,.03,.13,.03],
  kick: [.73,-.22,.47,.2,.36,-.08,.03,.3,.27],
  balance: [.71,-.3,.6,.3,.6,-.06,.03,.19,.4],
  lunge: [.6,-.29,.5,.3,.51,-.28,.03,.28,.03],
  sleep: [.23,-.18,.15,.19,.14,-.27,.09,.28,.09],
  guitar: [.68,-.26,.43,.17,.35,-.12,.03,.12,.03],
  violin: [.69,-.28,.64,.2,.55,-.09,.03,.09,.03],
  read: [.53,-.13,.42,.19,.42,-.19,.03,.2,.03],
  carry: [.68,-.12,.4,.13,.4,-.15,.03,.15,.03],
} as const;

type Prop = 'none'|'desk'|'book'|'cup'|'plant'|'music'|'box'|'ball'|'pan'|'easel'|'weight';
interface Activity { name:string; seconds:number; poses:readonly PoseName[]; path:readonly number[]; prop:Prop }
const activity=(name:string,seconds:number,poses:PoseName[],path:number[],prop:Prop='none'):Activity=>({name,seconds,poses,path,prop});
// Each sequence has distinct gestures, a route, rests, and an object where appropriate.
export const WINDOW_ACTIVITIES:readonly Activity[] = [
  activity('Pacing on a call',19,['phone','step','phone','back'],[.23,.5,.76,.5]),
  activity('Crossing the room',14,['stand','step','back','stand'],[.18,.4,.7,.82]),
  activity('Looking out the window',23,['step','stand','left','stand','back'],[.22,.5,.5,.5,.22]),
  activity('Waving hello',12,['stand','reach','right','reach','stand'],[.5,.5,.5,.5,.5]),
  activity('Stretching after work',17,['sit','stand','both','left','right'],[.5,.5,.5,.5,.5],'desk'),
  activity('Typing a report',21,['type','type','read','reach','type'],[.43,.45,.43,.45,.43],'desk'),
  activity('Turning book pages',25,['sit','read','left','read'],[.5,.5,.49,.5],'book'),
  activity('Taking notes',18,['read','type','read','right'],[.46,.48,.46,.48],'desk'),
  activity('Making a presentation',20,['left','right','reach','open','stand'],[.25,.5,.7,.5,.25],'desk'),
  activity('Filing paperwork',22,['bend','carry','step','reach','stand'],[.22,.22,.55,.74,.74],'box'),
  activity('Watering a plant',16,['carry','pour','stand','pour'],[.25,.55,.55,.55],'plant'),
  activity('Pruning houseplants',24,['bend','left','right','reach'],[.56,.6,.6,.6],'plant'),
  activity('Opening the curtains',13,['step','both','open','stand'],[.25,.5,.5,.5]),
  activity('Wiping the glass',15,['reach','right','reach','left','bend'],[.42,.55,.62,.45,.45]),
  activity('Dusting shelves',26,['left','step','reach','right','bend'],[.22,.46,.7,.7,.7]),
  activity('Sweeping the floor',18,['bend','left','bend','right','step'],[.22,.33,.48,.65,.78]),
  activity('Mopping',27,['lunge','bend','right','bend','left'],[.28,.4,.56,.68,.5]),
  activity('Vacuuming the rug',23,['step','bend','back','bend'],[.24,.64,.36,.74]),
  activity('Folding laundry',20,['bend','carry','open','carry','bend'],[.48,.5,.5,.5,.48],'box'),
  activity('Hanging a shirt',17,['bend','carry','both','reach','stand'],[.32,.42,.6,.6,.6]),
  activity('Ironing clothes',19,['left','bend','right','bend'],[.47,.5,.53,.5],'desk'),
  activity('Stirring dinner',14,['stand','left','pour','right'],[.48,.48,.5,.5],'pan'),
  activity('Chopping vegetables',11,['bend','carry','bend','left','bend','right'],[.46,.46,.5,.5,.54,.54],'pan'),
  activity('Flipping a pancake',16,['carry','right','reach','carry'],[.48,.52,.52,.48],'pan'),
  activity('Setting the table',24,['bend','carry','step','pour','back'],[.2,.2,.65,.65,.2],'cup'),
  activity('Pouring coffee',18,['reach','carry','pour','stand'],[.32,.45,.57,.57],'cup'),
  activity('Sipping tea',28,['sit','drink','sit','read'],[.5,.5,.5,.5],'cup'),
  activity('Washing dishes',17,['bend','left','right','carry','bend'],[.48,.46,.53,.53,.48],'pan'),
  activity('Carrying groceries',22,['carry','step','carry','bend','stand'],[.18,.42,.73,.73,.73],'box'),
  activity('Unpacking a delivery',26,['bend','carry','right','bend','left'],[.5,.5,.7,.5,.3],'box'),
  activity('Slow dancing',21,['left','clap','right','open'],[.38,.47,.62,.53]),
  activity('Disco dancing',13,['reach','kick','both','lunge','right'],[.38,.5,.62,.5,.38]),
  activity('Practising ballet',20,['balance','both','balance','lunge','open'],[.4,.5,.6,.5,.4]),
  activity('Dancing with headphones',16,['phone','left','phone','right','kick'],[.43,.38,.5,.62,.55]),
  activity('Celebrating a goal',12,['sit','stand','both','clap','both'],[.5,.5,.48,.52,.5]),
  activity('Playing guitar',23,['guitar','right','guitar','left'],[.46,.48,.52,.5],'music'),
  activity('Playing violin',19,['violin','left','violin','right'],[.5,.48,.5,.52],'music'),
  activity('Playing keyboard',27,['sit','type','left','type','right'],[.42,.46,.53,.55,.48],'desk'),
  activity('Practising drums',15,['both','left','both','right','bend'],[.5,.47,.5,.53,.5],'music'),
  activity('Singing into a microphone',22,['phone','open','phone','reach'],[.4,.5,.6,.5],'music'),
  activity('Jumping jacks',10,['stand','both','lunge','both'],[.5,.5,.5,.5]),
  activity('Squats',14,['stand','low','lunge','low','stand'],[.5,.5,.5,.5,.5]),
  activity('Morning yoga',31,['both','balance','lunge','left','stand'],[.5,.5,.5,.5,.5]),
  activity('Lifting weights',18,['low','carry','clap','both','carry'],[.5,.5,.5,.5,.5],'weight'),
  activity('Boxing practice',11,['stand','left','stand','right','lunge'],[.35,.47,.53,.65,.5]),
  activity('Jogging in place',12,['step','back','step','kick'],[.48,.52,.48,.52]),
  activity('Balancing on one leg',29,['stand','balance','both','balance','stand'],[.47,.5,.53,.5,.47]),
  activity('Bouncing a ball',17,['stand','bend','right','stand','bend'],[.42,.48,.58,.58,.48],'ball'),
  activity('Practising a golf swing',21,['bend','left','both','right','stand'],[.5,.48,.52,.54,.5]),
  activity('Tying shoelaces',24,['sit','bend','low','bend','stand'],[.5,.48,.5,.52,.5]),
  activity('Painting a canvas',28,['left','reach','right','bend','reach'],[.36,.4,.45,.35,.4],'easel'),
  activity('Taking a photograph',20,['step','clap','reach','clap','back'],[.22,.46,.62,.62,.4]),
  activity('Knitting on the sofa',30,['sit','read','carry','read'],[.48,.49,.51,.5],'book'),
  activity('Building a model',32,['bend','type','carry','left','type'],[.44,.48,.5,.54,.48],'desk'),
  activity('Wrapping a present',25,['bend','open','carry','clap','bend'],[.5,.48,.5,.52,.5],'box'),
  activity('Feeding a pet',22,['carry','step','bend','low','stand'],[.2,.5,.7,.7,.7],'ball'),
  activity('Playing with a cat',19,['low','left','right','reach','low'],[.4,.45,.55,.6,.5],'ball'),
  activity('Rocking a baby',33,['carry','left','carry','right'],[.44,.48,.56,.52]),
  activity('Chatting over drinks',29,['drink','right','open','drink','left'],[.42,.46,.5,.54,.5],'cup'),
  activity('Settling down to sleep',37,['step','sit','read','sleep','sleep'],[.22,.5,.5,.5,.5],'book'),
];

const hash=(seed:number)=>{let n=Math.imul(seed^0x9e3779b9,0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return ((n^(n>>>16))>>>0)/4294967296;};
export function windowActivity(seed:number):Activity {return WINDOW_ACTIVITIES[Math.floor(hash(seed^0x51ed270b)*WINDOW_ACTIVITIES.length)];}

/** Continuous interpolation includes the last-to-first transition; no teleports at loop boundaries. */
export function activityPose(seed:number,time:number):{activity:Activity;u:number;pose:number[];phase:number}{
  const activity=windowActivity(seed),cycle=time*(.85+hash(seed+7)*.3)/activity.seconds+hash(seed+11),phase=((cycle%1)+1)%1;
  const frame=phase*activity.poses.length,i=Math.floor(frame),next=(i+1)%activity.poses.length,t=frame-i,s=t*t*(3-2*t);
  const a=POSES[activity.poses[i]],b=POSES[activity.poses[next]];
  return {activity,u:activity.path[i]+(activity.path[next]-activity.path[i])*s,pose:a.map((v,k)=>v+(b[k]-v)*s),phase};
}

export function paintActivity(g:CanvasRenderingContext2D,at:(u:number,v:number)=>[number,number],seed:number,time:number):void {
  const {activity,u,pose:p,phase}=activityPose(seed,time),head=p[0],hip=Math.max(.17,head-.42),shoulder=head-.17;
  g.strokeStyle='rgba(17,14,24,.92)';g.fillStyle='rgba(17,14,24,.92)';g.lineCap='round';
  const width=Math.hypot(...at(1,0).map((v,i)=>v-at(0,0)[i]) as [number,number]);
  g.lineWidth=Math.max(.65,width*.045);
  const line=(...points:[number,number][])=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(...at(...p)):g.moveTo(...at(...p)));g.stroke();};
  const h=at(u,head),r=Math.max(.7,width*.063);g.beginPath();g.ellipse(...h,r,r*1.15,0,0,Math.PI*2);g.fill();
  line([u,head-.1],[u,hip]);line([u,shoulder],[u+p[1],p[2]]);line([u,shoulder],[u+p[3],p[4]]);
  line([u,hip],[u+p[5],p[6]]);line([u,hip],[u+p[7],p[8]]);
  const box=(x:number,y:number,w:number,h:number)=>{g.beginPath();g.moveTo(...at(x,y));g.lineTo(...at(x+w,y));g.lineTo(...at(x+w,y+h));g.lineTo(...at(x,y+h));g.closePath();g.fill();};
  switch(activity.prop){
    case 'desk':line([.16,.22],[.9,.22]);line([.23,.22],[.23,0]);line([.83,.22],[.83,0]);g.fillStyle='#79a6b7';box(.66,.23,.16,.18);break;
    case 'book':g.fillStyle='#bcaa86';box(u-.12,.28,.24,.07);break;
    case 'cup':g.fillStyle='#d1c6a4';box(u+p[3]-.03,p[4],.07,.09);break;
    case 'plant':g.fillStyle='#637d52';box(.74,.05,.09,.27);line([.78,.2],[.66,.3]);line([.78,.26],[.88,.4]);break;
    case 'music':g.fillStyle='#a7875b';box(u-.16,.3,.26,.12);break;
    case 'box':g.fillStyle='#a88b67';box(.37,.03,.26,.17);break;
    case 'ball':{const b=at(.74,.08+Math.abs(Math.sin(phase*Math.PI*8))*.27);g.fillStyle='#b59161';g.beginPath();g.arc(...b,Math.max(.7,width*.06),0,Math.PI*2);g.fill();break;}
    case 'pan':line([.2,.19],[.86,.19]);g.fillStyle='#657a80';box(.51,.2,.25,.09);break;
    case 'easel':line([.66,0],[.78,.64],[.9,0]);g.fillStyle='#c6bba0';box(.65,.31,.25,.29);break;
    case 'weight':line([u+p[1],p[2]],[u+p[3],p[4]]);box(u+p[1]-.04,p[2]-.06,.07,.13);box(u+p[3]-.04,p[4]-.06,.07,.13);break;
  }
}
