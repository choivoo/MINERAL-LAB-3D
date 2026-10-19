#!/usr/bin/env python3
"""Sync only experimentally sourced, stoichiometry-verified COD CIF structures.
COD https://www.crystallography.net/cod/ (CC0). Unverified entries never get
fabricated coordinates. Existing validated entries remain on transient failures.
"""
import concurrent.futures, json, math, re, time
from collections import Counter
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen,Request
import gemmi

TARGETS = {
 "calcite":("Calcite",{"Ca":1,"C":1,"O":3}),
 "aragonite":("Aragonite",{"Ca":1,"C":1,"O":3}),
 "dolomite":("Dolomite",{"Ca":1,"Mg":1,"C":2,"O":6}),
 "magnesite":("Magnesite",{"Mg":1,"C":1,"O":3}),
 "siderite":("Siderite",{"Fe":1,"C":1,"O":3}),
 "rhodochrosite":("Rhodochrosite",{"Mn":1,"C":1,"O":3}),
 "smithsonite":("Smithsonite",{"Zn":1,"C":1,"O":3}),
 "halite":("Halite",{"Na":1,"Cl":1}),
 "sylvite":("Sylvite",{"K":1,"Cl":1}),
 "fluorite":("Fluorite",{"Ca":1,"F":2}),
 "pyrite":("Pyrite",{"Fe":1,"S":2}),
 "chalcopyrite":("Chalcopyrite",{"Cu":1,"Fe":1,"S":2}),
 "cuprite":("Cuprite",{"Cu":2,"O":1}),
 "malachite":("Malachite",{"Cu":2,"C":1,"O":5,"H":2}),
 "azurite":("Azurite",{"Cu":3,"C":2,"O":8,"H":2}),
 "quartz":("Quartz",{"Si":1,"O":2}),
 "hematite":("Hematite",{"Fe":2,"O":3}),
 "magnetite":("Magnetite",{"Fe":3,"O":4}),
 "gypsum":("Gypsum",{"Ca":1,"S":1,"O":6,"H":4}),
 "galena":("Galena",{"Pb":1,"S":1}),
 "sphalerite":("Sphalerite",{"Zn":1,"S":1}),
 "sulfur":("Sulfur",{"S":8})
}
PINS = {
 "calcite":[9000095], "aragonite":[2103119], "dolomite":[9000100],
 "magnesite":[9000096],"siderite":[9000098],"rhodochrosite":[9000097],
 "smithsonite":[9000099],"quartz":[9011495],"hematite":[9015503],
 "magnetite":[9007644],"gypsum":[5000039],"sulfur":[4124791]
}
BASE="https://www.crystallography.net/cod/"
def read(url):
 last=None
 for _ in range(2):
  try:
   req=Request(url,headers={"User-Agent":"MINERAL-LAB-3D-v5/1.0 (educational CC0 crystal importer)","Accept":"text/plain, application/json, */*"})
   with urlopen(req,timeout=9) as r: return r.read(2800000).decode("utf-8","replace")
  except Exception as exc: last=exc; time.sleep(.2)
 raise last

def candidate_ids(name,key):
 found=list(PINS.get(key,[]))
 for text in (name,):
  try:
   payload=read(BASE+"result?"+urlencode({"text":text,"format":"lst"}))
   found += [int(x) for x in re.findall(r"(?m)^\s*(\d{7})\s*$",payload)][:18]
  except Exception as ex: print("SEARCH_UNAVAILABLE",key,str(ex),flush=True)
 return list(dict.fromkeys(found))[:20]

def parse(cid,name,formula):
 source=BASE+str(cid)+".cif"
 data=read(source)
 block=gemmi.cif.read_string(data).sole_block()
 mineral=(block.find_value("_chemical_name_mineral") or "").strip(" \"'").lower()
 if mineral and name.lower() not in mineral:
  raise ValueError("Different mineral name: "+mineral[:70])
 st=gemmi.make_small_structure_from_block(block)
 if not st or not st.cell or not st.sites:raise ValueError("Missing atom sites")
 sites=list(st.get_all_unit_cell_sites())
 atoms=[]
 for site in sites:
  if not math.isfinite(site.occ) or site.occ < .999:
   raise ValueError("Mixed/disordered occupancies need special treatment")
  sym=site.element.name
  if sym not in formula:raise ValueError("Unexpected element "+sym)
  pos=[float(site.fract.x)%1,float(site.fract.y)%1,float(site.fract.z)%1]
  if not all(math.isfinite(t) for t in pos):raise ValueError("Invalid atomic coordinate")
  atoms.append([sym]+[round(t,6) for t in pos])
 atoms=list({tuple(row):row for row in atoms}.values())
 counts=Counter(x[0] for x in atoms)
 if not atoms or len(atoms)>420:raise ValueError("Unsupported cell size")
 ratios=[counts.get(sym,0)/num for sym,num in formula.items()]
 if not ratios or min(ratios)<=0 or max(ratios)-min(ratios)>.002:
  raise ValueError("Formula mismatch: "+str(dict(counts)))
 cell=st.cell
 lattice=[cell.a,cell.b,cell.c,cell.alpha,cell.beta,cell.gamma]
 if not all(math.isfinite(x) for x in lattice) or min(lattice[:3])<.5 or min(lattice[3:])<30:
  raise ValueError("Invalid unit cell")
 return {"source":source,"sourceId":cid,
         "spaceGroup":st.spacegroup_hm or "reported in CIF",
         "lattice":[round(x,5) for x in lattice],
         "atoms":atoms,"verifiedFormula":formula,"validation":"full occupancy / composition / CIF unit cell"}

def process(entry):
 key,(name,formula)=entry
 errors=[]
 for cid in candidate_ids(name,key):
  try:
   rec=parse(cid,name,formula)
   return key,rec,None
  except Exception as ex:
   errors.append(str(cid)+": "+str(ex)[:100])
 return key,None,"; ".join(errors[-3:]) or "No COD candidates"

old={}
p=Path("cod_crystals.js")
if p.exists():
 m=re.search(r"window\.COD_CRYSTALS\s*=\s*(\{.*\})\s*;",p.read_text(encoding="utf-8"),re.S)
 if m:
  try:old=json.loads(m.group(1))
  except Exception:pass

verified={k:v for k,v in old.items() if k in TARGETS and isinstance(v,dict) and
          v.get("sourceId") and v.get("atoms") and v.get("lattice")}
failed={}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 futures=[ex.submit(process,entry) for entry in TARGETS.items()]
 for f in concurrent.futures.as_completed(futures):
  key,rec,error=f.result()
  if rec:
   verified[key]=rec
   print("VERIFIED",key,rec["sourceId"],len(rec["atoms"]),flush=True)
  else:
   failed[key]=error
   print("NOT_VERIFIED",key,error[:210],flush=True)

p.write_text("window.COD_CRYSTALS="+json.dumps(verified,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
Path("structure-report.json").write_text(json.dumps({
 "total_minerals":len(TARGETS),"verified_count":len(verified),
 "verified":{k:{"source":v["source"],"sourceId":v["sourceId"],"sites":len(v["atoms"])} for k,v in verified.items()},
 "unverified":failed,
 "note":"Verified CIF atomic sites; mineral shapes remain representative procedural habits, not measured scans."
},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("COMPLETE",len(verified),"/",len(TARGETS),"CIF structures verified",flush=True)
