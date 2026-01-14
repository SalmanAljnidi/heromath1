import { playSound } from './utils.js';

export class Quiz {
    constructor(ui, onComplete) {
        this.el = ui; // object containing DOM elements
        this.onComplete = onComplete;
        this.timer = null;
        this.timeLeft = 20;
    }

    show() {
        const a = Math.floor(Math.random() * 10);
        const b = Math.floor(Math.random() * 10);
        const isAdd = Math.random() > 0.4;
        const answer = isAdd ? a + b : (a > b ? a - b : b - a);
        const qText = isAdd ? `${a} + ${b}` : (a > b ? `${a} - ${b}` : `${b} - ${a}`);

        this.el.question.textContent = `${qText} = ؟`;
        this.el.options.innerHTML = '';
        this.el.timer.textContent = '20';
        
        // Generate answers
        const answers = new Set([answer]);
        while(answers.size < 4) {
            answers.add(Math.max(0, answer + Math.floor(Math.random()*6) - 3));
        }
        
        Array.from(answers).sort(()=>Math.random()-0.5).forEach(ans => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = ans;
            btn.onclick = () => this.check(ans, answer, btn);
            this.el.options.appendChild(btn);
        });

        this.el.screen.classList.add('active');
        this.timeLeft = 20;
        
        if(this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.el.timer.textContent = this.timeLeft;
            if(this.timeLeft <= 0) this.resolve(false);
        }, 1000);
    }

    check(selected, correct, btn) {
        if(selected === correct) {
            btn.classList.add('correct');
            playSound('correct');
            setTimeout(() => this.resolve(true), 800);
        } else {
            btn.classList.add('wrong');
            playSound('wrong');
            setTimeout(() => this.resolve(false), 800);
        }
    }

    resolve(success) {
        clearInterval(this.timer);
        this.el.screen.classList.remove('active');
        this.onComplete(success);
    }
}
