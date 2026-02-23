// bins.js - simple simulator for three bins
(function(){
  const cards = Array.from(document.querySelectorAll('.bin-card'));
  const randomizeBtn = document.getElementById('randomize');
  const setLow = document.getElementById('set-low');
  const setMed = document.getElementById('set-medium');
  const setHigh = document.getElementById('set-high');

  function setLevel(card, percent){
    const fill = card.querySelector('.bin-fill');
    const glow = card.querySelector('.bin-glow');
    const pct = card.querySelector('.bin-percent');
    percent = Math.max(0,Math.min(100,Math.round(percent)));
    // set height
    fill.style.height = percent + '%';
    pct.textContent = percent + '%';
    // color states
    fill.classList.remove('state-medium','state-high');
    glow.classList.remove('glow-medium','glow-strong');
    // control wave animation speed via CSS variable (faster when near full)
    const waveSpeed = Math.max(0.8, 6 - (percent/20)); // between ~0.8s and 6s
    fill.style.setProperty('--wave-speed', waveSpeed + 's');
    if(percent > 5) fill.classList.add('wave'); else fill.classList.remove('wave');
    if(percent >= 90){
      fill.classList.add('state-high');
      glow.classList.add('glow-strong');
      // dramatic pulsing when critically full
      card.animate([
        { boxShadow: '0 10px 30px rgba(255,60,60,0.06)' },
        { boxShadow: '0 20px 60px rgba(255,60,60,0.12)' },
        { boxShadow: '0 10px 30px rgba(255,60,60,0.06)' }
      ],{duration:1200,iterations:3});
    } else if(percent >= 60){
      fill.classList.add('state-medium');
      glow.classList.add('glow-medium');
    } else {
      // green
    }
  }

  function randomizeAll(){
    cards.forEach(card=>{
      const p = Math.floor(Math.random()*101);
      setLevel(card,p);
    });
  }

  // init with some values
  function init(){
    // example starting values
    setLevel(cards[0], 32);
    setLevel(cards[1], 68);
    setLevel(cards[2], 93);

    // click to toggle a single random animation
    cards.forEach(card=>{
      card.addEventListener('click',()=>{
        const p = Math.floor(Math.random()*101);
        setLevel(card,p);
      });
    });

    randomizeBtn && randomizeBtn.addEventListener('click',randomizeAll);
    setLow && setLow.addEventListener('click',()=>cards.forEach(c=>setLevel(c,20)));
    setMed && setMed.addEventListener('click',()=>cards.forEach(c=>setLevel(c,65)));
    setHigh && setHigh.addEventListener('click',()=>cards.forEach(c=>setLevel(c,92)));
  }

  // wait for DOM
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
