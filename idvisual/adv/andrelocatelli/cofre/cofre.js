/* Cofre de clientes — tudo fica NO NAVEGADOR deste computador (IndexedDB), criptografado com a senha mestra.
   Nada é enviado a servidor nem ao GitHub. AES-256-GCM, chave derivada por PBKDF2 (SHA-256, 250 mil iterações).
   Se a senha mestra for esquecida, os dados NÃO podem ser recuperados (por isso existe o backup criptografado). */
(function(){
const DB='locatelli-clientes',ITER=250000,SK='cofre.chave';
let chave=null,db=null;
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>{let s='';new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x));return btoa(s)};
const deb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

function abreDB(){return db?Promise.resolve(db):new Promise((ok,err)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('meta',{keyPath:'k'});d.createObjectStore('clientes',{keyPath:'id'});const a=d.createObjectStore('arquivos',{keyPath:'id'});a.createIndex('cid','cid')};
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

const COFRE={
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
    if(!s)return false;
    try{chave=await crypto.subtle.importKey('raw',deb64(s),'AES-GCM',true,['encrypt','decrypt']);
      const ver=await get('meta','verif');if(!ver){chave=null;return false}
      await decifra(ver.v);return true}catch(e){chave=null;try{sessionStorage.removeItem(SK)}catch(x){}return false}},
  aberto(){return !!chave},
  bloquear(){chave=null;try{sessionStorage.removeItem(SK)}catch(e){}},

  /* ----- clientes ----- */
  async listar(){const r=await todos('clientes'),o=[];for(const x of r){try{o.push(await decifraJSON(x))}catch(e){}}
    return o.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR'))},
  async obter(id){const x=await get('clientes',id);return x?decifraJSON(x):null},
  async salvar(c){if(!c.id)c.id=uid();c.atualizado=Date.now();if(!c.criado)c.criado=c.atualizado;
    await put('clientes',{id:c.id,...await cifraJSON(c)});return c},
  async excluir(id){for(const a of await COFRE.arquivos(id))await del('arquivos',a.id);await del('clientes',id)},
  /* procura por CPF (só dígitos) */
  async porCpf(cpf){const d=String(cpf||'').replace(/\D/g,'');if(d.length!==11)return null;return(await COFRE.listar()).find(c=>String(c.cpf||'').replace(/\D/g,'')===d)||null},

  /* ----- arquivos ----- */
  async addArquivo(cid,{nome,tipo,origem,blob}){
    const buf=await blob.arrayBuffer(),id=uid(),h=await cifraJSON({nome,tipo:tipo||blob.type||'',origem:origem||'',data:Date.now(),tamanho:buf.byteLength}),d=await cifra(buf);
    await put('arquivos',{id,cid,h,d});return id},
  async arquivos(cid){const d=await abreDB(),r=await new Promise((ok,err)=>{const q=d.transaction('arquivos','readonly').objectStore('arquivos').index('cid').getAll(cid);q.onsuccess=()=>ok(q.result);q.onerror=()=>err(q.error)}),o=[];
    for(const x of r){try{o.push({id:x.id,cid:x.cid,...await decifraJSON(x.h)})}catch(e){}}return o.sort((a,b)=>b.data-a.data)},
  async lerArquivo(id){const x=await get('arquivos',id);if(!x)return null;const m=await decifraJSON(x.h);return new Blob([await decifra(x.d)],{type:m.tipo||'application/octet-stream'})},
  async excluirArquivo(id){await del('arquivos',id)},

  /* ----- backup (já sai criptografado; só abre com a mesma senha mestra) ----- */
  async exportar(){
    const o={versao:1,meta:await todos('meta'),clientes:await todos('clientes'),arquivos:await todos('arquivos')};
    const cv=r=>({...r,ct:r.ct?b64(r.ct):undefined});
    const j=JSON.stringify({versao:1,meta:o.meta.map(m=>m.k==='verif'?{k:m.k,v:{iv:m.v.iv,ct:b64(m.v.ct)}}:m),
      clientes:o.clientes.map(c=>({id:c.id,iv:c.iv,ct:b64(c.ct)})),
      arquivos:o.arquivos.map(a=>({id:a.id,cid:a.cid,h:{iv:a.h.iv,ct:b64(a.h.ct)},d:{iv:a.d.iv,ct:b64(a.d.ct)}}))});
    return new Blob([j],{type:'application/json'})},
  async importar(file){
    const j=JSON.parse(await file.text());if(j.versao!==1)throw new Error('Arquivo de backup inválido.');
    const sal=j.meta.find(m=>m.k==='sal'),atual=await get('meta','sal');
    if(atual&&atual.v!==sal.v)throw new Error('Este backup foi feito com outra senha mestra. Importe-o num navegador ainda sem cofre.');
    if(!atual){for(const m of j.meta)await put('meta',m.k==='verif'?{k:m.k,v:{iv:m.v.iv,ct:deb64(m.v.ct).buffer}}:m)}
    for(const c of j.clientes)await put('clientes',{id:c.id,iv:c.iv,ct:deb64(c.ct).buffer});
    for(const a of j.arquivos)await put('arquivos',{id:a.id,cid:a.cid,h:{iv:a.h.iv,ct:deb64(a.h.ct).buffer},d:{iv:a.d.iv,ct:deb64(a.d.ct).buffer}});
    return{clientes:j.clientes.length,arquivos:j.arquivos.length,precisaAbrir:!atual}},
  uid
};
window.COFRE=COFRE;
})();
