import {REACTION_KEYS,type ReactionKey} from './ReactionPoses';
/** Explicit motion scores: each entry changes the ordered actions and joint targets. No speed/amplitude variants. */
export const REACTION_SCORES={
 headache:[
 'tl br hb','tr fh ct','tt fc bo','fh nb hs','br tl rc',
 'nb tr bi','tl el hs','tr er hb','tt kn bo','fh rb se',
 'br hl mr','tl hr mb','tr hl slv','tt hb cp','nb fh ff',
 'el br rc','er tt se','fh tl nl','br tr nr','tt nb bw',
 'tl fh ws','tr br yh','nb hs ca','el er fc','tt rb kn',
 ],
 'arm-pain':[
 'al wl sl','ar wr sr','cl al bo','cr ar bi','wl at ah',
 'wr aw ct','sl ql al','sr qr ar','ql cl rc','qr cr se',
 'at wl mb','aw wr br','al cl nl','ar cr nr','ah at hs',
 'wl sl ol','wr sr or','ql at st','qr aw bl','cl wl fc',
 'cr wr rb','al rir hr','ar ril hl','at aw ah','sl sr bw',
 ],
 limp:[
 'kl ll hel','kr lr her','jl kl dlw','jr kr drw','ll bw kl',
 'lr bn kr','hel jl kn','her jr ff','nl kl rc','nr kr bi',
 'kl rl bw','kr rr bn','jl ll bo','jr lr st','ll hel nl',
 'lr her nr','dlw kl sh','drw kr fp','bw ll jr','bn lr jl',
 'kl jr cg','kr jl sq','hel her kn','nl nr bw','jl jr ff',
 ],
 winded:[
 'xl bi bo','xr bl ff','st ss kn','ril bl bi','rir xr bo',
 'bl kn rc','ss nl bi','ff nr bo','bi xl fs','bo xr ws',
 'kn st mb','xl ril bw','xr rir bn','st ff sh','bl bi cp',
 'ril rr kn','rir rl ff','ss cg bo','bi hb xl','bo ct xr',
 'fs kn bi','ws st se','xl xr ah','ff kn yh','bl bo rc',
 ],
 flinch:[
 'pl dl hl','pr dr hr','pb ds ct','dk el bw','dl pl rc',
 'dr pr bo','ds dk bi','po pb hl','ol pl hr','or pr hs',
 'pl dk cg','pr ds sq','pb fc bn','dk he sh','dl tt le',
 'dr nb ca','ds po kn','ol dl se','or dr nt','pl pr ah',
 'pb dk wrg','dk pl nl','dl pr nr','po hs rc','ds cg cp',
 ],
 tremble:[
 'te wrg ah','wrg sp bn','ah te ct','sp cp bo','bn nt se',
 'te cl al','wrg cr ar','ah bl bi','sp po hl','cp mb hr',
 'bn cg ds','nt te hs','se wrg fh','te ll bw','wrg lr kn',
 'ah nb rb','sp wl sl','cp wr sr','bn nl fc','nt nr tt',
 'se bi bo','te he dk','wrg al ar','ah ct cp','sp sh hd',
 ],
 cower:[
 'ds cg fc','dk sq he','dl nl ct','dr nr mb','fc ds bn',
 'cg ah hl','sq bl hr','he dk ff','nl ds cp','nr fc wrg',
 'ds dl pl','dk dr pr','fc he pb','cg tt ct','sq rb bo',
 'dl cg yl','dr sq yr','he nl ah','bn nr bl','fc dk kn',
 'ds sq el','cg nl er','nr dk ca','he fc bw','dk ds rc',
 ],
 startle:[
 'hu pb hl','he pl hr','pb pr po','pl ol bw','pr or bn',
 'hu he dk','he hu le','pb ds sh','pl pr nt','pr pl rc',
 'hu sp cp','he fc ct','pb dl er','pl dr el','pr dk mb',
 'hu ll bw','he lr kn','pb nl ds','pl nr fc','pr sq he',
 'hu hl hr','he hr hs','pb tt bi','pl wrg se','pr ah bo',
 ],
 sob:[
 'ml sb mr','mr slv ct','slv fc sb','sb bl bo','fc ml nl',
 'ml mr ah','mr rb nr','slv mb ff','sb cp bn','fc sb sq',
 'ml ct wrg','mr hb xl','slv sb kn','sb mr ca','fc rb hd',
 'ml bl hs','mr xl bo','slv nl fc','sb nr tt','fc ah bi',
 'ml mb se','mr ct bk','slv mr cp','sb fc slp','fc slv rc',
 ],
 withdraw:[
 'yl ca bk','yr ct hd','bk ah hl','ca hs hr','ct yl slp',
 'hd yr bo','yl bk sh','yr ca fp','bk ct mb','ca ah bn',
 'ct bk nl','hd ca nr','yl hl ct','yr hr hs','bk slp ff',
 'ca yl he','ct yr fc','hd bk nt','yl ca cp','yr ah wrg',
 'bk hd bo','ca ct se','yl yr bn','yr yl bw','slp bk rc',
 ],
 sigh:[
 'bi hb bo','bo sh hd','hb ct se','sh bi rc','hd bo slp',
 'bi xl hb','bo xr ct','hb br ws','sh hp fp','hd lp ca',
 'bi kn bo','bo ff nt','hb nb se','sh ak hs','hd bk ct',
 'bi tt bo','bo ml mr','hb yh hd','sh bl cp','hd slp kn',
 'bi rc sh','bo hb fc','hb hs fp','sh bo bn','hd bi se',
 ],
 exasperated:[
 'hu sh fp','hp il hs','lp ir hb','fp ak bo','sh hu hd',
 'hu br ct','hp swr ca','lp swl bk','fp gc le','sh il ir',
 'hu he fc','hp ur ak','lp ul nt','fp ts bw','sh tu bn',
 'hu fh ws','hp mb bo','lp ch se','fp hu kn','sh ca hs',
 'hu swl swr','hp lp sh','lp hp fp','fp hd rc','sh br bo',
 ],
 clenched:[
 'gl gc nt','gr gc bw','gc ca ct','gl ul bo','gr ur bi',
 'gc te hs','gl wrg mb','gr ah fh','gc ak le','gl il bw',
 'gr ir bn','gc dl ds','gl ts nt','gr tu rc','gc nl cp',
 'gl at cl','gr aw cr','gc st ss','gl po hd','gr fp se',
 'gc hl hr','gl gr ah','gr gl ca','gc he ct','gl wr sl',
 ],
 angry:[
 'ur ir ak','ul il ts','il gc bw','ir gr tu','ts gl ca',
 'tu gr le','ur ul hu','ul ur fp','il swl hs','ir swr hb',
 'ak gc nt','ur ir po','ul il ol','il ir or','ir il sh',
 'ts ur gc','tu ul gr','ur dl bw','ul dr bn','il pl hl',
 'ir pr hr','ak hu br','gc ur ct','ul gc rc','gr ur se',
 ],
 disgust:[
 'mb hs swl','st ff swr','hs le ct','swr mb yr','swl br yl',
 'mb st bo','st ss mb','hs po le','swr ol hl','swl or hr',
 'mb br fc','st kn ws','hs yr ca','swr yl bk','swl yr hd',
 'mb xl bi','st ril rr','hs fh rb','swr fp sh','swl hp hs',
 'mb el er','st ss cg','hs ct rc','swr swl po','swl swr bo',
 ],
 ashamed:[
 'ct fc bk','fc slv hd','bk ml slp','ct mr ah','fc fh bo',
 'bk ca yl','ct ah yr','fc rb nl','bk wrg nr','ct mb bn',
 'fc ml ct','bk mr hs','ct br se','fc he ff','bk slv kn',
 'ct cl al','fc cr ar','bk cp bi','ct xl bo','fc nr cg',
 'bk nl sh','ct hs ca','fc ct rc','bk hd se','ct slp mb',
 ],
 panic:[
 'he hu ds','hu pl pr','ds he cg','pl pr dk','pr po fc',
 'he hl hr','hu hr hl','ds rb tt','pl ol dk','pr or ds',
 'he fc sq','hu dl dr','ds nl nr','pl ll bw','pr lr bn',
 'he st ss','hu mb bl','ds cp wrg','pl te ah','pr sp po',
 'he kn bo','hu sq fc','ds he ct','pl fc hs','pr dk rc',
 ],
 grief:[
 'sb xl nl','fc bl nr','nl fc mb','nr sb ct','xl ml bo',
 'bl mr ff','sb ah sq','fc cp bn','nl mr slp','nr ml hd',
 'xl hb fc','bl ct wrg','sb kn mb','fc nl tt','nl nr cp',
 'nr nl ah','xl bk bo','bl he sb','sb rb ct','fc mr se',
 'nl xl bi','nr bl hs','xl sb rc','bl fc hd','sb slv bo',
 ],
 overwhelmed:[
 'tt he fc','fc hu kn','he cg ct','tt wrg cp','hu ds sq',
 'fc tt nl','he rb nr','tt fh ff','hu sp po','fc br bo',
 'he ah bn','tt kn ws','hu ml mr','fc st ss','he pl pr',
 'tt hl hr','hu hp lp','fc ca bk','he mb slp','tt ds dk',
 'hu cp bi','fc te se','he tt rc','tt fc hd','hu he bo',
 ],
 exhausted:[
 'yh rb slp','kn ff bo','rb fh hd','slp kn se','yh hb sn',
 'kn nl rc','rb mr ml','slp nr ct','yh ws bo','kn st bi',
 'rb tt se','slp bk hd','yh mb ff','kn dlw drw','rb sn hs',
 'slp ah bn','yh bi ct','kn br bo','rb el er','slp cg cp',
 'yh hd se','kn hel her','rb ct rc','slp ff nt','yh kn slp',
 ],
} as const;
export const REACTION_FAMILIES=Object.keys(REACTION_SCORES) as (keyof typeof REACTION_SCORES)[];
export const REACTION_CLIPS=REACTION_FAMILIES.flatMap((family,index)=>REACTION_SCORES[family].map((score,n)=>{
 const keys=score.split(' ') as ReactionKey[];
 for(const k of keys)if(!REACTION_KEYS[k])throw Error('Unknown reaction key '+k);
 return{id:`${family}-${n+1}`,family,index,score,keys,label:keys.map(k=>REACTION_KEYS[k].label).join(' → '),duration:3.2};
}));
