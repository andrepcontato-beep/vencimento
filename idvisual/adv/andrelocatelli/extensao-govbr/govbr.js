/* Roda na página de login do gov.br: preenche CPF → Continuar → senha → Entrar.
   Captcha e verificação em duas etapas continuam por sua conta. */
(async()=>{
  const c=await chrome.runtime.sendMessage({tipo:'pegar'});
  if(!c)return;
  const visivel=e=>e&&e.offsetParent!==null&&!e.disabled;
  const poe=(el,v)=>{el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);
    ['input','change','blur'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})))};
  const botao=(...ids)=>{for(const q of ids){const b=document.querySelector(q);if(visivel(b))return b}
    return [...document.querySelectorAll('button,input[type=submit]')].find(b=>visivel(b)&&/^(continuar|entrar|avançar)/i.test((b.innerText||b.value||'').trim()))};
  let passo1=false,fim=Date.now()+90000;
  const t=setInterval(async()=>{
    if(Date.now()>fim){clearInterval(t);return}
    const sen=document.querySelector('input[type=password]');
    if(visivel(sen)){
      clearInterval(t);poe(sen,c.senha);
      const b=botao('#submit-button','button[type=submit]');
      await chrome.runtime.sendMessage({tipo:'limpar'});
      if(b)setTimeout(()=>b.click(),250);
      return}
    const cpf=document.querySelector('#accountId,input[name=accountId]');
    if(!passo1&&visivel(cpf)){
      passo1=true;poe(cpf,c.cpf);
      const b=botao('#enter-account-id','button[type=submit]');
      if(b)setTimeout(()=>b.click(),250)}
  },400);
})();
