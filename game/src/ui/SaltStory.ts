import {saltStage,storySetting} from './SaltStage';
import chapters from '../content/salt-story/chapters.json';
import type { Simulation } from '../sim/Simulation';
import type { ModalHost } from './Modals';
import { h } from './dom';

const scenes = chapters.flatMap((chapter, ci) => chapter.scenes.map((scene, si) => ({ ...scene, chapter: chapter.title, ci, si })));
const beats = scenes.flatMap((scene, sceneIndex) => scene.beats.map((beat, index) => ({ ...beat, sceneIndex, index })));
const sceneStarts = scenes.map((_, sceneIndex) => beats.findIndex(b => b.sceneIndex === sceneIndex));

/** The authored story is opt-in, chronological and saved with this world. Ambient dialogue stays intact. */
export function showSaltStory(modal: ModalHost, sim: Simulation, returnToTalk?: () => void, streetEncounters?: () => void): void {
  const progress = sim.saltStory;
  progress.furthest = Math.min(beats.length - 1, progress.furthest);
  progress.position = Math.min(progress.furthest, progress.position);
  const draw = () => {
    const beat = beats[progress.position], scene = scenes[beat.sceneIndex];
    const jump = (position: number) => { progress.position = position; progress.furthest = Math.max(progress.furthest, position); draw(); };
    const chapterPicker = h('select', { 'aria-label': 'Story chapter', onchange: (e: Event) => {
      const ci = +(e.target as HTMLSelectElement).value; jump(sceneStarts[scenes.findIndex(s => s.ci === ci)]);
    } }, chapters.map((c, ci) => h('option', { value: ci, selected: scene.ci === ci, text: `${c.title} · ${c.scenes.length} scenes` })));
    const scenePicker = h('select', { 'aria-label': 'Story scene', onchange: (e: Event) => jump(sceneStarts[+(e.target as HTMLSelectElement).value]) },
      scenes.flatMap((s, i) => s.ci === scene.ci ? [h('option', { value: i, selected: i === beat.sceneIndex, text: s.title })] : []));
    const speaker = beat.speaker.replace(/\s*\(.*/, '').trim();
    const context = scene.beats.find(b => b.speaker === 'Scene')?.text ?? '';
    const previous = h('button', { text: 'Previous line', disabled: progress.position === 0, onclick: () => { progress.position--; draw(); } });
    const next = h('button.btn', { text: progress.position === beats.length - 1 ? 'Story complete' : beat.index === scene.beats.length - 1 ? 'Next scene' : 'Next line', disabled: progress.position === beats.length - 1, onclick: () => {
      progress.position++; progress.furthest = Math.max(progress.furthest, progress.position); draw();
    } });
    const cast = [...new Set(scene.beats.filter(b => b.speaker !== 'Scene').map(b => b.speaker.replace(/\s*\(.*/, '').trim()))];
    const transcript = h('details.salt-transcript', null, [h('summary', { text: 'Read the full scene dialogue' }),
      ...scene.beats.map(b => h('p', null, [h('b', { text: b.speaker === 'Scene' ? 'Scene: ' : b.speaker + ': ' }), b.text]))]);
    const buttons = [previous, next];
    if (beat.sceneIndex < scenes.length - 1 && beat.index < scene.beats.length - 1) buttons.push(h('button', { text: 'Next scene', onclick: () => jump(sceneStarts[beat.sceneIndex + 1]) }));
    if (progress.position < progress.furthest) buttons.push(h('button', { text: 'Resume latest line', onclick: () => { progress.position = progress.furthest; draw(); } }));
    if (returnToTalk) buttons.push(h('button', { text: 'Back to conversation', onclick: () => { modal.close(); returnToTalk(); } }));
    if (streetEncounters) buttons.push(h('button', { text: 'Street encounters', onclick: streetEncounters }));
    const setting=storySetting(scene.title+' '+context),decisions=progress.decisions??={};
    const labels=setting==='medical'?['Stay and offer support · $5','Give them space','Help everyone stay calm']:setting==='party'?['Buy a round · $5','Leave the crowd alone','Check on a friend']:setting==='dairy'?['Buy something for the table · $5','Listen quietly','Reassure Ruth and Sal']:['Offer practical help · $5','Keep your distance','Calm things down'];
    const choose=(choice:number)=>{if(decisions[beat.sceneIndex]!==undefined)return;if(choice===0&&sim.player.cash<5)return;decisions[beat.sceneIndex]=choice;const p=sim.player;if(choice===0){p.cash-=5;p.reputation+=.5;p.emo.mood=Math.min(1,p.emo.mood+.12);}else if(choice===1){p.needs.energy=Math.min(1,p.needs.energy+.03);}else{p.emo.fear=Math.max(0,p.emo.fear-.15);p.needs.social=Math.min(1,p.needs.social+.05);}for(const name of cast){const c=sim.chars.find(c=>c.name.toLowerCase().includes(name.toLowerCase()));if(c&&choice!==1){const rel=sim.relate(c,p.id);rel.trust=Math.min(1,rel.trust+.06);}}draw();};
    const decision=decisions[beat.sceneIndex],choices=h('div.salt-choices',null,decision===undefined?labels.map((label,i)=>h('button.btn',{text:label,disabled:i===0&&sim.player.cash<5,onclick:()=>choose(i)})):[h('p',{role:'status',text:'Your choice: '+labels[decision]+'. Saved in this world.'})]);
    const library=h('details.salt-library',null,[h('summary',{text:'Chapter library · full authored dialogue'}),h('label',null,['Chapter',chapterPicker]),h('label',null,['Scene',scenePicker]),transcript]);
    modal.show('SALT · '+scene.chapter.replace(/^MosaicScope Story, /,''),[
      h('div.salt-layout',null,[saltStage(sim,scene.title,context,cast,speaker,beat.text),h('section.salt-decision',null,[
      h('article.salt-line',{'aria-live':'polite'},[h('h4',{text:speaker==='Scene'?'Around you':speaker}),h('p',{text:beat.text})]),
      h('div.opts',null,buttons),h('h4',{text:'Your part in this moment'}),choices,library])])
    ],'salt-dialogue');
    (modal.el.querySelector('.opts button:nth-child(2)') as HTMLButtonElement)?.focus({ preventScroll: true });
  };
  draw();
}
