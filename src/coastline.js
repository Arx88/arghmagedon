// One silhouette shared by terrain, shoreline foam, waves and nautical charts.
export function coastRadius(angle,x,z){const phase=x*.031+z*.027;return 1+Math.sin(angle*3+phase)*.11+Math.cos(angle*5-phase)*.06+Math.sin(angle*9+phase*.7)*.025;}
export const coastGLSL='float phase=a.x*.031+a.y*.027;float shape=1.+sin(ang*3.+phase)*.11+cos(ang*5.-phase)*.06+sin(ang*9.+phase*.7)*.025;';
