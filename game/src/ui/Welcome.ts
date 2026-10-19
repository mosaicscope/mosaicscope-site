import {accessoryControls} from './Accessories';
import { h } from './dom';
import { canvasStage, roundBox, sceneText } from './CanvasStage';
import { pose, solve, drawFigure } from '../render/StickFigure';
import type { Character, Look, HairStyle, HatStyle } from '../entities/types';
import './welcome.css';

export interface WelcomeHost {
  player():Character;
  latest():{slot:string;savedAt:string;label:string}|null;
  continue(slot:string):string|null;
  create(name:string,look:Look):string|null;
}
const HAIR:HairStyle[]=['none','big','buzz','sidepart','spiky','curly','long','bob','bun','pony','braids','afro','mohawk','pigtails','topknot'];
const HATS:HatStyle[]=['none','bandana','cap','beanie','bucket','beret','headphones','cowboy','snapback','hood'];
const COLORS=['#eee4d3','#ec2a1c','#f6b62c','#6fe3b0','#3dd6ff','#b48cff','#ff7ad9','#657b92'];
export class Welcome {
  el=h('section.welcome.hidden',{role:'dialog','aria-modal':'true','aria-label':'Welcome to the Mosaics'});
  private draft:Character;
  private name='You';
  constructor(private host:WelcomeHost){this.draft=host.player();}
  show(){this.el.classList.remove('hidden');this.menu();}
  close(){this.el.classList.add('hidden');this.el.replaceChildren();}
  private menu(){
    const latest=this.host.latest(),error=h('p.welcome-error',{role:'alert'});
    this.el.replaceChildren(h('div.welcome-card',null,[
      h('small',{text:'ŌTAUTAHI / AFTER HOURS'}),h('h1',null,['The ',h('em',{text:'Mosaics'})]),
      h('p',{text:'A city full of characters. A story that belongs to you.'}),
      h('div.welcome-actions',null,[
        h('button.btn.acid',{text:'Continue',disabled:!latest,onclick:()=>{if(!latest)return;const message=this.host.continue(latest.slot);if(message)error.textContent=message;else this.close();}}),
        h('button.btn',{text:'Start new game',onclick:()=>this.creator()}),
      ]),h('p.welcome-save',{text:latest?`Last saved ${new Date(latest.savedAt).toLocaleString()} · ${latest.label}`:'Your story will save automatically in this browser.'}),
      h('p.welcome-save',{text:'A cookie remembers which save to continue. Full progress stays in this browser; manual slots are kept.'}),error,
    ]));
    (this.el.querySelector('button:not(:disabled)') as HTMLElement)?.focus();
  }
  private creator(){
    this.draft={...this.host.player(),look:structuredClone(this.host.player().look)};
    this.draft.look.accessories??=[];
    this.name='You';
    const preview=canvasStage((g,t,reduced)=>{
      const bg=g.createRadialGradient(250,180,20,240,250,340);bg.addColorStop(0,'#2a4844');bg.addColorStop(1,'#101f29');g.fillStyle=bg;g.fillRect(0,0,480,540);
      g.fillStyle='#0005';g.beginPath();g.ellipse(240,440,75,20,0,0,Math.PI*2);g.fill();
      const k=2.5*this.draft.look.scale;solve(pose('idle','normal',reduced?0:t,0,0,0),240,440,k,1);drawFigure(g,this.draft,240,440,k,1,reduced?0:t,0,1);
      sceneText(g,this.name||'You',240,490,21,'#eed8a4');roundBox(g,135,505,210,3,1,'#77998b');
    },{width:480,height:540,label:'Live character preview using the same model as the city'});
    const update=<K extends keyof Look>(key:K,value:Look[K])=>{this.draft.look[key]=value;};
    const select=(label:string,values:string[],value:string,change:(v:string)=>void)=>h('label',null,[label,h('select',{'aria-label':label,onchange:(e:Event)=>change((e.target as HTMLSelectElement).value)},values.map(v=>h('option',{value:v,selected:v===value,text:v[0].toUpperCase()+v.slice(1)})))]);
    const swatches=(label:string,key:'color'|'accent'|'skin'|'hairColor',colors=COLORS)=>h('fieldset.welcome-swatches',null,[h('legend',{text:label}),...colors.map(color=>h('button',{type:'button',style:`background:${color}`,title:color,'aria-label':`${label} ${color}`,'aria-pressed':String(this.draft.look[key]===color),onclick:(e:Event)=>{update(key,color);const button=e.currentTarget as HTMLElement;for(const sibling of button.parentElement!.querySelectorAll('button'))sibling.setAttribute('aria-pressed',String(sibling===button));}}))]);
    const error=h('p.welcome-error',{role:'alert'});
    const controls=h('div.welcome-custom',null,[
      h('small',{text:'MAKE YOURSELF AT HOME'}),h('h2',{text:'Your character'}),
      h('label',null,['Name',h('input',{value:this.name,maxlength:28,'aria-label':'Character name',oninput:(e:Event)=>{this.name=(e.target as HTMLInputElement).value;}})]),
      select('Body',['guy','girl'],this.draft.look.kind,v=>update('kind',v as Look['kind'])),
      select('Hair',HAIR,this.draft.look.hair,v=>update('hair',v as HairStyle)),
      select('Headwear',HATS,this.draft.look.hat,v=>update('hat',v as HatStyle)),
      select('Clothing',['tank','tee','long','hoodie','coat','vest','poncho','dress','suit','jersey','apron','hawaiian'],this.draft.look.top??'tee',v=>update('top',v as Look['top'])),
      select('Legwear',['shorts','jeans','ripped','trackies','skirt','kilt','slacks','boardies'],this.draft.look.bottom??'shorts',v=>update('bottom',v as Look['bottom'])),
      select('Footwear',['sneakers','boots','workboots','heels','jandals','sandals','bare'],this.draft.look.shoes??'sneakers',v=>update('shoes',v as Look['shoes'])),
      swatches('Outfit','color'),swatches('Accent','accent'),
      swatches('Skin','skin',['#f1c9a5','#d9a173','#c78d5f','#a06a43','#6e452b','#efe3d6']),
      swatches('Hair colour','hairColor',['#1a1410','#6b4a2a','#c9a56a','#8a8a8a','#e8554f','#b48cff']),
      select('Shirt pattern',['Plain','Stripes','Centre stripe','Logo','Two tone','Chevron','Pocket','Dots'],['Plain','Stripes','Centre stripe','Logo','Two tone','Chevron','Pocket','Dots'][this.draft.look.pattern??0],v=>update('pattern',['Plain','Stripes','Centre stripe','Logo','Two tone','Chevron','Pocket','Dots'].indexOf(v))),
      accessoryControls(this.draft),
      h('label',null,['Height',h('input',{type:'range',min:.85,max:1.15,step:.05,value:this.draft.look.scale,'aria-label':'Height',oninput:(e:Event)=>update('scale',+(e.target as HTMLInputElement).value)})]),
      h('label',null,['Build',h('input',{type:'range',min:.8,max:1.4,step:.1,value:this.draft.look.build??1,'aria-label':'Build',oninput:(e:Event)=>update('build',+(e.target as HTMLInputElement).value)})]),
      h('div.welcome-actions',null,[h('button.btn.acid',{text:'Start my story',onclick:()=>{const message=this.host.create(this.name.trim().slice(0,28)||'You',structuredClone(this.draft.look));if(message)error.textContent=message;else this.close();}}),h('button.btn',{text:'Back',onclick:()=>this.menu()})]),error,
    ]);
    this.el.replaceChildren(h('div.welcome-editor',null,[preview,controls]));
    (controls.querySelector('input') as HTMLElement)?.focus();
  }
}
