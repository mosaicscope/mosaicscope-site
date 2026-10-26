import type {MappedBuilding} from '../ui/DestinationDistrict';
import {mappedBuildingStyle,regionalArchitecture} from './mappedBuildingStyle';
/** These three surveyed structures are documented Gothic Revival basalt/limestone Arts Centre buildings.
 * Reference: https://www.artscentre.org.nz/about-us/history (appearance, not photographic reconstruction). */
const HERITAGE=new Set([32050462,32050470,1349907117]);
export function mappedFacadeStyle(b:MappedBuilding){
 const base=regionalArchitecture(b.tags),style=mappedBuildingStyle(b),seed=Math.abs(Math.imul(b.id,2654435761))>>>0,heritage=HERITAGE.has(b.id)||/gothic/.test(base.architecture),industrial=/industrial|warehouse|shed|hangar|garage/.test(b.tags.building??''),glass=b.tags['building:material']==='glass',variant=seed%6;
 const materials=industrial?['metal','concrete','brick']:style.kind==='house'?['timber','brick','plaster']:['concrete','brick','glass','plaster','stone','concrete'];
 const material=b.tags['building:material']||(heritage?'stone':materials[variant%materials.length]);
 const palettes:Record<string,string[]>={timber:['#ddd9c8','#c3c9bc','#b9c8c6','#d0c2ad'],brick:['#a8735c','#815d50','#b0886f','#9c7359'],plaster:['#d3cebc','#dedbd0','#c8c9be','#c3b9ab'],concrete:['#aeb4b0','#c5c7bf','#8b999b','#b1aca0'],glass:['#69949f','#759ba4','#537c88','#8aa5a8'],stone:['#777b78','#8b8b80','#9b9687','#697775'],metal:['#9daaad','#afb7b1','#7c8c8b','#a9a18d']};
 const wall=b.tags['building:colour']?base.wall:heritage?'#747e7d':(palettes[material]??palettes.concrete)[seed%4],roof=b.tags['roof:colour']?base.roof:heritage?'#45565f':['#5f6b6c','#87776b','#50656a','#73817d','#6d6964','#72838a'][variant],shape=b.tags['roof:shape']||(heritage?'gabled':style.kind==='house'?'gabled':'flat');
 return{...base,wall,roof,material,shape,heritage,window:heritage?'arch':industrial?'industrial':glass||material==='glass'?'ribbon':style.kind==='house'?'domestic':variant%3===0?'ribbon':'bay',bayWidth:heritage?2.7:industrial?6:glass?4.5:2.8+(seed%4)*.45,trim:heritage?'#d4ccaf':material==='brick'?'#d0c4a7':'#bcc6c2',estimated:!HERITAGE.has(b.id)&&base.estimated};
}
