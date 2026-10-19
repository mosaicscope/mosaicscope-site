/** Transparent production PNGs. Original street people remain on their shared figure renderer. */
type Atlas={image:HTMLImageElement;columns:number;rows:number;ready:boolean;key:string};
const atlases:Atlas[]=[];
function load(file:string,columns:number,rows:number){const image=typeof Image!=='undefined'?new Image():{} as HTMLImageElement,atlas:Atlas={image,columns,rows,ready:false,key:file};if(typeof Image==='undefined')return atlas;image.onload=()=>{atlas.ready=true;};image.src=import.meta.env.BASE_URL+'art/'+file;atlases.push(atlas);return atlas;}
const sport=load('horse-dog-gaits.png',4,4),farm=load('farm-animal-gaits.png',8,6),walk=load('horse-dog-walk.png',4,2);
const species=[/cattle|cow/i,/sheep/i,/pig/i,/goat/i,/deer/i,/alpaca/i,/chick|chook/i,/duck/i,/goose/i,/donkey/i,/cat/i,/bee/i];
const frames=new Map<string,{cv:HTMLCanvasElement;bottom:number}>();
export function drawAnimalAtlas(g:CanvasRenderingContext2D,x:number,y:number,kind:string,time:number,size:number,gait='walk'){
 const horse=/horse|trainer|race/i.test(kind),dog=/dog|greyhound/i.test(kind),index=species.findIndex(s=>s.test(kind));
 if(!horse&&!dog&&index<0)return false;
 const atlas=horse||dog?(time===0||gait==='walk'?walk:sport):farm;if(!atlas.ready)return false;
 const n=atlas===sport?8:4,frame=time===0?0:Math.floor(Math.max(0,time)*(horse?12:dog?14:5))%n;
 const slot=horse?frame:dog?(atlas===sport?8:4)+frame:index*4+frame,key=atlas.key+slot;
 let tile=frames.get(key);
 if(!tile){
  const cw=atlas.image.naturalWidth/atlas.columns,ch=atlas.image.naturalHeight/atlas.rows,cv=document.createElement('canvas');cv.width=Math.ceil(cw);cv.height=Math.ceil(ch);const c=cv.getContext('2d')!;
  c.drawImage(atlas.image,slot%atlas.columns*cw,Math.floor(slot/atlas.columns)*ch,cw,ch,0,0,cw,ch);
  const alpha=c.getImageData(0,0,cv.width,cv.height).data;let bottom=Math.floor(ch*.82);
  for(let row=cv.height-1;row>=0;row--){let solid=0;for(let col=0;col<cv.width;col++)if(alpha[(row*cv.width+col)*4+3]>120)solid++;if(solid>4){bottom=row;break;}}
  tile={cv,bottom};frames.set(key,tile);
 }
 const relative=horse?1.12:dog?.73:index>=6&&index<=8?.53:index===11?.32:1;
 const width=90*size*relative,height=width*tile.cv.height/tile.cv.width;
 g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(tile.cv,x-width*.5,y-height*tile.bottom/tile.cv.height,width,height);g.restore();return true;
}
export function animalAtlasesReady(){return atlases.every(a=>a.ready);}
