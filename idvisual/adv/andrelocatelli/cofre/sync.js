/* Sincronização do cofre com a nuvem (Firebase), com criptografia de ponta a ponta:
   só dados JÁ CRIPTOGRAFADOS (AES-256-GCM, senha mestra) saem do navegador. A nuvem nunca vê a senha mestra nem o conteúdo.
   Regra de conflito: vale o registro mais recente (carimbo "u"); o histórico de alterações é somado entre aparelhos. */
(function(){
const b64=b=>COFRE.raw.b64(b),deb64=s=>COFRE.raw.deb64(s);
const ab=x=>x instanceof ArrayBuffer?x:(x&&x.buffer?x.buffer.slice(x.byteOffset,x.byteOffset+x.byteLength):x);

/* ---------- algoritmo (independe do tipo de nuvem): T = transporte ---------- */
async function sincronizar(T,prog){
  const R=COFRE.raw,st={subiu:0,baixou:0},say=t=>prog&&prog(t);
  say('Conferindo o cofre…');
  const rm=await T.getMeta(),lm=await R.get('meta','sal'),lv=await R.get('meta','verif');
  if(lm&&lv){
    if(!rm)await T.setMeta({sal:lm.v,viv:lv.v.iv,vct:b64(lv.v.ct)});
    else if(rm.sal!==lm.v)throw new Error('A nuvem tem um cofre criado com outra senha mestra. Para juntar, restaure o backup deste aparelho num navegador sem cofre.');
  }else if(rm){await COFRE.aplicarMeta(rm.sal,rm.viv,rm.vct);st.novoAparelho=true}
  else return Object.assign(st,{vazio:true});

  say('Clientes…');
  const rem=new Map((await T.listar('clientes')).map(d=>[d.id,d]));
  for(const l of await R.todos('clientes')){
    if(!l.u){l.u=Date.now();await R.put('clientes',l)}
    const r=rem.get(l.id);rem.delete(l.id);
    if(!r||(r.u||0)<l.u){await T.gravar('clientes',l.apagado?{id:l.id,u:l.u,apagado:true}:{id:l.id,u:l.u,iv:l.iv,ct:b64(l.ct)});st.subiu++}
    else if((r.u||0)>l.u){await R.put('clientes',r.apagado?{id:r.id,u:r.u,apagado:true}:{id:r.id,u:r.u,iv:r.iv,ct:deb64(r.ct).buffer});st.baixou++}
  }
  for(const r of rem.values()){await R.put('clientes',r.apagado?{id:r.id,u:r.u,apagado:true}:{id:r.id,u:r.u,iv:r.iv,ct:deb64(r.ct).buffer});st.baixou++}
  /* clientes apagados definitivamente: some o que sobrou deles (aqui e na nuvem) */
  const morto=new Set((await R.todos('clientes')).filter(c=>c.apagado).map(c=>c.id));
  for(const h of await R.todos('historico'))if(morto.has(h.cid))await R.del('historico',h.id);
  for(const a of await R.todos('arquivos'))if(morto.has(a.cid))await R.del('arquivos',a.id);

  say('Histórico…');
  const remH=new Map((await T.listar('historico')).map(d=>[d.id,d]));
  for(const x of [...remH.values()])if(morto.has(x.cid)){if(T.apagar)await T.apagar('historico',x.id);remH.delete(x.id)}
  for(const l of await R.todos('historico')){if(!remH.has(l.id)){await T.gravar('historico',{id:l.id,cid:l.cid,t:l.t,iv:l.iv,ct:b64(l.ct)});st.subiu++}remH.delete(l.id)}
  for(const r of remH.values()){await R.put('historico',{id:r.id,cid:r.cid,t:r.t,iv:r.iv,ct:deb64(r.ct).buffer});st.baixou++}

  say('Arquivos…');
  const remA=new Map((await T.listar('arquivos')).map(d=>[d.id,d]));
  for(const x of [...remA.values()])if(morto.has(x.cid)){if(T.apagar)await T.apagar('arquivos',x.id,true);remA.delete(x.id)}
  for(const l of await R.todos('arquivos')){
    if(!l.u){l.u=Date.now();await R.put('arquivos',l)}
    const r=remA.get(l.id);remA.delete(l.id);
    if(!r){say('Enviando arquivo…');await T.blobPut(l.id,new Uint8Array(ab(l.d.ct)));await T.gravar('arquivos',{id:l.id,cid:l.cid,u:l.u,hiv:l.h.iv,hct:b64(l.h.ct),div:l.d.iv});st.subiu++}
    else if((r.u||0)<l.u){await T.gravar('arquivos',{...r,u:l.u,hiv:l.h.iv,hct:b64(l.h.ct)});st.subiu++}
    else if((r.u||0)>l.u){await R.put('arquivos',{...l,u:r.u,h:{iv:r.hiv,ct:deb64(r.hct).buffer}});st.baixou++}
  }
  for(const r of remA.values()){say('Baixando arquivo…');const bytes=await T.blobGet(r.id);
    await R.put('arquivos',{id:r.id,cid:r.cid,u:r.u,h:{iv:r.hiv,ct:deb64(r.hct).buffer},d:{iv:r.div,ct:ab(bytes)}});st.baixou++}
  return st;
}

/* ---------- transporte Firebase ---------- */
const CARREGADOS={};
function carrega(src){return CARREGADOS[src]||(CARREGADOS[src]=new Promise((ok,er)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>er(new Error('Não consegui carregar '+src));document.head.appendChild(s)}))}
let fb=null;
async function firebaseIniciar(){
  if(fb)return fb;
  if(!window.FIREBASE_CONFIG)throw new Error('SEM_CONFIG');
  for(const f of ['app','auth','firestore','storage'])await carrega(`vendor/firebase-${f}-compat.js?v=1`);
  const app=firebase.apps.length?firebase.app():firebase.initializeApp(window.FIREBASE_CONFIG);
  fb={app,auth:firebase.auth(),db:firebase.firestore(),st:firebase.storage()};
  return fb;
}
async function usuario(f,entrar){
  if(f.auth.currentUser)return f.auth.currentUser;
  const u=await new Promise(ok=>{const off=f.auth.onAuthStateChanged(x=>{off();ok(x)})});
  if(u||!entrar)return u;
  const r=await f.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());return r.user;
}
async function transporteFirebase(entrar){
  const f=await firebaseIniciar(),u=await usuario(f,entrar);if(!u)return null;
  const base=f.db.collection('users').doc(u.uid),col=n=>base.collection(n);
  return{
    email:u.email,
    async getMeta(){const d=await base.collection('meta').doc('cofre').get();return d.exists?d.data():null},
    async setMeta(m){await base.collection('meta').doc('cofre').set(m)},
    async listar(n){const q=await col(n).get();return q.docs.map(d=>d.data())},
    async gravar(n,doc){await col(n).doc(doc.id).set(doc)},
    async apagar(n,id,blob){await col(n).doc(id).delete();if(blob){try{await f.st.ref(`users/${u.uid}/arquivos/${id}`).delete()}catch(e){}}},
    async blobPut(id,bytes){await f.st.ref(`users/${u.uid}/arquivos/${id}`).put(new Blob([bytes],{type:'application/octet-stream'}))},
    async blobGet(id){return new Uint8Array(await f.st.ref(`users/${u.uid}/arquivos/${id}`).getBytes())}
  };
}

/* ---------- controle (botão, status, automático) ---------- */
let T=null,rodando=false,agenda=null,ultima=0;const ouvintes=[];
const emite=(tipo,x)=>ouvintes.forEach(f=>{try{f(tipo,x)}catch(e){}});
const SYNC={
  sincronizar,
  configurado:()=>!!window.FIREBASE_CONFIG,
  aoMudarEstado:f=>ouvintes.push(f),
  usarTransporte:t=>{T=t},
  ultima:()=>ultima,
  /* entrar=true abre o login do Google (clique do usuário) */
  async executar(entrar){
    if(rodando)return null;rodando=true;emite('inicio');
    try{
      if(!T||T.__fb){const t=await transporteFirebase(!!entrar);if(!t){emite('fim',{precisaEntrar:true});return null}t.__fb=true;T=t}
      const st=await sincronizar(T,x=>emite('prog',x));ultima=Date.now();emite('fim',st);return st;
    }catch(e){emite('erro',e);throw e}finally{rodando=false}
  },
  /* chamado quando algo muda no cofre: sincroniza sozinho depois de alguns segundos, se já houver login */
  agendar(){clearTimeout(agenda);agenda=setTimeout(()=>{if(SYNC.configurado()||T)SYNC.executar(false).catch(()=>{})},4000)},
  async sair(){const f=await firebaseIniciar();await f.auth.signOut();T=null}
};
window.SYNC=SYNC;
})();
