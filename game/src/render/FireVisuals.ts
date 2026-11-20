/** 80 original profiles plus 500 new combinations of flame shape and smoke. */
export interface FireVisualProfile {id:number;flameShape:number;smokeStyle:number;smoke:string;core:string;body:string;height:number;width:number;flicker:number;lean:number}
const smoke=['rgba(53,50,46,.62)','rgba(78,75,70,.58)','rgba(105,101,92,.54)','rgba(43,44,46,.68)','rgba(132,126,112,.5)','rgba(70,72,77,.6)','rgba(154,151,138,.48)','rgba(85,75,63,.62)','rgba(36,38,40,.68)','rgba(64,57,50,.64)','rgba(100,82,68,.58)','rgba(130,113,95,.52)','rgba(170,160,142,.48)','rgba(99,105,111,.56)','rgba(135,143,148,.50)','rgba(190,185,169,.45)','rgba(70,59,57,.62)','rgba(116,99,91,.56)','rgba(147,139,128,.52)','rgba(45,48,56,.66)'];
export function fireVisualProfile(seed:number,battery=false):FireVisualProfile{
 const id=((Math.trunc(seed)%580)+580)%580,flameShape=id<80?id%10:10+(id-80)%25,smokeStyle=id<80?Math.floor(id/10):Math.floor((id-80)/25);
 return {id,flameShape,smokeStyle,smoke:smoke[smokeStyle],core:battery?'rgba(224,242,255,.98)':'rgba(255,235,138,.95)',body:battery?'rgba(170,205,255,.88)':'rgba(255,148,24,.87)',height:.78+flameShape*.025,width:.8+(flameShape%7)*.075,flicker:6.5+flameShape*.2,lean:.65+(flameShape%6)*.1};
}
