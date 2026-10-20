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
    modal.show('SALT stories · 11 chapters / 62 scenes', [
      h('div.salt-story', null, [h('p', { text: '11 chapters · 62 scenes. Continue in order or choose a chapter.' }),
        h('label', null, ['Chapter', chapterPicker]), h('label', null, ['Scene', scenePicker]),
        h('p.eyebrow', { text: scene.chapter }), h('h3', { text: scene.title }),
        ...(beat.speaker === 'Scene' ? [] : [h('details', null, [h('summary', { text: 'Scene setting' }), h('p.salt-location', { text: context })])]),
        h('p.salt-cast', { text: 'In this scene: ' + cast.join(' · ') }),
        h('article.salt-line', { 'aria-live': 'polite' }, [h('h4', { text: speaker === 'Scene' ? 'The scene' : beat.speaker }), h('p', { text: beat.text })]),
        h('p', { text: `Scene ${beat.sceneIndex + 1} of ${scenes.length} · line ${beat.index + 1} of ${scene.beats.length} · saved with your game` }),
        h('div.opts', null, buttons), transcript,
        h('p.dim', { text: 'Next line follows the authored sequence. Chapter and scene selectors let you read any part. Normal city conversations and activities remain available.' })])
    ], 'salt-dialogue');
    (modal.el.querySelector('.opts button:nth-child(2)') as HTMLButtonElement)?.focus({ preventScroll: true });
  };
  draw();
}
