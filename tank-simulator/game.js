(() => {
  const canvas=document.getElementById('gameCanvas');
  const healthEl=document.getElementById('health');
  const ammoEl=document.getElementById('ammo');
  const killsEl=document.getElementById('kills');
  const scoreEl=document.getElementById('score');
  const speedEl=document.getElementById('speed');
  const overlay=document.getElementById('overlay');
  const startBtn=document.getElementById('startBtn');
  const restartBtn=document.getElementById('restartBtn');
  const fireBtn=document.getElementById('fireBtn');
  const reloadBtn=document.getElementById('reloadBtn');
  const message=document.getElementById('message');

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.setSize(960,600,false);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.92;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x9aa98a);
  scene.fog=new THREE.Fog(0xa4ad93,110,300);

  const camera=new THREE.PerspectiveCamera(62,960/600,.1,500);

  scene.add(new THREE.HemisphereLight(0xd9e8c7,0x3d4936,1.0));
  const sun=new THREE.DirectionalLight(0xfff4d8,1.15);
  sun.position.set(65,90,35);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-100;
  sun.shadow.camera.right=100;
  sun.shadow.camera.top=100;
  sun.shadow.camera.bottom=-100;
  scene.add(sun);

  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(260,260),
    new THREE.MeshStandardMaterial({color:0x6f7d58,roughness:1})
  );
  ground.rotation.x=-Math.PI/2;
  ground.receiveShadow=true;
  scene.add(ground);

  const grid=new THREE.GridHelper(260,26,0x4c5742,0x59644d);
  grid.position.y=.02;
  scene.add(grid);

  const keys=Object.create(null);
  const shells=[];
  const enemyShells=[];
  const enemies=[];
  const obstacles=[];
  let player,turret,barrel;
  let running=false,last=0,score=0,kills=0,ammo=20,health=100,speed=0,reloadTimer=0,fireCooldown=0,msgTimer=0;

  function mat(color,rough=.75,metal=.08){
    return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
  }

  function createTank(color=0x66724e,enemy=false){
    const g=new THREE.Group();
    const trackMat=mat(0x1d211c,.95,.05);
    const bodyMat=mat(color,.72,.12);
    const darkMat=mat(0x252b24,.8,.15);

    const lower=new THREE.Mesh(new THREE.BoxGeometry(4.5,1,7),bodyMat);
    lower.position.y=1.0; lower.castShadow=true; g.add(lower);

    const upper=new THREE.Mesh(new THREE.BoxGeometry(3.8,.8,4.7),bodyMat);
    upper.position.set(0,1.8,-.1); upper.castShadow=true; g.add(upper);

    [-2.35,2.35].forEach(x=>{
      const track=new THREE.Mesh(new THREE.BoxGeometry(.65,.85,7.5),trackMat);
      track.position.set(x,.72,0); track.castShadow=true; g.add(track);
      for(let z=-2.8;z<=2.8;z+=1.4){
        const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.7,14),darkMat);
        wheel.rotation.z=Math.PI/2; wheel.position.set(x,.63,z); g.add(wheel);
      }
    });

    const turretPivot=new THREE.Group();
    turretPivot.position.y=2.38;
    g.add(turretPivot);

    const turretMesh=new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.65,.75,12),bodyMat);
    turretMesh.rotation.x=Math.PI/2;
    turretMesh.castShadow=true;
    turretPivot.add(turretMesh);

    const barrelPivot=new THREE.Group();
    turretPivot.add(barrelPivot);
    const gun=new THREE.Mesh(new THREE.CylinderGeometry(.16,.21,4.8,10),darkMat);
    gun.rotation.x=Math.PI/2;
    gun.position.z=-2.5;
    barrelPivot.add(gun);

    const hatch=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.28,12),darkMat);
    hatch.rotation.x=Math.PI/2; hatch.position.y=.46; turretPivot.add(hatch);

    g.userData={turret:turretPivot,barrel:barrelPivot,radius:3.4,enemy};
    return g;
  }

  function createObstacle(x,z,w,d,h=3){
    const mesh=new THREE.Mesh(
      new THREE.BoxGeometry(w,h,d),
      mat(0x777361,.95,.02)
    );
    mesh.position.set(x,h/2,z);
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    obstacles.push({mesh,x,z,w,d});
  }

  [
    [-28,-20,12,7,5],[30,-25,10,9,4],[0,-50,16,6,4],
    [-42,20,8,14,5],[37,17,12,8,5],[-6,38,18,6,4],
    [52,48,8,12,5],[-54,-48,10,10,4]
  ].forEach(v=>createObstacle(...v));

  function collides(x,z,r=3){
    if(Math.abs(x)>120-r||Math.abs(z)>120-r) return true;
    return obstacles.some(o=>
      x+r>o.x-o.w/2 && x-r<o.x+o.w/2 &&
      z+r>o.z-o.d/2 && z-r<o.z+o.d/2
    );
  }

  function spawnEnemies(){
    enemies.forEach(e=>scene.remove(e.mesh));
    enemies.length=0;
    const spots=[
      [-72,-68],[70,-65],[-82,18],[78,30],
      [-50,74],[55,75],[0,-90],[4,88]
    ];
    spots.forEach((p,i)=>{
      const mesh=createTank(i%2?0x795f45:0x6e5842,true);
      mesh.position.set(p[0],0,p[1]);
      mesh.rotation.y=(i*.9)%Math.PI;
      scene.add(mesh);
      enemies.push({mesh,hp:70,fire:1.2+i*.23,speed:5.5+(i%3),dead:false});
    });
  }

  function spawnShell(owner,fromEnemy=false){
    const ang=owner.rotation.y + owner.userData.turret.rotation.y;
    const dir=new THREE.Vector3(-Math.sin(ang),0,-Math.cos(ang));
    const shell=new THREE.Mesh(
      new THREE.SphereGeometry(.18,8,8),
      new THREE.MeshBasicMaterial({color:fromEnemy?0xff8a58:0xffe07a})
    );
    shell.position.copy(owner.position);
    shell.position.y=2.5;
    shell.position.addScaledVector(dir,4.8);
    scene.add(shell);
    (fromEnemy?enemyShells:shells).push({mesh,dir,life:3.0,speed:fromEnemy?38:58});
  }

  function showMessage(text){
    message.textContent=text;
    message.classList.add('show');
    msgTimer=1.4;
  }

  function shoot(){
    if(!running||fireCooldown>0||reloadTimer>0) return;
    if(ammo<=0){showMessage('الذخيرة فارغة — اضغط R');return;}
    ammo--; fireCooldown=.55;
    spawnShell(player,false);
    updateHud();
  }

  function reload(){
    if(!running||reloadTimer>0||ammo===20) return;
    reloadTimer=2.0;
    showMessage('جاري إعادة التعبئة...');
  }

  function reset(){
    running=false; score=0;kills=0;ammo=20;health=100;speed=0;reloadTimer=0;fireCooldown=0;
    shells.splice(0).forEach(s=>scene.remove(s.mesh));
    enemyShells.splice(0).forEach(s=>scene.remove(s.mesh));
    if(player) scene.remove(player);
    player=createTank(0x6e7e55,false);
    player.position.set(0,0,72);
    player.rotation.y=0;
    scene.add(player);
    turret=player.userData.turret;
    barrel=player.userData.barrel;
    spawnEnemies();
    updateHud();
    updateCamera(true);
    renderer.render(scene,camera);
    overlay.classList.add('show');
  }

  function start(){
    overlay.classList.remove('show');
    running=true;
    last=performance.now();
    requestAnimationFrame(loop);
  }

  function updateHud(){
    healthEl.textContent=Math.max(0,Math.round(health));
    ammoEl.textContent=reloadTimer>0?'...':ammo;
    killsEl.textContent=kills;
    scoreEl.textContent=score;
    speedEl.textContent=Math.round(Math.abs(speed)*5);
  }

  function updatePlayer(dt){
    const forward=keys.w||keys.ArrowUp;
    const back=keys.s||keys.ArrowDown;
    const left=keys.a||keys.ArrowLeft;
    const right=keys.d||keys.ArrowRight;
    const turretL=keys.q||keys.KeyQ;
    const turretR=keys.e||keys.KeyE;

    if(forward) speed+=13*dt;
    else if(back) speed-=10*dt;
    else speed*=Math.pow(.16,dt);
    speed=THREE.MathUtils.clamp(speed,-6,16);

    if(Math.abs(speed)>.15){
      const turn=(left?1:0)-(right?1:0);
      player.rotation.y+=turn*dt*(.75+Math.min(Math.abs(speed)/12,.55))*Math.sign(speed||1);
    }

    if(turretL) turret.rotation.y+=1.25*dt;
    if(turretR) turret.rotation.y-=1.25*dt;

    const dir=new THREE.Vector3(-Math.sin(player.rotation.y),0,-Math.cos(player.rotation.y));
    const next=player.position.clone().addScaledVector(dir,speed*dt);
    if(!collides(next.x,next.z,3.2)) player.position.copy(next);
    else speed*=.2;

    player.position.x=THREE.MathUtils.clamp(player.position.x,-116,116);
    player.position.z=THREE.MathUtils.clamp(player.position.z,-116,116);
  }

  function updateEnemies(dt){
    enemies.forEach(e=>{
      if(e.dead) return;
      const toPlayer=player.position.clone().sub(e.mesh.position);
      const dist=toPlayer.length();
      const target=Math.atan2(-toPlayer.x,-toPlayer.z);
      e.mesh.rotation.y=THREE.MathUtils.lerp(e.mesh.rotation.y,target,.03);
      e.mesh.userData.turret.rotation.y=0;

      if(dist>28){
        const dir=new THREE.Vector3(-Math.sin(e.mesh.rotation.y),0,-Math.cos(e.mesh.rotation.y));
        const next=e.mesh.position.clone().addScaledVector(dir,e.speed*dt);
        if(!collides(next.x,next.z,3.2)) e.mesh.position.copy(next);
      }

      e.fire-=dt;
      if(e.fire<=0&&dist<78){
        e.fire=2.2+Math.random()*1.7;
        spawnShell(e.mesh,true);
      }
    });
  }

  function hitObstacle(pos){
    return obstacles.some(o=>
      pos.x>o.x-o.w/2 && pos.x<o.x+o.w/2 &&
      pos.z>o.z-o.d/2 && pos.z<o.z+o.d/2
    );
  }

  function updateShellList(list,dt,enemyShot){
    for(let i=list.length-1;i>=0;i--){
      const s=list[i];
      s.mesh.position.addScaledVector(s.dir,s.speed*dt);
      s.life-=dt;
      let remove=s.life<=0||hitObstacle(s.mesh.position);

      if(!enemyShot){
        for(const e of enemies){
          if(e.dead) continue;
          if(s.mesh.position.distanceTo(e.mesh.position)<3.1){
            e.hp-=40; remove=true;
            if(e.hp<=0){
              e.dead=true; kills++; score+=250;
              e.mesh.visible=false;
              showMessage('تم تدمير الهدف!');
              if(kills>=8){
                running=false;
                overlay.querySelector('h2').textContent='المهمة ناجحة 🏆';
                overlay.querySelector('p').textContent='دمّرت جميع أهداف التدريب.';
                startBtn.textContent='العب من جديد';
                startBtn.onclick=reset;
                overlay.classList.add('show');
              }
            }
            break;
          }
        }
      }else if(s.mesh.position.distanceTo(player.position)<3.2){
        health-=14; remove=true;
        showMessage('أصيبت الدبابة!');
        if(health<=0){
          health=0; running=false;
          overlay.querySelector('h2').textContent='تم تدمير الدبابة';
          overlay.querySelector('p').textContent='اضغط للبدء من جديد.';
          startBtn.textContent='إعادة';
          startBtn.onclick=reset;
          overlay.classList.add('show');
        }
      }

      if(remove){
        scene.remove(s.mesh);
        list.splice(i,1);
      }
    }
  }

  function updateCamera(force=false){
    const behind=new THREE.Vector3(
      Math.sin(player.rotation.y)*12,
      7.5,
      Math.cos(player.rotation.y)*12
    );
    const desired=player.position.clone().add(behind);
    if(force) camera.position.copy(desired);
    else camera.position.lerp(desired,.09);
    const target=player.position.clone();
    target.y=2.1;
    camera.lookAt(target);
  }

  function update(dt){
    fireCooldown=Math.max(0,fireCooldown-dt);
    if(reloadTimer>0){
      reloadTimer-=dt;
      if(reloadTimer<=0){
        reloadTimer=0;ammo=20;showMessage('تمت إعادة التعبئة');
      }
    }
    if(msgTimer>0){
      msgTimer-=dt;
      if(msgTimer<=0) message.classList.remove('show');
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateShellList(shells,dt,false);
    updateShellList(enemyShells,dt,true);
    updateCamera();
    updateHud();
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
    if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    if(k===' '&&!e.repeat){shoot();return;}
    if(k==='r'&&!e.repeat){reload();return;}
    keys[k]=true;
    keys[e.code]=true;
  },{passive:false});

  document.addEventListener('keyup',e=>{
    keys[e.key.toLowerCase()]=false;
    keys[e.code]=false;
  });

  document.querySelectorAll('[data-key]').forEach(btn=>{
    const key=btn.dataset.key;
    btn.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;keys[key.toLowerCase()]=true;});
    ['pointerup','pointercancel','pointerleave'].forEach(type=>btn.addEventListener(type,()=>{keys[key]=false;keys[key.toLowerCase()]=false;}));
  });

  fireBtn.addEventListener('click',shoot);
  reloadBtn.addEventListener('click',reload);
  restartBtn.addEventListener('click',reset);
  startBtn.onclick=start;

  reset();
})();