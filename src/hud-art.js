// Production raster artwork generated specifically for Pirate Tides.
import {glyph} from './hud-glyphs.js';
import './hud-glyphs.css';
const root='/assets/pirate-ui/';
export const definitions='';
export const icon=(name,className='')=>(className==='action-art'?null:glyph(name,className))??`<img class="hud-icon ${className}" src="${name==='hook'?root+'grappling-hook.png':root+(['cannon','swords','chest','fire'].includes(name)?'v2/':'')+name+'.webp'}" alt="" draggable="false">`;
export const matchArtwork=()=>`<img class="match-art" src="${root}v2/match.webp" alt="" draggable="false">`;
export const compassArtwork=()=>`<img class="compass-art" src="${root}compass-rim-v3.png" alt="" draggable="false"><span class="compass-direction compass-n">N</span><span class="compass-direction compass-s">S</span><span class="compass-direction compass-w">O</span><span class="compass-direction compass-e">E</span>`;
export const ropeArtwork='<div class="action-rope" aria-hidden="true"></div>';
