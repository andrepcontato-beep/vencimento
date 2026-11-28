/* Casca do sistema: entrada (ENTRAR / lembrar neste dispositivo), menu do topo, painel, ⚙ e ☁ */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2600)};
let novo=false,salvo=false,noApp=false;

/* ---------- entrada ---------- */
function modo(){
  const b=$('#lgBox');b.classList.toggle('novo',novo);b.classList.toggle('salvo',salvo&&!novo);
  $('#entrar').textContent=novo?'CRIAR SENHA MESTRA':'ENTRAR';
  $('#lgLnk').hidden=!novo;$('#lgAviso').hidden=!novo;$('#erroTrava').textContent='';
  $('#lem').checked=novo?false:salvo?true:$('#lem').checked;
}
function mostraLogin(descanso){
  noApp=false;$('#shell').hidden=true;$('#login').hidden=false;$('#pw').value='';$('#pw2').value='';
  try{sessionStorage.removeItem('loc.entrou')}catch(e){}
  if(descanso&&COFRE.aberto()){salvo=true;novo=false}
  modo();if(!salvo)setTimeout(()=>$('#pw').focus(),50)
}
async function abreApp(){
  $('#login').hidden=true;$('#shell').hidden=false;noApp=true;
  try{sessionStorage.setItem('loc.entrou','1')}catch(e){}
  if(!abreApp.ok){abreApp.ok=true;relogio();setInterval(relogio,1000)}
  await window.CLI.entra();
  const h=(location.hash||'').replace('#','');ir(['painel','clientes','fin','modelos','changelog'].includes(h)?h:'painel');
}
async function entrar(){
  const er=$('#erroTrava');er.textContent='';
  try{
    if(novo){if($('#pw').value!==$('#pw2').value)throw new Error('As senhas não conferem.');await COFRE.criar($('#pw').value)}
    else if(COFRE.demo){await COFRE.abrir('demonstracao')}
    else if(salvo){
      if(!(await COFRE.retomar())){salvo=false;modo();throw new Error('Não consegui abrir com a chave deste dispositivo — digite a senha mestra.')}
    }else await COFRE.abrir($('#pw').value);
    if(!COFRE.demo&&!(salvo&&!novo)){if($('#lem').checked)await COFRE.lembrarDispositivo();else await COFRE.esquecerDispositivo()}
    await abreApp();
  }catch(e){er.textContent=e.message}
}
$('#entrar').onclick=entrar;
$('#lem').onchange=async e=>{
  if(novo)return;
  if(!e.target.checked){if(salvo){salvo=false;modo();$('#lem').checked=false;$('#pw').focus()}}
  else if(!salvo&&await COFRE.temDispositivo()){salvo=true;modo()}
};
['#pw','#pw2'].forEach(s=>$(s).onkeydown=e=>{if(e.key==='Enter')entrar()});
$('#fImp0').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const r=await COFRE.importar(f);toast(`Restaurado: ${r.clientes} cliente(s), ${r.arquivos} arquivo(s)`);boot()}catch(x){alert(x.message)}};
$('#bNuvem0').onclick=async()=>{const er=$('#erroTrava');er.textContent='';
  try{if(!SYNC.configurado())throw new Error('A nuvem ainda não está configurada neste site.');
    er.textContent='Entrando e baixando…';const st=await SYNC.executar(true);
    if(st&&st.novoAparelho){er.textContent='';return boot()}
    throw new Error(st&&st.vazio?'Não há cofre na nuvem para esta conta (envie primeiro a partir do aparelho que já tem os clientes).':'Não foi possível baixar.')}
  catch(e){er.textContent=e.message==='SEM_CONFIG'?'A nuvem ainda não está configurada neste site.':e.message}};

async function bootDemo(){
  if(!(await COFRE.configurado())){await COFRE.criar('demonstracao');await window.DEMO_SEED()}
  novo=false;salvo=true;
  let entrou=false;try{entrou=sessionStorage.getItem('loc.entrou')==='1'}catch(e){}
  if(entrou&&await COFRE.retomar())return abreApp();
  $('#login').hidden=false;modo();
  try{await COFRE.abrir('demonstracao')}catch(e){$('#erroTrava').textContent='Falha ao abrir a demonstração.';return}
  await abreApp()
}
async function boot(){
  if(COFRE.demo)return bootDemo();
  novo=!(await COFRE.configurado());salvo=false;
  let entrou=false;try{entrou=sessionStorage.getItem('loc.entrou')==='1'}catch(e){}
  if(!novo&&entrou&&await COFRE.retomar())return abreApp();
  if(!novo&&await COFRE.temDispositivo())salvo=true;
  $('#login').hidden=false;modo();if(!salvo)setTimeout(()=>(novo?$('#pw'):$('#pw')).focus(),50);
}

/* ---------- menu / telas ---------- */
const frames={fin:'#fr-fin',changelog:'#fr-cl'};
function ir(v){
  $$('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
  $$('.topo button.m').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  const f=frames[v]&&$(frames[v]);if(f&&!f.getAttribute('src'))f.src=f.dataset.src;
  try{history.replaceState(null,'','#'+v)}catch(e){}window.scrollTo(0,0);
}
$$('.topo button.m').forEach(b=>b.onclick=()=>ir(b.dataset.v));
$('#bCl').onclick=()=>ir('changelog');
$('#logoB').onclick=()=>mostraLogin(true);
$$('[data-md]').forEach(a=>a.onclick=e=>{e.preventDefault();$('#fr-md').src=a.getAttribute('href');$('#mdMenu').hidden=true;$('#mdFrWrap').hidden=false});
$('#mdVolta').onclick=()=>{$('#mdFrWrap').hidden=true;$('#mdMenu').hidden=false;$('#fr-md').removeAttribute('src')};


/* ---------- Painel: organizar blocos (🔒/🔓) ---------- */
const PDEF={L:['resumo','agenda','partos','parados'],R:['relogio','calendario']};
let play=null;
function pLoad(){let l=null;try{l=JSON.parse(localStorage.getItem('painel.layout'))}catch(e){}
  const ids=$$('#hPool .w, #hGrid .w').map(w=>w.dataset.w),ok=a=>Array.isArray(a)?a.filter(i=>ids.includes(i)):[];
  play=l&&l.L&&l.R?{L:ok(l.L),R:ok(l.R)}:JSON.parse(JSON.stringify(PDEF));
  const dup=new Set();['L','R'].forEach(k=>play[k]=play[k].filter(i=>!dup.has(i)&&dup.add(i)))}
function pSave(){try{localStorage.setItem('painel.layout',JSON.stringify(play))}catch(e){}}
function pRender(){
  const all={};$$('.w').forEach(w=>all[w.dataset.w]=w);
  ['L','R'].forEach(k=>play[k].forEach(i=>$('#col'+k).appendChild(all[i])));
  const on=new Set([...play.L,...play.R]);
  Object.keys(all).forEach(i=>{if(!on.has(i))$('#hPool').appendChild(all[i])});
  $$('.w').forEach(w=>{if(!w.querySelector('.wc')){const c=document.createElement('div');c.className='wc';
    c.innerHTML='<button type="button" class="sec mini" data-a="up" title="Subir">▲</button><button type="button" class="sec mini" data-a="dn" title="Descer">▼</button><button type="button" class="sec mini" data-a="lado" title="Mudar de lado">⇄</button><button type="button" class="sec mini" data-a="rm" title="Remover do painel">✕</button>';
    w.appendChild(c);w.draggable=false;
    c.onclick=e=>{const b=e.target.closest('button');if(b)pAcao(w.dataset.w,b.dataset.a)}}});
  $('#hTrayB').innerHTML=Object.keys(all).filter(i=>!on.has(i)).map(i=>`<button type="button" class="sec mini" data-add="${i}">+ ${all[i].dataset.nome}</button>`).join('')||'<small style="color:var(--mut)">nenhum — todos estão no painel</small>';
  $$('[data-add]').forEach(b=>b.onclick=()=>{const i=b.dataset.add;(play.R.length<play.L.length?play.R:play.L).push(i);pSave();pRender()});
  $$('.w').forEach(w=>w.draggable=$('#v-painel').classList.contains('org'))}
function pAcao(i,a){
  const k=play.L.includes(i)?'L':'R',arr=play[k],x=arr.indexOf(i);
  if(a==='up'&&x>0)[arr[x-1],arr[x]]=[arr[x],arr[x-1]];
  else if(a==='dn'&&x<arr.length-1)[arr[x+1],arr[x]]=[arr[x],arr[x+1]];
  else if(a==='lado'){arr.splice(x,1);play[k==='L'?'R':'L'].push(i)}
  else if(a==='rm')arr.splice(x,1);
  pSave();pRender()}
$('#bOrg').onclick=()=>{const v=$('#v-painel'),on=!v.classList.contains('org');v.classList.toggle('org',on);
  $('#bOrg').textContent=on?'🔓':'🔒';$('#bOrg').classList.toggle('on',on);$('#bOrg').setAttribute('aria-pressed',on);$('#hTray').hidden=!on;pRender()};
$('#bOrgPad').onclick=()=>{play=JSON.parse(JSON.stringify(PDEF));pSave();pRender()};
let arr=null;
document.addEventListener('dragstart',e=>{const w=e.target.closest&&e.target.closest('.w');if(w&&$('#v-painel').classList.contains('org')){arr=w.dataset.w;w.classList.add('arrasta');e.dataTransfer.setData('text/plain',arr);e.dataTransfer.effectAllowed='move'}});
document.addEventListener('dragend',()=>{arr=null;$$('.w.arrasta').forEach(w=>w.classList.remove('arrasta'))});
$$('#hGrid .col').forEach(col=>{col.ondragover=e=>{if(arr)e.preventDefault()};
  col.ondrop=e=>{if(!arr)return;e.preventDefault();const alvo=e.target.closest('.w'),k=col.dataset.col;
    ['L','R'].forEach(z=>play[z]=play[z].filter(i=>i!==arr));
    const pos=alvo&&alvo.dataset.w!==arr?play[k].indexOf(alvo.dataset.w):-1;
    if(pos>=0)play[k].splice(pos,0,arr);else play[k].push(arr);pSave();pRender()}});
pLoad();pRender();

/* ---------- relógio ---------- */
function relogio(){const d=new Date(),z=n=>String(n).padStart(2,'0'),h=$('#hora');if(!h)return;
  h.textContent=z(d.getHours())+':'+z(d.getMinutes())+':'+z(d.getSeconds());
  const t=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});$('#dia').textContent=t.charAt(0).toUpperCase()+t.slice(1)}

/* ---------- ⚙ configurações / ☁ / 👁 ---------- */
const autoOn=()=>{try{return localStorage.getItem('sync.auto')!=='0'}catch(e){return true}};
function marcaAuto(){$('#auto').checked=autoOn();$('#bNuvem').classList.toggle('auto',autoOn())}
$('#bCfg').onclick=()=>{marcaAuto();$('#erroCfg').textContent='';const u=window.SYNC&&SYNC.ultima&&SYNC.ultima();$('#ult').textContent=u?'Última sincronização: '+new Date(u).toLocaleString('pt-BR'):'';$('#cfg').hidden=false};
$('#cfgX').onclick=()=>$('#cfg').hidden=true;
$('#cfg').onclick=e=>{if(e.target.id==='cfg')$('#cfg').hidden=true};
$('#auto').onchange=e=>{try{localStorage.setItem('sync.auto',e.target.checked?'1':'0')}catch(x){}marcaAuto();toast(e.target.checked?'Sincronização automática ligada':'Sincronização automática desligada')};
$('#cfgSinc').onclick=()=>{$('#cfg').hidden=true;$('#bNuvem').click()};
$('#bEsq').onclick=async()=>{await COFRE.esquecerDispositivo();toast('Este dispositivo não guarda mais a senha')};
$('#bSenhaM').onclick=async()=>{
  const er=$('#erroCfg');er.textContent='';
  try{if($('#pn1').value!==$('#pn2').value)throw new Error('As senhas novas não conferem.');
    await COFRE.trocarSenha($('#pa').value,$('#pn1').value);
    ['#pa','#pn1','#pn2'].forEach(s=>$(s).value='');$('#cfg').hidden=true;toast('Senha mestra alterada');
    if(window.SYNC&&SYNC.configurado()&&autoOn())SYNC.executar(false).catch(()=>{});
  }catch(e){er.textContent=e.message}};
/* o ☁ gira enquanto sincroniza */
new MutationObserver(()=>{const t=($('#stNuvem').textContent||'');$('#bNuvem').classList.toggle('gira',/^Sincronizando/.test(t))}).observe($('#stNuvem'),{childList:true,characterData:true,subtree:true});
/* o olho vale também para as telas em quadro (financeiro etc.) */
function avisaOlho(){let v='1';try{v=sessionStorage.getItem('cofre.olho')==='0'?'0':'1'}catch(e){}$$('iframe').forEach(f=>{try{f.contentWindow.postMessage({loc:'olho',v},'*')}catch(e){}})}
$('#bOlho').addEventListener('click',()=>setTimeout(avisaOlho,0));
$$('iframe').forEach(f=>f.addEventListener('load',avisaOlho));

function gerador(u){ir('modelos');$('#mdMenu').hidden=true;$('#mdFrWrap').hidden=false;$('#fr-md').src=u}
$('#demoReset').onclick=async()=>{if(!confirm('Reiniciar a demonstração? Os dados voltam ao estado inicial.'))return;try{COFRE.bloquear();sessionStorage.removeItem('loc.entrou')}catch(e){}
  await new Promise(r=>{const q=indexedDB.deleteDatabase('locatelli-demo');q.onsuccess=q.onerror=q.onblocked=()=>r()});location.reload()};
window.SHELLAPI={ir,gerador,async sair(){salvo=COFRE.demo||await COFRE.temDispositivo();novo=false;mostraLogin(false)},toast};
boot();
})();
