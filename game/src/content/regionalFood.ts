import {TOYS} from './toys';
const menus:Record<string,[string,string,string][]>={
 gulf:[['karak','karak tea','flat_white'],['machboos','machboos rice plate','fish_chips'],['shawarma','shawarma wrap','kebab'],['dates','dates & Arabic coffee','donut']],
 IN:[['chai','masala chai','flat_white'],['dosa','dosa & chutney','fish_chips'],['chaat','chaat plate','bao'],['thali','vegetarian thali','burger']],
 JP:[['onigiri','onigiri set','sushi'],['ramen','ramen bowl','fish_chips'],['matcha','matcha tea','flat_white'],['taiyaki','taiyaki','donut']],
 US:[['deli','deli sandwich','burger'],['filter_coffee','filter coffee','flat_white'],['pancakes','pancake stack','pie']],
 CA:[['poutine','poutine','fish_chips'],['coffee','coffee','flat_white'],['bagel','bagel sandwich','burger']],
 GB:[['tea','tea & a biscuit','flat_white'],['jacket','jacket potato','burger'],['sandwich','sandwich lunch','pie']],
 ID:[['nasi','nasi goreng','fish_chips'],['sate','sate plate','kebab'],['kopi','kopi','flat_white']],
 CK:[['ika','ika mata','sushi'],['fruit','tropical fruit plate','bao'],['coffee','island coffee','flat_white']],
};
for(const [region,items]of Object.entries(menus))for(const [id,name,base]of items){const key=`regional_${region}_${id}`;TOYS[key]={...TOYS[base],id:key,name,blurb:'Prepared by a local kitchen. Fictional game-currency prices.'};}
export function regionalFood(country:string,kind:string):string[]|null{if(!['cafe','diner','bakery','fishchips','pizza','sushi','dairy'].includes(kind))return null;const region=['KW','AE','QA','BH','OM','SA'].includes(country)?'gulf':country,items=menus[region];return items?items.map(([id])=>`regional_${region}_${id}`):null;}
