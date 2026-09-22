(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const bestEl = document.getElementById('best');
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
  renderer.toneMappingExposure = .88;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7bbce6);
  scene.fog = new THREE.Fog(0xa8cde3, 85, 420);

  const camera = new THREE.PerspectiveCamera(62, 960 / 600, .1, 900);
  camera.position.set(0, 7.2, 18);

  const hemi = new THREE.HemisphereLight(0xe0f4ff, 0x526447, 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffefd2, 1.45);
  sun.position.set(50, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  scene.add(sun);

  const ROAD_WIDTH = 18;
  const ROAD_HALF = ROAD_WIDTH / 2;
  const PLAYER_Z = 8;
  const keys = Object.create(null);
  const roadPieces = [];
  const traffic = [];
  const scenery = [];

  let playerCar;
  let running = false;
  let last = 0;
  let score = 0;
  let speed = 0;
  let playerX = 0;
  let steerVisual = 0;
  let spawnTimer = 0;
  let distance = 0;

  function makeCar(color) {
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: .34,
      metalness: .18
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x173748,
      roughness: .18,
      metalness: .22,
      transparent: true,
      opacity: .9
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x101418,
      roughness: .65
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x08090a,
      roughness: .95
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xaab2b9,
      roughness: .3,
      metalness: .72
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xff263e,
      emissive: 0x550007
    });

    const lower = new THREE.Mesh(new THREE.BoxGeometry(3.5, .85, 6.3), bodyMat);
    lower.position.y = 1.05;
    lower.castShadow = true;
    g.add(lower);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(3.25, .42, 1.55), bodyMat);
    hood.position.set(0, 1.62, -2.15);
    hood.castShadow = true;
    g.add(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.85, 1.25, 2.8), glassMat);
    cabin.position.set(0, 1.95, .05);
    cabin.castShadow = true;
    g.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, .17, 2.55), darkMat);
    roof.position.set(0, 2.62, .05);
    g.add(roof);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.5, .16, .35), darkMat);
    spoiler.position.set(0, 2.0, 2.85);
    g.add(spoiler);

    const wheelGeo = new THREE.CylinderGeometry(.56, .56, .46, 16);
    const rimGeo = new THREE.CylinderGeometry(.27, .27, .48, 16);
    const wheels = [
      [-1.7,.65,-1.85],[1.7,.65,-1.85],
      [-1.7,.65,1.85],[1.7,.65,1.85]
    ];

    wheels.forEach(([x,y,z]) => {
      const tire = new THREE.Mesh(wheelGeo,tireMat);
      tire.rotation.z = Math.PI/2;
      tire.position.set(x,y,z);
      tire.castShadow = true;
      g.add(tire);

      const rim = new THREE.Mesh(rimGeo,rimMat);
      rim.rotation.z = Math.PI/2;
      rim.position.set(x,y,z);
      g.add(rim);
    });

    [-1.05,1.05].forEach(x => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(.7,.24,.16),redMat);
      tail.position.set(x,1.25,3.22);
      g.add(tail);
    });

    g.userData.halfW = 1.75;
    g.userData.halfL = 3.15;
    return g;
  }

  function addRoad() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x303438, roughness: .98 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x557949, roughness: 1 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe9e6d9 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf7f7f7 });

    for (let i = 0; i < 12; i++) {
      const z = -i * 40;

      const grass = new THREE.Mesh(new THREE.BoxGeometry(90,.22,40),grassMat);
      grass.position.set(0,-.14,z);
      grass.receiveShadow = true;
      scene.add(grass);

      const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH,.28,40),roadMat);
      road.position.set(0,0,z);
      road.receiveShadow = true;
      scene.add(road);

      for (const x of [-ROAD_HALF + .22, ROAD_HALF - .22]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(.22,.035,40),edgeMat);
        edge.position.set(x,.17,z);
        scene.add(edge);
      }

      for (const laneX of [-ROAD_WIDTH/6, ROAD_WIDTH/6]) {
        for (let d = -16; d <= 16; d += 8) {
          const dash = new THREE.Mesh(new THREE.BoxGeometry(.16,.04,4.1),lineMat);
          dash.position.set(laneX,.18,z+d);
          scene.add(dash);
          roadPieces.push(dash);
        }
      }
    }

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x8d9499,
      roughness: .65,
      metalness: .42
    });

    for (let i=0;i<60;i++) {
      const z = -i*8;
      [-ROAD_HALF-1.0,ROAD_HALF+1.0].forEach(x => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.16,.8,.16),barrierMat);
        post.position.set(x,.4,z);
        scene.add(post);
        scenery.push({mesh:post,type:'roadside'});

        const rail = new THREE.Mesh(new THREE.BoxGeometry(.18,.25,7.7),barrierMat);
        rail.position.set(x,.72,z);
        scene.add(rail);
        scenery.push({mesh:rail,type:'roadside'});
      });
    }
  }

  function addScenery() {
    const trunkMat = new THREE.MeshStandardMaterial({ color:0x765038, roughness:1 });
    const leafMat = new THREE.MeshStandardMaterial({ color:0x3d6f3c, roughness:1 });
    const rockMat = new THREE.MeshStandardMaterial({ color:0x777e82, roughness:1 });

    for (let i=0;i<45;i++) {
      const z = -20 - i*11;
      const side = i%2===0 ? -1 : 1;
      const x = side * (14 + (i%5)*3.5);

      if (i%4===0) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(2.1 + (i%3)*.4,0),
          rockMat
        );
        rock.scale.y = .7;
        rock.position.set(x,1.2,z);
        rock.rotation.set(.2,i*.5,.1);
        rock.castShadow = true;
        scene.add(rock);
        scenery.push({mesh:rock,type:'decor'});
      } else {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.34,.44,3.2,8),trunkMat);
        trunk.position.y = 1.6;
        trunk.castShadow = true;
        tree.add(trunk);

        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1,5.2,9),leafMat);
        crown.position.y = 5.1;
        crown.castShadow = true;
        tree.add(crown);

        tree.position.set(x,0,z);
        scene.add(tree);
        scenery.push({mesh:tree,type:'decor'});
      }
    }

    const mountainMat = new THREE.MeshStandardMaterial({ color:0x687783,roughness:1 });
    for(let i=0;i<14;i++){
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(18+(i%4)*5,28+(i%3)*8,6),
        mountainMat
      );
      const side=i%2===0?-1:1;
      m.position.set(side*(42+(i%4)*12),13,-80-i*28);
      m.rotation.y=i*.4;
      scene.add(m);
    }
  }

  function spawnTraffic() {
    const colors=[0xff4459,0x42bfff,0xffcc52,0x8468ff,0x62d78f,0xf1f1f1];
    const lanes=[-6,0,6];
    const car=makeCar(colors[Math.floor(Math.random()*colors.length)]);
    const lane=lanes[Math.floor(Math.random()*lanes.length)];
    car.position.set(lane,0,-180-Math.random()*120);
    car.rotation.y=Math.PI;
    scene.add(car);
    traffic.push({
      mesh:car,
      speed:70+Math.random()*75,
      halfW:1.75,
      halfL:3.15
    });
  }

  function best() {
    bestEl.textContent = localStorage.getItem('vertexRacingBest3D') || '0';
  }

  function showOverlay(icon,title,text,button,onClick){
    overlayIcon.textContent=icon;
    overlayTitle.textContent=title;
    overlayText.textContent=text;
    startBtn.textContent=button;
    startBtn.onclick=onClick;
    overlay.classList.add('show');
  }

  function reset(){
    running=false;
    score=0;
    speed=0;
    playerX=0;
    steerVisual=0;
    spawnTimer=.8;
    distance=0;

    traffic.forEach(t=>scene.remove(t.mesh));
    traffic.length=0;

    playerCar.position.set(0,0,PLAYER_Z);
    playerCar.rotation.set(0,0,0);

    scoreEl.textContent='0';
    speedEl.textContent='0';
    best();

    showOverlay(
      '🏁',
      'جاهز لـ Vertex Racing 3D؟',
      'سرّع، لف بحرية على الطريق، وتفادى السيارات.',
      'ابدأ السباق',
      start
    );

    renderer.render(scene,camera);
  }

  function start(){
    overlay.classList.remove('show');
    running=true;
    last=performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver(){
    running=false;
    const finalScore=Math.floor(score);
    const old=Number(localStorage.getItem('vertexRacingBest3D')||0);
    if(finalScore>old){
      localStorage.setItem('vertexRacingBest3D',String(finalScore));
    }
    best();

    showOverlay(
      '💥',
      'انتهى السباق',
      'نتيجتك: '+finalScore,
      'العب من جديد',
      ()=>{reset();start();}
    );
  }

  function intersectsTraffic(t){
    const dx=Math.abs(playerCar.position.x-t.mesh.position.x);
    const dz=Math.abs(PLAYER_Z-t.mesh.position.z);
    return dx < (1.65+t.halfW) && dz < (2.75+t.halfL);
  }

  function update(dt){
    const gas=keys.ArrowUp||keys.w;
    const brake=keys.ArrowDown||keys.s;
    const left=keys.ArrowLeft||keys.a;
    const right=keys.ArrowRight||keys.d;

    if(gas) speed += 115*dt;
    else speed -= 23*dt;

    if(brake) speed -= 165*dt;

    speed=THREE.MathUtils.clamp(speed,0,310);

    const steer=(left?-1:0)+(right?1:0);
    const steerPower=4.6 + speed/82;
    playerX += steer*steerPower*dt;

    if(Math.abs(playerX)>ROAD_HALF-2.1){
      speed -= 115*dt;
    }

    playerX=THREE.MathUtils.clamp(playerX,-ROAD_HALF-4.5,ROAD_HALF+4.5);
    playerCar.position.x += (playerX-playerCar.position.x)*Math.min(1,dt*13);

    steerVisual += (steer*.16-steerVisual)*Math.min(1,dt*10);
    playerCar.rotation.z=-steerVisual;
    playerCar.rotation.y=-steerVisual*.7;

    distance += speed*dt;
    score += speed*dt*.055;
    scoreEl.textContent=Math.floor(score);
    speedEl.textContent=Math.floor(speed);

    const worldMove=(speed/3.6)*dt;

    roadPieces.forEach(d=>{
      d.position.z += worldMove;
      if(d.position.z>28) d.position.z -= 480;
    });

    scenery.forEach(s=>{
      s.mesh.position.z += worldMove;
      if(s.mesh.position.z>35){
        s.mesh.position.z -= 500;
      }
    });

    spawnTimer -= dt;
    if(spawnTimer<=0 && speed>40){
      spawnTraffic();
      spawnTimer=Math.max(.55,1.45-speed/430)+Math.random()*.35;
    }

    for(let i=traffic.length-1;i>=0;i--){
      const t=traffic[i];
      const relative=Math.max(10,(speed-t.speed)/3.6);
      t.mesh.position.z += relative*dt;

      if(intersectsTraffic(t)){
        gameOver();
        return;
      }

      if(t.mesh.position.z>32){
        scene.remove(t.mesh);
        traffic.splice(i,1);
        score+=30;
      }
    }

    const camTargetX=playerCar.position.x*.38;
    camera.position.x += (camTargetX-camera.position.x)*Math.min(1,dt*5);
    camera.position.y = 7.1 + speed/190;
    camera.lookAt(playerCar.position.x*.25,1.35,-20);
  }

  function loop(now){
    if(!running) return;
    const dt=Math.min((now-last)/1000,.033);
    last=now;
    update(dt);
    renderer.render(scene,camera);
    requestAnimationFrame(loop);
  }

  document.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(['arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
    keys[e.key]=true;
    keys[k]=true;
  },{passive:false});

  document.addEventListener('keyup',e=>{
    keys[e.key]=false;
    keys[e.key.toLowerCase()]=false;
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
  playerCar=makeCar(0xff3f55);
  playerCar.position.set(0,0,PLAYER_Z);
  scene.add(playerCar);

  best();
  reset();
})();