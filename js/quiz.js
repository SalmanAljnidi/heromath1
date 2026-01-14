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
    this.mode=(o.mode||'primary');
  }

  setMode(mode){ this.mode = (mode==='upper') ? 'upper' : 'primary'; }

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

  _makeMul(){
    const a = randInt(0,10);
    const b = randInt(0,10);
    return {kind:'ضرب', op:'×', a, b, answer:a*b, text:`${toArabicDigits(a)} × ${toArabicDigits(b)} = ؟`};
  }

  _makeDiv(){
    const divisor = randInt(1,10);
    const quotient = randInt(0,10);
    const dividend = divisor * quotient;
    return {kind:'قسمة', op:'÷', a:dividend, b:divisor, answer:quotient, text:`${toArabicDigits(dividend)} ÷ ${toArabicDigits(divisor)} = ؟`};
  }

  _question(level){
    if(this.mode==='upper'){
      // Mix multiplication and division
      const divBias = Math.min(0.55, 0.25 + level*0.03);
      return (Math.random()<divBias) ? this._makeDiv() : this._makeMul();
    }else{
      const m=this._pickMode(level);
      return (Math.random()<m.subBias) ? this._makeSub() : this._makeAdd();
    }
  }

  _choices(answer, q){
    const s=new Set([answer]);
    let guard=0;
    const max = (q && q.op==='×') ? 100 : 10;
    const span = (max===100) ? 12 : 3;
    while(s.size<4 && guard++<800){
      let c = answer + randInt(-span, span);
      c = clamp(c,0,max);
      s.add(c);
    }
    while(s.size<4) s.add(randInt(0,max));
    return shuffle([...s]).slice(0,4);
  }

  _renderViz(q){
    if(!this.vizEl) return;
    const el=this.vizEl;
    el.innerHTML='';
    if(this.mode==='upper'){
      // No representation for upper grades
      return;
    }
    const makeGroup=(count, cutFromEnd=0)=>{
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
    this._choices(q.answer, q).forEach(v=>{
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
