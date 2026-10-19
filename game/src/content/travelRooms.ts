import type {InteriorDef} from './interiors';
import {p,wp,z,spot} from './interiorKit';
export const LOUNGES = [
 {id:'terminal',name:'Gate lounge',cost:0,benefit:'Boarding displays, charging points and gate seating.'},
 {id:'quiet',name:'Quiet lounge',cost:0,benefit:'A calm corner to rest before boarding.'},
 {id:'family',name:'Family lounge',cost:0,benefit:'Play tables, family seating and a changing area.'},
 {id:'work',name:'Business lounge',cost:20,benefit:'Desks, charging, coffee and a quiet workspace.'},
 {id:'premium',name:'Premium lounge',cost:45,benefit:'Buffet, comfortable seating and bar service.'},
 {id:'suite',name:'Rest & shower suite',cost:60,benefit:'A private bed, shower and fresh towels.'},
] as const;
export type LoungeId=typeof LOUNGES[number]['id'];
/** Authored airport spaces, using the same props, collision and figures as every town interior. */
export function airportRoom(id:LoungeId):InteriorDef{
 const info=LOUNGES.find(l=>l.id===id)!;
 const def:InteriorDef={kind:'airport',title:info.name,size:{w:20,h:14},door:{x:1.5,y:10.5},light:'warm',ambience:['terminal'],busy:.5,staff:{color:'#647585'},
 zones:[z('entry','Concourse',0,0,7,14,'tile','#a29b8e'),z('lounge',info.name,7,0,13,14,'carpet','#5c6063')],
 props:[wp('sign','n',1,5,'#d5c196','CHC · DEPARTURES'),wp('screen','n',8,5,'#273943','GATE 12 · BOARDING'),wp('window','n',14,5,'#a5c3ce','Apron view'),p('counter',2,2,4,1,'#83735f','Gate desk'),p('plant',18,11,1,1,'#56825c'),p('bin',5,12, .6,.6,'#454e52')],
 interactables:[{id:'gate',label:'Boarding display',x:4,y:4,text:'Gate 12 · Your flight is ready when you are.'}],spots:[spot(4,3.8,'work','s')],flavour:[info.benefit]};
 if(id==='suite'){
  def.props.push(p('bed',10,3,3,4,'#d7d0bf','Rest bed'),p('bath',16,3,2,3,'#d1d9da','Shower'),p('curtain',15,2,.1,5,'#8e9e9b'),p('cabinet',16,8,2,1,'#9a8468','Fresh towels'));
  def.interactables.push({id:'rest',label:'Rest and refresh',x:13.8,y:5,effect:'rest',text:'A proper rest, a shower and fresh towels before your flight.'});
 }else{
  for(let y=5;y<=10;y+=5)for(let x=9;x<=16;x+=3.5){def.props.push(p(id==='premium'||id==='quiet'?'sofa':'bench',x,y,2.5,.9,id==='premium'?'#8d6b51':'#526974','Gate seating'));def.spots.push(spot(x+1,y+1.6,'sit','n'));}
  def.interactables.push({id:'seat',label:'Take a seat',x:10,y:6.6,effect:'rest',text:'You settle into the lounge seating while the boarding display updates.'});
  if(id==='work')for(let x=9;x<18;x+=3){def.props.push(p('desk',x,2,2,1,'#977d60','Workstation'));def.spots.push(spot(x+1,3.8,'work','n'));}
  if(id==='premium'){def.props.push(p('counter',8,2,9,1,'#a48a69','Buffet & bar'),p('fridge',18,2,1,2,'#8c999e'));def.interactables.push({id:'buffet',label:'Enjoy the buffet',x:12,y:4,effect:'eat',text:'A warm meal and a drink, included in your lounge pass.'});}
  else def.props.push(p('vending',7.5,2,1.1,1,'#677a82','Coffee & snacks'));
  if(id==='family')def.props.push(p('table',3,6,2,2,'#c1a671','Activity table'),p('rug',2.5,5.5,3,3,'#9a7f6c'),p('cabinet',3,8.5,2,.7,'#a38b6c','Toys & books'));
 }
 return def;
}
