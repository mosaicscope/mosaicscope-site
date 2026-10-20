import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import chapters from '../src/content/salt-story/chapters.json';
import { restoreSaltProgress } from '../src/content/salt-story/progress';
import { isSaltCast } from '../src/content/salt-story/cast';
import { small } from './helpers';
import { serialize, restore } from '../src/persistence/SaveSystem';
import { Camera } from '../src/render/Camera';

describe('authored SALT story', () => {
  it('preserves all 11 original chapters, 62 scenes and every spoken line in order', () => {
    const root = new URL('../src/content/salt-story/', import.meta.url);
    const sources = readdirSync(root).filter(f => f.endsWith('.md')).sort();
    expect(chapters).toHaveLength(11);
    expect(chapters.flatMap(c => c.scenes)).toHaveLength(62);
    for (const [index, file] of sources.entries()) {
      const source = readFileSync(new URL(file, root), 'utf8');
      const sceneText = [...source.matchAll(/^## Scene[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(m => m[1]).join('\n');
      const original = [...sceneText.matchAll(/^\*\*([^*]+?):\*\*\s*([^\n]+)/gm)].map(m => [m[1], m[2].trim()]);
      const imported = chapters[index].scenes.flatMap(s => s.beats).filter(b => b.speaker !== 'Scene').map(b => [b.speaker, b.text]);
      expect(imported).toEqual(original);
      expect(chapters[index].scenes.every(s => s.beats.length > 0)).toBe(true);
    }
  });
  it('restores progress with the world and tolerates old or malformed saves', () => {
    const sim = small(); sim.saltStory = { position: 36, furthest: 52 };
    const data = serialize(sim);
    expect(restore(data).saltStory).toEqual(sim.saltStory);
    delete data.saltStory;
    expect(restore(data).saltStory).toEqual({ position: 0, furthest: 0 });
    expect(restoreSaltProgress({ position: 900, furthest: 4 })).toEqual({ position: 4, furthest: 4 });
    expect(restoreSaltProgress({ position: -1, furthest: Infinity })).toEqual({ position: 0, furthest: 0 });
  });
  it('recognises authored cast while keeping generic strangers outside the plot', () => {
    expect(isSaltCast('Ruth Thompson')).toBe(true);
    expect(isSaltCast('Tiles')).toBe(true);
    expect(isSaltCast('Random Stranger')).toBe(false);
  });
});

it('aim projection round-trips an elevated point at every supported zoom', () => {
  const cam = new Camera(); cam.lookAt(27, 35, true);
  for (const zoom of [.55, 1.1, 2.4, 7]) {
    cam.zoom = zoom;
    const screen = cam.toScreen(29.2, 33.6, 1.05, { x: 0, y: 0 });
    const aim = cam.toWorldAtHeight(screen.x, screen.y, 1.05);
    expect(aim.x).toBeCloseTo(29.2, 10); expect(aim.y).toBeCloseTo(33.6, 10);
  }
});
