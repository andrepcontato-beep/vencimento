/* No Meu INSS: se você veio do botão "Entrar sozinho", clica em "Entrar com gov.br". Não lê nem guarda senha. */
(()=>{
  let n=0;
  chrome.runtime.sendMessage({tipo:'tem'},r=>{
    if(!r||!r.ok)return;
    const t=setInterval(()=>{
      if(++n>150){clearInterval(t);return}
      const b=[...document.querySelectorAll('main button, form button, button')].find(x=>/gov\.?br/i.test(x.textContent||'')&&/entrar/i.test(x.textContent||''));
      if(b&&!b.disabled){clearInterval(t);b.click()}
    },400);
  });
})();
