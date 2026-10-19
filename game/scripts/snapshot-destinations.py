"""Small attributed OSM snapshots. Uses the official read API, no scraped imagery."""
import json, math, subprocess, xml.etree.ElementTree as ET
from pathlib import Path
centres={'SYD':(-33.8605,151.2095),'RAR':(-21.2077,-159.7753),'DPS':(-8.5068,115.2625),'NRT':(35.6595,139.7005),'LAX':(34.0129,-118.4957),'LHR':(51.5007,-.1246)}
out=Path('public/destinations');out.mkdir(exist_ok=True)
for code,(lat,lon) in centres.items():
    dy=260/111320;dx=dy/math.cos(math.radians(lat));target=out/(code+'.osm')
    url=f'https://api.openstreetmap.org/api/0.6/map?bbox={lon-dx},{lat-dy},{lon+dx},{lat+dy}'
    subprocess.run(['curl.exe','-f','-sS','--retry','1','--max-time','35',url,'-o',str(target)],check=True)
    root=ET.parse(target).getroot();nodes={int(n.attrib['id']):{'lat':float(n.attrib['lat']),'lon':float(n.attrib['lon'])} for n in root.findall('node')}
    els=[]
    for n in root:
        tags={t.attrib['k']:t.attrib['v'] for t in n.findall('tag')}
        if n.tag=='node' and tags.get('name'):
            els.append({'id':int(n.attrib['id']),**nodes[int(n.attrib['id'])],'tags':tags})
        if n.tag=='way' and (tags.get('building') or tags.get('highway')):
            geometry=[nodes[int(nd.attrib['ref'])] for nd in n.findall('nd') if int(nd.attrib['ref']) in nodes]
            els.append({'id':int(n.attrib['id']),'tags':tags,'geometry':geometry})
    (out/(code+'.raw.json')).write_text(json.dumps({'elements':els}),encoding='utf-8')
    print(code,len(els),flush=True)
    target.unlink()
