import { Game } from './game.js';
import { Quiz } from './quiz.js';
import { playSound, initAudio } from './utils.js';

// Elements
const startScreen = document.getElementById('startScreen');
const nameInput = document.getElementById('nameInput');
const btnStart = document.getElementById('btnStartGame');
const canvas = document.getElementById('gameCanvas');

// HUD
const uiLevel = document.getElementById('uiLevel');
const uiScore = document.getElementById('uiScore');
const uiPlayer = document.getElementById('uiPlayer');

// Setup Game
const game = new Game(canvas);

// Setup Quiz
const quiz = new Quiz({
    screen: document.getElementById('quizScreen'),
    question: document.getElementById('quizQuestion'),
    options: document.getElementById('quizOptions'),
    timer: document.getElementById('quizTimer')
}, (success) => {
    // لما ينتهي السؤال
    if(success) {
        game.respawn(false);
        game.state = 'PLAYING';
        game.loop(performance.now());
    } else {
        // إذا جاوب خطأ نعيد المرحلة من البداية
        game.stats.score = Math.max(0, game.stats.score - 50);
        game.startLevel(game.stats.level);
    }
    updateUI();
});

// Link Game Callbacks
game.onLose = () => {
    quiz.show();
};

// UI Loop
setInterval(updateUI, 200);
function updateUI() {
    uiLevel.textContent = game.stats.level;
    uiScore.textContent = game.stats.score;
}

// Start Button Logic
btnStart.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'البطل';
    uiPlayer.textContent = name;
    
    // Hide Screen
    startScreen.classList.remove('active');
    
    // Start Audio Context
    initAudio();
    
    // Start Game
    game.startLevel(1);
});

// Controls (Keyboard)
window.addEventListener('keydown', e => {
    if(e.code === 'ArrowLeft') game.input.left = true;
    if(e.code === 'ArrowRight') game.input.right = true;
    if(e.code === 'Space') game.input.jump = true;
});
window.addEventListener('keyup', e => {
    if(e.code === 'ArrowLeft') game.input.left = false;
    if(e.code === 'ArrowRight') game.input.right = false;
    if(e.code === 'Space') game.input.jump = false;
});

// Controls (Touch)
document.getElementById('btnLeft').addEventListener('touchstart', (e) => { e.preventDefault(); game.input.left = true; });
document.getElementById('btnLeft').addEventListener('touchend', (e) => { e.preventDefault(); game.input.left = false; });
document.getElementById('btnRight').addEventListener('touchstart', (e) => { e.preventDefault(); game.input.right = true; });
document.getElementById('btnRight').addEventListener('touchend', (e) => { e.preventDefault(); game.input.right = false; });
document.getElementById('btnJump').addEventListener('touchstart', (e) => { e.preventDefault(); game.input.jump = true; });
document.getElementById('btnJump').addEventListener('touchend', (e) => { e.preventDefault(); game.input.jump = false; });
