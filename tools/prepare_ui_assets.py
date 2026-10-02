"""Slice generated production atlases. Preserve their artwork and alpha."""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r'C:\Users\juanp\.codex\generated_images\01a0e5a2-75c5-7fe3-80a4-f517c39abd44')
OUT = ROOT / 'public' / 'assets' / 'pirate-ui'
OUT.mkdir(parents=True, exist_ok=True)
names = ['cannon','swords','chest','fire','rum','anchor','coin','wheel','crew','shield','note','gear','harpoon','chain','bomb','spyglass']
icons = Image.open(SOURCE/'exec-9dad41a0-ee07-46b5-9134-da88b0a70cfb.png').convert('RGBA')
frames = Image.open(SOURCE/'exec-441dfc47-f3bf-44c5-8174-293f20de99df.png').convert('RGBA')
portraits = Image.open(SOURCE/'exec-ab3d8980-ab4a-449f-9e36-382223be785c.png').convert('RGBA')
panel = Image.open(SOURCE/'exec-6ef9194e-9352-48dd-93b8-585f9c163661.png').convert('RGBA')
manifest={}
def save(name, image, max_size, trim=True):
    if trim:
        bounds=image.getchannel('A').point(lambda v:255 if v>12 else 0).getbbox()
        if bounds:image=image.crop(bounds)
    image.thumbnail(max_size,Image.Resampling.LANCZOS)
    image.save(OUT/f'{name}.webp',lossless=True,method=6)
    manifest[name]={'width':image.width,'height':image.height}
for n,name in enumerate(names):
    w,h=icons.size
    save(name,icons.crop((n%4*w//4,n//4*h//4,(n%4+1)*w//4,(n//4+1)*h//4)),(320,320))
for name,rect in [('compass',(0,50,625,745)),('medal',(625,110,1280,750)),('scoreboard',(0,800,625,1145)),('dialogue-frame',(630,815,1280,1140))]:
    save(name,frames.crop(rect),(900,700))
for n,name in enumerate(['boatswain','lookout','harpooner','sailor','carpenter','captain']):
    w,h=portraits.size
    save(name,portraits.crop((n%3*w//3,n//3*h//2,(n%3+1)*w//3,(n//3+1)*h//2)),(420,420),False)
save('ship-panel',panel,(1100,440))
save('ship-emblem',panel.crop((0,0,685,793)),(410,475))
save('ship-banner',panel.crop((640,145,1983,675)),(900,360))
save('rope',panel.crop((750,181,1230,208)),(480,27),False)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'assets':len(manifest),'directory':str(OUT),'atlases':[icons.size,frames.size,portraits.size,panel.size]}))
