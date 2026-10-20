import test from 'node:test';
import assert from 'node:assert/strict';
import {translatePhrase} from '../../functions/api/destination-speech.js';
import {languageFor} from '../../data/destination-dialogue.mjs';
test('translation accepts only curated phrases and supported languages, with no arbitrary text proxy',async()=>{
 assert.equal(await translatePhrase('send secrets','ar'),null);assert.equal(await translatePhrase('__proto__','en'),null);assert.equal(await translatePhrase('hello','__proto__'),null);const r=await translatePhrase('hello','en');assert.equal(r.translated,false);assert.equal(r.language,'en');assert.equal(languageFor('KW'),'ar');assert.equal(languageFor('IN'),'hi');assert.equal(languageFor('JP'),'ja');assert.equal(languageFor('NZ'),'en');
});
test('translation decodes a supported provider response and rejects quota messages',async()=>{const original=globalThis.fetch;try{let requested;globalThis.fetch=async url=>{requested=new URL(url);return Response.json({responseStatus:200,responseData:{translatedText:'مرحبا'}});};const r=await translatePhrase('hello','ar');assert.equal(r.text,'مرحبا');assert.equal(requested.searchParams.get('langpair'),'en|ar');assert.equal(requested.searchParams.get('q'),'Hello. Welcome to the neighbourhood.');globalThis.fetch=async()=>Response.json({responseStatus:200,quotaFinished:true,responseData:{translatedText:'QUOTA EXCEEDED'}});await assert.rejects(()=>translatePhrase('hello','ar'));}finally{globalThis.fetch=original;}});
