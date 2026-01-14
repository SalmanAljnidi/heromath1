let audioCtx = null;

export function initAudio() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

export function playSound(type) {
    if(!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'jump') {
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
    } 
    else if (type === 'coin') {
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.setValueAtTime(1600, t + 0.1);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
    }
    else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t); osc.stop(t + 0.1);
    }
    else if (type === 'correct') {
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.setValueAtTime(900, t+0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t+0.4);
        osc.start(t); osc.stop(t+0.4);
    }
    else if (type === 'lose') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.5);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
    }
}
