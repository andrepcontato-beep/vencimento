/* Cofre de clientes — tudo fica NO NAVEGADOR deste computador (IndexedDB), criptografado com a senha mestra.
   Nada é enviado a servidor nem ao GitHub. AES-256-GCM, chave derivada por PBKDF2 (SHA-256, 250 mil iterações).
   Se a senha mestra for esquecida, os dados NÃO podem ser recuperados (por isso existe o backup criptografado). */
(function(){
/* modo demonstração (index.html?demo=1): cofre próprio, separado do real; a marca vale só nesta aba */
const DEMO=(()=>{try{if(window===window.top){if(/[?&]demo=1/.test(location.search))sessionStorage.setItem('demo','1');else sessionStorage.removeItem('demo')}return sessionStorage.getItem('demo')==='1'}catch(e){return false}})();
const DB=DEMO?'locatelli-demo':'locatelli-clientes',ITER=250000,SK=DEMO?'cofre.chave.demo':'cofre.chave';
let chave=null,db=null;
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>{let s='';new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x));return btoa(s)};
const deb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

function abreDB(){return db?Promise.resolve(db):new Promise((ok,err)=>{
  const r=indexedDB.open(DB,2);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'k'});if(!d.objectStoreNames.contains('clientes'))d.createObjectStore('clientes',{keyPath:'id'});if(!d.objectStoreNames.contains('arquivos')){const a=d.createObjectStore('arquivos',{keyPath:'id'});a.createIndex('cid','cid')}if(!d.objectStoreNames.contains('historico')){const h=d.createObjectStore('historico',{keyPath:'id'});h.createIndex('cid','cid')}};
  r.onsuccess=()=>{db=r.result;ok(db)};r.onerror=()=>err(r.error)})}
const tx=async(st,modo,fn)=>{const d=await abreDB();return new Promise((ok,err)=>{const t=d.transaction(st,modo),s=t.objectStore(st),r=fn(s);t.oncomplete=()=>ok(r&&r.result!==undefined?r.result:undefined);t.onerror=()=>err(t.error);t.onabort=()=>err(t.error)})};
const get=(st,k)=>tx(st,'readonly',s=>s.get(k)),put=(st,v)=>tx(st,'readwrite',s=>s.put(v)),del=(st,k)=>tx(st,'readwrite',s=>s.delete(k)),todos=st=>tx(st,'readonly',s=>s.getAll());

async function derivar(senha,sal){const m=await crypto.subtle.importKey('raw',enc.encode(senha),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:sal,iterations:ITER,hash:'SHA-256'},m,{name:'AES-GCM',length:256},true,['encrypt','decrypt'])}
async function cifra(buf){const iv=crypto.getRandomValues(new Uint8Array(12));return{iv:b64(iv),ct:await crypto.subtle.encrypt({name:'AES-GCM',iv},chave,buf)}}
async function decifra(r){return crypto.subtle.decrypt({name:'AES-GCM',iv:deb64(r.iv)},chave,r.ct)}
const cifraJSON=async o=>cifra(enc.encode(JSON.stringify(o)));
const decifraJSON=async r=>JSON.parse(dec.decode(await decifra(r)));

async function lembra(){const raw=await crypto.subtle.exportKey('raw',chave);try{sessionStorage.setItem(SK,b64(raw))}catch(e){}}

/* ----- histórico de alterações: resumo legível do que mudou ----- */
const ROT={origem:'Origem',dpp:'Data provável do parto',nome:'Nome',cpf:'CPF',rg:'RG',tel:'Telefone',nac:'Nacionalidade',ec:'Estado civil',prof:'Profissão',sexo:'Sexo',end:'Endereço',cep:'CEP',cid:'Cidade/UF',nasc:'Nascimento',cond:'Condição',notas:'Observações'};
const vz=v=>{v=v==null?'':String(v);return v.length>70?v.slice(0,70)+'…':(v||'—')};
function diff(a,b){
  const r=[],g=(o,k)=>{const v=o&&o[k];return v==null?'':String(v)};
  for(const k in ROT){if(g(a,k)!==g(b,k))r.push(ROT[k]+': '+vz(g(a,k))+' → '+vz(g(b,k)))}
  for(const k in ROT){if(k==='notas'||k==='nasc'||k==='cond')continue;if(g(a.rep,k)!==g(b.rep,k)&&(g(a.rep,k)||g(b.rep,k)))r.push('Representante · '+ROT[k]+': '+vz(g(a.rep,k))+' → '+vz(g(b.rep,k)))}
  if(!!a.repr!==!!b.repr)r.push(b.repr?'Cadastro passou a ser de representado(a)':'Cadastro deixou de ser de representado(a)');
  if(g(a,'govSenha')!==g(b,'govSenha'))r.push(!g(a,'govSenha')?'Senha do gov.br cadastrada':!g(b,'govSenha')?'Senha do gov.br apagada':'Senha do gov.br alterada');
  const nomeMk=k=>window.MARCAS&&MARCAS[k]?MARCAS[k].nome:k;
  {const A3=a.marcas||[],B3=b.marcas||[];B3.filter(x=>!A3.includes(x)).forEach(x=>r.push('Marcador adicionado: '+nomeMk(x)));A3.filter(x=>!B3.includes(x)).forEach(x=>r.push('Marcador removido: '+nomeMk(x)))}
  const A=a.beneficios||[],B=b.beneficios||[];B.filter(x=>!A.includes(x)).forEach(x=>r.push('Serviço adicionado: '+x));A.filter(x=>!B.includes(x)).forEach(x=>r.push('Serviço removido: '+x));
  {const ch=x=>(x.andamento||[]).map(y=>y.e+'|'+y.t),A2=ch(a),B2=ch(b);(b.andamento||[]).filter(y=>!A2.includes(y.e+'|'+y.t)).forEach(y=>r.push('Andamento adicionado: '+y.e));(a.andamento||[]).filter(y=>!B2.includes(y.e+'|'+y.t)).forEach(y=>r.push('Andamento removido: '+y.e))}
  {const ha=a.honorarios||{},hb=b.honorarios||{},m=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
   if((Number(ha.valor)||0)!==(Number(hb.valor)||0))r.push('Honorários: '+m(ha.valor)+' → '+m(hb.valor));
   if((ha.obs||'')!==(hb.obs||''))r.push('Honorários · observação: '+vz(ha.obs)+' → '+vz(hb.obs));
   const PA=ha.pagamentos||[],PB=hb.pagamentos||[];PB.filter(x=>!PA.some(y=>y.id===x.id)).forEach(x=>r.push('Pagamento registrado: '+m(x.v)+(x.o?' ('+x.o+')':'')));PA.filter(x=>!PB.some(y=>y.id===x.id)).forEach(x=>r.push('Pagamento removido: '+m(x.v)))}
  if(!a.excluido!==!b.excluido)r.push(b.excluido?'Cliente excluído':'Cliente restaurado');
  return r}

const avisa=()=>{try{COFRE.aoMudar&&COFRE.aoMudar()}catch(e){}};
const COFRE={
  demo:DEMO,
  async configurado(){return !!(await get('meta','verif'))},
  /* primeira vez: cria a senha mestra */
  async criar(senha){
    if(!senha||senha.length<8)throw new Error('A senha mestra precisa ter pelo menos 8 caracteres.');
    const sal=crypto.getRandomValues(new Uint8Array(16));chave=await derivar(senha,sal);
    const v=await cifra(enc.encode('cofre-locatelli-ok'));
    await put('meta',{k:'sal',v:b64(sal)});await put('meta',{k:'verif',v});await lembra();return true},
  async abrir(senha){
    const sal=await get('meta','sal'),ver=await get('meta','verif');if(!sal||!ver)throw new Error('Cofre ainda não foi criado.');
    const k=await derivar(senha,deb64(sal.v));chave=k;
    try{if(dec.decode(await decifra(ver.v))!=='cofre-locatelli-ok')throw 0}catch(e){chave=null;throw new Error('Senha mestra incorreta.')}
    await lembra();return true},
  /* reabre sem pedir senha de novo enquanto a aba estiver aberta (entre o gerador e a lista de clientes) */
  async retomar(){
    if(chave)return true;let s=null;try{s=sessionStorage.getItem(SK)}catch(e){}
    if(s){try{chave=await crypto.subtle.importKey('raw',deb64(s),'AES-GCM',true,['encrypt','decrypt']);
      const ver=await get('meta','verif');if(!ver){chave=null;return false}
      await decifra(ver.v);return true}catch(e){chave=null;try{sessionStorage.removeItem(SK)}catch(x){}}}
    /* "lembrar neste dispositivo": chave guardada como CryptoKey NÃO exportável (a senha nunca é guardada) */
    try{const d=await get('meta','dev');if(d&&d.v){chave=d.v;const ver=await get('meta','verif');if(!ver){chave=null;return false}await decifra(ver.v);return true}}catch(e){chave=null}
    return false},
  /* troca a senha mestra: recifra tudo (clientes, arquivos, histórico) com a nova chave; a nuvem é atualizada na próxima sincronização */
  async trocarSenha(atual,nova){
    if(!nova||nova.length<8)throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
    const sal0=await get('meta','sal'),ver=await get('meta','verif');if(!sal0||!ver)throw new Error('Cofre ainda não foi criado.');
    const k0=await derivar(atual||'',deb64(sal0.v));
    try{if(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:deb64(ver.v.iv)},k0,ver.v.ct))!=='cofre-locatelli-ok')throw 0}catch(e){throw new Error('Senha atual incorreta.')}
    const sal=crypto.getRandomValues(new Uint8Array(16)),k1=await derivar(nova,sal);
    const re=async r=>{const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:deb64(r.iv)},k0,r.ct),iv=crypto.getRandomValues(new Uint8Array(12));return{iv:b64(iv),ct:await crypto.subtle.encrypt({name:'AES-GCM',iv},k1,pt)}};
    const agora=Date.now(),cs=[],as=[],hs=[];
    for(const x of await todos('clientes'))cs.push(x.apagado||!x.ct?x:{...x,...await re(x),u:agora});
    for(const a of await todos('arquivos'))as.push({...a,h:await re(a.h),d:await re(a.d),u:agora});
    for(const h of await todos('historico'))hs.push({...h,...await re(h)});
    const iv=crypto.getRandomValues(new Uint8Array(12)),vv={iv:b64(iv),ct:await crypto.subtle.encrypt({name:'AES-GCM',iv},k1,enc.encode('cofre-locatelli-ok'))};
    for(const x of cs)await put('clientes',x);for(const x of as)await put('arquivos',x);for(const x of hs)await put('historico',x);
    await put('meta',{k:'sal',v:b64(sal),trocada:agora});await put('meta',{k:'verif',v:vv});
    chave=k1;await lembra();if(await COFRE.temDispositivo())await COFRE.lembrarDispositivo();
    avisa();return true},
  async lembrarDispositivo(){if(!chave)return false;try{const raw=await crypto.subtle.exportKey('raw',chave);const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);await put('meta',{k:'dev',v:k});return true}catch(e){return false}},
  async esquecerDispositivo(){try{await del('meta','dev')}catch(e){}},
  async temDispositivo(){try{const d=await get('meta','dev');return !!(d&&d.v)}catch(e){return false}},
  aberto(){return !!chave},
  bloquear(){chave=null;try{sessionStorage.removeItem(SK)}catch(e){}},

  /* ----- clientes ----- */
  async listar(){const r=await todos('clientes'),o=[];for(const x of r){if(x.apagado||String(x.id).startsWith('sys-'))continue;try{o.push(await decifraJSON(x))}catch(e){}}
    return o.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR'))},
  /* entradas financeiras avulsas (não ligadas a cliente): registro especial 'sys-avulsos' (sincroniza e entra no backup junto com os clientes) */
  async avulsos(){const x=await get('clientes','sys-avulsos');if(!x||x.apagado)return[];try{return(await decifraJSON(x)).itens||[]}catch(e){return[]}},
  async salvarAvulsos(itens){await put('clientes',{id:'sys-avulsos',u:Date.now(),...await cifraJSON({id:'sys-avulsos',itens})});avisa()},
  async obter(id){const x=await get('clientes',id);return x?decifraJSON(x):null},
  async salvar(c,o){o=o||{};if(!c.id)c.id=uid();
    const prev=await COFRE.obter(c.id);c.atualizado=Date.now();if(!c.criado)c.criado=c.atualizado;
    if(prev&&!o.semHistorico){const r=diff(prev,c);if(r.length)await put('historico',{id:uid(),cid:c.id,t:Date.now(),...await cifraJSON({antes:prev,resumo:o.restauracao?['Versão restaurada',...r]:r})})}
    await put('clientes',{id:c.id,u:Date.now(),...await cifraJSON(c)});avisa();return c},
  /* histórico do cliente (mais recente primeiro) */
  async historico(cid){const d=await abreDB(),r=await new Promise((ok,err)=>{const q=d.transaction('historico','readonly').objectStore('historico').index('cid').getAll(cid);q.onsuccess=()=>ok(q.result);q.onerror=()=>err(q.error)}),o=[];
    for(const x of r){try{o.push({id:x.id,t:x.t,...await decifraJSON(x)})}catch(e){}}return o.sort((a,b)=>b.t-a.t)},
  /* volta o cadastro ao estado em que estava ANTES daquela alteração (a restauração também fica no histórico, então dá para desfazer) */
  async restaurar(hid){const x=await get('historico',hid);if(!x)throw new Error('Entrada não encontrada.');const e=await decifraJSON(x);
    if(e.arq){await COFRE.marcarArquivo(e.arq,false);await put('historico',{id:uid(),cid:x.cid,t:Date.now(),...await cifraJSON({resumo:['Arquivo restaurado: '+(e.arqNome||'')]})});return 'arquivo'}
    const atual=await COFRE.obter(x.cid)||{};const c=Object.assign({},e.antes);c.criado=atual.criado||c.criado;await COFRE.salvar(c,{restauracao:true});return 'cliente'},
  async apagarDefinitivo(id){for(const a of await COFRE.arquivos(id,true))await del('arquivos',a.id);for(const h of await COFRE.historico(id))await del('historico',h.id);await put('clientes',{id,u:Date.now(),apagado:true});avisa()},
  async excluir(id){for(const a of await COFRE.arquivos(id,true))await del('arquivos',a.id);for(const h of await COFRE.historico(id))await del('historico',h.id);await del('clientes',id)},
  /* procura por CPF (só dígitos) */
  async porCpf(cpf){const d=String(cpf||'').replace(/\D/g,'');if(d.length!==11)return null;return(await COFRE.listar()).find(c=>!c.excluido&&String(c.cpf||'').replace(/\D/g,'')===d)||null},

  /* ----- arquivos ----- */
  async addArquivo(cid,{nome,tipo,origem,blob}){
    const buf=await blob.arrayBuffer(),id=uid(),h=await cifraJSON({nome,tipo:tipo||blob.type||'',origem:origem||'',data:Date.now(),tamanho:buf.byteLength}),d=await cifra(buf);
    await put('arquivos',{id,cid,u:Date.now(),h,d});avisa();return id},
  async arquivos(cid,todos){const d=await abreDB(),r=await new Promise((ok,err)=>{const q=d.transaction('arquivos','readonly').objectStore('arquivos').index('cid').getAll(cid);q.onsuccess=()=>ok(q.result);q.onerror=()=>err(q.error)}),o=[];
    for(const x of r){try{const m=await decifraJSON(x.h);if(todos||!m.del)o.push({id:x.id,cid:x.cid,...m})}catch(e){}}return o.sort((a,b)=>b.data-a.data)},
  /* exclusão de arquivo vai para a lixeira (continua no cofre) e fica registrada no histórico, onde pode ser restaurada */
  async marcarArquivo(id,del){const x=await get('arquivos',id);if(!x)return;const m=await decifraJSON(x.h);if(del)m.del=Date.now();else delete m.del;await put('arquivos',{...x,u:Date.now(),h:await cifraJSON(m)});avisa()},
  async arquivoParaLixeira(id){const x=await get('arquivos',id);if(!x)return;const m=await decifraJSON(x.h);await COFRE.marcarArquivo(id,true);await put('historico',{id:uid(),cid:x.cid,t:Date.now(),...await cifraJSON({arq:id,arqNome:m.nome,resumo:['Arquivo excluído: '+m.nome]})})},
  async lerArquivo(id){const x=await get('arquivos',id);if(!x)return null;const m=await decifraJSON(x.h);return new Blob([await decifra(x.d)],{type:m.tipo||'application/octet-stream'})},
  async excluirArquivo(id){await del('arquivos',id)},

  /* ----- backup (já sai criptografado; só abre com a mesma senha mestra) ----- */
  async exportar(){
    const o={versao:1,meta:(await todos('meta')).filter(m=>m.k!=='dev'),clientes:await todos('clientes'),arquivos:await todos('arquivos'),historico:await todos('historico')};
    const cv=r=>({...r,ct:r.ct?b64(r.ct):undefined});
    const j=JSON.stringify({versao:1,meta:o.meta.map(m=>m.k==='verif'?{k:m.k,v:{iv:m.v.iv,ct:b64(m.v.ct)}}:m),
      clientes:o.clientes.filter(c=>!c.apagado).map(c=>({id:c.id,u:c.u,iv:c.iv,ct:b64(c.ct)})),
      arquivos:o.arquivos.map(a=>({id:a.id,cid:a.cid,u:a.u,h:{iv:a.h.iv,ct:b64(a.h.ct)},d:{iv:a.d.iv,ct:b64(a.d.ct)}})),
      historico:o.historico.map(h=>({id:h.id,cid:h.cid,t:h.t,iv:h.iv,ct:b64(h.ct)}))});
    return new Blob([j],{type:'application/json'})},
  async importar(file){
    const j=JSON.parse(await file.text());if(j.versao!==1)throw new Error('Arquivo de backup inválido.');
    const sal=j.meta.find(m=>m.k==='sal'),atual=await get('meta','sal');
    if(atual&&atual.v!==sal.v)throw new Error('Este backup foi feito com outra senha mestra. Importe-o num navegador ainda sem cofre.');
    if(!atual){for(const m of j.meta.filter(m=>m.k!=='dev'))await put('meta',m.k==='verif'?{k:m.k,v:{iv:m.v.iv,ct:deb64(m.v.ct).buffer}}:m)}
    for(const c of j.clientes)await put('clientes',{id:c.id,u:c.u,iv:c.iv,ct:deb64(c.ct).buffer});
    for(const a of j.arquivos)await put('arquivos',{id:a.id,cid:a.cid,u:a.u,h:{iv:a.h.iv,ct:deb64(a.h.ct).buffer},d:{iv:a.d.iv,ct:deb64(a.d.ct).buffer}});
    for(const h of (j.historico||[]))await put('historico',{id:h.id,cid:h.cid,t:h.t,iv:h.iv,ct:deb64(h.ct).buffer});
    return{clientes:j.clientes.length,arquivos:j.arquivos.length,precisaAbrir:!atual}},
  /* acesso bruto (só dados já criptografados) para a sincronização com a nuvem */
  raw:{todos,get,put,del,b64,deb64},
  async aplicarMeta(sal,ivV,ctV){await put('meta',{k:'sal',v:sal});await put('meta',{k:'verif',v:{iv:ivV,ct:deb64(ctV).buffer}})},
  uid
};
window.COFRE=COFRE;
})();
