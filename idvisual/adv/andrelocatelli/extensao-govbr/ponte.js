/* Roda na página Clientes. Avisa que a extensão existe e repassa o pedido “entrar” ao fundo. */
document.documentElement.dataset.locGovbr='1';
window.addEventListener('message',e=>{
  if(e.source!==window||e.origin!==location.origin)return;
  const d=e.data;if(!d||d.loc!=='govbr-entrar')return;
  if(!/^\d{11}$/.test(d.cpf||'')||typeof d.senha!=='string'||!d.senha||d.senha.length>200)return;
  chrome.runtime.sendMessage({tipo:'entrar',cpf:d.cpf,senha:d.senha,alvo:d.alvo==='gov'?'gov':'inss'});
});
