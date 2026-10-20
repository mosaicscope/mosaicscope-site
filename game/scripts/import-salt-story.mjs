// Rebuild the runtime story from the original, user-provided Markdown kept alongside it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../src/content/salt-story/', import.meta.url));
const chapters = fs.readdirSync(root).filter(f => /^mosaicscope-story-part-.*\.md$/.test(f)).sort().map(file => {
  const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const scenes = [...text.matchAll(/^## Scene[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(match => ({
    title: match[0].split('\n')[0].replace(/^#+\s*/, ''),
    beats: match[1].split(/\n\s*\n/).map(p => p.trim()).filter(p => p && p !== '---').map(paragraph => {
      const speaker = paragraph.match(/^\*\*([^*]+?):\*\*\s*([\s\S]*)/);
      return speaker ? { speaker: speaker[1], text: speaker[2].trim() } : { speaker: 'Scene', text: paragraph.replace(/^\*+|\*+$/g, '').trim() };
    }),
  }));
  return { id: file.replace('mosaicscope-story-part-', '').replace(/\.md$/, ''), title: text.split('\n')[0].replace(/^#+\s*/, '').trim(), scenes };
});
if (chapters.length !== 11 || chapters.reduce((n, c) => n + c.scenes.length, 0) !== 62) throw Error('Story import incomplete');
fs.writeFileSync(path.join(root, 'chapters.json'), JSON.stringify(chapters, null, 2) + '\n');
console.log(`Imported ${chapters.length} chapters / 62 scenes / ${chapters.reduce((n,c)=>n+c.scenes.reduce((n,s)=>n+s.beats.length,0),0)} beats`);
