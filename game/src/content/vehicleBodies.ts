/** Authored body families: roofline, overhangs and glazing differ independently of paint and lamps. */
export interface BodyShape{cf:number;cr:number;hood:number;deck:number;cab:[number,number];roof:[number,number];cw:number;rw:number;wheel:number;rh?:number;boxy?:boolean;open?:boolean;pill?:number;tray?:boolean}
const families:[string,string,BodyShape][]=[
 ['short hatch','demi fit peugeot colt',{cf:.23,cr:.05,hood:.42,deck:.6,cab:[-.45,.13],roof:[-.39,-.08],cw:.89,rw:.76,wheel:.26}],
 ['round micro','vitz march beetle',{cf:.36,cr:.3,hood:.4,deck:.54,cab:[-.41,.24],roof:[-.3,.01],cw:.92,rw:.67,wheel:.25,rh:1.03}],
 ['square kei','alto panda cube',{cf:.06,cr:.025,hood:.46,deck:.65,cab:[-.46,.19],roof:[-.43,.1],cw:.97,rw:.9,wheel:.23,boxy:true,rh:1.04}],
 ['sport hatch','axela tiida polo pulsar clio',{cf:.28,cr:.11,hood:.4,deck:.59,cab:[-.44,.19],roof:[-.35,-.06],cw:.9,rw:.77,wheel:.29}],
 ['classic notchback','crown marktwo bluebird cefiro laurel mercone',{cf:.08,cr:.06,hood:.49,deck:.53,cab:[-.3,.17],roof:[-.22,.035],cw:.91,rw:.81,wheel:.27,pill:2}],
 ['modern saloon','camry lancer kizashi accord audia atenza',{cf:.26,cr:.16,hood:.42,deck:.5,cab:[-.34,.23],roof:[-.23,-.035],cw:.9,rw:.73,wheel:.28,pill:2}],
 ['executive','mercs five passat',{cf:.16,cr:.11,hood:.49,deck:.55,cab:[-.36,.2],roof:[-.27,.04],cw:.91,rw:.8,wheel:.27,pill:2}],
 ['long saloon','seven',{cf:.14,cr:.08,hood:.47,deck:.54,cab:[-.39,.25],roof:[-.3,.09],cw:.92,rw:.81,wheel:.25,pill:3}],
 ['eco wedge','prius chre',{cf:.37,cr:.04,hood:.31,deck:.58,cab:[-.45,.28],roof:[-.31,.01],cw:.92,rw:.72,wheel:.26}],
 ['low coupe','celica silvia integra auditt eightysix brz zthree zseven',{cf:.32,cr:.23,hood:.4,deck:.53,cab:[-.33,.12],roof:[-.22,-.06],cw:.86,rw:.67,wheel:.3}],
 ['long grand tourer','supra svx',{cf:.32,cr:.21,hood:.43,deck:.56,cab:[-.35,.04],roof:[-.25,-.09],cw:.84,rw:.68,wheel:.31}],
 ['mid engine wedge','nsx corvette',{cf:.4,cr:.22,hood:.27,deck:.5,cab:[-.24,.29],roof:[-.09,.06],cw:.8,rw:.61,wheel:.35}],
 ['open roadster','stwo zed mercsl',{cf:.3,cr:.22,hood:.42,deck:.5,cab:[-.23,.15],roof:[-.2,.02],cw:.87,rw:.75,wheel:.31,open:true,rh:.77}],
 ['muscle coupe','mustang challenger',{cf:.1,cr:.09,hood:.52,deck:.51,cab:[-.34,.02],roof:[-.24,-.09],cw:.88,rw:.77,wheel:.3}],
 ['long wagon','legacy levorg volfive golfestate voltwo',{cf:.14,cr:.04,hood:.44,deck:.65,cab:[-.46,.16],roof:[-.43,.035],cw:.93,rw:.85,wheel:.26,pill:3}],
 ['urban crossover','cxfive ravfour crv tiguan volxc',{cf:.24,cr:.09,hood:.5,deck:.65,cab:[-.44,.17],roof:[-.37,.01],cw:.94,rw:.81,wheel:.27,pill:2}],
 ['large SUV','cxnine forester xtrail',{cf:.14,cr:.035,hood:.52,deck:.67,cab:[-.47,.18],roof:[-.44,.065],cw:.94,rw:.86,wheel:.27,pill:3}],
 ['utility 4x4','patrol pajero rangeclassic defender vitara cherokee',{cf:.055,cr:.02,hood:.57,deck:.65,cab:[-.47,.1],roof:[-.45,.045],cw:.97,rw:.9,wheel:.3,boxy:true,pill:2}],
 ['double cab pickup','navara ftruck',{cf:.1,cr:.015,hood:.52,deck:.56,cab:[-.19,.22],roof:[-.16,.09],cw:.91,rw:.84,wheel:.27,tray:true,pill:2}],
 ['people mover','alphard stepwagon delica',{cf:.16,cr:.035,hood:.38,deck:.64,cab:[-.48,.31],roof:[-.45,.18],cw:.96,rw:.9,wheel:.22,pill:3}],
 ['forward cab van','hiacewide transporter',{cf:.1,cr:.025,hood:.29,deck:.5,cab:[-.49,.4],roof:[-.48,.25],cw:.97,rw:.93,wheel:.21,boxy:true,pill:2}],
 ['shuttle bus','coaster',{cf:.07,cr:.025,hood:.5,deck:.52,cab:[-.49,.47],roof:[-.48,.4],cw:.98,rw:.95,wheel:.18,pill:7}],
 ['rally saloon','gsr',{cf:.17,cr:.08,hood:.43,deck:.56,cab:[-.28,.17],roof:[-.19,.01],cw:.9,rw:.76,wheel:.31,pill:2}],
];
const bodies=new Map(families.flatMap(([family,ids,shape])=>ids.split(' ').map(id=>[id,{family,shape}] as const)));
export const fleetBody=(id:string)=>bodies.get(id);
export const BODY_FAMILIES=families.map(([name])=>name);
