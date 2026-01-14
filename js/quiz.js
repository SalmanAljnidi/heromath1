import {toArabicDigits, randInt, shuffle, clamp} from './utils.js';

export class Quiz{
  constructor(o){
    this.overlay=o.overlay;
    this.typeEl=o.typeEl;
    this.timerEl=o.timerEl;
    this.textEl=o.textEl;
    this.vizEl=o.vizEl;
    this.choicesEl=o.choicesEl;
    this.onResolve=o.onResolve;
    this.audio=o.audio;

    this.active=false;
    this.remaining=20;
    this._t=null;
    this._locked=false;

    this.correct=0;
    this.wrong=0;
    this.current=null;
  }

  _pickMode(level){
    // 0-10 always. Increase subtraction frequency a bit as level increases.
    const subBias = Math.min(0.60, 0.25 + level*0.03);
    return {subBias};
  }

  _makeAdd(){
    const a = randInt(0,10);
    const b = randInt(0,10-a);
    return {kind:'جمع', op:'+', a, b, answer:a+b, text:`${toArabicDigits(a)} + ${toArabicDigits(b)} = ؟`};
  }

  _makeSub(){
    const a = randInt(0,10);
    const b = randInt(0,a);
    return {kind:'طرح', op:'-', a, b, answer:a-b, text:`${toArabicDigits(a)} − ${toArabicDigits(b)} = ؟`};
  }

  _question(level){
    const m=this._pickMode(level);
    return (Math.random()<m.subBias) ? this._makeSub() : this._makeAdd();
  }

  _choices(answer){
    const s=new Set([answer]);
    let guard=0;
    while(s.size<4 && guard++<500){
      let c = answer + randInt(-3,3);
      c = clamp(c,0,10);
      s.add(c);
    }
    // if still not enough (rare), fill randomly
    while(s.size<4) s.add(randInt(0,10));
    return shuffle([...s]).slice(0,4);
  }

  _renderViz(q){
    if(!this.vizEl) return;
    const el=this.vizEl;
    el.innerHTML='';

    const makeGroup=(count, cutFromEnd=0)=>{
      const g=document.createElement('div');
      g.className='group';
      for(let i=0;i<count;i++){
        const d=document.createElement('span');
        d.className='dot' + (i>=count-cutFromEnd ? ' cut':'');
        g.appendChild(d);
      }
      return g;
    };

    if(q.op==='+'){
      el.appendChild(makeGroup(q.a,0));
      const op=document.createElement('div');
      op.style.cssText='display:flex;align-items:center;justify-content:center;min-width:24px;font-weight:900;opacity:.9';
      op.textContent='+';
      el.appendChild(op);
      el.appendChild(makeGroup(q.b,0));
    }else{
      el.appendChild(makeGroup(q.a,q.b));
    }
  }

  show(level){
    if(this.active) return;
    if(!this.overlay || !this.typeEl || !this.timerEl || !this.textEl || !this.choicesEl){
      // fail-safe: if UI missing, resolve as wrong to avoid soft lock
      try{ this.onResolve(false); }catch{}
      return;
    }

    this.active=true;
    this._locked=false;
    this.remaining=20;

    const q=this._question(level);
    this.current=q;

    this.typeEl.textContent=`سؤال ${q.kind}`;
    this.timerEl.textContent=toArabicDigits(this.remaining);
    this.textEl.textContent=q.text;
    this._renderViz(q);

    this.choicesEl.innerHTML='';
    this._choices(q.answer).forEach(v=>{
      const btn=document.createElement('button');
      btn.className='choice';
      btn.type='button';
      btn.textContent=toArabicDigits(v);
      btn.addEventListener('click',()=>this._pick(v,btn));
      this.choicesEl.appendChild(btn);
    });

    this.overlay.classList.add('show');

    this._t=setInterval(()=>{
      this.remaining--;
      this.timerEl.textContent=toArabicDigits(Math.max(0,this.remaining));
      if(this.remaining<=0) this._timeout();
      else if(this.remaining<=5) this.audio?.tick?.();
    },1000);
  }

  _pick(value, btn){
    if(!this.active || this._locked) return;
    this._locked=true;

    const ok = (value===this.current.answer);
    const buttons=[...this.choicesEl.querySelectorAll('button.choice')];
    buttons.forEach(b=>b.disabled=true);

    if(ok){
      btn.classList.add('good');
      this.correct++;
      this.audio?.good?.();
      setTimeout(()=>this._close(true),650);
    }else{
      btn.classList.add('bad');
      this.wrong++;
      this.audio?.bad?.();
      const corr=buttons.find(b=>b.textContent===toArabicDigits(this.current.answer));
      if(corr) corr.classList.add('good');
      setTimeout(()=>this._close(false),900);
    }
  }

  _timeout(){
    if(!this.active || this._locked) return;
    this._locked=true;
    const buttons=[...this.choicesEl.querySelectorAll('button.choice')];
    buttons.forEach(b=>b.disabled=true);
    const corr=buttons.find(b=>b.textContent===toArabicDigits(this.current.answer));
    if(corr) corr.classList.add('good');
    this.wrong++;
    this.audio?.bad?.();
    setTimeout(()=>this._close(false),900);
  }

  _close(ok){
    clearInterval(this._t); this._t=null;
    this.overlay.classList.remove('show');
    this.active=false;
    try{ this.onResolve(ok); }catch{}
  }
}
