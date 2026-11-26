/* Sincronização do cofre com a nuvem (Supabase), com criptografia de ponta a ponta:
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

/* ---------- transporte Supabase ---------- */
const CARREGADOS={};
function carrega(src){return CARREGADOS[src]||(CARREGADOS[src]=new Promise((ok,er)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>er(new Error('Não consegui carregar '+src));document.head.appendChild(s)}))}
let sb=null;
async function supaIniciar(){
  if(sb)return sb;
  if(!window.SUPABASE_CONFIG)throw new Error('SEM_CONFIG');
  if(!window.supabase)await carrega('cofre/vendor/supabase-js-2.45.4.js');
  sb=window.supabase.createClient(window.SUPABASE_CONFIG.url,window.SUPABASE_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'locatelli.nuvem'}});
  return sb;
}
/* janelinha de login da nuvem (e-mail + senha da nuvem — NÃO é a senha mestra do cofre) */
function pedeLogin(msg){return new Promise((ok,no)=>{
  const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML='<form style="background:#fff;color:#222;border-radius:10px;padding:20px;width:100%;max-width:340px;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)"><b style="font-size:16px">Entrar na nuvem</b><div style="color:#666;font-size:12px;margin:4px 0 10px">Conta da nuvem (não é a senha mestra do cofre).</div><input name="e" type="email" placeholder="e-mail" autocomplete="username" required style="width:100%;box-sizing:border-box;padding:9px;margin-bottom:8px;border:1px solid #bbb;border-radius:6px"><input name="p" type="password" placeholder="senha da nuvem" autocomplete="current-password" required style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #bbb;border-radius:6px"><div class="m" style="color:#b03a2e;font-size:12px;min-height:16px;margin-top:6px"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button type="button" class="c" style="padding:8px 12px">Cancelar</button><button style="padding:8px 14px;background:#b8860b;color:#fff;border:0;border-radius:6px;font-weight:700">Entrar</button></div></form>';
  document.body.appendChild(d);const f=d.querySelector('form');f.querySelector('.m').textContent=msg||'';f.e.focus();
  d.querySelector('.c').onclick=()=>{d.remove();no(new Error('Login cancelado.'))};
  f.onsubmit=e=>{e.preventDefault();const v={e:f.e.value.trim(),p:f.p.value};d.remove();ok(v)};
})}
async function usuario(c,entrar){
  const g=await c.auth.getSession();if(g.data&&g.data.session)return g.data.session.user;
  if(!entrar)return null;
  let msg='';
  for(let i=0;i<3;i++){
    const v=await pedeLogin(msg);
    const r=await c.auth.signInWithPassword({email:v.e,password:v.p});
    if(!r.error)return r.data.user;
    msg=/invalid/i.test(r.error.message)?'E-mail ou senha da nuvem incorretos.':r.error.message;
  }
  throw new Error(msg);
}
const ok=(r)=>{if(r.error)throw new Error(r.error.message||String(r.error));return r.data};
async function transporteSupabase(entrar){
  const c=await supaIniciar(),u=await usuario(c,entrar);if(!u)return null;
  const T0=()=>c.from('docs'),arq=()=>c.storage.from('arquivos');
  return{
    email:u.email,
    async getMeta(){const r=ok(await T0().select('d').eq('col','meta').eq('id','cofre').maybeSingle());return r?r.d:null},
    async setMeta(m){ok(await T0().upsert({uid:u.id,col:'meta',id:'cofre',d:m},{onConflict:'uid,col,id'}))},
    async listar(n){const out=[];for(let i=0;;i+=500){const r=ok(await T0().select('d').eq('col',n).order('id').range(i,i+499));out.push(...r.map(x=>x.d));if(r.length<500)break}return out},
    async gravar(n,doc){ok(await T0().upsert({uid:u.id,col:n,id:doc.id,d:doc},{onConflict:'uid,col,id'}))},
    async apagar(n,id,blob){ok(await T0().delete().eq('col',n).eq('id',id));if(blob){try{await arq().remove([u.id+'/'+id])}catch(e){}}},
    async blobPut(id,bytes){ok(await arq().upload(u.id+'/'+id,new Blob([bytes],{type:'application/octet-stream'}),{upsert:true,contentType:'application/octet-stream'}))},
    async blobGet(id){return new Uint8Array(await ok(await arq().download(u.id+'/'+id)).arrayBuffer())}
  };
}

/* ---------- controle (botão, status, automático) ---------- */
let T=null,rodando=false,agenda=null,ultima=0;const ouvintes=[];
const emite=(tipo,x)=>ouvintes.forEach(f=>{try{f(tipo,x)}catch(e){}});
const SYNC={
  sincronizar,
  configurado:()=>!!window.SUPABASE_CONFIG,
  aoMudarEstado:f=>ouvintes.push(f),
  usarTransporte:t=>{T=t},
  ultima:()=>ultima,
  /* entrar=true abre a janelinha de login (clique do usuário) */
  async executar(entrar){
    if(rodando)return null;rodando=true;emite('inicio');
    try{
      if(!T||T.__sb){const t=await transporteSupabase(!!entrar);if(!t){emite('fim',{precisaEntrar:true});return null}t.__sb=true;T=t}
      const st=await sincronizar(T,x=>emite('prog',x));ultima=Date.now();emite('fim',st);return st;
    }catch(e){emite('erro',e);throw e}finally{rodando=false}
  },
  /* chamado quando algo muda no cofre: sincroniza sozinho depois de alguns segundos, se já houver login */
  agendar(){clearTimeout(agenda);agenda=setTimeout(()=>{if(SYNC.configurado()||T)SYNC.executar(false).catch(()=>{})},4000)},
  async sair(){const c=await supaIniciar();await c.auth.signOut();T=null}
};
window.SYNC=SYNC;
})();
