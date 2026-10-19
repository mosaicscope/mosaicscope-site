import {drawReactionPortrait} from '../render/RefFigure';
import {sampleReactionFace,setReactionFace} from '../render/ReactionFaces';
import type {Character} from '../entities/types';
import {NEGATIVE_REACTIONS,sampleReactionClip} from '../render/NegativeReactions';
import {REACTION_FAMILIES} from '../render/ReactionScores';
import {solve,drawFigure} from '../render/StickFigure';
import {canvasStage,roundBox,sceneText} from './CanvasStage';
import {h} from './dom';

/** Browse the actual shipped motion scores with the player's unchanged Mosaics character model. */
export function reactionCatalogue(player:Character):HTMLElement{
 let page=0,playing=true,seek=.49,epoch=0,wasPlaying=true;
 const select=h('select',{'aria-label':'Reaction family'},[h('option',{value:'all',text:'All 500 animations'}),...REACTION_FAMILIES.map(f=>h('option',{value:f,text:f.replace(/-/g,' ')}))]) as HTMLSelectElement;
 const filter=h('input',{type:'search','aria-label':'Find reaction',placeholder:'Find an action, e.g. wrist or crouch'}) as HTMLInputElement;
 const stats=h('p.reaction-count',{'aria-live':'polite'}),list=h('ol.reaction-scores',{'aria-label':'Visible motion scores'});
 const prev=h('button.btn',{text:'Previous page',onclick:()=>{page--;refresh();}}) as HTMLButtonElement;
 const next=h('button.btn',{text:'Next page',onclick:()=>{page++;refresh();}}) as HTMLButtonElement;
 const play=h('button.btn',{text:'Pause animations','aria-pressed':'true',onclick:()=>{playing=!playing;play.textContent=playing?'Pause animations':'Play animations';play.setAttribute('aria-pressed',String(playing));}});
 const scrub=h('input',{type:'range',min:0,max:1,step:.01,value:seek,'aria-label':'Animation position',oninput:(e:Event)=>{seek=+(e.target as HTMLInputElement).value;playing=false;play.textContent='Play animations';play.setAttribute('aria-pressed','false');}});
 const cols=window.innerWidth<650?2:3,pageSize=6,W=960,H=cols===2?1080:720;
 let matching=NEGATIVE_REACTIONS,shown=matching.slice(0,pageSize);
 const model={...player,look:{...player.look},phys:0,wounds:[],hand:-1,emo:{...player.emo,fear:0,frustration:0,mood:0,composure:1},needs:{...player.needs,energy:1}};
 const refresh=()=>{const query=filter.value.toLowerCase();matching=NEGATIVE_REACTIONS.filter(c=>(select.value==='all'||c.family===select.value)&&(!query||(c.id+' '+c.label).toLowerCase().includes(query)));const pages=Math.max(1,Math.ceil(matching.length/pageSize));page=Math.max(0,Math.min(page,pages-1));shown=matching.slice(page*pageSize,(page+1)*pageSize);stats.textContent=`${matching.length} distinct clips · page ${page+1} / ${pages} · ${shown.map(c=>c.id).join(', ')}`;prev.disabled=page===0;next.disabled=page>=pages-1;list.replaceChildren(...shown.map(c=>h('li',{'data-clip':c.id},[h('b',{text:c.id}),h('span',{text:c.label})])));};
 select.addEventListener('change',()=>{page=0;refresh();});filter.addEventListener('input',()=>{page=0;refresh();});refresh();
 const stage=canvasStage((g,t,reduced)=>{
  if(playing&&!wasPlaying)epoch=t-seek*3.2;wasPlaying=playing;
  g.fillStyle='#171c19';g.fillRect(0,0,W,H);const progress=reduced?.49:playing?((t-epoch)%3.2)/3.2:seek;
  for(let i=0;i<shown.length;i++){const c=shown[i],x=i%cols*W/cols,y=Math.floor(i/cols)*H/(pageSize/cols),cw=W/cols,ch=H/(pageSize/cols);
   roundBox(g,x+7,y+7,cw-14,ch-14,8,'#272d26','#5c62514d');sceneText(g,c.id,x+18,y+32,16,'#d9c18f','left');
   setReactionFace(model,sampleReactionFace(c,progress*c.duration));
   const a=sampleReactionClip(c,progress*c.duration),k=cols===2?1.55:1.5;solve(a,x+cw/2,y+ch-60,k,1);drawFigure(g,model,x+cw/2,y+ch-60,k,1,0,0,1,true);
   g.save();g.fillStyle='#171d18';g.beginPath();g.arc(x+cw-59,y+84,45,0,7);g.fill();g.clip();drawReactionPortrait(g,model,x+cw-59,y+84,29);g.restore();
   const step=Math.min(2,Math.max(0,Math.floor(progress*3)));sceneText(g,c.label.split(' → ')[step],x+cw/2,y+ch-24,15,'#dedbd0');
  }
  if(!shown.length)sceneText(g,'No matching clips',W/2,H/2,22);
 },{width:W,height:H,label:'Actual reaction animation catalogue: 500 distinct motion sequences'});
 return h('section.reaction-catalogue',null,[h('p',{text:'500 distinct action sequences. Each follows three different gestures, then settles back to rest. These are the same motion tracks used in the city and interiors.'}),h('div.reaction-tools',null,[select,filter,play]),stats,stage,h('label.reaction-scrub',null,['Scrub motion ',scrub]),h('div.reaction-pages',null,[prev,next]),list]);
}
