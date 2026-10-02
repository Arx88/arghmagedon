import fs from 'node:fs';
import postcss from 'postcss';
const file=new URL('../src/hud-reference.css',import.meta.url);
const css=postcss.parse(fs.readFileSync(file,'utf8'));
css.walkRules(rule=>{rule.selectors=rule.selectors.map(s=>s.startsWith('body.game-hud')?s:`body.game-hud ${s}`);});
fs.writeFileSync(file,css.toString());
console.log('All HUD selectors scoped to body.game-hud.');
