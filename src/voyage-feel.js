export const boostTuning = Object.freeze({speed:1.72,acceleration:3.6,drain:30,recovery:12,recoveryDelay:1.5,rearm:18});
export function createVoyageState(){return {stamina:100,boosting:false,boostIntensity:0,exhausted:false,rest:0,rumCharges:3,rumTime:0,rumCooldown:0};}
export function drinkRum(v){if(v.rumCharges<=0||v.rumCooldown>0)return false;v.rumCharges--;v.rumTime=7;v.rumCooldown=22;return true;}
export function stepVoyage(v,{boost,canSail},dt){
  v.rumTime=Math.max(0,v.rumTime-dt);v.rumCooldown=Math.max(0,v.rumCooldown-dt);
  // Empty sails must recover and the control must be released before another burst.
  if(!boost&&v.stamina>=boostTuning.rearm)v.exhausted=false;
  v.boosting=!!boost&&canSail&&!v.exhausted&&v.stamina>0;
  if(v.boosting){
    const active=Math.min(dt,v.stamina/boostTuning.drain);
    v.stamina=Math.max(0,v.stamina-boostTuning.drain*active);v.rest=0;
    if(v.stamina<1e-8){v.stamina=0;v.boosting=false;v.exhausted=true;v.rest=dt-active;}
  }else{
    const previousRest=v.rest;v.rest+=dt;
    const recovery=Math.max(0,v.rest-boostTuning.recoveryDelay)-Math.max(0,previousRest-boostTuning.recoveryDelay);
    v.stamina=Math.min(100,v.stamina+boostTuning.recovery*recovery);
  }
  // Visual feedback eases independently; releasing the control restores the speed cap immediately.
  const target=v.boosting?1:0,response=v.boosting?8:5;
  v.boostIntensity=target+((v.boostIntensity??0)-target)*Math.exp(-response*dt);
  return {speed:v.boosting?boostTuning.speed:v.rumTime>0?1.1:1,acceleration:v.boosting?boostTuning.acceleration:1,handling:v.rumTime>0?1.12:1};
}

export const weaponProfiles=[
 {name:'Hierro de cortesía',range:49,speed:38,arc:1.4,damage:1,reload:1,spread:.18},
 {name:'Cadena del cobrador',range:35,speed:31,arc:.45,damage:.82,reload:1.2,spread:.12},
 {name:'Brasas de cortesía',range:42,speed:29,arc:2.8,damage:.9,reload:1.3,spread:.2},
 {name:'Granada de la suegra',range:33,speed:24,arc:5.2,damage:1.25,reload:1.65,spread:.25,splash:5.5},
];
