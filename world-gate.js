/* Mosaic World entry keypad. This is a playful entry gate, not account authentication. */
(() => {
  let previous = null, busy = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'mosaic-keypad';
  dialog.setAttribute('aria-labelledby', 'mosaic-keypad-title');
  dialog.innerHTML = '<form method="dialog"><div class="keypad-cap"><span aria-hidden="true">◆</span><button type="submit" aria-label="Close keypad">×</button></div><p class="keypad-kicker">AFTER HOURS</p><h2 id="mosaic-keypad-title">The Mosaics</h2><p>Enter your access code.</p><label class="sr" for="mosaic-access">Access code</label><input id="mosaic-access" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-describedby="mosaic-keypad-status"><p id="mosaic-keypad-status" role="status" aria-live="polite"></p><div class="keypad-grid"></div><button class="keypad-enter" type="button">Enter world →</button></form>';
  const input = dialog.querySelector('input'), status = dialog.querySelector('[role="status"]'), grid = dialog.querySelector('.keypad-grid');
  for (const key of ['1','2','3','4','5','6','7','8','9','Clear','0','⌫']) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = key;
    if(key === '⌫') button.setAttribute('aria-label','Delete last digit');
    button.addEventListener('click', () => { input.value = key === 'Clear' ? '' : key === '⌫' ? input.value.slice(0,-1) : (input.value + key).slice(0,4); status.textContent=''; }); grid.append(button);
  }
  const enter = async () => {
    if (busy) return;
    if (input.value.length !== 4) {status.textContent='Enter four digits.'; input.focus(); return;}
    busy=true;
    try {
      const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.value));
      const value=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
      if(value === 'eb3d9dac46073924cffbc322aeac56e17b3c33c8005b591d3209e26e14af625b') {input.value=''; location.assign('/world/'); return;}
      input.value=''; status.textContent='That code did not match. Try again.'; input.focus();
    } finally {busy=false;}
  };
  dialog.querySelector('.keypad-enter').addEventListener('click',enter);
  input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,4);status.textContent='';});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();enter();}});
  dialog.addEventListener('close',()=>{input.value='';status.textContent='';previous?.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  document.body.append(dialog);
  const open = element => {previous=element;input.value='';status.textContent='';if(!dialog.open)dialog.showModal();input.focus({preventScroll:true});};
  document.addEventListener('click',e=>{const target=e.target.closest('.bar__mark, #wordmark, #foot-mark, .prop--sign');if(!target)return;e.preventDefault();e.stopImmediatePropagation();open(target);},true);
  for(const element of document.querySelectorAll('#wordmark, #foot-mark')) {element.tabIndex=0;element.setAttribute('role','button');element.setAttribute('aria-label','Open Mosaic World keypad');element.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(element);}});}
})();
