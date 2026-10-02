// Sampling rectangles from the ORIGINAL generated raster atlas, not from a UI
// screenshot. A luminance mask discards its black background without fringes.
export const glyphRegions=Object.freeze({
 ship:[612.7622,490.3846,3.6311,7.6803],crew:[461.9896,173.2461,2.6703,48.9221,'compact-glyphs-v8.png'],
 swords:[630.9631,504.9505,50,8.1018],fleet:[533.2826,426.7782,73.659,5.7677],island:[612.7622,490.3846,96.5394,7.5683],
 anchor:[609.8304,488.0383,3.8435,36.3805],wrench:[732.4974,586.2069,27.7383,36.3529],shield:[643.7098,515.1515,50,36.3968],
 clock:[630.9631,504.9505,72.5886,36.4414],target:[601.2007,481.1321,96.7146,36.4986],coin:[656.9822,525.7732,4.4001,63.7574],
 chest:[606.9264,485.7143,26.4304,64.422],spyglass:[533.2826,426.7782,50.2195,63.2697],rum:[637.2727,510,72.5042,63.7472],
 cannon:[451.8976,169.4616,35.9544,49.3647,'compact-glyphs-v8.png'],hook:[612.7622,490.3846,3.3328,90.8643],fire:[630.9631,504.9505,27.5809,90.898],
 chain:[563.9582,451.3274,50,92.4777],bomb:[618.7114,495.1456,73.7366,90.6522],wheel:[568.9935,455.3571,96.9886,92.0854],
 gear:[505.9289,189.7233,68.6222,47.7974,'compact-glyphs-v8.png'],note:[581.8182,218.1818,95.6958,47.5962,'compact-glyphs-v8.png'],
});
export function glyph(name,className=''){
 const region=glyphRegions[name];if(!region)return null;
 const [sx,sy,x,y,atlas='glyph-atlas-v7.png']=region;
 return `<span class="hud-icon glyph-v7 ${className}" data-glyph="${name}" aria-hidden="true" style="--glyph-atlas:url('/assets/pirate-ui/${atlas}');--glyph-size:${sx}% ${sy}%;--glyph-position:${x}% ${y}%"></span>`;
}
