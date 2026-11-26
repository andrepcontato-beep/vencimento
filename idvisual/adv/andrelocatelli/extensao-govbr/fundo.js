/* Guarda CPF/senha só em memória de sessão (some ao fechar o Chrome) e por no máximo 3 minutos. */
const VALE=3*60*1000;
chrome.runtime.onMessage.addListener((m,s,res)=>{
  (async()=>{
    if(m&&m.tipo==='entrar'&&s.tab){
      await chrome.storage.session.set({pend:{cpf:m.cpf,senha:m.senha,t:Date.now()}});
      await chrome.tabs.create({url:m.alvo==='gov'?'https://sso.acesso.gov.br/login':'https://meu.inss.gov.br/'});
      res({ok:true});
    }else if(m&&m.tipo==='pegar'&&s.url&&s.url.startsWith('https://sso.acesso.gov.br/')){
      const {pend}=await chrome.storage.session.get('pend');
      res(pend&&Date.now()-pend.t<VALE?{cpf:pend.cpf,senha:pend.senha}:null);
    }else if(m&&m.tipo==='limpar'){
      await chrome.storage.session.remove('pend');res({ok:true});
    }else res(null);
  })();
  return true;
});
