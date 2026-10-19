#!/usr/bin/env python3
"""Fetch reproducible, stoichiometry-checked CC0 COD crystal structures.
Unverified minerals remain conceptual; NEVER fabricate atomic coordinates.
Data: https://www.crystallography.net/cod/ and COD CIF archive.
"""
import collections,json,math,re,time
from urllib.request import Request,urlopen
from urllib.parse import quote
from pathlib import Path
import gemmi

TARGETS={
'calcite':('Calcite',{'Ca':1,'C':1,'O':3},[9000095]),
'aragonite':('Aragonite',{'Ca':1,'C':1,'O':3},[2103119]),
'dolomite':('Dolomite',{'Ca':1,'Mg':1,'C':2,'O':6},[9000100]),
'magnesite':('Magnesite',{'Mg':1,'C':1,'O':3},[9000096]),
'siderite':('Siderite',{'Fe':1,'C':1,'O':3},[9000098]),
'rhodochrosite':('Rhodochrosite',{'Mn':1,'C':1,'O':3},[9000097]),
'smithsonite':('Smithsonite',{'Zn':1,'C':1,'O':3},[9000099]),
'pyrite':('Pyrite',{'Fe':1,'S':2},[]),
'chalcopyrite':('Chalcopyrite',{'Cu':1,'Fe':1,'S':2},[]),
'cuprite':('Cuprite',{'Cu':2,'O':1},[]),
'malachite':('Malachite',{'Cu':2,'C':1,'O':5,'H':2},[]),
'azurite':('Azurite',{'Cu':3,'C':2,'O':8,'H':2},[]),
'quartz':('Quartz',{'Si':1,'O':2},[9011495]),
'hematite':('Hematite',{'Fe':2,'O':3},[9015503]),
'magnetite':('Magnetite',{'Fe':3,'O':4},[9007644]),
'gypsum':('Gypsum',{'Ca':1,'S':1,'O':6,'H':4},[5000039]),
'sulfur':('Sulfur',{'S':8},[4124791])
}
def read(url):
 req=Request(url,headers={'User-Agent':'MineralLab3D/4.0 educational CC0 crystal importer'})
 return urlopen(req,timeout=5).read(2000000).decode('utf-8','replace')
def get_record(cid,name,formula):
 url='https://www.crystallography.net/cod/%s.cif'%cid
 block=gemmi.cif.read_string(read(url)).sole_block()
 official=(block.find_value('_chemical_name_mineral') or '').strip(' "\'')
 if official and name.lower() not in official.lower(): raise ValueError('wrong mineral: '+official)
 st=gemmi.make_small_structure_from_block(block)
 raw=[]
 for site in st.get_all_unit_cell_sites():
  el=site.element.name
  if site.occ < 0.99 or el not in formula:raise ValueError('disordered or wrong element '+el)
  raw.append([el,*[round(float(v)%1,6) for v in (site.fract.x,site.fract.y,site.fract.z)]])
 atoms=list({tuple(row):row for row in raw}.values())
 found=collections.Counter(row[0] for row in atoms)
 multiples=[found[k]/v for k,v in formula.items()]
 if any(v<=0 for v in multiples) or max(multiples)-min(multiples)>1e-4 or len(atoms)>500:raise ValueError('composition mismatch')
 cell=st.cell
 lattice=[cell.a,cell.b,cell.c,cell.alpha,cell.beta,cell.gamma]
 if any(not math.isfinite(x) for x in lattice) or min(lattice[:3])<1:raise ValueError('invalid cell')
 return {'source':url,'sourceId':cid,'spaceGroup':st.spacegroup_hm or '', 'lattice':[round(v,5) for v in lattice],'atoms':atoms}
def candidates(name,pinned):
 ids=list(pinned)
 try:
  response=read('https://www.crystallography.net/cod/result?text='+quote(name)+'&format=lst')
  ids+= [int(v.strip()) for v in response.splitlines() if re.fullmatch(r'\d{7}',v.strip())][:2]
 except Exception as exc:print('Search failed:',name,exc)
 return list(dict.fromkeys(ids))
from concurrent.futures import ThreadPoolExecutor,as_completed
def verify(item):
 key,(name,formula,pinned)=item
 issue='No verified CIF found'
 for cid in candidates(name,pinned):
  try:
   record=get_record(cid,name,formula)
   print('VERIFIED',key,cid,len(record['atoms']),flush=True)
   return key,record,None
  except Exception as exc:
   issue=str(exc)
   print('SKIP',key,cid,issue,flush=True)
 return key,None,issue
result={};failed={}
with ThreadPoolExecutor(max_workers=5) as pool:
 for future in as_completed([pool.submit(verify,item) for item in TARGETS.items()]):
  key,record,issue=future.result()
  if record is not None:result[key]=record
  else:failed[key]=issue
Path('cod_crystals.js').write_text('window.COD_CRYSTALS='+json.dumps(result,separators=(',',':'))+';',encoding='utf-8')
Path('structure-report.json').write_text(json.dumps({'verified':list(result),'unverified':failed},indent=2),encoding='utf-8')
print('VERIFIED',len(result),'of',len(TARGETS),'additional crystal structures')
