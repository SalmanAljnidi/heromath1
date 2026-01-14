import {clamp, toArabicDigits} from './utils.js';

export class AudioFX{
  constructor(){ this.ctx=null; this.enabled=true; }
  _ensure(){ if(!this.ctx){ const C=window.AudioContext||window.webkitAudioContext; this.ctx=new C(); } }
  _tone(freq, dur=0.12, type='sine', gain=0.07){
    if(!this.enabled) return;
    this._ensure();
    const t0=this.ctx.currentTime;
    const o=this.ctx.createOscillator();
    const g=this.ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t0); o.stop(t0+dur);
  }
  jump(){ this._tone(560,0.08,'square',0.06); this._tone(780,0.08,'square',0.05); }
  coin(){ this._tone(980,0.07,'triangle',0.06); this._tone(1320,0.08,'triangle',0.05); }
  win(){ this._tone(660,0.12,'triangle',0.06); setTimeout(()=>this._tone(880,0.12,'triangle',0.06),140); setTimeout(()=>this._tone(1100,0.14,'triangle',0.06),280); }
  hit(){ this._tone(170,0.16,'sawtooth',0.06); }
  good(){ this._tone(784,0.10,'triangle',0.07); setTimeout(()=>this._tone(988,0.12,'triangle',0.07),120); }
  bad(){ this._tone(220,0.12,'sawtooth',0.06); setTimeout(()=>this._tone(180,0.14,'sawtooth',0.06),120); }
  tick(){ this._tone(420,0.05,'square',0.03); }
}

class Rect{ constructor(x,y,w,h){ this.x=x; this.y=y; this.w=w; this.h=h; } }
class Player extends Rect{
  constructor(x,y){ super(x,y,42,56); this.vx=0; this.vy=0; this.onGround=false; this.facing=1; this.inv=0; }
}

export class Game{
  constructor(canvas, ui, onLose){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.ui=ui; this.onLose=onLose;
    this.audio=new AudioFX();

    this.keys={left:false,right:false,jump:false};
    this.touchAxis=0; this.touchJump=false;

    this.gravity=2150;
    this.speed=470;
    this.jumpV=-840;

    this.levelIndex=0;
    this.levels=this._makeLevels(12);
    this.running=false;
    this.dead=false;

    this.score=0;
    this.correct=0; this.wrong=0;

    this.cameraX=0;
    this.time=0;
    this.fx=[];

    this._resetLevel(true);
    this._last=0;
  }

  _makeLevels(n){
    const themes=[
      {mode:'day', top:'#7dd3fc', bottom:'#dbeafe', hill:'#1d4ed8', glow:'#38bdf8', clouds:true},
      {mode:'sunset', top:'#fb7185', bottom:'#fbbf24', hill:'#b45309', glow:'#f59e0b', clouds:true},
      {mode:'morning', top:'#fda4af', bottom:'#60a5fa', hill:'#1e40af', glow:'#fb7185', clouds:true},
    ];
    const lvls=[];
    for(let i=0;i<n;i++){
      const width=2850 + i*230;
      const groundY=476;
      const holes=[];
      const spikes=[];
      const plats=[];
      const coins=[];
      const enemies=[];
      const finish={x:width-140, y:groundY-96, w:30, h:96};
      const theme=themes[Math.floor(i/2)%themes.length];

      // holes
      const holeCount=3 + Math.floor(i/2);
      for(let h=0;h<holeCount;h++){
        const x=560 + h*(590 + i*14) + (i*45);
        const w=150 + (h%2)*70 + (i%3)*10;
        holes.push({x,w});
      }
      holes.sort((a,b)=>a.x-b.x);

      // ground segments excluding holes
      let cursor=0;
      for(const ho of holes){
        const seg=Math.max(0, ho.x-cursor);
        if(seg>0) plats.push({x:cursor,y:groundY,w:seg,h:80, kind:'ground'});
        cursor=ho.x+ho.w;
      }
      if(cursor<width) plats.push({x:cursor,y:groundY,w:width-cursor,h:80, kind:'ground'});

      // platform patterns
      const mode=i%4;
      if(mode===0){
        for(let k=0;k<9+i;k++){
          const px=250+k*245+(k%2)*60;
          const py=395-(k%5)*44;
          plats.push({x:px,y:py,w:220,h:22,kind:'plat'});
          if(k%2===0) coins.push({x:px+95,y:py-28,r:10,taken:false});
          if(k%4===1) spikes.push({x:px+60,y:py+22,w:85,h:18});
        }
      }else if(mode===1){
        for(let k=0;k<8+i;k++){
          const px=260+k*290;
          const py=365-(k%3)*62;
          plats.push({x:px,y:py,w:180+(k%2)*70,h:22,kind:'plat'});
          coins.push({x:px+80,y:py-28,r:10,taken:false});
          if(k%3===1) spikes.push({x:px+45,y:py+22,w:90,h:18});
        }
      }else if(mode===2){
        for(let k=0;k<7+i;k++){
          const px=260+k*320;
          const py=345-(k%2)*85;
          plats.push({x:px,y:py,w:190,h:22,kind:'plat'});
          if(k%2===0) coins.push({x:px+85,y:py-28,r:10,taken:false});
        }
        const mx=1020+i*60;
        plats.push({x0:mx, y:260, x:mx, w:180, h:22, kind:'moveX', range:250, speed:1.0});
        plats.push({x0:mx+540, y0:320, y:320, x:mx+540, w:170, h:22, kind:'moveY', range:120, speed:1.25});
      }else{
        for(let k=0;k<7+i;k++){
          const px=290+k*335;
          const py=330-(k%2)*95-(k%3)*22;
          plats.push({x:px,y:py,w:170,h:22,kind:'plat'});
          if(k%3===0) coins.push({x:px+80,y:py-28,r:10,taken:false});
          if(k%4===2) plats.push({x:px+65,y:groundY-16,w:60,h:16,kind:'spring'});
        }
      }

      // enemies: slimes on ground and bats higher on later levels
      const eCount=3+i;
      for(let e=0;e<eCount;e++){
        const ex=740+e*360+(i*18);
        const kind=(i>=3 && e%3===0)?'bat':'slime';
        if(kind==='slime'){
          enemies.push({x:ex,y:groundY-30,w:40,h:30,dir:(e%2?1:-1),speed:90+i*7,x0:ex,dead:false,kind});
        }else{
          enemies.push({x:ex,y:groundY-220,w:44,h:30,dir:(e%2?1:-1),speed:105+i*6,x0:ex,phase:e*0.8,dead:false,kind});
        }
      }

      lvls.push({width,groundY,holes,spikes,platforms:plats,coins,enemies,finish,start:{x:90,y:groundY-56},theme});
    }
    return lvls;
  }

  _resetLevel(full){
    const lvl=this.levels[this.levelIndex];
    this.cameraX=0;
    this.player=new Player(lvl.start.x, lvl.start.y);
    this.checkpoint={x:this.player.x, y:this.player.y};
    this.dead=false;
    this.enemies=lvl.enemies.map(e=>({...e,dead:false}));
    this.coins=lvl.coins.map(c=>({...c,taken:false}));
    this.fx=[];
    if(full){ this.score=0; this.correct=0; this.wrong=0; }
    this._syncUI();
  }

  _syncUI(){
    if(!this.ui) return;
    this.ui.level.textContent=toArabicDigits(this.levelIndex+1);
    this.ui.score.textContent=toArabicDigits(this.score);
    this.ui.correct.textContent=toArabicDigits(this.correct);
    this.ui.wrong.textContent=toArabicDigits(this.wrong);
  }

  setPlayerName(n){this.playerName=(n||'').trim();}

  start(){
    if(this.running) return;
    this.running=true;
    this._last=performance.now();
    requestAnimationFrame(t=>this._loop(t));
  }

  setInput(k,v){ if(this.keys[k]!==undefined) this.keys[k]=v; }
  setTouchAxis(v){ this.touchAxis=clamp(v,-1,1); }
  setTouchJump(v){ this.touchJump=!!v; }

  _loop(t){
    if(!this.running) return;
    const dt=Math.min(0.033,(t-this._last)/1000);
    this._last=t;
    this.time+=dt;
    this._update(dt);
    this._draw();
    requestAnimationFrame(tt=>this._loop(tt));
  }

  _update(dt){
    const lvl=this.levels[this.levelIndex];
    const p=this.player;

    // moving platforms
    for(const pl of lvl.platforms){
      if(pl.kind==='moveX'){
        pl.x = pl.x0 + Math.sin(this.time*pl.speed)*pl.range;
      }else if(pl.kind==='moveY'){
        pl.y = pl.y0 + Math.sin(this.time*pl.speed)*pl.range;
      }
    }

    const axis=(Math.abs(this.touchAxis)>0.01)?this.touchAxis:0;
    const left=this.keys.left || axis<-0.15;
    const right=this.keys.right || axis>0.15;
    const jump=this.keys.jump || this.touchJump;

    const sp = this.speed*(axis!==0 ? (0.55+0.45*Math.abs(axis)) : 1);
    p.vx=0;
    if(left){ p.vx=-sp; p.facing=-1; }
    if(right){ p.vx=sp; p.facing=1; }

    if(jump && p.onGround){
      p.vy=this.jumpV;
      p.onGround=false;
      this.audio.jump();
      this._burst(p.x+p.w/2, p.y+p.h, lvl.theme.glow, 10);
    }

    // gravity
    p.vy += this.gravity*dt;

    // X move
    p.x += p.vx*dt;
    p.x = clamp(p.x,0,lvl.width-p.w);

    // Y move + collision
    const prevY=p.y;
    p.y += p.vy*dt;
    p.onGround=false;

    for(const pl of lvl.platforms){
      if(!this._overlap(p,pl)) continue;
      const prevBottom=prevY+p.h;
      if(prevBottom <= pl.y+2 && p.vy>=0){
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround=true;
        // checkpoint on safe landing
        this.checkpoint={x:p.x, y:p.y};
      }else if(prevY >= pl.y+pl.h-2 && p.vy<0){
        p.y = pl.y + pl.h;
        p.vy = 0;
      }
    }

    // springs
    for(const pl of lvl.platforms){
      if(pl.kind!=='spring') continue;
      if(this._overlap(p,pl) && p.vy>=0 && (p.y+p.h) <= pl.y+18){
        p.y = pl.y - p.h;
        p.vy = this.jumpV*1.12;
        p.onGround=false;
        this.audio.jump();
        this._burst(pl.x+pl.w/2, pl.y, '#fbbf24', 14);
      }
    }

    // spike collision
    for(const s of lvl.spikes){
      if(this._overlap(p,s) && p.inv<=0){
        this._lose();
        return;
      }
    }

    // pit fall
    if(p.y>600){ this._lose(); return; }

    // coins
    for(const c of this.coins){
      if(c.taken) continue;
      const dx=(p.x+p.w/2)-c.x, dy=(p.y+p.h/2)-c.y;
      if(dx*dx+dy*dy < (c.r+18)*(c.r+18)){
        c.taken=true;
        this.score+=10;
        this.audio.coin();
        this._burst(c.x,c.y,'#fbbf24',12);
        this._syncUI();
      }
    }

    // enemies
    for(const e of this.enemies){
      if(e.dead) continue;
      if(e.kind==='slime'){
        e.x += e.dir*e.speed*dt;
        if(e.x>e.x0+180) e.dir=-1;
        if(e.x<e.x0-180) e.dir=1;
        e.y = lvl.groundY-30;
      }else{
        e.x += e.dir*(e.speed)*dt;
        e.y = (lvl.groundY-220) + Math.sin(this.time*2.2+e.phase)*55;
        if(e.x>e.x0+220) e.dir=-1;
        if(e.x<e.x0-220) e.dir=1;
      }

      if(p.inv<=0 && this._overlap(p,e)){
        const pBottom=p.y+p.h;
        if(e.kind==='slime' && p.vy>0 && (pBottom-e.y)<18){
          e.dead=true;
          p.vy=this.jumpV*0.55;
          this.score+=25;
          this.audio.coin();
          this._burst(e.x+e.w/2, e.y+e.h/2, '#22c55e', 14);
          this._syncUI();
        }else{
          this._lose();
          return;
        }
      }
    }
    this.enemies=this.enemies.filter(e=>!e.dead);

    // finish
    if(this._overlap(p,lvl.finish)){
      this.audio.win();
      this._advanceLevel();
      return;
    }

    if(p.inv>0) p.inv -= dt;

    // camera
    const target=p.x-380;
    this.cameraX += (target-this.cameraX)*(1-Math.pow(0.001,dt));
    this.cameraX = clamp(this.cameraX,0,Math.max(0,lvl.width-960));

    // fx update
    this.fx = this.fx.filter(f=>{
      f.vy += 1200*dt;
      f.x += f.vx*dt;
      f.y += f.vy*dt;
      f.t -= dt;
      return f.t>0;
    });
  }

  _advanceLevel(){
    if(this.levelIndex < this.levels.length-1){
      this.levelIndex++;
      this._resetLevel(false);
    }else{
      this.levelIndex=0;
      this._resetLevel(true);
    }
  }

  _lose(){
    if(!this.running || this.dead) return;
    this.dead=true;
    this.running=false;
    this.audio.hit();
    this.onLose();
  }

  afterQuiz(ok){
    const lvl=this.levels[this.levelIndex];
    const p=this.player;
    if(ok){
      this.correct++;
      p.x=this.checkpoint.x;
      p.y=this.checkpoint.y;
      p.vx=0; p.vy=0;
      p.inv=2.2;
      this._burst(p.x+p.w/2, p.y+p.h/2, lvl.theme.glow, 18);
    }else{
      this.wrong++;
      this._resetLevel(false);
    }
    this.dead=false;
    this.running=true;
    this._last=performance.now();
    this._syncUI();
    requestAnimationFrame(t=>this._loop(t));
  }

  _overlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  _burst(x,y,color,count){
    for(let i=0;i<count;i++){
      const ang=Math.random()*Math.PI*2;
      const sp=220+Math.random()*520;
      this.fx.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-240,t:0.45+Math.random()*0.35,c:color});
    }
  }

  _draw(){
    const ctx=this.ctx;
    const lvl=this.levels[this.levelIndex];
    ctx.clearRect(0,0,960,540);

    // sky gradient
    const g=ctx.createLinearGradient(0,0,0,540);
    g.addColorStop(0,lvl.theme.top);
    g.addColorStop(1,lvl.theme.bottom);
    ctx.fillStyle=g;
    ctx.fillRect(0,0,960,540);

    
    // hills parallax
    const par=-this.cameraX*0.18;
    ctx.save();
    ctx.translate(par,0);
    ctx.globalAlpha=0.75;
    ctx.fillStyle=lvl.theme.hill;
    this._hills(ctx,0,420,140,8);
    ctx.restore();

    // clouds parallax
    ctx.save();
    ctx.translate(-this.cameraX*0.28,0);
    ctx.globalAlpha=0.22;
    ctx.fillStyle='#fff';
    for(let i=0;i<6;i++){
      const cx=120+i*220 + Math.sin(this.time*0.25+i)*20;
      const cy=90+(i%2)*40;
      this._cloud(ctx,cx,cy,70,28);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-this.cameraX,0);

    // pits
    for(const ho of lvl.holes){
      ctx.fillStyle='#05070f';
      ctx.fillRect(ho.x,lvl.groundY,ho.w,80);
      ctx.fillStyle='rgba(255,255,255,.06)';
      ctx.fillRect(ho.x,lvl.groundY,ho.w,6);
    }

    // platforms
    for(const pl of lvl.platforms){
      const isGround = pl.kind==='ground';
      const isMove = pl.kind==='moveX' || pl.kind==='moveY';
      const isSpring = pl.kind==='spring';
      const c1 = isGround ? '#1b2f5d' : (isSpring ? '#3a240b' : (isMove ? '#23406d' : '#223b6b'));
      const c2 = isGround ? '#2c4f8a' : (isSpring ? '#fbbf24' : '#2b5590');
      this._tile(ctx,pl.x,pl.y,pl.w,pl.h,c1,c2);
      if(isMove){
        ctx.fillStyle='rgba(125,211,252,.18)';
        ctx.fillRect(pl.x,pl.y-4,pl.w,4);
      }
      if(isSpring){
        ctx.fillStyle='rgba(251,191,36,.35)';
        ctx.fillRect(pl.x,pl.y,pl.w,pl.h);
      }
      ctx.fillStyle='rgba(255,255,255,.10)';
      ctx.fillRect(pl.x,pl.y,pl.w,3);
    }

    // spikes
    for(const s of lvl.spikes){
      ctx.fillStyle='#111827';
      const teeth=6;
      for(let i=0;i<teeth;i++){
        const tx=s.x + i*(s.w/teeth);
        ctx.beginPath();
        ctx.moveTo(tx, s.y+s.h);
        ctx.lineTo(tx+(s.w/teeth)/2, s.y);
        ctx.lineTo(tx+(s.w/teeth), s.y+s.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,255,.12)';
      ctx.fillRect(s.x, s.y+s.h-3, s.w, 3);
    }

    // coins
    for(const c of this.coins){
      if(c.taken) continue;
      ctx.save();
      ctx.translate(c.x, c.y + Math.sin(this.time*6 + c.x*0.01)*2);
      ctx.beginPath();
      ctx.fillStyle='#fbbf24';
      ctx.arc(0,0,c.r,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.22)';
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.globalAlpha=0.35;
      ctx.fillStyle='#fff';
      ctx.beginPath();
      ctx.arc(-3,-3,4,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // finish flag
    ctx.fillStyle=lvl.theme.glow;
    ctx.fillRect(lvl.finish.x,lvl.finish.y,6,lvl.finish.h);
    ctx.fillStyle='#22c55e';
    ctx.fillRect(lvl.finish.x+6,lvl.finish.y+10,lvl.finish.w-6,26);
    ctx.fillStyle='rgba(255,255,255,.25)';
    ctx.fillRect(lvl.finish.x+6,lvl.finish.y+10,(lvl.finish.w-6)*0.35,26);

    // enemies
    for(const e of this.enemies){
      if(e.kind==='slime') this._slime(ctx,e);
      else this._bat(ctx,e);
    }

    // fx
    for(const f of this.fx){
      ctx.globalAlpha=Math.max(0, Math.min(1, f.t*1.6));
      ctx.fillStyle=f.c;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3.2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;

    // hero
    this._hero(ctx,this.player,lvl.theme.glow);

    ctx.restore();

    // HUD
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.font='16px system-ui';
    ctx.textAlign='left';
    ctx.fillText(`المرحلة: ${toArabicDigits(this.levelIndex+1)}   النقاط: ${toArabicDigits(this.score)}`, 14, 24);
    ctx.restore();
  }

  _tile(ctx,x,y,w,h,c1,c2){
    ctx.fillStyle=c1;
    ctx.fillRect(x,y,w,h);
    ctx.save();
    ctx.globalAlpha=0.32;
    ctx.strokeStyle=c2;
    ctx.lineWidth=2;
    const tile=34;
    for(let yy=y+8;yy<y+h;yy+=tile){
      for(let xx=x+8;xx<x+w;xx+=tile){
        const off=((Math.floor((yy-y)/tile))%2)*tile/2;
        ctx.strokeRect(xx+off,yy,tile-10,tile-16);
      }
    }
    ctx.restore();
  }

  _hills(ctx,x0,yBase,amp,count){
    ctx.beginPath();
    ctx.moveTo(x0,540);
    ctx.lineTo(x0,yBase);
    const step=120;
    for(let i=0;i<count;i++){
      const x=x0+i*step;
      const y=yBase + Math.sin(i*0.8)*amp*0.18;
      ctx.quadraticCurveTo(x+step*0.5, y-amp*0.45, x+step, y);
    }
    ctx.lineTo(x0+count*step,540);
    ctx.closePath();
    ctx.fill();
  }

  _cloud(ctx,x,y,w,h){
    ctx.beginPath();
    ctx.ellipse(x,y,w*0.45,h*0.55,0,0,Math.PI*2);
    ctx.ellipse(x+w*0.25,y-h*0.10,w*0.35,h*0.45,0,0,Math.PI*2);
    ctx.ellipse(x-w*0.25,y-h*0.05,w*0.30,h*0.40,0,0,Math.PI*2);
    ctx.fill();
  }

  _hero(ctx,p,glow){
    const run=Math.abs(p.vx)>10 && p.onGround;
    const bob=run?Math.sin(this.time*14)*2:(p.onGround?0:-1);
    const leg=run?Math.sin(this.time*14):0;
    const arm=run?Math.sin(this.time*14+Math.PI):(p.onGround?0:0.8);
    const x=p.x, y=p.y+bob, w=p.w, h=p.h;

    // shadow
    ctx.save();
    ctx.globalAlpha=0.18;
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(x+w/2, p.y+h+6, 18, 6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    const blink = p.inv>0 && (Math.floor(performance.now()/120)%2===0);
    ctx.save();
    if(blink) ctx.globalAlpha=0.28;

    // glow outline
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.fillStyle=glow;
    ctx.beginPath();
    ctx.roundRect(x+4, y+14, w-8, h-18, 12);
    ctx.fill();
    ctx.restore();

    // cape
    ctx.save();
    ctx.globalAlpha=0.55;
    ctx.fillStyle='#ef4444';
    ctx.beginPath();
    const fx=x+(p.facing>0?-8:w+8);
    ctx.moveTo(x+w/2, y+14);
    ctx.quadraticCurveTo(fx, y+26, x+w/2+(p.facing>0?-22:22), y+50);
    ctx.quadraticCurveTo(x+w/2, y+46, x+w/2, y+14);
    ctx.fill();
    ctx.restore();

    // body armor
    ctx.fillStyle='#3b82f6';
    ctx.beginPath();
    ctx.roundRect(x+6, y+16, w-12, h-22, 12);
    ctx.fill();

    // visor/helmet
    ctx.fillStyle='#fbbf24';
    ctx.beginPath();
    ctx.roundRect(x+10, y+4, w-20, 18, 10);
    ctx.fill();

    ctx.fillStyle='rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.roundRect(x+12, y+10, w-24, 7, 6);
    ctx.fill();

    // emblem
    ctx.fillStyle='rgba(255,255,255,.24)';
    ctx.beginPath();
    ctx.ellipse(x+w/2, y+36, 9, 7, 0, 0, Math.PI*2);
    ctx.fill();

    // arms
    ctx.strokeStyle='#111827';
    ctx.lineWidth=7;
    ctx.lineCap='round';
    const ax=x+w/2, ay=y+26;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax+(p.facing*10), ay+arm*6);
    ctx.stroke();

    // legs
    const lx=x+w/2-7, rx=x+w/2+7, ly=y+h-10;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx+leg*7, ly+11);
    ctx.moveTo(rx, ly);
    ctx.lineTo(rx-leg*7, ly+11);
    ctx.stroke();

    ctx.restore();
  }

  _slime(ctx,e){
    const bounce=Math.sin(this.time*8 + e.x*0.02)*2;
    const x=e.x, y=e.y+bounce, w=e.w, h=e.h;
    ctx.save();
    ctx.fillStyle='#22c55e';
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,12);
    ctx.fill();
    ctx.globalAlpha=0.35;
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.ellipse(x+w*0.35, y+h*0.35, 5, 4, 0, 0, Math.PI*2);
    ctx.ellipse(x+w*0.65, y+h*0.35, 5, 4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle='#052e16';
    ctx.beginPath();
    ctx.ellipse(x+w*0.35, y+h*0.40, 2.6, 2.6, 0, 0, Math.PI*2);
    ctx.ellipse(x+w*0.65, y+h*0.40, 2.6, 2.6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  _bat(ctx,e){
    const flap=(Math.sin(this.time*12+e.phase)+1)/2;
    ctx.save();
    ctx.translate(e.x+e.w/2, e.y+e.h/2);
    ctx.fillStyle='#ef4444';
    ctx.beginPath();
    ctx.ellipse(0,0,10,8,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#fb7185';
    const wingY=-2+flap*6;
    ctx.beginPath();
    ctx.moveTo(-6,0);
    ctx.quadraticCurveTo(-22, wingY, -30, 8);
    ctx.quadraticCurveTo(-18, 4, -6, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6,0);
    ctx.quadraticCurveTo(22, wingY, 30, 8);
    ctx.quadraticCurveTo(18, 4, 6, 0);
    ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.8)';
    ctx.beginPath();
    ctx.ellipse(-4,-2,2.2,2.2,0,0,Math.PI*2);
    ctx.ellipse(4,-2,2.2,2.2,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}
