import { playSound } from './utils.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Game State
        this.state = 'MENU'; // MENU, PLAYING, QUIZ
        this.width = 0;
        this.height = 0;
        this.lastTime = 0;
        
        // Physics Constants
        this.gravity = 1500;
        this.speed = 400;
        this.jumpForce = -750;

        // Entities
        this.player = { x: 50, y: 0, w: 40, h: 56, vx: 0, vy: 0, grounded: false, facing: 1, squash: 1 };
        this.camera = { x: 0 };
        this.level = { groundY: 450, platforms: [], coins: [], enemies: [], finish: 0, length: 0 };
        this.particles = [];
        
        this.input = { left: false, right: false, jump: false };
        this.stats = { level: 1, score: 0, lives: 3 };

        this.onLose = null; // Callback
        this.onWin = null; // Callback

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Fit canvas to container
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = rect.width;
        this.height = rect.height;
        this.level.groundY = this.height - 80;
    }

    startLevel(levelNum) {
        this.stats.level = levelNum;
        this.generateLevel(levelNum);
        this.respawn(true);
        this.state = 'PLAYING';
        this.lastTime = performance.now();
        requestAnimationFrame(t => this.loop(t));
    }

    respawn(fullReset) {
        this.player.x = 100;
        this.player.y = this.level.groundY - 100;
        this.player.vx = 0;
        this.player.vy = 0;
        this.camera.x = 0;
        if(fullReset) {
            this.particles = [];
        }
    }

    generateLevel(n) {
        // Procedural Generation (بناء المراحل تلقائياً)
        const mapLen = 2000 + (n * 500);
        this.level.length = mapLen;
        this.level.finish = mapLen - 150;
        this.level.platforms = [];
        this.level.coins = [];
        this.level.enemies = [];
        
        // Floor
        let cursor = 0;
        while(cursor < mapLen) {
            // Gap chance
            if(cursor > 400 && cursor < mapLen-400 && Math.random() < 0.2 + (n*0.05)) {
                cursor += 150 + Math.random()*100; // Hole
            } else {
                const w = 400 + Math.random()*600;
                this.level.platforms.push({ x: cursor, y: this.level.groundY, w: Math.min(w, mapLen-cursor), h: 200, type: 'ground' });
                cursor += w;
            }
        }

        // Elevated Platforms & Coins
        for(let x = 400; x < mapLen - 400; x += 350) {
            if(Math.random() > 0.3) {
                const y = this.level.groundY - (100 + Math.random()*120);
                const w = 150 + Math.random()*100;
                this.level.platforms.push({ x, y, w, h: 20, type: 'plat' });
                
                // Add Coin on platform
                if(Math.random() > 0.4) this.level.coins.push({ x: x+w/2, y: y-30, taken: false });

                // Add Enemy
                if(Math.random() > 0.6) {
                    this.level.enemies.push({ 
                        x: x+20, y: y-30, w:40, h:40, 
                        x1: x, x2: x+w-40, dir: 1, type: (n>2 && Math.random()>0.5)?'bat':'slime', dead: false 
                    });
                }
            }
        }
        
        // Ground Coins
        for(let i=0; i<10+n; i++) {
            this.level.coins.push({ x: 300 + Math.random()*(mapLen-500), y: this.level.groundY-30, taken: false });
        }
    }

    loop(t) {
        if(this.state !== 'PLAYING') return;
        const dt = Math.min((t - this.lastTime) / 1000, 0.05);
        this.lastTime = t;

        this.update(dt);
        this.draw();
        requestAnimationFrame(time => this.loop(time));
    }

    update(dt) {
        const p = this.player;

        // 1. Controls
        let dir = 0;
        if (this.input.left) dir = -1;
        if (this.input.right) dir = 1;

        // Acceleration
        if(dir !== 0) {
            p.vx += dir * 2000 * dt;
            p.facing = dir;
        } else {
            p.vx *= 0.8; // Friction
        }
        // Max Speed limit
        p.vx = Math.max(-this.speed, Math.min(this.speed, p.vx));

        // Jump
        if (this.input.jump && p.grounded) {
            p.vy = this.jumpForce;
            p.grounded = false;
            p.squash = 0.6; // Stretch visual
            this.input.jump = false; // Prevent hold-jump
            playSound('jump');
            this.spawnParticles(p.x + p.w/2, p.y + p.h, 10, '#cbd5e1');
        }

        // Gravity
        p.vy += this.gravity * dt;
        
        // 2. Movement & Collision
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.grounded = false;

        // Platform Collisions
        // Simple AABB logic
        for(const plat of this.level.platforms) {
            if (p.x + p.w > plat.x + 10 && p.x < plat.x + plat.w - 10) { // X Check
                if (p.y + p.h >= plat.y && p.y + p.h <= plat.y + 40 && p.vy >= 0) { // Landed on top
                    p.y = plat.y - p.h;
                    p.vy = 0;
                    p.grounded = true;
                    if(p.squash === 1) p.squash = 1.2; // Land squash
                }
            }
        }

        // 3. Game Logic
        // Pit Death
        if(p.y > this.height + 100) this.die();

        // Coins
        this.level.coins.forEach(c => {
            if(!c.taken && Math.hypot((p.x+p.w/2)-c.x, (p.y+p.h/2)-c.y) < 30) {
                c.taken = true;
                this.stats.score += 10;
                playSound('coin');
                this.spawnParticles(c.x, c.y, 8, '#fbbf24');
            }
        });

        // Enemies
        this.level.enemies.forEach(e => {
            if(e.dead) return;
            // Move Enemy
            e.x += e.dir * (e.type==='bat'?100:60) * dt;
            if(e.type === 'bat') e.y += Math.sin(this.lastTime/200)*0.5;
            
            if(e.x < e.x1 || e.x > e.x2) e.dir *= -1;

            // Collision with Player
            if(p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
                // Mario Stomp Logic
                if(p.vy > 0 && p.y + p.h < e.y + e.h/2 + 10) {
                    e.dead = true;
                    p.vy = -400; // Bounce
                    this.stats.score += 20;
                    playSound('hit');
                    this.spawnParticles(e.x+e.w/2, e.y+e.h/2, 15, '#10b981');
                } else {
                    this.die();
                }
            }
        });

        // Finish Line
        if(p.x > this.level.finish) {
            playSound('win');
            this.stats.level++;
            this.startLevel(this.stats.level);
        }

        // Camera Follow
        const targetCam = p.x - 200;
        this.camera.x += (targetCam - this.camera.x) * 0.1;

        // Visual Recovery
        p.squash += (1 - p.squash) * 10 * dt;

        // Particles
        for(let i=this.particles.length-1; i>=0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt * 2;
            if(pt.life <= 0) this.particles.splice(i, 1);
        }
    }

    die() {
        if(this.state === 'QUIZ') return;
        this.state = 'QUIZ';
        playSound('lose');
        if(this.onLose) this.onLose();
    }

    spawnParticles(x, y, count, color) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200;
            this.particles.push({
                x, y, 
                vx: Math.cos(angle) * speed, 
                vy: Math.sin(angle) * speed - 100,
                color, life: 1.0, size: Math.random()*5+2
            });
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Sky Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#4f46e5');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.translate(-this.camera.x, 0);

        // Platforms
        this.level.platforms.forEach(plat => {
            ctx.fillStyle = '#0f172a'; // Ground Body
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            ctx.fillStyle = '#10b981'; // Grass Top
            ctx.fillRect(plat.x, plat.y, plat.w, 15);
            // Detail
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(plat.x, plat.y+5, plat.w, 5);
        });

        // Finish Flag
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(this.level.finish, this.level.groundY - 100, 10, 100);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(this.level.finish+10, this.level.groundY - 100);
        ctx.lineTo(this.level.finish+60, this.level.groundY - 80);
        ctx.lineTo(this.level.finish+10, this.level.groundY - 60);
        ctx.fill();

        // Coins
        const coinBob = Math.sin(performance.now() / 200) * 5;
        this.level.coins.forEach(c => {
            if(c.taken) return;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(c.x, c.y + coinBob, 12, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(c.x, c.y + coinBob, 8, 0, Math.PI*2);
            ctx.fill();
        });

        // Enemies
        this.level.enemies.forEach(e => {
            if(e.dead) return;
            ctx.save();
            ctx.translate(e.x + e.w/2, e.y + e.h/2);
            if(e.dir < 0) ctx.scale(-1, 1);
            
            if(e.type === 'slime') {
                const sq = Math.abs(Math.sin(performance.now()/150)) * 0.1;
                ctx.scale(1+sq, 1-sq);
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.arc(0, 5, 20, Math.PI, 0);
                ctx.lineTo(20, 20); ctx.lineTo(-20, 20);
                ctx.fill();
                // Eyes
                ctx.fillStyle = 'white';
                ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'black';
                ctx.beginPath(); ctx.arc(10, 0, 3, 0, Math.PI*2); ctx.fill();
            } else {
                // Bat
                const flap = Math.sin(performance.now()/50) * 10;
                ctx.fillStyle = '#a855f7';
                ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#7e22ce';
                ctx.beginPath(); 
                ctx.moveTo(10, -5); ctx.lineTo(35, -20+flap); ctx.lineTo(20, 10); ctx.fill(); // Wing R
                ctx.moveTo(-10, -5); ctx.lineTo(-35, -20+flap); ctx.lineTo(-20, 10); ctx.fill(); // Wing L
            }
            ctx.restore();
        });

        // Player (Animated)
        const p = this.player;
        ctx.save();
        ctx.translate(p.x + p.w/2, p.y + p.h);
        ctx.scale(1/p.squash, p.squash); // Elastic effect
        if(p.facing < 0) ctx.scale(-1, 1); // Flip
        
        // Body
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.roundRect(-18, -45, 36, 40, 8); ctx.fill();
        // Head
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath(); ctx.roundRect(-14, -55, 28, 25, 6); ctx.fill();
        // Helmet
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.roundRect(-16, -60, 32, 12, 4); ctx.fill();
        // Eyes
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(6, -45, 3, 0, Math.PI*2); ctx.fill();
        // Scarf
        ctx.fillStyle = '#fbbf24';
        const wind = Math.sin(performance.now()/100)*3;
        ctx.beginPath(); ctx.moveTo(-10, -35); ctx.lineTo(-30, -30+wind); ctx.lineTo(-30, -40+wind); ctx.fill();

        ctx.restore();

        // Particles
        this.particles.forEach(pt => {
            ctx.globalAlpha = pt.life;
            ctx.fillStyle = pt.color;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        });

        ctx.restore();
    }
}
