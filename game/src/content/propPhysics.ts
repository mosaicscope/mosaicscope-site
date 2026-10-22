export function propPhysics(model:string){
 if(['ball','basketball','football'].includes(model))return{material:'rubber',strength:70,bend:.25,radius:.12};
 if(['crate','fruit','parcel','picnic','chess','piano','board','stall','table'].includes(model))return{material:'timber',strength:30,bend:.06,radius:['picnic','stall'].includes(model)?.45:.2};
 if(['fountain','planter'].includes(model))return{material:'concrete',strength:180,bend:.025,radius:.24};
 if(['cone','bag','basket','bin','suitcase','skate','cooler'].includes(model))return{material:'plastic',strength:22,bend:.4,radius:.16};
 return{material:'metal',strength:85,bend:.25,radius:['rack','barrier','luggage','cart'].includes(model)?.35:.15};
}
