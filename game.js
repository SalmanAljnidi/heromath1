// إعدادات اللعبة
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ضبط الحجم ليناسب دقة "ريترو"
const GAME_WIDTH = 400; // دقة داخلية منخفضة لتعطي شكل البكسل
const GAME_HEIGHT = 225;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// متغيرات عامة
let gameRunning = false;
let frames = 0;
let score = 0;
let coins = 0;
let timeLeft = 300;

// المدخلات
const keys = { right: false, left: false, up: false };

// نقطة الأمان (عشان لو طاح يرجع هنا)
let safeSpot = { x: 50, y: 0 };

// ========================
// 1. نظام الرسومات (SPRITES)
// ========================
// بدال الصور، بنرسم البكسل بالكود عشان نضمن انها تشتغل عند الجميع
const drawPixelSprite = (ctx, type, x, y, dir = 1) => {
    ctx.save();
    if(dir === -1) {
        ctx.translate(x + 16, y);
        ctx.scale(-1, 1);
        x = 0; // Reset x relative to translation
    } else {
        ctx.translate(x, y);
    }

    if(type === 'hero') {
        // قبعة حمراء
        ctx.fillStyle = '#f00'; ctx.fillRect(0,0,16,4); ctx.fillRect(4,-2,8,2);
        // وجه
        ctx.fillStyle = '#fc9'; ctx.fillRect(2,4,10,6);
        // شنب
        ctx.fillStyle = '#000'; ctx.fillRect(8,7,4,2);
        // جسم ازرق
        ctx.fillStyle = '#00f'; ctx.fillRect(3,10,10,6);
        // اذرع حمراء
        ctx.fillStyle = '#f00'; ctx.fillRect(0,10,3,6); ctx.fillRect(13,10,3,6);
    } else if(type === 'goomba') { // الفطر الشرير
        ctx.fillStyle = '#8B4513'; // بني
        ctx.beginPath(); ctx.arc(8, 8, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; // عيون
        ctx.fillRect(4,5,2,4); ctx.fillRect(10,5,2,4);
        ctx.fillStyle = '#fc9'; // قدم
        if(Math.floor(Date.now()/200)%2===0) {
            ctx.fillRect(1,12,4,3); ctx.fillRect(11,12,4,3);
        } else {
            ctx.fillRect(3,12,4,3); ctx.fillRect(9,12,4,3);
        }
    } else if(type === 'brick') {
        ctx.fillStyle = '#B22222'; ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,16,1); ctx.fillRect(0,8,16,1);
        ctx.fillRect(8,0,1,8); ctx.fillRect(4,8,1,8); ctx.fillRect(12,8,1,8);
    } else if(type === 'qblock') {
        ctx.fillStyle = '#FFD700'; ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#000'; ctx.font='10px monospace'; ctx.fillText('?', 5, 12);
        ctx.strokeRect(1,1,14,14);
    } else if(type === 'ground') {
        ctx.fillStyle = '#8B4513'; ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#CD853F'; ctx.fillRect(2,2,12,10);
    } else if(type === 'coin') {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.ellipse(8, 8, 5, 7, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
};

// ========================
// 2. كائنات اللعبة
// ========================
class Player {
    constructor() {
        this.x = 50; this.y = 100;
        this.w = 16; this.h = 16;
        this.vx = 0; this.vy = 0;
        this.speed = 2.5; // سرعة مناسبة لمقاس اللعبة
        this.jumpPower = -6.5;
        this.grounded = false;
        this.facing = 1;
        this.dead = false;
    }
    update() {
        if(this.dead) return;

        // الحركة
        if (keys.right) { this.vx = this.speed; this.facing = 1; }
        else if (keys.left) { this.vx = -this.speed; this.facing = -1; }
        else { this.vx *= 0.8; } // احتكاك

        if (keys.up && this.grounded) {
            this.vy = this.jumpPower;
            this.grounded = false;
            playSound('jump');
        }

        this.vy += 0.3; // الجاذبية
        this.x += this.vx;
        this.y += this.vy;

        this.checkCollisions();

        // تحديث نقطة الأمان
        if(this.grounded) {
            safeSpot.x = this.x;
            safeSpot.y = this.y - 10; // احفظه فوق الأرض بشوي
        }

        // الموت بالسقوط
        if(this.y > GAME_HEIGHT) {
            handleDeath();
        }
    }
    checkCollisions() {
        this.grounded = false;
        // تصادم مع الأرضيات
        level.tiles.forEach(tile => {
            if(checkRect(this, tile)) {
                // اصطدام من فوق (هبوط)
                if(this.vy > 0 && this.y + this.h - this.vy <= tile.y) {
                    this.y = tile.y - this.h;
                    this.vy = 0;
                    this.grounded = true;
                }
                // اصطدام بالرأس (طوب)
                else if(this.vy < 0 && this.y - this.vy >= tile.y + tile.h) {
                    this.y = tile.y + tile.h;
                    this.vy = 0;
                    if(tile.type === 'qblock' && !tile.used) {
                        tile.used = true;
                        tile.type = 'brick'; // يتحول لطوب عادي
                        coins++;
                        score += 100;
                        playSound('coin');
                        updateUI();
                    }
                }
                // اصطدام جانبي
                else if(this.vx > 0) { this.x = tile.x - this.w; this.vx = 0; }
                else if(this.vx < 0) { this.x = tile.x + tile.w; this.vx = 0; }
            }
        });

        // تصادم مع العملات
        level.coins = level.coins.filter(c => {
            if(checkRect(this, c)) {
                coins++; score+=50; playSound('coin'); updateUI(); return false;
            }
            return true;
        });

        // تصادم مع الأعداء
        level.enemies.forEach(e => {
            if(e.dead) return;
            if(checkRect(this, e)) {
                // دعس العدو
                if(this.vy > 0 && this.y + this.h - this.vy <= e.y + e.h * 0.5) {
                    e.dead = true;
                    this.vy = -3; // قفزة صغيرة
                    score += 100;
                    playSound('stomp');
                    updateUI();
                } else {
                    handleDeath();
                }
            }
        });
    }
    draw() {
        if(this.dead) return;
        drawPixelSprite(ctx, 'hero', this.x, this.y, this.facing);
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 16; this.h = 16;
        this.dir = -1;
        this.dead = false;
    }
    update() {
        if(this.dead) return;
        this.x += this.dir * 0.8;
        
        // جاذبية بسيطة
        let onGround = false;
        level.tiles.forEach(t => {
            if(this.x < t.x + t.w && this.x + this.w > t.x && this.y + this.h + 1 > t.y && this.y < t.y + t.h) {
                onGround = true;
            }
            // اصطدام بالجدار يعكس الاتجاه
            if(checkRect(this, t)) {
                this.dir *= -1;
                this.x += this.dir * 2;
            }
        });
        if(!onGround) this.y += 2;
    }
    draw() {
        if(this.dead) return;
        drawPixelSprite(ctx, 'goomba', this.x, this.y, 1);
    }
}

// ========================
// 3. بناء المرحلة
// ========================
const level = { tiles: [], coins: [], enemies: [] };

function initLevel() {
    level.tiles = []; level.coins = []; level.enemies = [];
    
    // الأرضية
    for(let i=0; i<100; i++) {
        // حفر (بدون أرضية)
        if(i !== 15 && i !== 16 && i !== 40 && i !== 41) {
            level.tiles.push({x: i*16, y: GAME_HEIGHT-16, w:16, h:16, type:'ground'});
            level.tiles.push({x: i*16, y: GAME_HEIGHT, w:16, h:16, type:'ground'});
        }
    }

    // الطوب والمنصات
    const addPlatform = (x, y, w) => {
        for(let i=0; i<w; i++) level.tiles.push({x:(x+i)*16, y:y*16, w:16, h:16, type:'brick'});
    };
    const addQBlock = (x, y) => level.tiles.push({x:x*16, y:y*16, w:16, h:16, type:'qblock', used:false});

    // تصميم المرحلة (مشابه للمرحلة 1-1)
    addQBlock(8, 9);
    addPlatform(12, 9, 3); addQBlock(13, 5);
    addPlatform(20, 8, 2); 
    addPlatform(28, 9, 5); addQBlock(30, 5);
    addPlatform(45, 10, 3);
    addPlatform(55, 7, 3);

    // عملات
    for(let i=0; i<10; i++) level.coins.push({x: (20+i*5)*16, y: 100, w:10, h:14});

    // أعداء
    level.enemies.push(new Enemy(200, 180));
    level.enemies.push(new Enemy(400, 180));
    level.enemies.push(new Enemy(600, 180));
}

let player = new Player();
let cameraX = 0;

// ========================
// 4. المحرك الرئيسي
// ========================
function loop() {
    if(!gameRunning) return;
    
    ctx.fillStyle = '#5c94fc'; // لون السماء
    ctx.fillRect(0,0, canvas.width, canvas.height);

    // الكاميرا
    // خلي البطل في النص، لكن لا ترجع لليسار (مثل ماريو القديم)
    let targetCam = player.x - GAME_WIDTH * 0.4;
    if(targetCam > cameraX) cameraX = targetCam;
    
    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    // رسم الأرضيات
    level.tiles.forEach(t => drawPixelSprite(ctx, t.type, t.x, t.y));
    
    // رسم العملات
    level.coins.forEach(c => drawPixelSprite(ctx, 'coin', c.x, c.y));

    // تحديث ورسم الأعداء
    level.enemies.forEach(e => { e.update(); e.draw(); });

    // اللاعب
    player.update();
    player.draw();

    ctx.restore();

    requestAnimationFrame(loop);
}

function checkRect(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

// ========================
// 5. نظام الأسئلة (المنقذ)
// ========================
const quizScreen = document.getElementById('quiz-screen');
let quizTimerVal = 30;
let quizInterval;

function handleDeath() {
    gameRunning = false;
    player.dead = true;
    
    // إظهار السؤال
    generateQuestion();
    quizScreen.classList.add('active');
    
    // بدء المؤقت
    quizTimerVal = 30;
    document.getElementById('timer-fill').style.width = '100%';
    clearInterval(quizInterval);
    quizInterval = setInterval(() => {
        quizTimerVal--;
        document.getElementById('timer-fill').style.width = (quizTimerVal/30)*100 + '%';
        if(quizTimerVal <= 0) {
            clearInterval(quizInterval);
            resetGame(); // انتهى الوقت، خسارة كاملة
        }
    }, 1000);
}

function generateQuestion() {
    // إعداد أرقام عربية (0-10)
    const toArabic = n => (''+n).replace(/\d/g, d=>'٠١٢٣٤٥٦٧٨٩'[d]);
    
    const isPlus = Math.random() > 0.5;
    const a = Math.floor(Math.random() * 11); // 0-10
    const b = Math.floor(Math.random() * 11);
    
    let ans, qStr;
    if(isPlus) {
        // تأكد المجموع ما يتجاوز 20 للتبسيط، أو خليه بسيط
        ans = a + b;
        qStr = `${toArabic(a)} + ${toArabic(b)}`;
    } else {
        // الطرح: تأكد الأكبر أولاً
        let max = Math.max(a, b);
        let min = Math.min(a, b);
        ans = max - min;
        qStr = `${toArabic(max)} − ${toArabic(min)}`;
    }

    // العرض النصي
    document.getElementById('q-text').textContent = `${qStr} = ؟`;

    // العرض البصري (الدوائر)
    const visual = document.getElementById('q-visual');
    visual.innerHTML = '';
    
    const createDots = (count) => {
        let div = document.createElement('div');
        div.className = 'visual-group';
        for(let i=0; i<count; i++) {
            let d = document.createElement('div');
            d.className = 'dot';
            div.appendChild(d);
        }
        return div;
    };

    if(isPlus) {
        visual.appendChild(createDots(a));
        let op = document.createElement('div'); op.className='operator'; op.textContent='+';
        visual.appendChild(op);
        visual.appendChild(createDots(b));
    } else {
        // في الطرح نظهر الرقم الكبير فقط
        let max = Math.max(a, b);
        visual.appendChild(createDots(max));
    }

    // الخيارات
    const container = document.getElementById('answers-container');
    container.innerHTML = '';
    
    let options = new Set([ans]);
    while(options.size < 4) {
        let wrong = ans + Math.floor(Math.random()*5) - 2;
        if(wrong >= 0) options.add(wrong);
    }
    
    Array.from(options).sort(()=>Math.random()-0.5).forEach(opt => {
        let btn = document.createElement('button');
        btn.className = 'ans-btn';
        btn.textContent = toArabic(opt);
        btn.onclick = () => checkAnswer(opt, ans);
        container.appendChild(btn);
    });
}

function checkAnswer(selected, correct) {
    if(selected === correct) {
        // إجابة صحيحة: العودة لنقطة الأمان
        clearInterval(quizInterval);
        quizScreen.classList.remove('active');
        respawnSafe();
    } else {
        // إجابة خاطئة: مؤثر اهتزاز أو صوت (اختياري)
        // حالياً نعيد اللعبة بالكامل عقاباً
        clearInterval(quizInterval);
        resetGame();
    }
}

function respawnSafe() {
    // إرجاع اللاعب لآخر مكان آمن
    player.dead = false;
    player.x = safeSpot.x;
    player.y = safeSpot.y - 20; // ارفعه شوي عشان ما يعلق
    player.vx = 0; 
    player.vy = 0;
    gameRunning = true;
    requestAnimationFrame(loop);
}

function resetGame() {
    quizScreen.classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
    score = 0; coins = 0;
    updateUI();
    initLevel();
    player = new Player();
    cameraX = 0;
    safeSpot = {x: 50, y: 0};
    gameRunning = false;
}

// ========================
// 6. الصوت والتحكم
// ========================
// مولد أصوات بسيط
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if(type === 'jump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if(type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.setValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if(type === 'stomp') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    }
}

// التحكم بالكيبورد
window.addEventListener('keydown', e => {
    if(e.code === 'ArrowRight') keys.right = true;
    if(e.code === 'ArrowLeft') keys.left = true;
    if(e.code === 'Space' || e.code === 'ArrowUp') keys.up = true;
});
window.addEventListener('keyup', e => {
    if(e.code === 'ArrowRight') keys.right = false;
    if(e.code === 'ArrowLeft') keys.left = false;
    if(e.code === 'Space' || e.code === 'ArrowUp') keys.up = false;
});

// التحكم باللمس
const btnRight = document.getElementById('btn-right');
const btnLeft = document.getElementById('btn-left');
const btnJump = document.getElementById('btn-jump');

const addTouch = (elem, code, val) => {
    elem.addEventListener('touchstart', (e) => { e.preventDefault(); keys[code] = true; });
    elem.addEventListener('touchend', (e) => { e.preventDefault(); keys[code] = false; });
};
addTouch(btnRight, 'right');
addTouch(btnLeft, 'left');
addTouch(btnJump, 'up');

// زر البدء
document.getElementById('start-screen').addEventListener('click', () => {
    document.getElementById('start-screen').classList.remove('active');
    initLevel();
    player = new Player();
    gameRunning = true;
    loop();
});

function updateUI() {
    document.getElementById('score').innerText = score.toString().padStart(4, '0');
    document.getElementById('coins').innerText = 'x' + coins.toString().padStart(2, '0');
}

// تشغيل أولي
initLevel();
