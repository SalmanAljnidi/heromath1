import {toArabicDigits, randInt, shuffle, clamp} from './utils.js';

export class Quiz{
  constructor(o){
    this.overlay=o.overlay; this.typeEl=o.typeEl; this.timerEl=o.timerEl;
    this.textEl=o.textEl; this.choicesEl=o.choicesEl; this.vizEl=o.vizEl;
    this.onResolve=o.onResolve; this.audio=o.audio;
    this.active=false; this.remaining=20; this._t=null; this._locked=false;
    this.correct=0; this.wrong=0;
  }
  _mode(level){
    if(level<=3) return {mulMax:5, allowDiv:false, divMax:0};
    if(level<=7) return {mulMax:8, allowDiv:true, divMax:6};
    return {mulMax:10, allowDiv:true, divMax:10};
  }
  _mul(m){
    const a=randInt(1,m), b=randInt(1,10), ans=a*b;
    return {kind:'ضرب', text:`${toArabicDigits(a)} × ${toArabicDigits(b)} = ؟`, answer:ans};
  }
  _div(maxRes){
    const res=randInt(1,maxRes), div=randInt(1,10), dvd=res*div;
    return {kind:'قسمة', text:`${toArabicDigits(dvd)} ÷ ${toArabicDigits(div)} = ؟`, answer:res};
  }
  _question(level){
    const m=this._mode(level);
    if(!m.allowDiv) return this._mul(m.mulMax);
    return (Math.random()<0.45) ? this._div(m.divMax) : this._mul(m.mulMax);
  }
  _choices(answer){
    const s=new Set([answer]);
    let guard=0;
    while(s.size<4 && guard++<500){
      let c=answer + randInt(-10,10);
      if(c<0) c=Math.abs(c)+1;
      c=clamp(c,0,10);
      s.add(c);
    }
    return shuffle([...s]).slice(0,4);
  }
  show(level){
    if(this.active) return;
    this.active=true; this._locked=false; this.remaining=20;
    const q=this._question(level); this.current=q;
    this.typeEl.textContent=`سؤال ${q.kind}`;
    this.timerEl.textContent=toArabicDigits(this.remaining);
    this.textEl.textContent=q.text;

    this._renderViz(q);
    this.choicesEl.innerHTML='';
    this._choices(q.answer).forEach(v=>{
      const btn=document.createElement('button');
      btn.className='choice'; btn.type='button';
      btn.textContent=toArabicDigits(v);
      btn.addEventListener('click',()=>this._pick(v,btn));
      this.choicesEl.appendChild(btn);
    });
    this.overlay.classList.add('show');
    this._t=setInterval(()=>{
      this.remaining--;
      this.timerEl.textContent=toArabicDigits(Math.max(0,this.remaining));
      if(this.remaining<=0) this._timeout();
      else if(this.remaining<=5) this.audio.tick();
    },1000);
  }
  _pick(value, btn){
    if(!this.active || this._locked) return;
    this._locked=true;
    const ok=(value===this.current.answer);
    const buttons=[...this.choicesEl.querySelectorAll('button.choice')];
    buttons.forEach(b=>b.disabled=true);
    if(ok){
      btn.classList.add('good');
      this.correct++; this.audio.good();
      setTimeout(()=>this._close(true),650);
    }else{
      btn.classList.add('bad');
      this.wrong++; this.audio.bad();
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
    this.wrong++; this.audio.bad();
    setTimeout(()=>this._close(false),900);
  }
  _close(ok){
    clearInterval(this._t); this._t=null;
    this.overlay.classList.remove('show');
    this.active=false;
    this.onResolve(ok);
  }
}
