import {Quiz} from './quiz.js';
import {Game, AudioFX} from './game.js';
import {toArabicDigits} from './utils.js';

const canvas=document.getElementById('game');
const ui={
  level:document.getElementById('uiLevel'),
  score:document.getElementById('uiScore'),
  correct:document.getElementById('uiCorrect'),
  wrong:document.getElementById('uiWrong'),
  player:document.getElementById('uiPlayer')
};

const audio=new AudioFX();

// ===== اسم اللاعب (بسيط + محفوظ) =====
const nameOverlay=document.getElementById('nameOverlay');
const nameInput=document.getElementById('nameInput');
const btnSaveName=document.getElementById('btnSaveName');
const btnChangeName=document.getElementById('btnChangeName');

let playerName=(localStorage.getItem('heroMathName')||'').trim();

function syncNameUI(){
  if(ui.player) ui.player.textContent = playerName ? playerName : '—';
  if(game && typeof game.setPlayerName==='function') game.setPlayerName(playerName);
}

function openNameOverlay(){
  if(!nameOverlay) return;
  nameOverlay.classList.add('show');
  if(nameInput){
    nameInput.value = playerName || '';
    nameInput.focus();
  }
}

function closeNameOverlay(){
  if(!nameOverlay) return;
  nameOverlay.classList.remove('show');
}

function requireName(){
  if(playerName) return true;
  openNameOverlay();
  return false;
}

function saveName(){
  const v=(nameInput?.value||'').trim();
  if(!v) return;
  playerName=v;
  localStorage.setItem('heroMathName', playerName);
  syncNameUI();
  closeNameOverlay();
  audio._ensure();
  if(!game.running) game.start();
}

if(btnSaveName) btnSaveName.addEventListener('click', saveName);
if(nameInput) nameInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); saveName(); }});
if(btnChangeName) btnChangeName.addEventListener('click', openNameOverlay);


// PWA
if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try{ await navigator.serviceWorker.register('./sw.js'); }catch{}
  });
}

const quiz = new Quiz({
  overlay:document.getElementById('quizOverlay'),
  typeEl:document.getElementById('quizType'),
  timerEl:document.getElementById('quizTimer'),
  textEl:document.getElementById('quizText'),
  vizEl:document.getElementById('quizViz'),
  choicesEl:document.getElementById('quizChoices'),
  audio,
  onResolve:(ok)=>game.afterQuiz(ok)
});

const game = new Game(canvas, ui, ()=>{
  if(quiz.active) return;
  quiz.show(game.levelIndex+1);
});
game.audio = audio;

// keyboard
window.addEventListener('keydown', e=>{
  if(quiz.active) return;
  if(e.code==='ArrowLeft') game.setInput('left', true);
  if(e.code==='ArrowRight') game.setInput('right', true);
  if(e.code==='Space'){
    game.setInput('jump', true);
    audio._ensure();
    e.preventDefault();
  }
});
window.addEventListener('keyup', e=>{
  if(e.code==='ArrowLeft') game.setInput('left', false);
  if(e.code==='ArrowRight') game.setInput('right', false);
  if(e.code==='Space') game.setInput('jump', false);
});

// buttons
document.getElementById('btnStart').addEventListener('click', ()=>{
  if(!requireName()) return;
  audio._ensure();
  if(!game.running) game.start();
});
document.getElementById('btnRestart').addEventListener('click', ()=>{
  if(!requireName()) return;
  audio._ensure();
  game.levelIndex=0;
  game._resetLevel(true);
  if(!game.running) game.start();
});

// joystick
const joy=document.getElementById('joy');
const knob=document.getElementById('knob');
const btnJump=document.getElementById('btnJump');
let joyActive=false;
let joyCenter={x:0,y:0};
const joyRadius=58;

function setKnob(dx,dy){
  const dist=Math.hypot(dx,dy);
  const k=dist>joyRadius ? (joyRadius/dist) : 1;
  const x=dx*k, y=dy*k;
  knob.style.transform=`translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  game.setTouchAxis(x/joyRadius);
}
function resetKnob(){
  knob.style.transform='translate(-50%,-50%)';
  game.setTouchAxis(0);
}

joy.addEventListener('pointerdown', e=>{
  if(quiz.active) return;
  joyActive=true;
  joy.setPointerCapture(e.pointerId);
  const r=joy.getBoundingClientRect();
  joyCenter={x:r.left+r.width/2, y:r.top+r.height/2};
  audio._ensure();
  setKnob(e.clientX-joyCenter.x, e.clientY-joyCenter.y);
});
joy.addEventListener('pointermove', e=>{
  if(!joyActive) return;
  setKnob(e.clientX-joyCenter.x, e.clientY-joyCenter.y);
});
joy.addEventListener('pointerup', ()=>{
  joyActive=false; resetKnob();
});
joy.addEventListener('pointercancel', ()=>{
  joyActive=false; resetKnob();
});

btnJump.addEventListener('pointerdown', e=>{
  if(quiz.active) return;
  audio._ensure();
  game.setTouchJump(true);
  e.preventDefault();
});
['pointerup','pointercancel','pointerleave'].forEach(ev=>{
  btnJump.addEventListener(ev, ()=>game.setTouchJump(false));
});
