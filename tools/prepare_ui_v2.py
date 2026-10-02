"""Production prep only: lossless conversion and transparent-margin cropping."""
from pathlib import Path
from PIL import Image
import json

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'C:\Users\juanp\.codex\generated_images\01a0e5a2-75c5-7fe3-80a4-f517c39abd44')
OUT=ROOT/'public/assets/pirate-ui/v2'
OUT.mkdir(parents=True,exist_ok=True)
FILES={
 'match':'exec-a50843d1-5751-4004-8583-9d68c9713464.png',
 'compass':'exec-d3abf82b-5303-4224-80a4-da70a6dba064.png',
 'medal':'exec-9b0ea9f2-c5f2-4257-aea6-4af9c952377f.png',
 'ship-panel':'exec-99174649-5599-41cd-8015-63eefe9d05d9.png',
 'dialogue':'exec-a33a8625-5e15-402e-9106-2ed41656229d.png',
 'cannon':'exec-4f7d0563-dca8-4d79-9f95-6e43f94260b4.png',
 'swords':'exec-b80143ad-6e3a-49ac-a020-0dc5aca65a0b.png',
 'chest':'exec-93c579a7-ce5e-4764-9de1-57564d450a3f.png',
 'fire':'exec-da6b28cf-7efd-45f7-bfee-22a170540f5d.png',
}
metadata={}
for name,file in FILES.items():
    im=Image.open(SOURCE/file).convert('RGBA')
    original=im.size
    bounds=im.getchannel('A').point(lambda v:255 if v>12 else 0).getbbox()
    im=im.crop(bounds)
    if name in ['compass','medal']:
        # Square padding, never stretching a circular instrument.
        side=max(im.size);square=Image.new('RGBA',(side,side))
        square.alpha_composite(im,((side-im.width)//2,(side-im.height)//2));im=square
    im.thumbnail((1200,1200),Image.Resampling.LANCZOS)
    im.save(OUT/f'{name}.webp',lossless=True,method=6)
    metadata[name]={'source':file,'source_size':original,'crop':bounds,'width':im.width,'height':im.height,'ratio':round(im.width/im.height,6),'center_alpha':im.getpixel((im.width//2,im.height//2))[3]}
pip_bounds=(118,41,219,277)
pip=Image.open(OUT.parent/'crew.webp').crop(pip_bounds)
pip.save(OUT/'crew-pip.webp',lossless=True,method=6)
metadata['crew-pip']={'source':'../crew.webp','crop':pip_bounds,'width':pip.width,'height':pip.height}
(OUT/'manifest.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata))
