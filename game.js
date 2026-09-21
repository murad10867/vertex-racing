(() => {
  'use strict';
  const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
  const scoreEl=document.getElementById('score'),speedEl=document.getElementById('speed'),bestEl=document.getElementById('best');
  const overlay=document.getElementById('overlay'),overlayIcon=document.getElementById('overlayIcon'),overlayTitle=document.getElementById('overlayTitle'),overlayText=document.getElementById('overlayText');
  const startBtn=document.getElementById('startBtn'),restartBtn=document.getElementById('restartBtn');

  const road={x:140,w:440};const lanes=[230,360,490];let lane=1,targetX=lanes[1],running=false,last=0,score=0,speed=120,lineOffset=0,spawn=0;let cars=[];
  const player={x:lanes[1],y:585,w:54,h:96};

  function best(){bestEl.textContent=localStorage.getItem('vertexRacingBest')||'0'}
  function reset(){running=false;score=0;speed=120;cars=[];lane=1;targetX=lanes[1];player.x=targetX;lineOffset=0;spawn=0;scoreEl.textContent='0';speedEl.textContent='120';best();showOverlay('🏁','جاهز للسباق؟','تفادى السيارات وحاول تحطيم رقمك القياسي.','ابدأ السباق',start);draw()}
  function showOverlay(icon,title,text,button,onClick){overlayIcon.textContent=icon;overlayTitle.textContent=title;overlayText.textContent=text;startBtn.textContent=button;startBtn.onclick=onClick;overlay.classList.add('show')}
  function start(){overlay.classList.remove('show');running=true;last=performance.now();requestAnimationFrame(loop)}
  function move(dir){if(!running)return;lane=Math.max(0,Math.min(2,lane+dir));targetX=lanes[lane]}
  function spawnCar(){const l=Math.floor(Math.random()*3);cars.push({x:lanes[l],y:-110,w:52,h:92,v:220+score*.04+Math.random()*70,color:['#ff5367','#4fc7ff','#ffd45c','#8e6bff'][Math.floor(Math.random()*4)]})}
  function collide(a,b){return a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function gameOver(){running=false;const old=Number(localStorage.getItem('vertexRacingBest')||0);if(score>old)localStorage.setItem('vertexRacingBest',String(Math.floor(score)));best();showOverlay('💥','انتهى السباق','نتيجتك: '+Math.floor(score),'العب من جديد',()=>{reset();start()})}
  function update(dt){
    speed=120+Math.min(230,score*.12);speedEl.textContent=Math.floor(speed);score+=dt*18;scoreEl.textContent=Math.floor(score);
    player.x+=(targetX-player.x)*Math.min(1,dt*12);lineOffset=(lineOffset+speed*dt*1.6)%90;
    spawn-=dt;if(spawn<=0){spawnCar();spawn=Math.max(.48,1.15-score*.0006)}
    for(let i=cars.length-1;i>=0;i--){const c=cars[i];c.y+=c.v*dt;if(collide(player,c)){gameOver();return}if(c.y>canvas.height+120){cars.splice(i,1);score+=12}}
  }
  function drawRoad(){
    ctx.fillStyle='#1d3321';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#34373b';ctx.fillRect(road.x,0,road.w,canvas.height);
    ctx.fillStyle='#d9d9d9';ctx.fillRect(road.x,0,7,canvas.height);ctx.fillRect(road.x+road.w-7,0,7,canvas.height);
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=7;ctx.setLineDash([42,48]);ctx.lineDashOffset=lineOffset;
    [road.x+road.w/3,road.x+road.w*2/3].forEach(x=>{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()});ctx.setLineDash([])
  }
  function carShape(c,isPlayer=false){
    ctx.save();ctx.translate(c.x,c.y);ctx.fillStyle=isPlayer?'#ff4054':c.color;ctx.shadowColor=isPlayer?'#ff4054':c.color;ctx.shadowBlur=14;
    ctx.beginPath();ctx.roundRect(-c.w/2,0,c.w,c.h,12);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#0b1218';ctx.fillRect(-c.w*.28,12,c.w*.56,25);ctx.fillRect(-c.w*.28,c.h-38,c.w*.56,24);
    ctx.fillStyle='#f1f6ff';ctx.fillRect(-c.w*.38,4,9,13);ctx.fillRect(c.w*.38-9,4,9,13);ctx.restore()
  }
  function draw(){drawRoad();cars.forEach(c=>carShape(c));carShape(player,true)}
  function loop(now){if(!running)return;const dt=Math.min((now-last)/1000,.033);last=now;update(dt);draw();requestAnimationFrame(loop)}
  document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='arrowleft'||k==='a'){e.preventDefault();move(-1)}if(k==='arrowright'||k==='d'){e.preventDefault();move(1)}});
  document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>move(b.dataset.move==='left'?-1:1)));
  restartBtn.addEventListener('click',reset);best();reset();
})();