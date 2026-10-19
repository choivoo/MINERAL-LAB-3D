import * as THREE from 'three';
/* MINERAL LAB 5 · dual-lens learning view. CIF atoms are displayed only when
   source verified; procedural specimen is clearly distinguished from scan. */
const app=window.mineralAppState;
const morph=window.MineralMorphology;
const stage=document.getElementById('stageWrap');
const tabs=document.querySelector('.stage-tabs');
if(!app||!morph||!stage||!tabs)throw Error('MINERAL LAB core unavailable');
const button=document.createElement('button');
button.id='compareTab';button.type='button';button.textContent='🔬 격자 + 실물형 3D';
button.setAttribute('aria-selected','false');tabs.appendChild(button);
const surface=document.createElement('div');surface.id='compareMount';
surface.innerHTML='<div class="compare-head"><span id="structureProof">원자 격자</span><span>3D 광물 표본 · 결정 습성 기반 모형</span></div><div class="compare-footer">좌측: 원자 배치(CIF 검증 여부 명시) · 우측: 대표 결정 외형(스캔 아님) · 한 손가락 회전 / 두 손가락 확대</div>';
stage.appendChild(surface);
button.addEventListener('click',()=>app.changeMode('compare'));
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.26;
surface.appendChild(renderer.domElement);renderer.domElement.style.touchAction='none';
const worldL=new THREE.Scene(),worldR=new THREE.Scene();
worldL.background=new THREE.Color('#123547');worldR.background=new THREE.Color('#122b3c');
const camL=new THREE.PerspectiveCamera(46,1,.1,100);
const camR=new THREE.PerspectiveCamera(46,1,.1,100);
for(const scene of [worldL,worldR]){
 scene.add(new THREE.HemisphereLight(0xe1fcff,0x31444d,2.1));
 const a=new THREE.DirectionalLight(0xffffff,3);a.position.set(-4,6,8);scene.add(a);
 const b=new THREE.DirectionalLight(0x77c9e6,1.6);b.position.set(6,-1,-4);scene.add(b);
 const c=new THREE.PointLight(0xffd5a6,26,24);c.position.set(2,4,2);scene.add(c);
}
const leftGroup=new THREE.Group(),rightGroup=new THREE.Group();
worldL.add(leftGroup);worldR.add(rightGroup);
let key='',nodes=[],lines=[],accurate=false,shape=null;
let yaw=.52,pitch=.27,distance=8.1;
const sphere=new THREE.SphereGeometry(.13,18,12);
const bondMat=new THREE.LineBasicMaterial({color:0x82d8e1,transparent:true,opacity:.53});
function disposeGroup(group){
 for(const node of [...group.children]){
  group.remove(node);node.traverse(x=>{
   if(x.geometry&&x.geometry!==sphere)x.geometry.dispose();
   if(x.material&&x.material!==bondMat){
    for(const m of (Array.isArray(x.material)?x.material:[x.material])){
      if(m.map)m.map.dispose();if(m.bumpMap&&m.bumpMap!==m.map)m.bumpMap.dispose();m.dispose();
    }
   }
  });
 }
}
function rebuild(){
 const st=app.get(),str=st.structure;
 if(!str)return;
 const newKey=st.current.id+'|'+st.cellCount+'|'+str.accurate+'|'+str.atoms.length;
 if(key===newKey)return;
 key=newKey;disposeGroup(leftGroup);disposeGroup(rightGroup);nodes=[];lines=[];
 const samples=str.atoms,limit=520,stride=Math.max(1,Math.ceil(samples.length/limit));
 const slice=samples.filter((_,i)=>i%stride===0),center=str.bounds/2;
 const map=new Map();
 for(let i=0;i<slice.length;i++){
  const atom=slice[i],position=new THREE.Vector3(atom.x-center,atom.y-center,atom.z-center);
  const n=new THREE.Mesh(sphere,new THREE.MeshPhysicalMaterial({
   color:app.COLORS[atom.symbol]||'#a5cada',roughness:.13,metalness:.1,clearcoat:1,clearcoatRoughness:.12,
   emissive:app.COLORS[atom.symbol]||'#a5cada',emissiveIntensity:.08
  }));
  const radius=.09+(atom.symbol==='O'?.01:.035);
  n.scale.setScalar(radius/.13);
  n.position.copy(position);leftGroup.add(n);
  const near=position.length();
  const random=Math.sin(i*16.739+near*12.31)*.095;
  nodes.push({mesh:n,dist:near+random,base:radius/.13});map.set(samples.indexOf(atom),i);
 }
 // A crystal nucleates near center and expands outward; not a kinetics model.
 const distances=nodes.map(p=>p.dist).sort((a,b)=>a-b);
 const min=distances[0]??0,max=distances[distances.length-1]??1;
 for(const node of nodes)node.front=(node.dist-min)/Math.max(.0001,max-min);
 if(samples.length<=520&&str.bonds.length<5000){
  for(const [a,b] of str.bonds){
   const ia=map.get(a),ib=map.get(b);
   if(ia===undefined||ib===undefined)continue;
   const A=nodes[ia].mesh.position,B=nodes[ib].mesh.position;
   const geo=new THREE.BufferGeometry().setFromPoints([A,B]);
   const mat=bondMat.clone();mat.color.setHex(0x86d8e9);
   const ln=new THREE.Line(geo,mat);
   leftGroup.add(ln);lines.push({mesh:ln,a:ia,b:ib});
  }
 }
 shape=morph.create(THREE,st.current);shape.scale.setScalar(1);rightGroup.add(shape);
 accurate=!!str.accurate;
 const proof=document.getElementById('structureProof');
 const rec=window.COD_CRYSTALS?.[st.current.id];
 const source=rec?.sourceId?'COD #'+rec.sourceId:(accurate?'문헌 기반 격자':'화학식 반복 개념도');
 proof.textContent=accurate?'원자 구조 · '+source:'원자 구조 미검증 · 화학식 개념도';
 proof.style.color=accurate?'#a3f6d8':'#ffdd8a';
 camL.position.set(0,1.5,Math.max(7,str.bounds*1.7));
}
function updateGrowth(){
 const st=app.get(),t=st.phase==='forming'?Math.max(.003,st.grow/100):1;
 const eased=t*t*(3-2*t);
 for(const node of nodes){
  const active=eased>=node.front;
  node.mesh.visible=active;
  node.mesh.scale.setScalar(active?node.base*Math.min(1,(eased-node.front)*35+.2):.001);
 }
 for(const bond of lines)bond.mesh.visible=st.showBonds&&eased>=Math.max(nodes[bond.a].front,nodes[bond.b].front);
 if(shape){
  // Macro-habit growth begins after nucleus/lattice formation.
  const p=Math.max(0,(t-.32)/.68),growth=p*p*(3-2*p);
  shape.scale.setScalar(Math.max(.001,growth));
  shape.visible=st.phase!=='forming'||t>.32;
 }
}
let pointer=null,touches=new Map(),startPinch=0,startDistance=0,latestWidth=0,latestHeight=0;
renderer.domElement.addEventListener('pointerdown',e=>{
 touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 renderer.domElement.setPointerCapture(e.pointerId);
 if(touches.size===1)pointer={x:e.clientX,y:e.clientY};
 if(touches.size===2){const p=[...touches.values()];startPinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);startDistance=distance}
 e.preventDefault();
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(!touches.has(e.pointerId))return;
 const old=touches.get(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(touches.size===2&&startPinch){
  const p=[...touches.values()],span=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  distance=THREE.MathUtils.clamp(startDistance*startPinch/Math.max(span,1),3.7,23);
 }else if(touches.size===1&&pointer){
  yaw+=(e.clientX-old.x)*.008;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-old.y)*.007,-1.25,1.25);
 }
 e.preventDefault();
});
for(const ev of ['pointerup','pointercancel'])renderer.domElement.addEventListener(ev,e=>{touches.delete(e.pointerId);if(touches.size===0)pointer=null});
renderer.domElement.addEventListener('wheel',e=>{distance=THREE.MathUtils.clamp(distance+e.deltaY*.008,3.7,23);e.preventDefault()},{passive:false});
function visibility(){
 const active=app.get().mode==='compare';
 surface.style.display=active?'block':'none';
 button.classList.toggle('active',active);
 button.setAttribute('aria-selected',String(active));
 if(active)rebuild();
}
window.addEventListener('mineral:updated',()=>{key='';visibility()});
window.addEventListener('mineral:mode',visibility);
const clock=new THREE.Clock();
function frame(){
 requestAnimationFrame(frame);
 if(app.get().mode!=='compare')return;
 const width=surface.clientWidth,height=surface.clientHeight;
 if(width<10||height<10)return;
 if(width!==latestWidth||height!==latestHeight){
  latestWidth=width;latestHeight=height;
  renderer.setSize(width,height,false);
 }
 rebuild();updateGrowth();
 const dt=Math.min(clock.getDelta(),.05);
 const st=app.get();if(st.autoSpin)yaw+=dt*.2*st.speed;
 for(const [cam,group] of [[camL,leftGroup],[camR,rightGroup]]){
  const r=cam===camL?Math.max(distance,(st.structure?.bounds||2)*1.8):distance*.86;
  cam.position.set(Math.sin(yaw)*Math.cos(pitch)*r,Math.sin(pitch)*r,Math.cos(yaw)*Math.cos(pitch)*r);
  cam.lookAt(0,0,0);
  cam.aspect=Math.max(.2,(width/2)/height);cam.updateProjectionMatrix();
  group.rotation.y=0;
 }
 renderer.setScissorTest(true);
 for(const [scene,cam,x,w] of [[worldL,camL,0,Math.floor(width/2)],[worldR,camR,Math.floor(width/2),Math.ceil(width/2)]]){
  renderer.setViewport(x,0,w,height);renderer.setScissor(x,0,w,height);renderer.render(scene,cam);
 }
 renderer.setScissorTest(false);
}
visibility();frame();
