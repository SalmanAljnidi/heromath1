import { clamp, toArabicDigits } from './utils.js';

// === AUDIO SYSTEM (محسن) ===
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.vol = 0.3; // صوت متزن
  }
  _ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  _play(freqs, type, dur, slide = 0) {
    if (!this.enabled) return;
    this._ensure();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freqs, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freqs * slide, t + dur);
    
    g.gain.setValueAtTime(this.vol, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  
  jump() { this._play(300, 'sine', 0.2, 2); } // صوت قفز ناعم يتصاعد
  coin() { 
    this._play(1200, 'sine', 0.1); 
    setTimeout(() => this._play(1800, 'sine', 0.2), 80); 
  }
  win() { 
    [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this._play(f, 'triangle', 0.3), i * 100));
  }
  hit() { this._play(150, 'sawtooth', 0.3, 0.1); } // صوت اصطدام منخفض
  good() { this._play(880, 'sine', 0.15); setTimeout(()=>this._play(1100, 'sine', 0.3), 100); }
  bad() { this._play(200, 'sawtooth', 0.2); setTimeout(()=>this._play(150, 'sawtooth', 0.3), 150); }
  tick() { this._play(800, 'square', 0.05); }
}

// === PARTICLES (نظام الجزيئات) ===
class Particle {
  constructor(x, y, color, speed, size) {
    this.x = x; this.y = y;
    const ang = Math.random() * Math.PI * 2;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.life = 1.0;
    this.decay = 0.02 + Math.random() * 0.03;
    this.color = color;
    this.size = size;
    this.grav = 500;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.grav * dt;
    this.life -= this.decay;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 40; this.h = 54;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.inv = 0; // Invincibility timer
    this.animTimer = 0;
    this.squash = 1; // Stretch factor for animation
  }
}

export class Game {
  constructor(canvas, ui, onLose) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false }); // Optimize
    this.ui = ui;
    this.onLose = onLose;
    this.audio = new AudioFX();

    this.keys = { left: false, right: false, jump: false };
    this.touchAxis = 0;
    this.touchJump = false;

    // Physics
    this.gravity = 1800; // جاذبية أثقل شوي لشعور واقعي
    this.speed = 420;
    this.jumpV = -780;

    this.levels = this._makeLevels(12);
    this.levelIndex = 0;
    
    // Game State
    this.particles = [];
    this.cameraX = 0;
    this.shake = 0; // اهتزاز الشاشة
    
    this.score = 0;
    this.correct = 0;
    this.wrong = 0;
    this.time = 0;
    this.running = false;
    
    this._resetLevel(true);
    this._last = 0;
  }

  // --- LEVEL GENERATION ---
  _makeLevels(n) {
    // ثيمات بصرية منوعة
    const themes = [
      { skyTop:'#1e293b', skyBot:'#3b82f6', grass:'#10b981', soil:'#065f46', cloudOP:0.3 }, // نهار
      { skyTop:'#4c0519', skyBot:'#fb7185', grass:'#f59e0b', soil:'#78350f', cloudOP:0.1 }, // غروب
      { skyTop:'#0f172a', skyBot:'#1e1b4b', grass:'#6366f1', soil:'#312e81', cloudOP:0.1 }  // ليل
    ];

    const lvls = [];
    for (let i = 0; i < n; i++) {
      const w = 3000 + i * 400;
      const gY = 480;
      const theme = themes[i % 3];
      
      const holes = [];
      const spikes = [];
      const plats = [];
      const coins = [];
      const enemies = [];
      
      // Procedural Generation Logic (مختصر للحفاظ على حجم الكود)
      // Holes
      for(let h=0; h<3+Math.floor(i/2); h++) {
        holes.push({x: 600 + h*600 + i*50, w: 120 + Math.random()*50});
      }
      
      // Ground Platforms
      let cur = 0;
      let sortedHoles = [...holes].sort((a,b)=>a.x - b.x);
      for(let ho of sortedHoles) {
        if(ho.x > cur) plats.push({x:cur, y:gY, w:ho.x-cur, h:200, type:'ground'});
        cur = ho.x + ho.w;
      }
      plats.push({x:cur, y:gY, w:w-cur, h:200, type:'ground'});

      // Air Platforms & Hazards
      const segment = 300;
      for(let x=400; x<w-400; x+=segment) {
        if(Math.random() > 0.3) {
          const h = 20;
          const y = gY - 100 - Math.random() * 120;
          const width = 140 + Math.random()*60;
          // Check hole overlap (simple check)
          const inHole = sortedHoles.some(ho => x+width > ho.x && x < ho.x+ho.w);
          
          if(!inHole) {
            plats.push({x, y, w:width, h, type:'plat'});
            if(Math.random() > 0.5) coins.push({x: x+width/2, y: y-30, taken:false});
            if(i>1 && Math.random() > 0.7) spikes.push({x: x+40, y: y-15, w: width-80, h:15});
            
            // Enemy
            if(Math.random() > 0.6) {
               enemies.push({
                 x: x+20, y: y-30, x0:x, x1:x+width-40, 
                 type: (Math.random()>0.7 && i>2)?'bat':'slime',
                 dir:1, dead:false
               });
            }
          }
        }
      }
      // More coins on ground
      for(let k=0; k<10; k++) {
         let cx = 500 + Math.random()*(w-600);
         let cy = gY - 30;
         coins.push({x:cx, y:cy, taken:false});
      }

      lvls.push({ width: w, groundY: gY, holes, spikes, platforms: plats, coins, enemies, theme, finish: w-150 });
    }
    return lvls;
  }

  _resetLevel(full) {
    const lvl = this.levels[this.levelIndex];
    this.player = new Player(100, lvl.groundY - 100);
    this.checkpoint = {x: 100, y: lvl.groundY - 100};
    this.cameraX = 0;
    this.particles = [];
    
    // Deep copy for reset
    this.activeCoins = lvl.coins.map(c => ({...c}));
    this.activeEnemies = lvl.enemies.map(e => ({...e}));
    
    if (full) { this.score = 0; this.correct = 0; this.wrong = 0; }
    this._syncUI();
    this.running = true;
    this.dead = false;
  }

  _syncUI() {
    if (!this.ui) return;
    this.ui.level.textContent = toArabicDigits(this.levelIndex + 1);
    this.ui.score.textContent = toArabicDigits(this.score);
    this.ui.correct.textContent = toArabicDigits(this.correct);
    this.ui.wrong.textContent = toArabicDigits(this.wrong);
  }

  start() { if (!this.running) { this.running = true; this._last = performance.now(); requestAnimationFrame(t => this._loop(t)); } }
  
  setPlayerName(n) { this.playerName = n; }
  setInput(k, v) { this.keys[k] = v; }
  setTouchAxis(v) { this.touchAxis = clamp(v, -1, 1); }
  setTouchJump(v) { this.touchJump = !!v; }

  _loop(t) {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this._last) / 1000);
    this._last = t;
    this.time += dt;

    this._update(dt);
    this._draw();
    requestAnimationFrame(tt => this._loop(tt));
  }

  _update(dt) {
    if(this.dead) return;
    const p = this.player;
    const lvl = this.levels[this.levelIndex];

    // Controls
    const axis = (Math.abs(this.touchAxis) > 0.1) ? this.touchAxis : 0;
    const left = this.keys.left || axis < -0.2;
    const right = this.keys.right || axis > 0.2;
    const jump = this.keys.jump || this.touchJump;

    // Movement Physics
    const accel = this.speed * (axis !== 0 ? Math.abs(axis) : 1);
    if (left) { p.vx = -accel; p.facing = -1; p.animTimer += dt; }
    else if (right) { p.vx = accel; p.facing = 1; p.animTimer += dt; }
    else { p.vx *= 0.8; p.animTimer = 0; } // Friction

    // Jump
    if (jump && p.onGround) {
      p.vy = this.jumpV;
      p.onGround = false;
      p.squash = 0.6; // Stretch up
      this.audio.jump();
      this._spawnParticles(p.x + p.w/2, p.y + p.h, 10, '#fff');
    }

    p.vy += this.gravity * dt;
    p.x += p.vx * dt;
    p.x = clamp(p.x, 0, lvl.width - p.w);

    // Platform Collisions
    const prevY = p.y;
    p.y += p.vy * dt;
    p.onGround = false;

    for (let plat of lvl.platforms) {
      if (p.x + p.w > plat.x + 5 && p.x < plat.x + plat.w - 5) { // X overlap
        if (prevY + p.h <= plat.y + 10 && p.y + p.h >= plat.y) { // Landing
          if(p.vy > 0) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.onGround = true;
            if(p.squash === 1) p.squash = 1.3; // Squash down on land
            this.checkpoint = {x:p.x, y:p.y};
          }
        }
      }
    }

    // Squash recovery
    p.squash += (1 - p.squash) * 10 * dt;

    // Pit Death
    if (p.y > lvl.groundY + 100) this._die();

    // Spikes
    for(let s of lvl.spikes) {
       if(this._overlap(p, s)) this._die();
    }

    // Coins
    for(let c of this.activeCoins) {
      if(!c.taken && this._dist(p.x+p.w/2, p.y+p.h/2, c.x, c.y) < 40) {
        c.taken = true;
        this.score += 10;
        this.audio.coin();
        this._spawnParticles(c.x, c.y, 8, '#fbbf24');
        this._syncUI();
      }
    }

    // Enemies
    for(let e of this.activeEnemies) {
      if(e.dead) continue;
      // Enemy AI
      if(e.type === 'slime') {
        e.x += e.dir * 80 * dt;
        if(e.x < e.x0 || e.x > e.x1) e.dir *= -1;
      } else { // Bat
        e.x += e.dir * 100 * dt;
        e.y += Math.sin(this.time * 5) * 1;
        if(e.x < e.x0 || e.x > e.x1) e.dir *= -1;
      }

      // Collision
      if(this._overlap(p, {x:e.x, y:e.y, w:40, h:40})) {
        if(p.vy > 0 && p.y + p.h < e.y + 30) { // Stomp
          e.dead = true;
          p.vy = -400; // Bounce
          this.score += 20;
          this.audio.hit();
          this._spawnParticles(e.x+20, e.y+20, 15, '#10b981');
          this.shake = 5;
          this._syncUI();
        } else if(p.inv <= 0) {
          this._die();
        }
      }
    }

    // Finish
    if (p.x > lvl.finish) {
      this.audio.win();
      this._advanceLevel();
    }

    if (p.inv > 0) p.inv -= dt;

    // Camera follow (Smooth Lerp)
    const targetX = p.x - 300;
    this.cameraX += (targetX - this.cameraX) * 0.1;
    this.cameraX = clamp(this.cameraX, 0, lvl.width - 900);

    // Screen Shake decay
    if(this.shake > 0) this.shake *= 0.9;
    if(this.shake < 0.5) this.shake = 0;

    // Particles update
    this.particles.forEach(pt => pt.update(dt));
    this.particles = this.particles.filter(pt => pt.life > 0);
  }

  _die() {
    if(this.dead) return;
    this.dead = true;
    this.shake = 20;
    this.audio.hit();
    this.onLose();
  }

  _spawnParticles(x, y, count, color) {
    for(let i=0; i<count; i++) {
      this.particles.push(new Particle(x, y, color, 100+Math.random()*200, 3+Math.random()*3));
    }
  }

  _advanceLevel() {
    this.levelIndex = (this.levelIndex + 1) % this.levels.length;
    this._resetLevel(false);
  }
  
  afterQuiz(ok) {
    if(ok) {
      this.correct++;
      this.player.x = this.checkpoint.x;
      this.player.y = this.checkpoint.y - 20;
      this.player.vy = 0;
      this.player.inv = 2;
      this.dead = false;
      this._spawnParticles(this.player.x+20, this.player.y+20, 20, '#38bdf8');
    } else {
      this.wrong++;
      this._resetLevel(false); // Restart level if wrong
    }
    this._syncUI();
  }

  _overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  _dist(x1,y1,x2,y2) { return Math.sqrt((x1-x2)**2 + (y1-y2)**2); }

  // --- DRAWING ENGINE (رسم احترافي) ---
  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const lvl = this.levels[this.levelIndex];
    
    // 1. Background (Gradient Sky)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, lvl.theme.skyTop);
    grad.addColorStop(1, lvl.theme.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Parallax Clouds/Hills
    ctx.save();
    // Shake effect
    const sx = (Math.random()-0.5)*this.shake;
    const sy = (Math.random()-0.5)*this.shake;
    ctx.translate(sx, sy);
    
    // Distant clouds
    ctx.fillStyle = `rgba(255,255,255,${lvl.theme.cloudOP})`;
    for(let i=0; i<10; i++) {
      let cx = (i*200 - this.cameraX * 0.2) % (w+400);
      if(cx < -200) cx += w+400;
      this._drawCloud(ctx, cx, 100 + (i%3)*50, 60 + (i%2)*20);
    }

    ctx.translate(-this.cameraX, 0);

    // 3. World
    // Platforms
    for(let p of lvl.platforms) {
      // Body (Soil)
      ctx.fillStyle = lvl.theme.soil;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // Top (Grass) with decoration
      ctx.fillStyle = lvl.theme.grass;
      ctx.fillRect(p.x, p.y, p.w, 15);
      // Grass blades details
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for(let g=p.x; g<p.x+p.w; g+=20) {
        ctx.fillRect(g, p.y, 4, 15);
      }
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(p.x, p.y+p.h-5, p.w, 5);
    }

    // Spikes
    ctx.fillStyle = '#94a3b8';
    for(let s of lvl.spikes) {
      ctx.beginPath();
      for(let i=0; i<s.w; i+=10) {
        ctx.lineTo(s.x+i+5, s.y);
        ctx.lineTo(s.x+i+10, s.y+s.h);
        ctx.lineTo(s.x+i, s.y+s.h);
      }
      ctx.fill();
    }

    // Finish Flag
    ctx.fillStyle = '#fff';
    ctx.fillRect(lvl.finish, lvl.groundY-80, 5, 80);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(lvl.finish+5, lvl.groundY-80);
    ctx.lineTo(lvl.finish+40, lvl.groundY-65);
    ctx.lineTo(lvl.finish+5, lvl.groundY-50);
    ctx.fill();

    // Coins
    for(let c of this.activeCoins) {
      if(c.taken) continue;
      const bob = Math.sin(this.time * 8) * 5;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      // Glow
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
      // Gold Coin
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Enemies
    for(let e of this.activeEnemies) {
      if(e.dead) continue;
      ctx.save();
      ctx.translate(e.x + 20, e.y + 20);
      if(e.dir < 0) ctx.scale(-1, 1);
      
      if(e.type === 'slime') {
        // Cute slime blob
        const sq = Math.abs(Math.sin(this.time * 10)) * 0.1;
        ctx.scale(1 + sq, 1 - sq);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(0, 0, 18, Math.PI, 0); // top dome
        ctx.lineTo(18, 15);
        ctx.lineTo(-18, 15);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(8, -5, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(8+e.dir*2, -5, 2, 0, Math.PI*2); ctx.fill();
      } else {
        // Bat
        const flap = Math.sin(this.time * 15);
        ctx.fillStyle = '#a855f7';
        ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
        // Wings
        ctx.fillStyle = '#7e22ce';
        ctx.beginPath(); 
        ctx.moveTo(5,0); ctx.lineTo(25, -10 + flap*10); ctx.lineTo(15, 10); ctx.fill();
        ctx.moveTo(-5,0); ctx.lineTo(-25, -10 + flap*10); ctx.lineTo(-15, 10); ctx.fill();
      }
      ctx.restore();
    }

    // Player (Cute Character)
    this._drawPlayer(ctx, this.player);

    // Particles
    for(let p of this.particles) p.draw(ctx);

    ctx.restore();
  }

  _drawCloud(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI*2);
    ctx.arc(x+size*0.8, y+size*0.2, size*0.7, 0, Math.PI*2);
    ctx.arc(x-size*0.8, y+size*0.2, size*0.7, 0, Math.PI*2);
    ctx.fill();
  }

  _drawPlayer(ctx, p) {
    if(p.inv > 0 && Math.floor(this.time*15)%2===0) return; // Blink
    
    ctx.save();
    ctx.translate(p.x + p.w/2, p.y + p.h); // Pivot at feet
    
    // Squash & Stretch
    ctx.scale(1/p.squash, p.squash); 
    if(p.facing < 0) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = '#38bdf8'; // Blue suit
    ctx.beginPath();
    ctx.roundRect(-18, -45, 36, 40, 10);
    ctx.fill();

    // Face
    ctx.fillStyle = '#ffe4c4'; // Skin
    ctx.beginPath();
    ctx.roundRect(-14, -42, 28, 20, 8);
    ctx.fill();

    // Eyes (Look in direction of speed)
    ctx.fillStyle = '#000';
    const eyeOff = Math.abs(p.vx) > 10 ? 4 : 0;
    ctx.beginPath(); ctx.arc(6+eyeOff, -34, 3, 0, Math.PI*2); ctx.fill(); // Right
    ctx.beginPath(); ctx.arc(-4+eyeOff, -34, 3, 0, Math.PI*2); ctx.fill(); // Left

    // Cap/Helmet
    ctx.fillStyle = '#ef4444'; // Red Hat
    ctx.beginPath();
    ctx.fillRect(-18, -48, 36, 8);
    ctx.fillRect(-18, -52, 20, 8); // Brim
    ctx.fill();

    // Scarf (Wind effect)
    ctx.fillStyle = '#f59e0b';
    const wind = Math.sin(this.time * 20) * 5;
    const speedTilt = -clamp(p.vx * 0.05, -15, 15);
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.lineTo(-25 + speedTilt, -15 + wind);
    ctx.lineTo(-25 + speedTilt, -25 + wind);
    ctx.fill();

    ctx.restore();
  }
}
