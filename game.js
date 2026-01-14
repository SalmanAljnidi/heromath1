const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// دقة NES تقريباً
const WIDTH = 256;
const HEIGHT = 240;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// === 1. مكتبة الرسومات (Sprite Atlas) ===
// 0: شفاف, 1: أحمر/بني, 2: بيج/وجه, 3: أزرق/أسود
// رسمت لك ماريو بيدي هنا بكسل بكسل
const SPRITES = {
    marioIdle: [
        "000001111100000",
        "000011111111100",
        "000033322320000",
        "000323222322200",
        "000322333322200",
        "000332222223300",
        "000002222222000",
        "000011311100000",
        "000111311311100",
        "001111333311110",
        "002213333331220",
        "002223333332220",
        "002233333333220",
        "000033300333000",
        "000333000033300",
        "003333000033330"
    ],
    marioRun: [
        "000001111100000",
        "000011111111100",
        "000033322320000",
        "000323222322200",
        "000322333322200",
        "000332222223300",
        "000002222222000",
        "000011311310000",
        "000111311311100",
        "001111333311110",
        "002213333331220",
        "002223333332220",
        "000333333333300",
        "003333000033330",
        "033300000000333",
        "033000000000033"
    ],
    goomba: [ // الفطر الشرير
        "0000001111000000",
        "0000111111110000",
        "0001111111111000",
        "0011111111111100",
        "0011131111311100",
        "0111333113331110",
        "0111333113331110",
        "0111111111111110",
        "0112222222222110",
        "0122222222222210",
        "0022222222222200",
        "0002222222222000",
        "0000033003300000",
        "0000333003330000",
        "0000333003330000"
    ],
    brick: [ // الطوب
        "1111111111111111",
        "1222212222222221",
        "1222212222222221",
        "1222212222222221",
        "1111111111111111",
        "1222222222122221",
        "1222222222122221",
        "1222222222122221",
        "1111111111111111",
        "1222212222222221",
        "1222212222222221",
        "1222212222222221",
        "1111111111111111",
        "1222222222122221",
        "1222222222122221",
        "1111111111111111"
    ],
    qblock: [ // علامة الاستفهام
        "1111111111111111",
        "1222222222222223",
        "1223333333333223",
        "1233222222233223",
        "1233223332233223",
        "1233223332233223",
        "1233222233333223",
        "1233333333222223",
        "1222222332222223",
        "1222222332222223",
        "1222222222222223",
        "1222222332222223",
        "1222222332222223",
        "1222222222222223",
        "1222222222222223",
        "1333333333333333"
    ]
};

// الألوان لكل كائن
const PALETTES = {
    mario: { 1: '#E70000', 2: '#FFCC99', 3: '#0000E7' }, // أحمر، بشرة، أزرق
    goomba: { 1: '#AA5500', 2: '#FFCC99', 3: '#000000' }, // بني، بشرة، أسود
    brick: { 1: '#CC6600', 2: '#FF9933' }, // طوب
    qblock: { 1: '#000000', 2: '#FFCC00', 3: '#AA5500' } // ذهبي
};

// دالة رسم البكسل (المحرك السحري)
function drawSprite(ctx, key, paletteName, x, y, flip = false) {
    const pixels = SPRITES[key];
    const palette = PALETTES[paletteName];
    if (!pixels) return;

    ctx.save();
    if (flip) {
        ctx.translate(x + 16, y);
        ctx.scale(-1, 1);
        x = 0;
        y = y;
    } else {
        ctx.translate(x, y);
        x = 0; y = 0;
    }

    const pixelSize = 1; 
    for (let r = 0; r < pixels.length; r++) {
        for (let c = 0; c < pixels[r].length; c++) {
            const colorCode = pixels[r][c];
            if (colorCode !== '0') {
                ctx.fillStyle = palette[colorCode];
                ctx.fillRect(x + c, y + r, 1, 1);
            }
        }
    }
    ctx.restore();
}

// === 2. تصميم المرحلة (Tile Map) ===
// M: أرضية, B: طوب, ?: سؤال, P: أنبوب, G: فطر شرير, #: فراغ
// هذه الخريطة طويلة جداً (3 شاشات عرض)
const LEVEL_MAP = [
    "                                                                                                   ",
    "                                                                                                   ",
    "                                                                                                   ",
    "                                                                                                   ",
    "      ?                                                                                            ",
    "                                          ???               B?B?B                                  ",
    "                    ?  B?B  ?            B   B                                                     ",
    "                                                                   G                               ",
    "         G                         G               G             BBBB                              ",
    "    B  BBBBB     BB?BB       BBBBBB    BBBBBBBBB       BB      BB    BB                            ",
    "                                                    BB        BB      BB          F                ",
    "             P           P                        BB         BB        BB         F                ",
    "MMMMMMMMMMMMMMMM  MMMMMMMMMMMMMM  MMMM  MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
    "MMMMMMMMMMMMMMMM  MMMMMMMMMMMMMM  MMMM  MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM"
];

const TILE_SIZE = 16;
let tiles = [];
let enemies = [];
let levelWidth = 0;

function parseLevel() {
    tiles = []; enemies = [];
    levelWidth = LEVEL_MAP[0].length * TILE_SIZE;
    
    for(let r=0; r<LEVEL_MAP.length; r++) {
        for(let c=0; c<LEVEL_MAP[r].length; c++) {
            const char = LEVEL_MAP[r][c];
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE + (HEIGHT - LEVEL_MAP.length * TILE_SIZE); // محاذاة للأسفل
            
            if(char === 'M') tiles.push({x, y, w:16, h:16, type:'ground'});
            else if(char === 'B') tiles.push({x, y, w:16, h:16, type:'brick'});
            else if(char === '?') tiles.push({x, y, w:16, h:16, type:'qblock', used:false});
            else if(char === 'P') {
                tiles.push({x, y, w:32, h:32, type:'pipe'}); // أنبوب بسيط
            }
            else if(char === 'G') enemies.push({x, y, w:16, h:16, dir:-1, dead:false, type:'goomba'});
            else if(char === 'F') tiles.push({x, y, w:4, h:32, type:'flag'}); // علم النهاية
        }
    }
}

// === 3. فيزياء اللعبة ===
const GRAVITY = 0.25;
const FRICTION = 0.8;
const MOVE_ACCEL = 0.5; // تسارع ناعم
const JUMP_FORCE = -5.5;

let player = {
    x: 50, y: 100, w: 14, h: 16, // عرض أنحف شوي عشان يدخل بين المكعبات
    vx: 0, vy: 0,
    grounded: false,
    facing: 1, // 1 يمين, -1 يسار
    animTimer: 0,
    dead: false
};

let camera = { x: 0 };
let gameState = 'MENU'; // MENU, PLAYING, QUIZ
let safeSpot = { x: 50, y: 0 }; // نقطة الأمان
let score = 0;
let coins = 0;

// المدخلات
const input = { left: false, right: false, jump: false };

function update() {
    if(gameState !== 'PLAYING') return;

    // حركة اللاعب
    if(input.right) { player.vx += MOVE_ACCEL; player.facing = 1; }
    else if(input.left) { player.vx -= MOVE_ACCEL; player.facing = -1; }
    else { player.vx *= FRICTION; }

    // حد السرعة
    player.vx = Math.max(Math.min(player.vx, 3), -3);

    // القفز
    if(input.jump && player.grounded) {
        player.vy = JUMP_FORCE;
        player.grounded = false;
        playSound('jump');
    }

    // الجاذبية
    player.vy += GRAVITY;

    // تطبيق الحركة
    player.x += player.vx;
    checkCollisionX();
    player.y += player.vy;
    player.grounded = false;
    checkCollisionY();

    // انيميشن
    if(Math.abs(player.vx) > 0.5) player.animTimer++;
    else player.animTimer = 0;

    // تحديث الأعداء
    enemies.forEach(e => {
        if(e.dead) return;
        // حركة بسيطة
        if(Math.abs(e.x - player.x) < WIDTH + 50) { // يتحرك فقط لو قريب
            e.x += e.dir * 0.5;
            e.y += GRAVITY; // يسقط
            // تصادم العدو مع الأرض
            let eGrounded = false;
            tiles.forEach(t => {
                if(checkRect(e, t)) {
                     if(e.y + e.h - 4 <= t.y) { e.y = t.y - e.h; eGrounded = true; } // وقوف
                     else { e.dir *= -1; } // اصطدام جدار
                }
            });
        }
        
        // تصادم اللاعب مع العدو
        if(checkRect(player, e)) {
            if(player.vy > 0 && player.y + player.h - player.vy <= e.y + e.h*0.5) {
                // دعس
                e.dead = true;
                player.vy = -3;
                score += 100;
                playSound('stomp');
            } else {
                die();
            }
        }
    });

    // تحديث نقطة الأمان (كل ما يوقف على أرض ثابتة)
    if(player.grounded) {
        safeSpot.x = player.x;
        safeSpot.y = player.y - 10;
    }

    // الموت بالسقوط
    if(player.y > HEIGHT + 20) die();

    // الكاميرا تتبع اللاعب
    let targetCam = player.x - WIDTH * 0.4;
    targetCam = Math.max(0, Math.min(targetCam, levelWidth - WIDTH));
    camera.x += (targetCam - camera.x) * 0.1;
    
    // الفوز
    if(player.x > levelWidth - 50) {
        alert("مبروك! فزت!");
        initGame();
    }
}

function checkCollisionX() {
    tiles.forEach(t => {
        if(checkRect(player, t)) {
            if(player.vx > 0) player.x = t.x - player.w;
            else if(player.vx < 0) player.x = t.x + t.w;
            player.vx = 0;
        }
    });
}

function checkCollisionY() {
    tiles.forEach(t => {
        if(checkRect(player, t)) {
            if(player.vy > 0) { // هبوط
                player.y = t.y - player.h;
                player.vy = 0;
                player.grounded = true;
            } else if(player.vy < 0) { // نطح
                player.y = t.y + t.h;
                player.vy = 0;
                if(t.type === 'qblock' && !t.used) {
                    t.used = true;
                    t.type = 'brick'; // يتحول لطوب عادي
                    coins++; score+=50; playSound('coin');
                }
            }
        }
    });
}

function checkRect(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

// === 4. الرسم ===
function draw() {
    // مسح الشاشة
    ctx.fillStyle = '#5C94FC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(-Math.floor(camera.x), 0);

    // رسم البلاط
    tiles.forEach(t => {
        if(t.type === 'ground') {
            ctx.fillStyle = '#C84C0C'; ctx.fillRect(t.x, t.y, 16, 16); // بسيط للأرض
            ctx.fillStyle = '#000'; ctx.fillRect(t.x, t.y, 16, 1); // خط علوي
        } else if(t.type === 'pipe') {
             ctx.fillStyle = '#00E700'; ctx.fillRect(t.x, t.y, 32, 32);
             ctx.strokeStyle='#000'; ctx.strokeRect(t.x,t.y,32,32);
        } else if(t.type === 'flag') {
             ctx.fillStyle = '#fff'; ctx.fillRect(t.x, t.y, 4, 120);
        } else {
            drawSprite(ctx, t.type, t.type==='brick'?'brick':(t.type==='qblock'?'qblock':'brick'), t.x, t.y);
        }
    });

    // رسم الأعداء
    enemies.forEach(e => {
        if(!e.dead) drawSprite(ctx, 'goomba', 'goomba', e.x, e.y);
    });

    // رسم اللاعب (مع تبديل السبرايت للحركة)
    if(gameState === 'PLAYING') {
        let spriteKey = 'marioIdle';
        if(!player.grounded) spriteKey = 'marioRun'; // وضعية القفز
        else if(Math.abs(player.vx) > 0.5) {
            // تبديل بين صورتين للمشي
            spriteKey = (Math.floor(player.animTimer / 5) % 2 === 0) ? 'marioRun' : 'marioIdle';
        }
        drawSprite(ctx, spriteKey, 'mario', player.x, player.y, player.facing === -1);
    }

    ctx.restore();

    // تحديث الواجهة
    document.getElementById('score').innerText = score.toString().padStart(6, '0');
    document.getElementById('coins').innerText = 'x' + coins.toString().padStart(2, '0');
    
    requestAnimationFrame(update);
    if(gameState === 'PLAYING') requestAnimationFrame(draw);
}

// === 5. نظام الأسئلة والإنقاذ ===
const quizModal = document.getElementById('quiz-screen');
let quizTimer;

function die() {
    gameState = 'QUIZ';
    playSound('die');
    
    // تجهيز السؤال
    quizModal.classList.add('active');
    generateMathProblem();
    
    // مؤقت
    let timeLeft = 30;
    const bar = document.getElementById('timer-fill');
    bar.style.width = '100%';
    
    if(quizTimer) clearInterval(quizTimer);
    quizTimer = setInterval(() => {
        timeLeft--;
        bar.style.width = (timeLeft/30)*100 + '%';
        if(timeLeft <= 0) {
            clearInterval(quizTimer);
            fullReset(); // انتهى الوقت = خسارة كاملة
        }
    }, 1000);
}

function generateMathProblem() {
    const isSum = Math.random() > 0.4;
    const toArabic = n => (''+n).replace(/\d/g, d=>'٠١٢٣٤٥٦٧٨٩'[d]);

    let a = Math.floor(Math.random()*11);
    let b = Math.floor(Math.random()*11);
    let ans, qStr;

    if(isSum) {
        ans = a + b;
        qStr = `${toArabic(a)} + ${toArabic(b)}`;
    } else {
        // ضمان الطرح موجب
        if(a < b) [a, b] = [b, a];
        ans = a - b;
        qStr = `${toArabic(a)} − ${toArabic(b)}`;
    }

    document.getElementById('question-text').innerText = `${qStr} = ؟`;

    // التمثيل البصري (الميزة الجديدة)
    const visual = document.getElementById('visual-area');
    visual.innerHTML = '';
    
    // نرسم العدد الأول (الكبير في الطرح)
    const totalDots = isSum ? a : a; 
    
    // إنشاء الكرات
    for(let i=0; i<totalDots; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        // إذا طرح، نشطب آخر كرات بعدد المطروح
        if(!isSum && i >= (a - b)) {
            dot.classList.add('crossed');
        }
        visual.appendChild(dot);
    }
    // في الجمع نضيف كرات العدد الثاني بفاصل
    if(isSum) {
        const op = document.createElement('div'); op.className='operator-sign'; op.innerText='+';
        visual.appendChild(op);
        for(let i=0; i<b; i++) {
            const d = document.createElement('div'); d.className='dot'; visual.appendChild(d);
        }
    }

    // الخيارات
    const ansGrid = document.getElementById('answers-grid');
    ansGrid.innerHTML = '';
    const opts = new Set([ans]);
    while(opts.size < 4) opts.add(Math.max(0, ans + Math.floor(Math.random()*5)-2));
    
    Array.from(opts).sort(()=>Math.random()-0.5).forEach(o => {
        const btn = document.createElement('button');
        btn.className = 'ans-btn';
        btn.innerText = toArabic(o);
        btn.onclick = () => {
            if(o === ans) {
                // إجابة صحيحة
                clearInterval(quizTimer);
                quizModal.classList.remove('active');
                respawn();
            } else {
                // خطأ
                btn.style.background = '#555';
            }
        };
        ansGrid.appendChild(btn);
    });
}

function respawn() {
    gameState = 'PLAYING';
    player.x = safeSpot.x;
    player.y = safeSpot.y;
    player.vx = 0; player.vy = 0;
    requestAnimationFrame(update);
    requestAnimationFrame(draw);
}

function fullReset() {
    quizModal.classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
    gameState = 'MENU';
}

function initGame() {
    parseLevel();
    player.x = 50; player.y = 100; player.vx=0; player.vy=0;
    score = 0; coins = 0;
    camera.x = 0;
    document.getElementById('start-screen').classList.remove('active');
    gameState = 'PLAYING';
    update();
    draw();
    
    // تشغيل الصوت (تفعيل الـ Context)
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

// === صوت بسيط ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(gameState === 'MENU') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if(type === 'jump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if(type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.setValueAtTime(1500, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if(type === 'stomp') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    }
}

// المدخلات
window.addEventListener('keydown', e => {
    if(e.code==='ArrowRight') input.right=true;
    if(e.code==='ArrowLeft') input.left=true;
    if(e.code==='Space'||e.code==='ArrowUp') input.jump=true;
});
window.addEventListener('keyup', e => {
    if(e.code==='ArrowRight') input.right=false;
    if(e.code==='ArrowLeft') input.left=false;
    if(e.code==='Space'||e.code==='ArrowUp') input.jump=false;
});
document.getElementById('start-screen').addEventListener('click', initGame);

// تشغيل أولي
parseLevel();
draw();
