(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const gameCard = document.getElementById('gameCard');
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const bestEl = document.getElementById('best');
  const positionEl = document.getElementById('position');
  const nitroFill = document.getElementById('nitroFill');
  const nitroText = document.getElementById('nitroText');
  const raceFill = document.getElementById('raceFill');
  const raceText = document.getElementById('raceText');
  const comboEl = document.getElementById('combo');
  const airText = document.getElementById('airText');
  const overlay = document.getElementById('overlay');
  const overlayIcon = document.getElementById('overlayIcon');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
  renderer.setSize(960, 600, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7bc5ef);
  scene.fog = new THREE.Fog(0x91c5df, 95, 520);

  const camera = new THREE.PerspectiveCamera(62, 960 / 600, .1, 1100);
  camera.position.set(0, 7.2, 18);

  const hemi = new THREE.HemisphereLight(0xe7f7ff, 0x465b46, 1.28);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffefd2, 1.5);
  sun.position.set(55, 90, 42);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  scene.add(sun);

  const ROAD_WIDTH = 22;
  const ROAD_HALF = ROAD_WIDTH / 2;
  const PLAYER_Z = 9;
  const RACE_LENGTH = 4500;
  const SEGMENT_LENGTH = 40;
  const SEGMENT_COUNT = 16;
  const WORLD_LENGTH = SEGMENT_LENGTH * SEGMENT_COUNT;

  const keys = Object.create(null);
  const roadSegments = [];
  const scenery = [];
  const traffic = [];
  const rivals = [];
  const ramps = [];
  const streaks = [];
  const smokeParticles = [];
  const sparkParticles = [];
  const neonProps = [];

  let nitroLight;

  let playerCar;
  let running = false;
  let last = 0;
  let score = 0;
  let speed = 0;
  let playerX = 0;
  let steerVisual = 0;
  let distance = 0;
  let nitro = 100;
  let spawnTimer = 1;
  let rampTimer = 5;
  let jumpY = 0;
  let jumpV = 0;
  let wasAirborne = false;
  let driftTime = 0;
  let comboTimer = 0;
  let crashCooldown = 0;
  let raceFinished = false;

  function makeCar(color, scale = 1) {
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: .3,
      metalness: .28
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x153c52,
      roughness: .13,
      metalness: .25,
      transparent: true,
      opacity: .9
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0d1217,
      roughness: .55,
      metalness: .32
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x050607,
      roughness: .95
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xc4d0d8,
      roughness: .2,
      metalness: .78
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xff2846,
      emissive: 0x650009
    });

    const lower = new THREE.Mesh(new THREE.BoxGeometry(3.65, .8, 6.5), bodyMat);
    lower.position.y = 1.0;
    lower.castShadow = true;
    g.add(lower);

    const sideL = new THREE.Mesh(new THREE.BoxGeometry(.34, .38, 4.5), bodyMat);
    sideL.position.set(-1.82, 1.44, .15);
    sideL.castShadow = true;
    g.add(sideL);

    const sideR = sideL.clone();
    sideR.position.x = 1.82;
    g.add(sideR);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(3.3, .44, 1.8), bodyMat);
    hood.position.set(0, 1.56, -2.2);
    hood.castShadow = true;
    g.add(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.18, 2.85), glassMat);
    cabin.position.set(0, 1.92, -.05);
    cabin.castShadow = true;
    g.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.65, .16, 2.35), darkMat);
    roof.position.set(0, 2.56, -.02);
    g.add(roof);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.65, .13, .34), darkMat);
    spoiler.position.set(0, 1.9, 2.95);
    g.add(spoiler);

    const spoilerLegGeo = new THREE.BoxGeometry(.12, .42, .12);
    [-.9,.9].forEach(x => {
      const leg = new THREE.Mesh(spoilerLegGeo, darkMat);
      leg.position.set(x, 1.72, 2.86);
      g.add(leg);
    });

    const wheelGeo = new THREE.CylinderGeometry(.56, .56, .46, 16);
    const rimGeo = new THREE.CylinderGeometry(.28, .28, .48, 16);
    const wheels = [
      [-1.77,.63,-1.85],[1.77,.63,-1.85],
      [-1.77,.63,1.88],[1.77,.63,1.88]
    ];

    const wheelMeshes = [];
    wheels.forEach(([x,y,z]) => {
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x,y,z);
      tire.castShadow = true;
      g.add(tire);
      wheelMeshes.push(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x,y,z);
      g.add(rim);
    });

    [-1.08,1.08].forEach(x => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(.7,.23,.14), redMat);
      tail.position.set(x,1.2,3.28);
      g.add(tail);
    });

    const headlightMat = new THREE.MeshBasicMaterial({ color:0xf3fbff });
    [-1.08,1.08].forEach(x => {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.72,.20,.12), headlightMat);
      lamp.position.set(x,1.18,-3.29);
      g.add(lamp);
    });

    const diffuser = new THREE.Mesh(
      new THREE.BoxGeometry(2.45,.18,.26),
      new THREE.MeshStandardMaterial({ color:0x151a20,roughness:.38,metalness:.55 })
    );
    diffuser.position.set(0,.72,3.28);
    g.add(diffuser);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x42dcff,
      transparent: true,
      opacity: .86
    });

    const flames = [];
    [-.82,.82].forEach(x => {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(.2,1.25,10), flameMat);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x,.84,3.75);
      flame.visible = false;
      g.add(flame);
      flames.push(flame);
    });

    g.scale.setScalar(scale);
    g.userData.halfW = 1.8 * scale;
    g.userData.halfL = 3.2 * scale;
    g.userData.wheels = wheelMeshes;
    g.userData.flames = flames;
    return g;
  }

  function makeRoadSegment(z) {
    const group = new THREE.Group();
    group.position.z = z;

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: .98 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d7548, roughness: 1 });
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x686c70, roughness: .95 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xefe8cf });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf7f7f7 });

    const ground = new THREE.Mesh(new THREE.BoxGeometry(120,.2,SEGMENT_LENGTH), grassMat);
    ground.position.y = -.14;
    ground.receiveShadow = true;
    group.add(ground);

    const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH,.28,SEGMENT_LENGTH), roadMat);
    road.position.y = 0;
    road.receiveShadow = true;
    group.add(road);

    [-ROAD_HALF-.72, ROAD_HALF+.72].forEach(x => {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.35,.16,SEGMENT_LENGTH), shoulderMat);
      shoulder.position.set(x,.03,0);
      shoulder.receiveShadow = true;
      group.add(shoulder);
    });

    [-ROAD_HALF+.18, ROAD_HALF-.18].forEach(x => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(.18,.04,SEGMENT_LENGTH), edgeMat);
      edge.position.set(x,.17,0);
      group.add(edge);
    });

    const curbRed = new THREE.MeshBasicMaterial({ color:0xd92f3b });
    const curbWhite = new THREE.MeshBasicMaterial({ color:0xf1f2f2 });
    for (let d=-18; d<=18; d+=4) {
      [-ROAD_HALF-.12,ROAD_HALF+.12].forEach(x => {
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(.55,.08,3.6),
          ((d/4)%2===0 ? curbRed : curbWhite)
        );
        curb.position.set(x,.18,d);
        group.add(curb);
      });
    }

    [-ROAD_WIDTH/6, ROAD_WIDTH/6].forEach(laneX => {
      for (let d=-16; d<=16; d+=8) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(.15,.04,4), lineMat);
        dash.position.set(laneX,.18,d);
        group.add(dash);
      }
    });

    scene.add(group);
    roadSegments.push(group);
  }

  function addRoad() {
    for (let i=0; i<SEGMENT_COUNT; i++) {
      makeRoadSegment(-i * SEGMENT_LENGTH);
    }

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x9aa1a6,
      roughness: .62,
      metalness: .4
    });

    for (let i=0; i<82; i++) {
      const z = -i * 8;
      [-ROAD_HALF-1.2, ROAD_HALF+1.2].forEach(x => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(.16,.28,7.6), barrierMat);
        rail.position.set(x,.72,z);
        scene.add(rail);
        scenery.push({ mesh:rail, wrap:656 });
      });
    }
  }

  function addScenery() {
    const trunkMat = new THREE.MeshStandardMaterial({ color:0x6c4933, roughness:1 });
    const leafMat = new THREE.MeshStandardMaterial({ color:0x386b3b, roughness:1 });
    const rockMat = new THREE.MeshStandardMaterial({ color:0x737a80, roughness:1 });
    const buildingMats = [
      new THREE.MeshStandardMaterial({color:0x526c7d,roughness:.86}),
      new THREE.MeshStandardMaterial({color:0x76625a,roughness:.86}),
      new THREE.MeshStandardMaterial({color:0x555d70,roughness:.86})
    ];

    for (let i=0; i<72; i++) {
      const z = -20 - i*9.5;
      const side = i%2===0 ? -1 : 1;
      const x = side * (17 + (i%5)*4.2);

      if (i%5===0) {
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(8+(i%3)*2, 16+(i%4)*6, 9),
          buildingMats[i%buildingMats.length]
        );
        building.position.set(x, building.geometry.parameters.height/2, z);
        building.castShadow = true;
        scene.add(building);
        scenery.push({mesh:building,wrap:680});
      } else if (i%4===0) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(2.2+(i%3)*.35,0),
          rockMat
        );
        rock.scale.y=.7;
        rock.position.set(x,1.2,z);
        rock.castShadow=true;
        scene.add(rock);
        scenery.push({mesh:rock,wrap:680});
      } else {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.32,.42,3,8),trunkMat);
        trunk.position.y=1.5;
        tree.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.0,5,9),leafMat);
        crown.position.y=4.9;
        tree.add(crown);
        tree.position.set(x,0,z);
        scene.add(tree);
        scenery.push({mesh:tree,wrap:680});
      }
    }

    const mountainMat = new THREE.MeshStandardMaterial({ color:0x687988,roughness:1 });
    for(let i=0;i<16;i++){
      const m=new THREE.Mesh(
        new THREE.ConeGeometry(18+(i%4)*5,28+(i%3)*8,6),
        mountainMat
      );
      const side=i%2===0?-1:1;
      m.position.set(side*(48+(i%4)*13),13,-100-i*32);
      m.rotation.y=i*.37;
      scene.add(m);
    }

    const neonColors=[0x13e8ff,0xff315d,0xa85cff];
    for(let i=0;i<12;i++){
      const signMat = new THREE.MeshBasicMaterial({
        color:neonColors[i%neonColors.length],
        transparent:true,
        opacity:.92
      });
      const sign=new THREE.Mesh(new THREE.BoxGeometry(6.5,.16,1.9),signMat);
      sign.rotation.x=-Math.PI/2;
      sign.position.set((i%2===0?-1:1)*(15+(i%3)*2.5),5.3,-55-i*54);
      scene.add(sign);
      scenery.push({mesh:sign,wrap:680});
      neonProps.push(sign);
    }

    const poleMat=new THREE.MeshStandardMaterial({color:0x333b43,roughness:.48,metalness:.62});
    const bulbMat=new THREE.MeshBasicMaterial({color:0xe7f6ff});
    for(let i=0;i<34;i++){
      const z=-18-i*19;
      [-14.2,14.2].forEach((x,sideIndex)=>{
        const lamp=new THREE.Group();
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,5.5,8),poleMat);
        pole.position.y=2.75;
        lamp.add(pole);
        const arm=new THREE.Mesh(new THREE.BoxGeometry(1.5,.08,.08),poleMat);
        arm.position.set(sideIndex===0?.7:-.7,5.2,0);
        lamp.add(arm);
        const bulb=new THREE.Mesh(new THREE.BoxGeometry(.48,.12,.28),bulbMat);
        bulb.position.set(sideIndex===0?1.35:-1.35,5.14,0);
        lamp.add(bulb);
        lamp.position.set(x,0,z);
        scene.add(lamp);
        scenery.push({mesh:lamp,wrap:680});
      });
    }
  }

  function addSpeedStreaks() {
    const mat = new THREE.MeshBasicMaterial({
      color:0x8beeff,
      transparent:true,
      opacity:.55
    });

    for(let i=0;i<24;i++){
      const s=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,4+Math.random()*5),mat);
      s.position.set(
        (Math.random()>.5?1:-1)*(6+Math.random()*12),
        1+Math.random()*9,
        -10-Math.random()*50
      );
      s.visible=false;
      scene.add(s);
      streaks.push(s);
    }
  }

  function initEffects() {
    const smokeMat = new THREE.MeshBasicMaterial({
      color:0xd7dbe0,
      transparent:true,
      opacity:0,
      depthWrite:false
    });
    for(let i=0;i<28;i++){
      const p=new THREE.Mesh(new THREE.SphereGeometry(.28,7,5),smokeMat.clone());
      p.visible=false;
      scene.add(p);
      smokeParticles.push({mesh:p,life:0,vx:0,vz:0,scale:1});
    }

    const sparkMat = new THREE.MeshBasicMaterial({
      color:0xffc04b,
      transparent:true,
      opacity:0,
      depthWrite:false
    });
    for(let i=0;i<36;i++){
      const p=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.45),sparkMat.clone());
      p.visible=false;
      scene.add(p);
      sparkParticles.push({mesh:p,life:0,vx:0,vy:0,vz:0});
    }

    nitroLight=new THREE.PointLight(0x21dfff,0,10);
    nitroLight.position.set(0,.9,3.9);
    playerCar.add(nitroLight);
  }

  function emitSmoke() {
    const p=smokeParticles.find(s=>s.life<=0);
    if(!p) return;

    const side=Math.random()>.5?-1:1;
    p.life=.55+Math.random()*.35;
    p.vx=(Math.random()-.5)*1.4;
    p.vz=2.2+Math.random()*2.4;
    p.scale=.75+Math.random()*.65;
    p.mesh.position.set(
      playerCar.position.x+side*1.45,
      .45+jumpY,
      PLAYER_Z+2.3+Math.random()*.7
    );
    p.mesh.scale.setScalar(p.scale);
    p.mesh.material.opacity=.34;
    p.mesh.visible=true;
  }

  function burstSparks(x,z,count=10) {
    let emitted=0;
    for(const p of sparkParticles){
      if(p.life>0) continue;
      p.life=.28+Math.random()*.3;
      p.vx=(Math.random()-.5)*13;
      p.vy=2+Math.random()*7;
      p.vz=(Math.random()-.5)*10;
      p.mesh.position.set(x,.75+jumpY,z);
      p.mesh.rotation.z=Math.random()*Math.PI;
      p.mesh.material.opacity=1;
      p.mesh.visible=true;
      emitted++;
      if(emitted>=count) break;
    }
  }

  function updateEffects(dt,drifting,nitroActive) {
    if(drifting && speed>110 && Math.random()<dt*22) emitSmoke();

    smokeParticles.forEach(p=>{
      if(p.life<=0) return;
      p.life-=dt;
      p.mesh.position.x+=p.vx*dt;
      p.mesh.position.z+=p.vz*dt;
      p.mesh.position.y+=.45*dt;
      const grow=1+dt*1.8;
      p.mesh.scale.multiplyScalar(grow);
      p.mesh.material.opacity=Math.max(0,p.life*.42);
      if(p.life<=0) p.mesh.visible=false;
    });

    sparkParticles.forEach(p=>{
      if(p.life<=0) return;
      p.life-=dt;
      p.vy-=14*dt;
      p.mesh.position.x+=p.vx*dt;
      p.mesh.position.y+=p.vy*dt;
      p.mesh.position.z+=p.vz*dt;
      p.mesh.material.opacity=Math.max(0,p.life*2.4);
      if(p.mesh.position.y<.05) p.mesh.position.y=.05;
      if(p.life<=0) p.mesh.visible=false;
    });

    if(nitroLight){
      nitroLight.intensity=nitroActive ? 3.2 : 0;
      nitroLight.distance=nitroActive ? 12 : 0;
    }
  }

  function spawnTraffic() {
    if (traffic.length > 11) return;

    const colors=[0xff4459,0x42bfff,0xffcc52,0x8468ff,0x62d78f,0xf1f1f1,0x24282f];
    const lanes=[-7,-3.5,0,3.5,7];
    const car=makeCar(colors[Math.floor(Math.random()*colors.length)], .9+Math.random()*.08);
    const lane=lanes[Math.floor(Math.random()*lanes.length)];

    car.position.set(lane,0,-170-Math.random()*180);
    car.rotation.y=Math.PI;
    scene.add(car);

    traffic.push({
      mesh:car,
      speed:75+Math.random()*95,
      halfW:car.userData.halfW,
      halfL:car.userData.halfL,
      passed:false
    });
  }

  function spawnRamp() {
    if (ramps.length >= 2) return;

    const lanes=[-6,0,6];
    const x=lanes[Math.floor(Math.random()*lanes.length)];
    const mat=new THREE.MeshStandardMaterial({
      color:0xff9d2f,
      roughness:.55,
      metalness:.25
    });

    const ramp=new THREE.Mesh(new THREE.BoxGeometry(4.7,.65,8),mat);
    ramp.position.set(x,.35,-230-Math.random()*90);
    ramp.rotation.x=-.12;
    ramp.castShadow=true;
    ramp.receiveShadow=true;
    scene.add(ramp);

    ramps.push({
      mesh:ramp,
      triggered:false
    });
  }

  function createRivals() {
    const colors=[
      0x00c8ff,0xffc23d,0x8e68ff,0x45dc82,0xff5f72,
      0xf4f4f4,0x24d6c8,0xff8b35,0x5068ff,0xff3fd2,
      0x7cff4f,0x35a7ff
    ];
    const lanes=[-8,-4,0,4,8];

    for(let i=0;i<49;i++){
      const color=colors[i%colors.length];
      const lane=lanes[i%lanes.length];
      const start=18+(i*16);
      const cruiseSpeed=248+(i%9)*3;

      const car=makeCar(color,.92+((i%4)*.012));
      car.position.set(lane,0,PLAYER_Z-start/2.5);
      car.rotation.y=0;
      scene.add(car);

      rivals.push({
        mesh:car,
        distance:start,
        speed:0,
        cruiseSpeed,
        lane,
        targetLane:lane,
        changeTimer:1.5+(i%5)*.55
      });
    }
  }

  function setCombo(text) {
    comboEl.textContent=text;
    comboEl.classList.add('show');
    comboTimer=1.15;
  }

  function best() {
    bestEl.textContent=localStorage.getItem('vertexRacingBestNitro')||'0';
  }

  function showOverlay(icon,title,text,button,onClick){
    overlayIcon.textContent=icon;
    overlayTitle.textContent=title;
    overlayText.textContent=text;
    startBtn.textContent=button;
    startBtn.onclick=onClick;
    overlay.classList.add('show');
  }

  function updateHud() {
    scoreEl.textContent=Math.floor(score);
    speedEl.textContent=Math.floor(speed);

    nitroFill.style.width=Math.max(0,Math.min(100,nitro))+'%';
    nitroText.textContent=Math.floor(nitro)+'%';

    const progress=Math.max(0,Math.min(100,(distance/RACE_LENGTH)*100));
    raceFill.style.width=progress+'%';
    raceText.textContent=Math.floor(progress)+'%';

    const ahead=rivals.filter(r=>r.distance>distance).length;
    positionEl.textContent=(ahead+1)+' / 50';
  }

  function resetRivals() {
    const lanes=[-8,-4,0,4,8];

    rivals.forEach((r,i)=>{
      const lane=lanes[i%lanes.length];
      const start=18+(i*16);

      r.distance=start;
      r.speed=0;
      r.cruiseSpeed=248+(i%9)*3;
      r.lane=lane;
      r.targetLane=lane;
      r.changeTimer=1.5+(i%5)*.55;
      r.mesh.visible=true;
      r.mesh.position.set(lane,0,PLAYER_Z-start/2.5);
      r.mesh.rotation.set(0,0,0);
    });
  }

  function clearDynamic() {
    traffic.forEach(t=>scene.remove(t.mesh));
    traffic.length=0;
    ramps.forEach(r=>scene.remove(r.mesh));
    ramps.length=0;
  }

  function reset(){
    running=false;
    raceFinished=false;
    score=0;
    speed=0;
    playerX=0;
    steerVisual=0;
    distance=0;
    nitro=100;
    spawnTimer=.7;
    rampTimer=4.2;
    jumpY=0;
    jumpV=0;
    wasAirborne=false;
    driftTime=0;
    comboTimer=0;
    crashCooldown=0;

    clearDynamic();
    resetRivals();

    playerCar.position.set(0,0,PLAYER_Z);
    playerCar.rotation.set(0,0,0);
    playerCar.userData.flames.forEach(f=>f.visible=false);

    gameCard.classList.remove('nitro-active');
    comboEl.classList.remove('show');
    airText.classList.remove('show');

    updateHud();
    best();

    showOverlay(
      '🏁',
      'Vertex Racing: Nitro Rush',
      'سباق آركيد سريع: نيترو، درفت، قفزات و49 منافسًا حتى خط النهاية.',
      'ابدأ السباق',
      start
    );

    renderer.render(scene,camera);
  }

  function start(){
    overlay.classList.remove('show');
    running=true;
    raceFinished=false;
    last=performance.now();
    requestAnimationFrame(loop);
  }

  function finishRace(){
    if(raceFinished) return;
    raceFinished=true;
    running=false;

    const ahead=rivals.filter(r=>r.distance>distance).length;
    const place=ahead+1;
    const bonus=Math.max(0,(51-place)*80);
    score+=bonus;

    const finalScore=Math.floor(score);
    const old=Number(localStorage.getItem('vertexRacingBestNitro')||0);
    if(finalScore>old) localStorage.setItem('vertexRacingBestNitro',String(finalScore));
    best();

    const placeText=place===1?'الأول 🏆':place===2?'الثاني 🥈':place===3?'الثالث 🥉':'المركز '+place;

    showOverlay(
      place===1?'🏆':'🏁',
      'وصلت خط النهاية',
      'مركزك: '+placeText+' — نتيجتك: '+finalScore,
      'سباق جديد',
      ()=>{reset();start();}
    );
  }

  function trafficCollision(t,nitroActive){
    if(crashCooldown>0) return false;

    const dx=Math.abs(playerCar.position.x-t.mesh.position.x);
    const dz=Math.abs(PLAYER_Z-t.mesh.position.z);
    const hit=dx<(1.6+t.halfW)&&dz<(2.75+t.halfL)&&jumpY<1.1;

    if(!hit) return false;

    crashCooldown=.9;

    if(nitroActive&&speed>220){
      t.mesh.rotation.z=(playerCar.position.x<t.mesh.position.x?-1:1)*1.1;
      t.mesh.position.x+=(playerCar.position.x<t.mesh.position.x?4:-4);
      t.speed=30;
      score+=240;
      nitro=Math.min(100,nitro+10);
      burstSparks((playerCar.position.x+t.mesh.position.x)/2,PLAYER_Z,18);
      setCombo('KNOCKDOWN +240');
    }else{
      speed*=.48;
      nitro=Math.max(0,nitro-20);
      score=Math.max(0,score-120);
      steerVisual+=(playerCar.position.x<t.mesh.position.x?-.28:.28);
      burstSparks((playerCar.position.x+t.mesh.position.x)/2,PLAYER_Z,14);
      setCombo('CRASH -120');
    }

    return true;
  }

  function updatePlayer(dt) {
    const gas=keys.ArrowUp||keys.KeyW;
    const brake=keys.ArrowDown||keys.KeyS;
    const left=keys.ArrowLeft||keys.KeyA;
    const right=keys.ArrowRight||keys.KeyD;
    const driftHeld=keys.ShiftLeft||keys.ShiftRight;
    const nitroHeld=keys.Space;

    const steer=(left?-1:0)+(right?1:0);
    const drifting=driftHeld&&steer!==0&&speed>95&&jumpY<.15;
    const nitroActive=nitroHeld&&nitro>0&&speed>45&&!drifting;

    if(gas) speed+=118*dt;
    else speed-=19*dt;

    if(brake) speed-=175*dt;

    if(drifting){
      driftTime+=dt;
      speed-=32*dt;
      nitro=Math.min(100,nitro+17*dt);
      score+=42*dt;
    }else{
      if(driftTime>.5){
        const bonus=Math.floor(driftTime*120);
        score+=bonus;
        setCombo('DRIFT +'+bonus);
      }
      driftTime=0;
    }

    if(nitroActive){
      speed+=205*dt;
      nitro-=27*dt;
      score+=30*dt;
    }else{
      nitro=Math.min(100,nitro+2.2*dt);
    }

    const maxSpeed=nitroActive?395:315;
    speed=THREE.MathUtils.clamp(speed,0,maxSpeed);

    const steerPower=4.4+speed/88+(drifting?2.3:0);
    playerX+=steer*steerPower*dt;

    if(Math.abs(playerX)>ROAD_HALF-2.0){
      speed-=120*dt;
    }

    playerX=THREE.MathUtils.clamp(playerX,-ROAD_HALF-4.7,ROAD_HALF+4.7);
    playerCar.position.x+=(playerX-playerCar.position.x)*Math.min(1,dt*13);

    const desiredSteer=steer*(drifting?.35:.17);
    steerVisual+=(desiredSteer-steerVisual)*Math.min(1,dt*(drifting?6:10));
    playerCar.rotation.z=-steerVisual;
    playerCar.rotation.y=-(drifting?steerVisual*1.65:steerVisual*.72);

    if(jumpY>0||jumpV>0){
      wasAirborne=true;
      jumpV-=16*dt;
      jumpY+=jumpV*dt;

      if(jumpY<=0){
        jumpY=0;
        jumpV=0;
        if(wasAirborne){
          score+=160;
          nitro=Math.min(100,nitro+18);
          setCombo('AIR TIME +160');
        }
        wasAirborne=false;
      }else{
        score+=32*dt;
        nitro=Math.min(100,nitro+5*dt);
      }
    }

    playerCar.position.y=jumpY;
    airText.classList.toggle('show',jumpY>.5);
    airText.textContent=jumpY>.5?'AIRBORNE ✈️':'';

    playerCar.userData.flames.forEach((f,i)=>{
      f.visible=nitroActive;
      if(nitroActive){
        const scale=.85+Math.sin(performance.now()*.02+i)*.22;
        f.scale.set(1,scale,1);
      }
    });

    gameCard.classList.toggle('nitro-active',nitroActive);
    streaks.forEach((s,i)=>{
      s.visible=nitroActive;
      if(nitroActive){
        s.position.z+=70*dt;
        if(s.position.z>20) s.position.z=-60-Math.random()*30;
      }
    });

    const wheelSpin=(speed/22)*dt;
    playerCar.userData.wheels.forEach(w=>w.rotation.x+=wheelSpin);

    return {nitroActive,drifting};
  }

  function updateWorld(dt) {
    const worldMove=(speed/3.6)*dt;

    roadSegments.forEach(seg=>{
      seg.position.z+=worldMove;
      if(seg.position.z>SEGMENT_LENGTH) seg.position.z-=WORLD_LENGTH;
    });

    scenery.forEach(s=>{
      s.mesh.position.z+=worldMove;
      if(s.mesh.position.z>45) s.mesh.position.z-=s.wrap;
    });

    distance+=(speed/3.6)*dt;
    score+=speed*dt*.055;
  }

  function updateTraffic(dt,nitroActive) {
    spawnTimer-=dt;

    if(spawnTimer<=0&&speed>55){
      spawnTraffic();
      spawnTimer=Math.max(.42,1.12-speed/560)+Math.random()*.32;
    }

    for(let i=traffic.length-1;i>=0;i--){
      const t=traffic[i];
      const relative=Math.max(7,(speed-t.speed)/3.6);
      const oldZ=t.mesh.position.z;
      t.mesh.position.z+=relative*dt;

      trafficCollision(t,nitroActive);

      if(!t.passed&&oldZ<PLAYER_Z&&t.mesh.position.z>=PLAYER_Z){
        t.passed=true;
        const dx=Math.abs(playerCar.position.x-t.mesh.position.x);

        if(dx<4.1&&!trafficCollision(t,nitroActive)){
          score+=110;
          nitro=Math.min(100,nitro+12);
          setCombo('NEAR MISS +110');
        }
      }

      if(t.mesh.position.z>42){
        scene.remove(t.mesh);
        traffic.splice(i,1);
      }
    }
  }

  function updateRamps(dt) {
    rampTimer-=dt;

    if(rampTimer<=0&&speed>110){
      spawnRamp();
      rampTimer=6+Math.random()*5;
    }

    const worldMove=(speed/3.6)*dt;

    for(let i=ramps.length-1;i>=0;i--){
      const r=ramps[i];
      r.mesh.position.z+=worldMove;

      if(!r.triggered&&jumpY<.1){
        const dx=Math.abs(playerCar.position.x-r.mesh.position.x);
        const dz=Math.abs(PLAYER_Z-r.mesh.position.z);

        if(dx<2.7&&dz<4.2){
          r.triggered=true;
          jumpV=9.2+speed/120;
          jumpY=.08;
          nitro=Math.min(100,nitro+8);
          setCombo('RAMP!');
        }
      }

      if(r.mesh.position.z>42){
        scene.remove(r.mesh);
        ramps.splice(i,1);
      }
    }
  }

  function updateRivals(dt) {
    const lanes=[-8,-4,0,4,8];

    rivals.forEach((r,i)=>{
      r.changeTimer-=dt;

      if(r.changeTimer<=0){
        const openLanes=lanes.filter(lane=>{
          return !rivals.some((other,j)=>
            j!==i &&
            Math.abs(other.distance-r.distance)<22 &&
            Math.abs(other.lane-lane)<2.2
          );
        });
        const choices=openLanes.length?openLanes:lanes;
        r.targetLane=choices[Math.floor(Math.random()*choices.length)];
        r.changeTimer=2.1+Math.random()*3.4;
      }

      r.lane+=(r.targetLane-r.lane)*Math.min(1,dt*1.2);

      let targetSpeed=r.cruiseSpeed+Math.sin(performance.now()*.0013+i)*6;

      // Keep rivals separated instead of bunching into one pack.
      const carAhead=rivals.find((other,j)=>
        j!==i &&
        other.distance>r.distance &&
        other.distance-r.distance<24 &&
        Math.abs(other.lane-r.lane)<2.2
      );
      if(carAhead) targetSpeed=Math.min(targetSpeed,carAhead.speed-10);

      const aiAcceleration=82;
      const maxStep=aiAcceleration*dt;
      r.speed+=THREE.MathUtils.clamp(targetSpeed-r.speed,-maxStep,maxStep);
      r.speed=THREE.MathUtils.clamp(r.speed,0,300);
      r.distance+=(r.speed/3.6)*dt;

      const rel=r.distance-distance;
      const z=PLAYER_Z-rel/2.5;

      r.mesh.position.x=r.lane;
      r.mesh.position.z=z;
      r.mesh.position.y=0;
      r.mesh.visible=z>-85&&z<52;

      const steerDelta=r.targetLane-r.lane;
      r.mesh.rotation.y=-steerDelta*.035;
      r.mesh.rotation.z=-steerDelta*.018;

      if(r.mesh.visible&&crashCooldown<=0&&jumpY<.8){
        const dx=Math.abs(playerCar.position.x-r.mesh.position.x);
        const dz=Math.abs(PLAYER_Z-r.mesh.position.z);

        if(dx<3.25&&dz<5.4){
          speed*=.72;
          score=Math.max(0,score-80);
          crashCooldown=.65;
          burstSparks((playerCar.position.x+r.mesh.position.x)/2,PLAYER_Z,10);
          setCombo('CONTACT');
        }
      }
    });
  }

  function updateCamera(dt,nitroActive,drifting) {
    const camTargetX=playerCar.position.x*.42;
    camera.position.x+=(camTargetX-camera.position.x)*Math.min(1,dt*5.2);
    camera.position.y=7.15+speed/205+jumpY*.36;
    camera.position.z=18.2+jumpY*.28;

    const desiredFov=nitroActive?78:(drifting?69:62);
    camera.fov+=(desiredFov-camera.fov)*Math.min(1,dt*6);
    camera.updateProjectionMatrix();

    const shake=nitroActive?.09:(drifting?.035:0);
    camera.position.x+=(Math.random()-.5)*shake;
    camera.position.y+=(Math.random()-.5)*shake;

    camera.lookAt(playerCar.position.x*.28,1.3+jumpY*.18,-22);

    renderer.toneMappingExposure=nitroActive?.98:.9;
  }

  function update(dt) {
    if(crashCooldown>0) crashCooldown-=dt;

    if(comboTimer>0){
      comboTimer-=dt;
      if(comboTimer<=0) comboEl.classList.remove('show');
    }

    const state=updatePlayer(dt);
    updateWorld(dt);
    updateRamps(dt);
    updateRivals(dt);
    updateEffects(dt,state.drifting,state.nitroActive);
    updateCamera(dt,state.nitroActive,state.drifting);
    updateHud();

    if(distance>=RACE_LENGTH){
      distance=RACE_LENGTH;
      updateHud();
      finishRace();
    }
  }

  function loop(now){
    if(!running) return;

    const dt=Math.min((now-last)/1000,.033);
    last=now;

    update(dt);
    renderer.render(scene,camera);

    if(running) requestAnimationFrame(loop);
  }

  document.addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    keys[e.code]=true;
  },{passive:false});

  document.addEventListener('keyup',e=>{
    keys[e.code]=false;
  });

  document.querySelectorAll('[data-key]').forEach(button=>{
    const key=button.dataset.key;

    button.addEventListener('pointerdown',e=>{
      e.preventDefault();
      keys[key]=true;
    });

    ['pointerup','pointercancel','pointerleave'].forEach(type=>{
      button.addEventListener(type,()=>keys[key]=false);
    });
  });

  restartBtn.addEventListener('click',reset);

  addRoad();
  addScenery();
  addSpeedStreaks();

  playerCar=makeCar(0xff304e,1.02);
  playerCar.position.set(0,0,PLAYER_Z);
  scene.add(playerCar);

  initEffects();
  createRivals();
  best();
  reset();
})();