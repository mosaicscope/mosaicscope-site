import { HAIR_FAMILIES, HAIR_VARIANTS, hairVariant } from '../content/hair';
import type { Look, HairStyle, Character } from '../entities/types';
import { h } from './dom';
import { canvasStage } from './CanvasStage';
import { pose, solve, drawFigure } from '../render/StickFigure';
import type { ModalHost } from './Modals';

const CLASSIC: HairStyle[] = ['none','big','buzz','sidepart','spiky','curly','long','bob','bun','pony','braids','afro','mohawk','pigtails','topknot'];
export function hairControls(look: Look): HTMLElement {
  let family = hairVariant(look.hair)?.family ?? -1;
  const style = h('select', { 'aria-label':'Hair', onchange: (e: Event) => { look.hair = (e.target as HTMLSelectElement).value as HairStyle; } }) as HTMLSelectElement;
  const populate = () => {
    const options = family < 0 ? CLASSIC.map(id => ({ id, label:id[0].toUpperCase()+id.slice(1) })) : HAIR_VARIANTS.filter(h => h.family === family);
    if (!options.some(h => h.id === look.hair)) look.hair = options[0].id;
    style.replaceChildren(...options.map(v => h('option',{ value:v.id,selected:v.id===look.hair,text:v.label })));
  };
  const families = h('select', { 'aria-label':'Hair family', onchange:(e:Event) => { family=+(e.target as HTMLSelectElement).value; populate(); } },
    [h('option',{value:-1,selected:family<0,text:'Classic styles'}),...HAIR_FAMILIES.map((label,i)=>h('option',{value:i,selected:i===family,text:label}))]);
  populate();
  return h('div.hair-controls',null,[h('label',null,['Hair family',families]),h('label',null,['Hair',style]),h('small',{text:'500 new variants · 25 families · every style available to everyone'})]);
}
export function showHairStudio(modal: ModalHost, c: Character): void {
  const preview = canvasStage((g,t,reduced) => {
    g.fillStyle='#242824';g.fillRect(0,0,480,410);
    const k=2.4*c.look.scale;solve(pose('idle','normal',reduced?0:t,0,0,0),240,370,k,1);drawFigure(g,c,240,370,k,1,t,0,1);
  },{width:480,height:410,label:'Live city character hairstyle preview'});
  modal.show('Appearance · hair studio',[preview,hairControls(c.look),h('label',null,['Hair colour',h('input',{type:'color','aria-label':'Hair colour',value:c.look.hairColor??'#1a1410',oninput:(e:Event)=>{c.look.hairColor=(e.target as HTMLInputElement).value;}})]),
    h('p',{text:'Changes appear on your city character immediately and are kept in your game save. Headwear can cover hair.'})]);
}
