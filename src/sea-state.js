import { coastRadius,coastGLSL } from './coastline.js';
export function seaHeight(x,z,t,storm,islands=[]){
 let distance=100;
 for(const a of islands){if(a.z<=0)continue;const qx=(x-a.x)/a.z,qz=(z-a.y)/a.w,angle=Math.atan2(qz,qx),shape=coastRadius(angle,a.x,a.y);distance=Math.min(distance,(Math.hypot(qx,qz)-shape)*Math.min(a.z,a.w));}
 const coast=Math.min(1,Math.max(0,distance/12)),attenuation=coast*coast*(3-2*coast);
 const swell=Math.pow((Math.sin(x*.045+z*.065+t*.88)+1)*.5,6)*6.-.8;
 return (Math.sin(x*.14+z*.11+t*1.25)*(.045+storm*2.2)+Math.sin(x*.22-z*.13+t*1.7)*(.03+storm*.65)+swell*storm)*attenuation;
}
export function seaVertexFunction(count){return `
 uniform vec4 islands[${count}];
 float seaHeight(vec2 p,float t,float storm){float d=100.;for(int i=0;i<${count};i++){vec4 a=islands[i];if(a.z<=0.)continue;vec2 q=(p-a.xy)/a.zw;float ang=atan(q.y,q.x);${coastGLSL}d=min(d,(length(q)-shape)*min(a.z,a.w));}
 float swell=pow((sin(p.x*.045+p.y*.065+t*.88)+1.)*.5,6.)*6.-.8;
 return (sin(p.x*.14+p.y*.11+t*1.25)*(.045+storm*2.2)+sin(p.x*.22-p.y*.13+t*1.7)*(.03+storm*.65)+swell*storm)*smoothstep(0.,12.,d);}
 `;}

