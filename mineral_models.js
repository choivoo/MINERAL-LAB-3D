/* MINERAL LAB - Educational mineral specimen habits.
   Morphology is illustrative and not a measured individual specimen mesh.
   Crystal lattice coordinates live separately in COD and prototype datasets. */
(function(){
'use strict';
const TYPE={
 calcite:'rhombo',aragonite:'needles',dolomite:'rhombo',magnesite:'rhombo',
 siderite:'rhombo',rhodochrosite:'rhombo',smithsonite:'rhombo',
 halite:'cubic',sylvite:'cubic',fluorite:'octa',pyrite:'pyrite',
 chalcopyrite:'tetra',cuprite:'octa',malachite:'botryoidal',azurite:'needles',
 quartz:'quartz',hematite:'plates',magnetite:'octa',gypsum:'blades',
 galena:'cubic',sphalerite:'tetra',sulfur:'sulfur'
};
const METAL = new Set(['Li','Na','K','Rb','Cs','Be','Mg','Ca','Sr','Ba','Al','Zn','Cu','Fe','Mn','Ni','Co','Pb','Ag','Cd','Sn','Cr','Ti']);
const GROUPS={carbonate:new Set(['C','O']),sulfate:new Set(['S','O']),hydroxide:new Set(['O','H'])};
function kindOf(mineral,a,b){
 if(a===b)return (a==='S'||a==='O'||a==='C'||a==='Si')?'covalent':'proximity';
 const x=[a,b].sort().join('-');
 if(x==='O-Si'||x==='C-O'||x==='O-S'||x==='H-O'||x==='S-S')return 'covalent';
 if(['halite','sylvite','fluorite'].includes(mineral.id))return 'ionic';
 if(['quartz','sulfur'].includes(mineral.id))return 'covalent';
 if(METAL.has(a)!==METAL.has(b))return ['pyrite','chalcopyrite','galena','sphalerite'].includes(mineral.id)?'mixed':'ionic';
 return 'mixed';
}
function create(THREE,mineral){
 let seed=Array.from(mineral.id).reduce((a,c)=>a*33+c.charCodeAt(0),7)>>>0;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const group=new THREE.Group(),style=TYPE[mineral.id]||'cubic';
 const color=new THREE.Color(mineral.color);
 const metallic=['pyrite','chalcopyrite','galena','hematite','magnetite'].includes(mineral.id);
 // Deterministic fine crystal growth striations, color zoning and surface micro-roughness.
 // Procedural appearance only; not measured spectral/SEM data.
 const c=document.createElement('canvas');c.width=c.height=256;
 const cx=c.getContext('2d',{willReadFrequently:true});
 const textureData=cx.createImageData(256,256);
 const isStriped=['malachite','azurite','quartz','gypsum','sulfur','aragonite','pyrite'].includes(mineral.id);
 const isGrainy=['hematite','magnetite','galena','chalcopyrite','cuprite','siderite'].includes(mineral.id);
 const rnd=new Float32Array(256*256);
 for(let i=0;i<rnd.length;i++)rnd[i]=rand();
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const i=y*256+x;
   const ring=isStriped?Math.sin(y*.29+x*.035+Math.sin(x*.035)*2)*.18:0;
   const grain=(rnd[i]-.5)*(isGrainy?.66:.28);
   const band=Math.sin(y*.052+x*.012)*.12;
   const v=Math.round(128+105*(ring+grain+band));
   textureData.data[i*4]=v;textureData.data[i*4+1]=v;
   textureData.data[i*4+2]=v;textureData.data[i*4+3]=255;
 }
 cx.putImageData(textureData,0,0);
 const surfaceMap=new THREE.CanvasTexture(c);
 surfaceMap.wrapS=surfaceMap.wrapT=THREE.RepeatWrapping;
 surfaceMap.repeat.set(2,2);
 surfaceMap.colorSpace=THREE.NoColorSpace;
 const material=new THREE.MeshPhysicalMaterial({
  color,metalness:metallic?.56:.09,roughness:metallic?.24:.13,
  bumpMap:surfaceMap,bumpScale:isGrainy?.045:isStriped?.019:.012,roughnessMap:surfaceMap,
  transmission:metallic?0:(['quartz','fluorite','halite','sylvite','calcite','gypsum','sulfur'].includes(mineral.id)?.32:.08),
  thickness:.9,ior:1.48,clearcoat:1,clearcoatRoughness:.09,
  emissive:color.clone().multiplyScalar(.10),emissiveIntensity:.21,
  transparent:true,opacity:.96,side:THREE.DoubleSide,flatShading:true
 });
 const make=(geo,x,y,z,sz=1,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.setScalar(sz);
  m.rotation.set(rx,ry,rz);group.add(m);return m
 };
 function rhombo(){
  const verts=[[-.75,-1,-.75],[.75,-1,-.75],[.75,1,-.75],[-.75,1,-.75],[-.75,-1,.75],[.75,-1,.75],[.75,1,.75],[-.75,1,.75]].map(([x,y,z])=>[x+.35*y,y,z+.14*y]);
  const faces=[[0,1,2],[0,2,3],[4,7,6],[4,6,5],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
  const v=[];for(const face of faces)for(const i of face)v.push(...verts[i]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
 }
 function hexTerm(){
  const coords=[],faces=[];for(let i=0;i<6;i++){const t=i*Math.PI/3;coords.push([Math.cos(t)*.62,-.78,Math.sin(t)*.62])}
  for(let i=0;i<6;i++){const t=i*Math.PI/3;coords.push([Math.cos(t)*.62,.75,Math.sin(t)*.62])}
  coords.push([0,1.65,0]);coords.push([0,-.78,0]);
  for(let i=0;i<6;i++){const j=(i+1)%6;faces.push([i,j,6+j],[i,6+j,6+i],[6+i,6+j,12],[13,j,i])}
  const v=[];for(const f of faces)for(const id of f)v.push(...coords[id]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g
 }
 let core;
 switch(style){
 case 'rhombo':
  core=rhombo();make(core,0,0,0,1.05,.1,.12,.06);
  for(let i=0;i<3;i++)make(core,(rand()-.5)*1.7,-.36+(rand()-.5)*.4,(rand()-.5)*1.45,.48+rand()*.26,rand(),rand(),rand());break;
 case 'pyrite':
 case 'cubic':
  core=new THREE.BoxGeometry(1.65,1.65,1.65);
  make(core,0,0,0,1,0,.14,0);
  for(let i=0;i<(style==='pyrite'?5:4);i++)make(core,(rand()-.5)*1.8,-.65+rand()*.7,(rand()-.5)*1.8,.36+rand()*.4,0,rand()*.3,0);break;
 case 'octa':
  core=new THREE.OctahedronGeometry(1.25,0);make(core,0,0,0,1);
  for(let i=0;i<4;i++)make(core,(rand()-.5)*1.7,(rand()-.5)*1.35,(rand()-.5)*1.5,.35+rand()*.3,rand(),rand(),rand());break;
 case 'tetra':
  core=new THREE.TetrahedronGeometry(1.23,0);make(core,0,0,0,1,0,.1,0);
  for(let i=0;i<5;i++)make(core,(rand()-.5)*2,(rand()-.5)*1.2,(rand()-.5)*1.65,.34+rand()*.4,rand(),rand(),rand());break;
 case 'quartz':
 case 'sulfur':
  core=hexTerm();make(core,0,0,0,1.05,0,.12,0);
  for(let i=0;i<8;i++)make(core,(rand()-.5)*2.5,-.4+(rand()-.5)*.6,(rand()-.5)*2,.35+rand()*.5,0,rand()*6.28,(rand()-.5)*.24);break;
 case 'needles':
 case 'blades':
  core=new THREE.CylinderGeometry(style==='blades'?.3:.12,style==='blades'?.36:.18,2.7,style==='blades'?4:6,1);
  for(let i=0;i<15;i++){const x=(rand()-.5)*1.55,z=(rand()-.5)*1.45,h=.5+rand()*.72;make(core,x,(h-1)*.6,z,h,(rand()-.5)*.35,rand()*6.28,(rand()-.5)*.38)}break;
 case 'botryoidal':
  core=new THREE.SphereGeometry(.5,14,10);
  for(let i=0;i<24;i++){const a=i*2.4,r=Math.sqrt(i/24)*1.28;make(core,Math.cos(a)*r,(rand()-.5)*.55,Math.sin(a)*r,.55+rand()*.48)}break;
 case 'plates':
  core=new THREE.CylinderGeometry(.95,.95,.23,6,1);
  for(let i=0;i<8;i++)make(core,(rand()-.5)*1.4,(rand()-.5)*1,(rand()-.5)*1.2,.5+rand()*.4,rand()*.6,rand()*6.28,rand()*.3);break;
 default:
  core=new THREE.IcosahedronGeometry(1.3,0);make(core,0,0,0,1);
 }
 group.userData={mineralId:mineral.id,style,surfaceMap,source:'결정 습성 기반 교육용 외형 모델 (실제 개별 표본 스캔 아님)'};
 group.scale.setScalar(.0001);
 return group;
}
window.MineralMorphology={create,kindOf,TYPE};
})();