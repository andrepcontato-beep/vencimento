(function(){
const $=s=>document.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DOCS=[['procuracao','Procuração'],['hipossuficiencia','Declaração de hipossuficiência'],['salario-maternidade','Contrato salário-maternidade'],['previdenciario','Contrato serviços previdenciários (50% / mín. 5 mil)'],['previdenciario-generico','Contrato genérico previdenciário (30%)'],['previdenciario-incapaz','Contrato PREV incapaz (50% / mín. 5 mil)']];
const IC={docx:'<svg class="ic" viewBox="0 0 24 24"><path fill="#2B579A" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" fill-opacity=".45" d="M14 2l5 5h-4a1 1 0 0 1-1-1z"/><path fill="#fff" d="M7.2 9.5h1.4l1.2 5 1.3-5h1.1l1.3 5 1.2-5h1.4l-1.9 7h-1.2l-1.2-4.6-1.2 4.6H9.1z"/></svg>',
 pdf:'<svg class="ic" viewBox="0 0 24 24"><path fill="#D32F2F" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" fill-opacity=".45" d="M14 2l5 5h-4a1 1 0 0 1-1-1z"/><text x="12" y="17.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="6.2" fill="#fff">PDF</text></svg>',
 img:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="#5b8a5b"/><circle cx="9" cy="10" r="2" fill="#fff"/><path d="M4 18l5-5 3 3 3-4 5 6z" fill="#fff" fill-opacity=".85"/></svg>',
 outro:'<svg class="ic" viewBox="0 0 24 24"><path fill="#888" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" fill-opacity=".45" d="M14 2l5 5h-4a1 1 0 0 1-1-1z"/></svg>'};
const icone=n=>/\.docx?$/i.test(n)?IC.docx:/\.pdf$/i.test(n)?IC.pdf:/\.(jpe?g|png|webp|heic|gif)$/i.test(n)?IC.img:IC.outro;
const fmtCpf=s=>{const d=String(s||'').replace(/\D/g,'');return d.length===11?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`:String(s||'')};
const fmtData=t=>new Date(t).toLocaleDateString('pt-BR');
const fmtTam=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2600)};
const copia=async(txt,rot)=>{try{await navigator.clipboard.writeText(txt);toast(rot+' copiado')}catch(e){toast('Não consegui copiar — selecione e copie manualmente')}};

let fMk=new Set(),clientes=[],sel=null,mostraSenha=false,verExcl=false,histAberto=false,andAberto=false,srvAberto=false;
const visiveis=()=>clientes.filter(c=>!c.excluido);

/* ---------- senha mestra ---------- */
async function inicia(){
  $('#barraCofre').hidden=true;$('#app').hidden=true;
  if(await COFRE.retomar())return entra();
  const novo=!(await COFRE.configurado());
  $('#trava').hidden=false;$('#bNuvem0').hidden=!novo;$('#travaNovo').hidden=!novo;$('#travaAbrir').hidden=novo;$('#lbImp0').hidden=!novo;
  $('#travaT').textContent=novo?'Criar senha mestra':'Desbloquear clientes';
  setTimeout(()=>(novo?$('#s1'):$('#s0')).focus(),50);
  $('#bTrava').onclick=async()=>{
    const er=$('#erroTrava');er.textContent='';
    try{
      if(novo){if($('#s1').value!==$('#s2').value)throw new Error('As senhas não conferem.');await COFRE.criar($('#s1').value)}
      else await COFRE.abrir($('#s0').value);
      $('#trava').hidden=true;entra();
    }catch(e){er.textContent=e.message}};
  $('#bNuvem0').onclick=async()=>{const er=$('#erroTrava');er.textContent='';
    try{if(!SYNC.configurado())throw new Error('A nuvem ainda não está configurada neste site (falta o projeto Supabase).');
      er.textContent='Entrando e baixando…';const st=await SYNC.executar(true);
      if(st&&st.novoAparelho){er.textContent='';return inicia()}
      throw new Error(st&&st.vazio?'Não há cofre na nuvem para esta conta (envie primeiro a partir do aparelho que já tem os clientes).':'Não foi possível baixar.')}
    catch(e){er.textContent=e.message==='SEM_CONFIG'?'A nuvem ainda não está configurada neste site.':e.message}};
  ['#s0','#s2'].forEach(s=>$(s).onkeydown=e=>{if(e.key==='Enter')$('#bTrava').click()});
}
/* ---- sincronização com a nuvem ---- */
function statusNuvem(t,cor){const e=$('#stNuvem');if(e){e.textContent=t;e.style.color=cor||''}}
const hhmm=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
/* embaçador: dados dos clientes ficam borrados até clicar no olho */
const EYE_ON='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',EYE_OFF='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 5.1A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a18.6 18.6 0 0 1-2.2 3.2M1 1l22 22"/></svg>';
let embaca=true;try{embaca=sessionStorage.getItem('cofre.olho')!=='0'}catch(e){}
function aplicaOlho(){document.body.classList.toggle('blur',embaca);const b=$('#bOlho');if(b){b.innerHTML=embaca?EYE_OFF:EYE_ON;b.title=embaca?'Dados ocultos — clique para mostrar':'Dados visíveis — clique para ocultar'}}
function ligaOlho(){aplicaOlho();$('#bOlho').onclick=()=>{embaca=!embaca;try{sessionStorage.setItem('cofre.olho',embaca?'1':'0')}catch(e){}aplicaOlho()}}
const ehBenef=r=>r==='Certidão de nascimento'||r==='Documento do(a) beneficiário(a)';
const autoSync=()=>{try{return localStorage.getItem('sync.auto')!=='0'}catch(e){return true}};
function ligaNuvem(){ligaOlho();
  if(ligaNuvem.ok)return;ligaNuvem.ok=true;
  COFRE.aoMudar=()=>{if(autoSync())SYNC.agendar()};
  SYNC.aoMudarEstado(async(tipo,x)=>{
    if(tipo==='inicio')statusNuvem('Sincronizando…');
    else if(tipo==='prog')statusNuvem('Sincronizando… '+x);
    else if(tipo==='erro')statusNuvem('⚠ '+(x&&x.message==='SEM_CONFIG'?'nuvem não configurada':'falha ao sincronizar'),'var(--red)');
    else if(tipo==='fim'){
      if(x&&x.precisaEntrar)return statusNuvem('Nuvem: não conectado');
      statusNuvem('☁ Sincronizado às '+hhmm(Date.now())+(x&&(x.subiu||x.baixou)?` (↑${x.subiu} ↓${x.baixou})`:''));
      if(x&&x.baixou){clientes=await COFRE.listar();const a=document.activeElement;lista();if(!a||!/INPUT|TEXTAREA|SELECT/.test(a.tagName))painel()}
    }});
  $('#bNuvem').onclick=async()=>{
    if(!SYNC.configurado()){toast('A nuvem ainda não está configurada neste site (falta o projeto Supabase)');return}
    try{await SYNC.executar(true)}catch(e){if(e&&e.message!=='SEM_CONFIG')toast('Erro: '+(e.message||e))}};
  if(SYNC.configurado()&&autoSync())SYNC.executar(false).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&SYNC.configurado()&&autoSync()&&Date.now()-SYNC.ultima()>60000)SYNC.executar(false).catch(()=>{})});
}
async function entra(){
  $('#trava').hidden=true;$('#barraCofre').hidden=false;$('#app').hidden=false;ligaNuvem();
  clientes=await COFRE.listar();
  for(const c of clientes){if(!c.repr&&(c.fnome||c.fcpf)){   /* cadastros antigos: passa o cadastro para o nome do(a) representado(a) */
    const r={};['nome','cpf','rg','tel','nac','ec','prof','sexo','end','cep','cid'].forEach(k=>{if(c[k])r[k]=c[k];delete c[k]});
    Object.assign(c,{repr:true,rep:r,nome:c.fnome||'',cpf:c.fcpf||'',nasc:c.fnasc||'',sexo:c.fsexo||'',cond:c.fcond||'menor'});['fnome','fcpf','fnasc','fsexo','fcond'].forEach(k=>delete c[k]);await COFRE.salvar(c,{semHistorico:true})}}
  for(const c of clientes){if(c.etapa!==undefined){if(c.etapa&&!(c.andamento||[]).length)c.andamento=[{e:c.etapa,t:c.atualizado||Date.now()}];delete c.etapa;delete c.fluxo;await COFRE.salvar(c,{semHistorico:true})}}
  for(const c of clientes){let mud=false;(c.andamento||[]).forEach(x=>{const pd=padronizaAnd(x.e);if(pd.mapped&&pd.e!==x.e){x.e=pd.e;mud=true}});if(mud)await COFRE.salvar(c,{semHistorico:true})}
  clientes=await COFRE.listar();
  const q=new URLSearchParams(location.search).get('id');
  sel=q&&clientes.find(c=>c.id===q)?q:null;
  lista();painel();notificaDpp();popupDpp();
}

/* ---------- lista ---------- */
/* o gerador espera: dados de quem assina (representante) + dados do(a) beneficiário(a) em f* */
function paraGerador(c){if(!c.repr)return c;return Object.assign({id:c.id},c.rep||{},{fnome:c.nome,fcpf:c.cpf,fnasc:c.nasc,fsexo:c.sexo,fcond:c.cond})}
const zapDe=c=>{let d=String((c.repr&&c.rep?c.rep.tel:c.tel)||'').replace(/\D/g,'');if(d.length<10)return '';if(!d.startsWith('55')||d.length<12)d='55'+d;return d};
const mkDe=c=>(c.marcas||[]).filter(k=>window.MARCAS&&MARCAS[k]);
const ZAP_SVG='<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/></svg>';
function lista(){
  const t=$('#busca').value.trim().toLowerCase(),d=t.replace(/\D/g,'');
  const base=clientes.filter(c=>verExcl?!!c.excluido:!c.excluido),nExcl=clientes.filter(c=>c.excluido).length;
  const disp=[...new Set(base.flatMap(c=>mkDe(c)))].filter(k=>MARCAS[k]);fMk.forEach(k=>{if(!disp.includes(k))fMk.delete(k)});
  if($('#fMks')){$('#fMks').innerHTML=disp.length?disp.map(k=>`<button type="button" class="mkf${fMk.has(k)?' on':''}" data-fmk="${k}" title="Filtrar: ${esc(MARCAS[k].nome)}" aria-label="${esc(MARCAS[k].nome)}" aria-pressed="${fMk.has(k)}">${MARCAS[k].svg}</button>`).join('')+(fMk.size?'<button type="button" class="mkf lim" id="fMkLimpa" title="Limpar filtro">×</button>':''):'';
    $('#fMks').querySelectorAll('[data-fmk]').forEach(b=>b.onclick=()=>{const k=b.dataset.fmk,tinha=fMk.has(k);fMk.clear();if(!tinha)fMk.add(k);sel=null;lista();painel()});if($('#fMkLimpa'))$('#fMkLimpa').onclick=()=>{fMk.clear();sel=null;lista();painel()}}
  const f=base.filter(c=>[...fMk].every(k=>mkDe(c).includes(k))).filter(c=>!t||(c.nome||'').toLowerCase().includes(t)||((c.rep&&c.rep.nome)||'').toLowerCase().includes(t)||(d&&(String(c.cpf||'')+String((c.rep&&c.rep.cpf)||'')).replace(/\D/g,'').includes(d)));
  $('#lista').innerHTML=(f.length?f.map(c=>`<div class="itemw"><button class="item ${c.id===sel?'on':''}${zapDe(c)||mkDe(c).length?' cz':''}" style="--pl:${(zapDe(c)?25:0)+mkDe(c).length*25+(zapDe(c)||mkDe(c).length?1:0)}px" data-id="${c.id}"><b>${esc(c.nome||'(sem nome)')}</b>${atualDe(c)?`<span style="display:block;color:var(--ouro2)">● ${esc(atualDe(c).e)}</span>`:''}</button>${zapDe(c)||mkDe(c).length?`<div class="mk">${zapDe(c)?`<a class="zap" href="https://wa.me/${zapDe(c)}" target="_blank" rel="noopener" title="Falar com ${c.repr?'o(a) representante':'este cliente'} no WhatsApp" aria-label="WhatsApp">${ZAP_SVG}</a>`:''}${mkDe(c).map(k=>`<span class="mki" title="${esc(MARCAS[k].nome)}">${MARCAS[k].svg}</span>`).join('')}</div>`:''}</div>`).join(''):`<div class="vazio">${base.length?'Nenhum cliente encontrado.':'Nenhum cliente ainda.<br>Eles entram aqui quando você gerar um contrato e escolher “Salvar cliente”, ou pelo botão “+ Novo”.'}</div>`)+(nExcl||verExcl?`<div style="margin-top:8px;font-size:12px"><a href="#" id="lnkExcl" style="color:var(--ouro2)">${verExcl?'← Voltar à lista':'Ver excluídos ('+nExcl+')'}</a></div>`:'');
  if($('#lnkExcl'))$('#lnkExcl').onclick=e=>{e.preventDefault();verExcl=!verExcl;sel=null;lista();painel()};
  $('#lista').querySelectorAll('.item').forEach(b=>b.onclick=()=>{sel=b.dataset.id;mostraSenha=false;srvAberto=false;lista();painel()});
  calendario();
}

/* ---------- calendário de datas prováveis de parto (DPP) + avisos ---------- */
let calMes=(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)})(),calDia=null;
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dppLista=()=>clientes.filter(c=>!c.excluido&&/^\d{4}-\d{2}-\d{2}$/.test(c.dpp||''));
const diasAte=iso=>{const[a,m,d]=iso.split('-').map(Number),t=new Date();return Math.round((new Date(a,m-1,d)-new Date(t.getFullYear(),t.getMonth(),t.getDate()))/864e5)};
const brDia=iso=>iso.split('-').reverse().join('/');
const somaDias=(iso,k)=>{const[a,m,d]=iso.split('-').map(Number);return isoD(new Date(a,m-1,d+k))};
/* lembrete: 30 dias antes do parto, conferir a qualidade de segurada e decidir se pede o salário-maternidade (permitido a partir de 28 dias antes) */
function lembretes30(){return dppLista().map(c=>({c,n:diasAte(c.dpp)})).filter(x=>x.n>=0&&x.n<=30).sort((a,b)=>a.n-b.n)}
function avisosDpp(){return dppLista().map(c=>({c,n:diasAte(c.dpp)})).filter(x=>x.n<=14&&x.n>=-30&&!(x.n<0&&x.c.dppVisto===x.c.dpp)).sort((a,b)=>a.n-b.n)}
/* lembretes agendados por cliente (perícia, visita…): c.lembretes=[{id,t,d,ok}] */
const lembAtivos=()=>{const o=[];clientes.filter(c=>!c.excluido).forEach(c=>(c.lembretes||[]).forEach(l=>{if(/^\d{4}-\d{2}-\d{2}$/.test(l.d||''))o.push({c,l})}));return o};
const lembAvisos=()=>lembAtivos().filter(x=>!x.l.ok).map(x=>({...x,n:diasAte(x.l.d)})).filter(x=>x.n<=3&&x.n>=-7).sort((a,b)=>a.n-b.n);
const FINAIS=['Arquivado','Deferido','Indeferido','Benefício implantado'];
async function homeRender(){
  if(!$('#hKpis'))return;
  const V=visiveis(),hj=isoD(new Date()),mes=hj.slice(0,7),nm=c=>esc(c.nome||'(sem nome)');
  const at=c=>{const a=atualDe(c);return !a||!FINAIS.includes(a.e)};
  const ativos=V.filter(at),aguard=V.filter(c=>{const a=atualDe(c);return a&&a.e==='Aguardando docs do cliente'});
  let rec=0,aberto=0;V.forEach(c=>{const H=c.honorarios||{},P=H.pagamentos||[];P.forEach(x=>{if((x.d||'').startsWith(mes))rec+=Number(x.v)||0});aberto+=Math.max(0,(Number(H.valor)||0)-P.reduce((a,x)=>a+(Number(x.v)||0),0))});
  try{(await COFRE.avulsos()).forEach(x=>{if((x.d||'').startsWith(mes))rec+=Number(x.v)||0})}catch(e){}
  $('#hKpis').innerHTML=`<div class="card kpi"><b>${ativos.length}</b><span>casos ativos</span></div><div class="card kpi warn"><b>${aguard.length}</b><span>aguardando documentos</span></div><div class="card kpi ok"><b>${brl(rec)}</b><span>recebido neste mês</span></div><div class="card kpi red"><b>${brl(aberto)}</b><span>em aberto (honorários a receber)</span></div>`;
  const ag=[];dppLista().filter(c=>c.dpp===hj).forEach(c=>ag.push({c,t:'Parto previsto hoje',cor:'d-r'}));lembAtivos().filter(x=>!x.l.ok&&x.l.d===hj).forEach(x=>ag.push({c:x.c,t:x.l.t,cor:'d-w'}));
  lembAtivos().filter(x=>!x.l.ok&&x.l.d&&x.l.d<hj).forEach(x=>ag.push({c:x.c,t:x.l.t+' (atrasado)',cor:'d-r'}));
  const lk=c=>`<a data-hc="${c.id}" style="text-decoration:underline">${nm(c)}</a>`;
  $('#hHoje').textContent=brDia(hj).slice(0,5);
  $('#hAgenda').innerHTML=ag.length?ag.map(x=>`<div class="hrow"><span class="dot ${x.cor}"></span><div class="t"><b>${esc(x.t)}</b><small>${lk(x.c)}</small></div></div>`).join(''):'<div class="vazio" style="padding:10px">Nada agendado para hoje.</div>';
  const pr=dppLista().map(c=>({c,n:diasAte(c.dpp)})).filter(x=>(x.n>=0&&x.n<=30)||(x.n<0&&x.n>=-30&&x.c.dppVisto!==x.c.dpp)).sort((a,b)=>a.n-b.n);
  $('#hPartos').innerHTML=pr.length?pr.map(x=>`<div class="hrow"><span class="dot ${x.n<=7?'d-r':'d-w'}"></span><div class="t"><b>${lk(x.c)}</b><small>${x.n===0?'parto previsto HOJE':x.n>0?'parto em '+x.n+' dia(s) · '+brDia(x.c.dpp):'parto previsto há '+(-x.n)+' dia(s)'}${x.n>=0&&x.n<=30?' · pedido liberado desde '+brDia(somaDias(x.c.dpp,-28)):''}</small></div></div>`).join(''):'<div class="vazio" style="padding:10px">Nenhum parto previsto nos próximos 30 dias.</div>';
  const pa=V.filter(at).map(c=>{const a=atualDe(c);return a?{c,a,d:Math.floor((Date.now()-a.t)/864e5)}:null}).filter(x=>x&&x.d>30).sort((a,b)=>b.d-a.d);
  $('#hParados').innerHTML=pa.length?pa.slice(0,12).map(x=>`<div class="hrow"><span class="dot ${x.d>60?'d-r':'d-w'}"></span><div class="t"><b>${lk(x.c)}</b><small>${esc(x.a.e)} · há ${x.d} dias</small></div>${zapDe(x.c)?`<a class="zap" href="https://wa.me/${zapDe(x.c)}" target="_blank" rel="noopener" title="WhatsApp" style="width:26px;height:26px">${ZAP_SVG}</a>`:''}</div>`).join('')+(pa.length>12?`<div class="vazio" style="padding:6px">+ ${pa.length-12} outros</div>`:''):'<div class="vazio" style="padding:10px">Nenhum caso parado.</div>';
  const h=new Date().getHours(),sd=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  $('#hAvTxt').innerHTML=`☀ ${sd}, André. Hoje: <b>${ag.length} compromisso(s)</b> · <b>${pa.length} caso(s) parado(s) há mais de 30 dias</b> · <b>${brl(aberto)}</b> a receber em honorários`;
  const aud=lembAtivos().filter(x=>!x.l.ok&&/audi[eê]ncia/i.test(x.l.t||'')).map(x=>({...x,n:diasAte(x.l.d)})).filter(x=>x.n>=0&&x.n<=60).sort((a,b)=>a.n-b.n);
  if($('#hAudi'))$('#hAudi').innerHTML=aud.length?aud.map(x=>`<div class="hrow"><span class="dot ${x.n<=7?'d-r':'d-w'}"></span><div class="t"><b>${esc(x.l.t)}</b><small>${lk(x.c)} · ${brDia(x.l.d)} · ${x.n===0?'HOJE':'em '+x.n+' dia(s)'}</small></div></div>`).join(''):'<div class="vazio" style="padding:10px">Nenhuma audiência prevista. (Cadastre como lembrete com "audiência" no título.)</div>';
  const lb=lembAtivos().filter(x=>!x.l.ok).map(x=>({...x,n:diasAte(x.l.d)})).filter(x=>x.n>=0&&x.n<=30).sort((a,b)=>a.n-b.n);
  if($('#hLemb'))$('#hLemb').innerHTML=lb.length?lb.slice(0,15).map(x=>`<div class="hrow"><span class="dot ${x.n<=3?'d-r':'d-w'}"></span><div class="t"><b>${esc(x.l.t)}</b><small>${lk(x.c)} · ${brDia(x.l.d)} · ${x.n===0?'HOJE':'em '+x.n+' dia(s)'}</small></div></div>`).join(''):'<div class="vazio" style="padding:10px">Nenhum lembrete nos próximos 30 dias.</div>';
  document.querySelectorAll('[data-hc]').forEach(a=>a.onclick=()=>window.CLI.abre(a.dataset.hc));
}
function calendario(){
  const E=$('#cal');if(!E)return;
  const L=dppLista(),LM=lembAtivos().filter(x=>!x.l.ok),agd={};L.forEach(c=>(agd[c.dpp]=agd[c.dpp]||[]).push({c}));LM.forEach(x=>(agd[x.l.d]=agd[x.l.d]||[]).push(x));
  const av=avisosDpp(),y=calMes.getFullYear(),m=calMes.getMonth(),prim=new Date(y,m,1).getDay(),nd=new Date(y,m+1,0).getDate(),hj=isoD(new Date());
  const l30=lembretes30();
  const txt=n=>n===0?'<b>é HOJE</b>':n>0?'em '+n+(n===1?' dia':' dias'):'há '+(-n)+(n===-1?' dia':' dias');
  let h=`<h2>Calendário</h2>`;
  h+=`<div class="calh"><button class="sec mini" id="calAnt" aria-label="Mês anterior">‹</button><span>${(t=>t.charAt(0).toUpperCase()+t.slice(1))(calMes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}))}</span><button class="sec mini" id="calPro" aria-label="Próximo mês">›</button></div><div class="cal">${['D','S','T','Q','Q','S','S'].map(x=>`<div class="dw">${x}</div>`).join('')}${'<div></div>'.repeat(prim)}`;
  for(let d=1;d<=nd;d++){const iso=isoD(new Date(y,m,d)),q=(agd[iso]||[]).length;
    h+=`<button data-dia="${iso}" class="${q?'tem ':''}${iso===hj?'hj ':''}${iso===calDia?'sel':''}" title="${q?q+' compromisso(s): parto previsto / lembretes':''}">${d}${q?`<sup>${q}</sup>`:''}</button>`}
  h+='</div>';
  if(calDia&&agd[calDia])h+=`<div style="margin-top:10px;font-size:13px"><b>${brDia(calDia)}</b>${agd[calDia].map(x=>`<div class="dppn">${x.l?esc(x.l.t)+' — ':'Parto previsto — '}<a data-calc="${x.c.id}" style="cursor:pointer;text-decoration:underline">${esc(x.c.nome||'(sem nome)')}</a></div>`).join('')}</div>`;
  h+=`<div class="linha" style="margin-top:10px;gap:8px;flex-wrap:wrap">${(L.length||LM.length)?'<button class="sec mini" id="calIcs" title="Baixa um arquivo para a agenda do celular, com lembrete 30 dias antes (qualidade de segurada) e alarme do parto 7 dias antes, 1 dia antes e no dia">📅 Levar para a agenda</button>':''}${(av.length||l30.length||lembAvisos().length)?'<button class="sec mini" id="calAvs">🔔 Ver avisos</button>':''}${('Notification' in window&&Notification.permission==='default')?'<button class="sec mini" id="calNot">🔔 Ativar avisos</button>':''}</div>`;
  E.innerHTML=h;
  $('#calAnt').onclick=()=>{calMes=new Date(y,m-1,1);calendario()};$('#calPro').onclick=()=>{calMes=new Date(y,m+1,1);calendario()};
  E.querySelectorAll('[data-dia]').forEach(b=>b.onclick=()=>{calDia=calDia===b.dataset.dia?null:b.dataset.dia;calendario()});
  E.querySelectorAll('[data-calc]').forEach(a=>a.onclick=()=>{sel=a.dataset.calc;mostraSenha=false;srvAberto=false;lista();painel();irCli()});
  if($('#calAvs'))$('#calAvs').onclick=()=>popupDpp(true);
  if($('#calNot'))$('#calNot').onclick=async()=>{try{await Notification.requestPermission()}catch(e){}calendario();notificaDpp()};
  if($('#calIcs'))$('#calIcs').onclick=()=>{
    const z=n=>String(n).padStart(2,'0'),ts=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const ev=L.map(c=>{const d=c.dpp.replace(/-/g,''),n=new Date(+c.dpp.slice(0,4),+c.dpp.slice(5,7)-1,+c.dpp.slice(8,10)+1),f=n.getFullYear()+z(n.getMonth()+1)+z(n.getDate());
      const al=t=>`BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Parto previsto\r\nTRIGGER:${t}\r\nEND:VALARM`;
      return `BEGIN:VEVENT\r\nUID:dpp-${c.id}@locatelli\r\nDTSTAMP:${ts}\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${f}\r\nSUMMARY:Parto previsto - ${String(c.nome||'cliente').replace(/[,;\\\n]/g,' ')}\r\n${al('-P7D')}\r\n${al('-P1D')}\r\n${al('PT9H')}\r\nEND:VEVENT`}).join('\r\n');
    const ev30=L.map(c=>{const i=somaDias(c.dpp,-30),d=i.replace(/-/g,''),f=somaDias(c.dpp,-29).replace(/-/g,''),pd=brDia(somaDias(c.dpp,-28));
      return `BEGIN:VEVENT\r\nUID:dpp30-${c.id}@locatelli\r\nDTSTAMP:${ts}\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${f}\r\nSUMMARY:Conferir qualidade de segurada e decidir pedido - ${String(c.nome||'cliente').replace(/[,;\\\n]/g,' ')}\r\nDESCRIPTION:Parto previsto em ${brDia(c.dpp)}. Pedido do salario-maternidade permitido a partir de ${pd} (28 dias antes).\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Conferir qualidade de segurada\r\nTRIGGER:PT9H\r\nEND:VALARM\r\nEND:VEVENT`}).join('\r\n');
    const evL=LM.map(x=>{const d=x.l.d.replace(/-/g,''),f=somaDias(x.l.d,1).replace(/-/g,''),cl=s=>String(s||'').replace(/[,;\\\n]/g,' ');
      return `BEGIN:VEVENT\r\nUID:lem-${x.l.id}@locatelli\r\nDTSTAMP:${ts}\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${f}\r\nSUMMARY:${cl(x.l.t)} - ${cl(x.c.nome||'cliente')}\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Lembrete\r\nTRIGGER:-P1D\r\nEND:VALARM\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Lembrete\r\nTRIGGER:PT8H\r\nEND:VALARM\r\nEND:VEVENT`}).join('\r\n');
    const b=new Blob(['BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Locatelli//DPP//PT\r\nCALSCALE:GREGORIAN\r\n'+[ev,ev30,evL].filter(Boolean).join('\r\n')+'\r\nEND:VCALENDAR\r\n'],{type:'text/calendar'});
    const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='agenda-clientes.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('Arquivo baixado: abra-o no celular para entrar na agenda')}
  homeRender();
}

/* popup de avisos: abre uma vez por dia ao entrar (ou pelo botão "Ver avisos") */
function popupDpp(forca){
  const av=avisosDpp(),l30=lembretes30(),la=lembAvisos();if(!av.length&&!l30.length&&!la.length){if(forca)toast('Nenhum aviso agora');return}
  const hj=isoD(new Date()),sig=hj+'|'+av.map(x=>x.c.id).join(',')+'|'+l30.map(x=>x.c.id).join(',')+'|'+la.map(x=>x.l.id).join(',');
  if(!forca){try{if(localStorage.getItem('dpp.popup')===sig)return;localStorage.setItem('dpp.popup',sig)}catch(e){}}
  const t=n=>n===0?'<b>é HOJE</b>':n>0?'em '+n+(n===1?' dia':' dias'):'há '+(-n)+(n===-1?' dia':' dias');
  const nm=c=>`<a data-pc="${c.id}" style="cursor:pointer;text-decoration:underline;font-weight:700">${esc(c.nome||'(sem nome)')}</a>`;
  const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML=`<div style="background:var(--card,#fff);color:var(--tx,#222);border-radius:10px;padding:20px;width:100%;max-width:440px;max-height:85vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.4);font-size:14px">
    <b style="font-size:16px">🔔 Avisos</b>
    ${av.length?`<div style="margin-top:12px"><b>Partos previstos</b>${av.map(x=>`<div style="padding:3px 0">${nm(x.c)} — ${brDia(x.c.dpp)} (${t(x.n)})${x.n<0?`<label style="display:block;font-size:12px;color:var(--mut);cursor:pointer"><input type="checkbox" data-vis="${x.c.id}"> não mostrar novamente (o parto já ocorreu)</label>`:''}</div>`).join('')}</div>`:''}
    ${l30.length?`<div style="margin-top:12px"><b>Conferir a qualidade de segurada e decidir o pedido</b>${l30.map(x=>{const pd=somaDias(x.c.dpp,-28),ja=diasAte(pd)<=0;return `<div style="padding:3px 0">${nm(x.c)} — parto ${brDia(x.c.dpp)} (${t(x.n)}); ${ja?'já pode pedir desde ':'pode pedir a partir de '}${brDia(pd)}</div>`}).join('')}</div>`:''}
    ${la.length?`<div style="margin-top:12px"><b>Agenda</b>${la.map(x=>`<div style="padding:3px 0">${esc(x.l.t)} — ${nm(x.c)} — ${brDia(x.l.d)} (${t(x.n)})<label style="display:block;font-size:12px;color:var(--mut);cursor:pointer"><input type="checkbox" data-feito="${x.l.id}"> feito (não avisar mais)</label></div>`).join('')}</div>`:''}
    <div style="text-align:right;margin-top:14px"><button id="pdOk">Ok</button></div></div>`;
  document.body.appendChild(d);d.querySelector('#pdOk').onclick=()=>d.remove();
  d.querySelectorAll('[data-pc]').forEach(a=>a.onclick=()=>{d.remove();sel=a.dataset.pc;mostraSenha=false;srvAberto=false;lista();painel();irCli()});
  d.querySelectorAll('[data-vis]').forEach(k=>k.onchange=async()=>{const c=clientes.find(x=>x.id===k.dataset.vis);if(!c)return;if(k.checked)c.dppVisto=c.dpp;else delete c.dppVisto;await COFRE.salvar(c,{semHistorico:true});clientes=await COFRE.listar();calendario()});
  d.querySelectorAll('[data-feito]').forEach(k=>k.onchange=async()=>{const x=lembAtivos().find(y=>y.l.id===k.dataset.feito);if(!x)return;const c=clientes.find(z=>z.id===x.c.id),l=(c.lembretes||[]).find(z=>z.id===k.dataset.feito);if(!l)return;l.ok=k.checked;await COFRE.salvar(c,{semHistorico:true});clientes=await COFRE.listar();calendario();if(sel===c.id)painel()});
}
/* notificação do navegador (só funciona com o site aberto): no máximo uma vez por dia por cliente */
function notificaDpp(){
  try{if(!('Notification' in window)||Notification.permission!=='granted')return;
    const hj=isoD(new Date()),ja=JSON.parse(localStorage.getItem('dpp.avisado')||'{}');
    avisosDpp().filter(x=>x.n<=3&&x.n>=-7).forEach(x=>{const k=x.c.id+'|'+hj;if(ja[k])return;ja[k]=1;
      new Notification('Parto previsto '+(x.n===0?'HOJE':x.n>0?'em '+x.n+' dia(s)':'há '+(-x.n)+' dia(s)'),{body:'Cliente do cofre — abra os clientes para ver ('+brDia(x.c.dpp)+')'})});
    lembAvisos().filter(x=>x.n<=1).forEach(x=>{const k='L'+x.l.id+'|'+hj;if(ja[k])return;ja[k]=1;new Notification(x.n<=0?'Lembrete de hoje':'Lembrete para amanhã',{body:x.l.t+' — abra os clientes ('+brDia(x.l.d)+')'})});
    const l3=JSON.parse(localStorage.getItem('dpp.l30')||'{}');
    lembretes30().forEach(x=>{const k=x.c.id+'|'+x.c.dpp;if(l3[k])return;l3[k]=1;new Notification('Conferir qualidade de segurada',{body:'Parto previsto em '+brDia(x.c.dpp)+' ('+x.n+' dias). Pedido permitido a partir de '+brDia(somaDias(x.c.dpp,-28))+'. Abra os clientes.'})});localStorage.setItem('dpp.l30',JSON.stringify(l3));
    const r={};Object.keys(ja).filter(k=>k.endsWith('|'+hj)).forEach(k=>r[k]=1);localStorage.setItem('dpp.avisado',JSON.stringify(r))}catch(e){}}
$('#busca').oninput=lista;

/* ---------- painel do cliente ---------- */
const CAMPOS=[['nome','Nome completo'],['cpf','CPF (é o login do gov.br)'],['rg','RG nº (+ órgão)'],['tel','Telefone / WhatsApp'],['nac','Nacionalidade'],['ec','Estado civil'],['prof','Profissão'],['sexo','Sexo'],['end','Endereço'],['cep','CEP'],['cid','Cidade/UF']];
/* andamentos possíveis (nem sempre acontecem em ordem: você adiciona conforme vão ocorrendo; dá para repetir e digitar outros) */
const ETAPAS=[['Contrato',['Assinar contrato','Contrato assinado']],['Documentos',['Aguardando docs do cliente','Documentos recebidos','Atualizar dados cadastrais','Aguardando atualização cadastral','Refazer senha']],['Protocolo',['Aguardando protocolar','Protocolado','Cumprimento de exigência','Aguardando análise do INSS']],['Perícia',['Aguardando agendamento médico','Perícia agendada','Aguardando perícia','Aguardando laudo médico']],['Decisão',['Deferido','Indeferido','Recurso protocolado','Aguardando recurso']],['Outros',['Entrar em contato com o cliente','Benefício implantado','Arquivado']]];
const ANDAMENTOS=ETAPAS.flatMap(x=>x[1]);
const ORIGENS=['Orgânico','Indicação','Escritório','Captação'];   /* lista fácil de parametrizar no futuro */
const DOCS_PADRAO=['RG / CNH','CPF','Comprovante de endereço','Procuração assinada','Contrato assinado','Declaração de hipossuficiência','CNIS','Certidão de nascimento','Laudo / atestado médico','Documentos rurais (prova material)'];
/* padroniza o texto digitado para o andamento padrão mais próximo (sem acento/maiúscula; sinônimos). Se não reconhecer, mantém o texto. */
const semAc=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const SINON=[[/^(assinar|colher assinatura|enviar contrato)|contrato.*(para|pra) assinar|falta assinar/,'Assinar contrato'],[/contrato.*(assinad|firmad)|assinou.*contrato/,'Contrato assinado'],
 [/refaz.*senha|redefin.*senha|nova senha|recuperar senha|senha gov/,'Refazer senha'],[/aguard.*atualiz.*cadastr|atualiz.*cadastr.*aguard/,'Aguardando atualização cadastral'],[/atualiz.*(cadastr|dados)/,'Atualizar dados cadastrais'],
 [/aguard.*(doc|document)|falta.*(doc|document)|pendente.*(doc|document)/,'Aguardando docs do cliente'],[/(doc|document).*(receb|entreg|ok)/,'Documentos recebidos'],
 [/aguard.*laudo|laudo.*aguard/,'Aguardando laudo médico'],[/aguard.*agend|agendar.*(pericia|medic)|marcar.*(pericia|medic)/,'Aguardando agendamento médico'],
 [/(pericia|consulta|medic).*(agendad|marcad)|agendou.*(pericia|medic)/,'Perícia agendada'],[/aguard.*pericia|pericia.*aguard/,'Aguardando perícia'],
 [/aguard.*protoc|falta protoc|para protocolar/,'Aguardando protocolar'],[/exigencia/,'Cumprimento de exigência'],
 [/aguard.*(analise|inss|resposta|resultado|decisao)/,'Aguardando análise do INSS'],[/recurso.*(protoc|interpost|apresent)|recorreu/,'Recurso protocolado'],[/aguard.*recurso/,'Aguardando recurso'],
 [/protocolad|protocolou|deu entrada/,'Protocolado'],[/indeferid|negad|nao concedid/,'Indeferido'],[/deferid|aprovad|concedid/,'Deferido'],
 [/implantad|pagamento liberad|beneficio liberad|comecou a receber/,'Benefício implantado'],[/arquiv|encerrad|concluid|finalizad/,'Arquivado'],[/contato|ligar|retornar|falar com/,'Entrar em contato com o cliente']];
function padronizaAnd(txt){const o=String(txt||'').trim(),n=semAc(o);if(!n)return{e:'',mapped:false};
  const ex=ANDAMENTOS.find(x=>semAc(x)===n);if(ex)return{e:ex,mapped:true};
  for(const [re,v] of SINON)if(re.test(n))return{e:v,mapped:true};
  return{e:o.charAt(0).toUpperCase()+o.slice(1),mapped:false}}
const atualDe=c=>{const a=c.andamento||[];return a.length?a[a.length-1]:null};
const brl=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const numBR=t=>{t=String(t||'').replace(/[R$\s]/g,'');if(!t)return NaN;if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');return Number(t)};
const hoje=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const BENEFICIOS=['Aposentadoria por idade urbana','Regras de transição (antiga aposentadoria por tempo de contribuição)','Aposentadoria por idade rural','Aposentadoria por idade híbrida','Aposentadoria por idade da pessoa com deficiência','Aposentadoria por tempo de contribuição da pessoa com deficiência','Aposentadoria especial','Aposentadoria do professor','Auxílio-doença (incapacidade temporária)','Aposentadoria por invalidez (incapacidade permanente)','Auxílio-acidente','BPC/LOAS da pessoa com deficiência','BPC/LOAS do idoso','Salário-maternidade urbano','Salário-maternidade rural (segurada especial)','Pensão por morte urbana','Pensão por morte rural','Auxílio-reclusão'];
const REP=CAMPOS.map(([k,r])=>[k,k==='nome'?'Nome completo do(a) representante':k==='cpf'?'CPF do(a) representante':r]);
const BEN=[['fnome','Nome do(a) beneficiário(a)'],['fcpf','CPF do(a) beneficiário(a)'],['fnasc','Data de nascimento'],['fsexo','Sexo'],['fcond','Condição']];
function campo(k,r,c,pre){pre=pre||'';const dk=pre+k;
  if(k==='sexo')return `<div><label>${r}</label><select data-k="${dk}"><option value="">—</option><option value="F" ${c[k]==='F'?'selected':''}>Feminino</option><option value="M" ${c[k]==='M'?'selected':''}>Masculino</option></select></div>`;
  if(k==='fsexo')return `<div><label>${r}</label><select data-k="${dk}"><option value="F" ${c[k]!=='M'?'selected':''}>Filha</option><option value="M" ${c[k]==='M'?'selected':''}>Filho</option></select></div>`;
  if(k==='cond')return `<div><label>${r}</label><select data-k="${dk}"><option value="menor" ${c[k]!=='incapaz'?'selected':''}>Menor de idade</option><option value="incapaz" ${c[k]==='incapaz'?'selected':''}>Incapaz (maior)</option></select></div>`;
  if(k==='fcond')return `<div><label>${r}</label><select data-k="${dk}"><option value="menor" ${c[k]!=='incapaz'?'selected':''}>Menor de idade</option><option value="incapaz" ${c[k]==='incapaz'?'selected':''}>Incapaz (maior)</option></select></div>`;
  return `<div><label>${r}</label><input type="${k==='fnasc'||k==='nasc'?'date':'text'}" data-k="${dk}" value="${esc(c[k])}"></div>`;
}
async function painel(){
  const P=$('#painel');
  if(!sel){P.innerHTML=`<div class="marca"></div>`;return}
  const c=clientes.find(x=>x.id===sel);if(!c){P.innerHTML='';return}
  const arqs=await COFRE.arquivos(c.id),hist=await COFRE.historico(c.id);
  const docs=c.repr?DOCS.filter(d=>d[0]==='previdenciario-incapaz'):DOCS;
  P.innerHTML=`
  ${c.excluido?`<div class="aviso" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1"><b>Cliente excluído</b> em ${new Date(c.excluido).toLocaleString('pt-BR')}. Os dados continuam guardados.</span><button id="bRestCli">Restaurar cliente</button><button class="btn" id="bApagaCli" style="border-color:#b03a2e;color:#b03a2e">Apagar definitivamente</button></div>`:''}
  <div class="duo">
  <div class="card srvc${srvAberto?' aberto':''}"><h2>Serviços contratados <span class="esp"></span><button type="button" class="sec mini" id="bSrvEd" title="Mostrar/ocultar a edição (adicionar, remover, marcadores, honorários)">${srvAberto?'▴ Fechar':'✎ Editar'}</button></h2>
    <div id="bens">${(c.beneficios||[]).length?(c.beneficios||[]).map((b,i)=>`<div class="arq"><div class="t"><b>${esc(b)}</b></div><button class="perigo mini ed" data-menos="${i}" title="Remover">−</button></div>`).join(''):'<div class="vazio" style="padding:8px">Nenhum serviço contratado.</div>'}</div>
    <div class="mkw" style="margin-top:12px"><label class="ed" style="margin-top:0">Marcadores <span style="font-weight:400;color:var(--mut)">— aparecem na lista, ao lado do WhatsApp</span></label>
      <div class="linha${(c.marcas||[]).filter(k=>window.MARCAS&&MARCAS[k]).length?'':' ed'}" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">${(c.marcas||[]).filter(k=>window.MARCAS&&MARCAS[k]).map(k=>`<span class="mkc" title="${esc(MARCAS[k].nome)}">${MARCAS[k].svg}<button type="button" class="mkx" data-marcax="${k}" title="Remover ${esc(MARCAS[k].nome)}" aria-label="Remover">×</button></span>`).join('')||'<span style="color:var(--mut);font-size:13px">Nenhum marcador.</span>'}</div>
      <div class="ed" style="position:relative"><button type="button" class="sec" id="bMkAbre" style="width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center">Escolha o marcador… <span>▾</span></button>
        <div id="mkMenu" hidden>${Object.keys(window.MARCAS||{}).filter(k=>!(c.marcas||[]).includes(k)).map(k=>`<button type="button" class="mkop" data-marcaadd="${k}" title="${esc(MARCAS[k].nome)}" aria-label="${esc(MARCAS[k].nome)}">${MARCAS[k].svg}</button>`).join('')||'<span style="color:var(--mut);font-size:13px;padding:4px 8px">Todos já escolhidos.</span>'}</div></div></div>
    <div class="linha ed" style="margin-top:10px"><select id="selBen" style="flex:1;min-width:220px"><option value="">Escolha o serviço…</option><optgroup label="Previdenciário">${BENEFICIOS.map(b=>`<option>${esc(b)}</option>`).join('')}</optgroup><option value="__outro">Outro serviço (digitar)…</option></select><input type="text" id="outroBen" placeholder="Nome do serviço" hidden style="flex:1;min-width:200px"><button class="mini" id="bMais" title="Adicionar">+</button></div>
    ${(()=>{const H=c.honorarios||{},P=H.pagamentos||[],pago=P.reduce((a,x)=>a+(Number(x.v)||0),0),falta=(Number(H.valor)||0)-pago;return `<div style="border-top:1px solid var(--bd);margin-top:14px;padding-top:10px">
      <div style="font-size:13px;font-weight:700;color:var(--ouro2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Honorários</div>
      <div class="linha"><div style="flex:1;min-width:130px"><label style="margin-top:0">Valor combinado (R$)</label><input type="text" id="honVal" inputmode="decimal" placeholder="0,00" value="${H.valor?esc(Number(H.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})):''}"></div>
        <div style="flex:2;min-width:170px"><label style="margin-top:0">Observação</label><input type="text" id="honObs" placeholder="ex.: 30% do êxito, entrada + parcelas" value="${esc(H.obs)}"></div><button class="sec mini" id="bHonSalva" style="align-self:flex-end;margin-bottom:2px">Salvar</button></div>
      <label>Pagamentos recebidos (abatem o valor)</label>
      ${P.length?P.map((x,i)=>`<div class="arq"><div class="t"><b>${brl(x.v)}</b><span>${x.d?new Date(x.d+'T12:00:00').toLocaleDateString('pt-BR'):''}${x.o?' · '+esc(x.o):''}</span></div><button class="perigo mini" data-pagx="${i}" title="Remover pagamento">−</button></div>`).join(''):'<div class="vazio" style="padding:6px">Nenhum pagamento registrado.</div>'}
      <div class="linha" style="margin-top:6px"><input type="text" id="pagVal" inputmode="decimal" placeholder="Valor (R$)" style="flex:1 1 90px;min-width:0"><input type="date" id="pagData" value="${hoje()}" style="flex:1 1 130px;min-width:0"><input type="text" id="pagObs" placeholder="Forma/local (Pix…)" style="flex:2 1 110px;min-width:0"><button class="mini" id="bPagMais" title="Registrar pagamento">+</button></div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:13px"><span>Combinado: <b>${brl(H.valor)}</b></span><span>Pago: <b>${brl(pago)}</b></span><span style="color:${H.valor&&falta<=0?'#2e7d32':'var(--ouro2)'}">${H.valor?(falta<=0?'<b>Quitado</b>'+(falta<0?' (pago a mais: '+brl(-falta)+')':''):'Falta: <b>'+brl(falta)+'</b>'):''}</span></div>
    </div>`})()}
  </div>

  <div><div class="card"><h2>Acesso gov.br / Meu INSS</h2>
    <div class="gov">
      <span class="k">Login</span><span class="v">${esc(fmtCpf(c.cpf))||'<i>informe o CPF acima</i>'}</span><button class="sec mini" id="bCopLogin" ${c.cpf?'':'disabled'}>Copiar</button>
      <span class="k">Senha</span><span class="v">${c.govSenha?(mostraSenha?esc(c.govSenha):'••••••••••'):'<i style="color:var(--mut)">não cadastrada</i>'}</span>
      <span class="linha">${c.govSenha?`<button class="sec mini" id="bVer">${mostraSenha?'Ocultar':'Mostrar'}</button><button class="sec mini" id="bCopSenha">Copiar</button>`:''}</span>
    </div>
    <div class="linha" style="margin-top:10px;gap:8px"><button class="sec" id="bGovAbre" ${c.cpf?'':'disabled'} title="Abre o Meu INSS (com a extensão instalada, já entra com CPF e senha)">🔗 Abrir Meu INSS</button></div>
    <div class="linha" style="margin-top:10px"><input type="password" id="novaSenha" placeholder="${c.govSenha?'Nova senha (substitui a atual)':'Digite a senha do gov.br'}" style="flex:1;min-width:200px" autocomplete="off"><button class="sec" id="bSenha">${c.govSenha?'Alterar':'Guardar'}</button>${c.govSenha?'<button class="perigo mini" id="bApagaSenha">Apagar senha</button>':''}</div>
    <div class="aviso" style="margin-bottom:0">A senha fica criptografada junto com os demais dados (cofre protegido pela sua senha mestra).</div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Agendar lembrete</h2>
    ${(()=>{const Ls=[...(c.lembretes||[])].sort((a,b)=>(a.d||'')<(b.d||'')?-1:1);return Ls.length?Ls.map(l=>{const n=/^\d{4}-\d{2}-\d{2}$/.test(l.d||'')?diasAte(l.d):null,atras=!l.ok&&n!==null&&n<0;return `<div class="arq"><div class="t"><b style="${l.ok?'text-decoration:line-through;color:var(--mut)':''}">${esc(l.t)}</b><span style="${atras?'color:var(--red)':''}">${l.d?brDia(l.d):''}${n===0&&!l.ok?' · hoje':atras?' · atrasado':''}</span></div><label style="font-size:12px;white-space:nowrap;cursor:pointer"><input type="checkbox" data-lemok="${l.id}" ${l.ok?'checked':''}> feito</label><button class="perigo mini" data-lemx="${l.id}" title="Remover">−</button></div>`}).join(''):'<div class="vazio" style="padding:8px">Nenhum lembrete.</div>'})()}
    <div class="linha" style="margin-top:8px"><input type="text" id="lemTxt" placeholder="O que lembrar (ex.: perícia médica, visita…)" style="flex:2 1 180px;min-width:0"><input type="date" id="lemData" style="flex:1 1 130px;min-width:0"><button class="mini" id="bLemAdd" title="Agendar">+</button></div>
    <div style="font-size:12px;color:var(--mut);margin-top:6px">Aparece marcado no calendário (junto com os partos) e no popup de avisos.</div>
  </div></div>
  </div>

  <div class="card"><h2>Andamento <span class="esp"></span></h2>
    ${(()=>{const A=c.andamento||[];return A.length?`<div class="tlh">${A.map((x,i)=>`<div class="tl ${i===A.length-1?'atual':''}"><b>${esc(x.e)}</b><small>${i===A.length-1?'atual · ':''}${new Date(x.t).toLocaleDateString('pt-BR')}</small><button class="x" data-andx="${i}" title="Remover este andamento">×</button></div>`).join('')}</div>`:'<div class="vazio" style="padding:8px">Nenhum andamento registrado.</div>'})()}
    <details id="detAnd" ${andAberto?'open':''} style="margin-top:12px"><summary style="cursor:pointer;color:var(--ouro2);font-weight:600;font-size:13px">Adicionar andamento (na ordem em que acontecer)</summary>
    ${ETAPAS.map(([g,L])=>`<div style="margin-top:8px"><small style="color:var(--mut);font-weight:700">${g}</small><div class="cats" style="margin-top:3px">${L.map(n=>`<button class="cat" data-andadd="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div></div>`).join('')}
    <div class="linha" style="margin-top:8px"><input type="text" id="outroAnd" placeholder="Outro andamento (digitar — é padronizado automaticamente)…" style="flex:1;min-width:200px"><button class="mini" id="bOutroAnd">+</button></div>
    </details>
  </div>

  <div class="card"><h2>Linha do tempo <span class="esp"></span></h2>
    ${(()=>{const T=[];
      const tD=d=>d===hoje()?Date.now()-1:new Date(d+'T12:00:00').getTime();
      (c.andamento||[]).forEach(x=>T.push({t:x.t,i:'📌',x:x.e}));
      ((c.honorarios&&c.honorarios.pagamentos)||[]).forEach(x=>{if(x.d)T.push({t:tD(x.d),i:'💰',x:'Pagamento recebido: '+brl(x.v)+(x.o?' ('+x.o+')':'')})});
      (c.lembretes||[]).forEach(l=>{if(l.d)T.push({t:tD(l.d),i:l.ok?'✅':'🗓',x:l.t+(l.ok?' (feito)':'')})});
      if(c.dpp)T.push({t:tD(c.dpp),i:'🤰',x:'Parto previsto'});
      (c.tlNotas||[]).forEach(n=>T.push({t:tD(n.d||hoje()),i:'📝',x:n.t,nid:n.id}));
      arqs.forEach(a=>T.push({t:a.data,i:'📎',x:'Arquivo: '+a.nome}));
      if(c.criado)T.push({t:c.criado,i:'👤',x:'Cadastro criado'});
      T.sort((a,b)=>b.t-a.t);const ag=Date.now();
      return T.length?`<div class="tlh">${T.slice(0,60).map(x=>`<div class="tl"><b>${x.i} ${esc(x.x)}</b><small>${new Date(x.t).toLocaleDateString('pt-BR')}${x.t>ag+43200000?' · agendado':''}</small>${x.nid?`<button class="x" data-tlx="${x.nid}" title="Remover anotação">×</button>`:''}</div>`).join('')}</div>`:'<div class="vazio" style="padding:8px">Nada ainda.</div>'})()}
    <div class="linha" style="margin-top:10px"><input type="text" id="tlTxt" placeholder="Anotar na linha do tempo (ligação, visita, observação…)" style="flex:2 1 200px;min-width:0"><input type="date" id="tlData" value="${hoje()}" style="flex:1 1 130px;min-width:0"><button class="mini" id="bTlAdd" title="Adicionar anotação">+</button></div>
  </div>

  <div class="card"><h2>Checklist de documentos <span class="esp"></span><span style="font-weight:400;color:var(--mut);text-transform:none;letter-spacing:0">${(()=>{const D=c.docs||[];return D.length?D.filter(x=>x.ok).length+' de '+D.length:''})()}</span></h2>
    ${(()=>{const D=c.docs||[];return D.length?`<div class="bar" style="height:8px;background:var(--bd);border-radius:5px;overflow:hidden;margin-bottom:6px"><i style="display:block;height:100%;background:var(--ouro);width:${Math.round(D.filter(x=>x.ok).length/D.length*100)}%"></i></div>`+D.map(x=>`<div class="arq"><label style="flex:1;display:flex;gap:8px;align-items:center;cursor:pointer;${x.ok?'text-decoration:line-through;color:var(--mut)':''}"><input type="checkbox" data-docok="${x.id}" ${x.ok?'checked':''}> ${esc(x.t)}</label><button class="perigo mini" data-docx="${x.id}" title="Remover">−</button></div>`).join(''):'<div class="vazio" style="padding:8px">Nenhum documento na lista.</div>'})()}
    <div class="cats" style="margin-top:8px">${DOCS_PADRAO.filter(n=>!(c.docs||[]).some(x=>x.t===n)).map(n=>`<button class="cat" data-docadd="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
    <div class="linha" style="margin-top:8px"><input type="text" id="docTxt" placeholder="Outro documento…" style="flex:1;min-width:200px"><button class="mini" id="bDocAdd">+</button></div>
  </div>

  <div class="card"><h2>Dados do cliente<span class="esp"></span><button id="bSalvar">Salvar alterações</button></h2>
    ${c.repr?`<div class="g2">${[['nome','Nome do(a) beneficiário(a) (representado(a))'],['cpf','CPF do(a) beneficiário(a) (é o login do gov.br)'],['nasc','Data de nascimento'],['sexo','Sexo'],['cond','Condição']].map(([k,r])=>campo(k,r,c)).join('')}</div>
    <h2 style="margin:16px 0 0">Representante legal</h2><div class="g2">${REP.map(([k,r])=>campo(k,r,c.rep||{},'rep.')).join('')}</div>`
    :`<div class="g2">${CAMPOS.map(([k,r])=>campo(k,r,c)).join('')}<div><label>Data provável do parto (DPP) — só gestante</label><input type="date" data-k="dpp" value="${esc(c.dpp||'')}"></div></div>`}
    <div class="g2"><div><label>Origem do cliente</label><select data-k="origem"><option value="">—</option>${[...ORIGENS,...(c.origem&&!ORIGENS.includes(c.origem)?[c.origem]:[])].map(o=>`<option ${c.origem===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div></div>
    <label>Observações</label><textarea data-k="notas">${esc(c.notas)}</textarea>
  </div>

  <div class="card"><h2>Arquivos <span class="esp"></span><label class="btn mini" style="margin:0;cursor:pointer">+ Adicionar<input type="file" id="fAdd" multiple hidden></label></h2>
    ${arqs.length?arqs.map(a=>`<div class="arq">${icone(a.nome)}<div class="t"><b>${esc(a.nome)}</b><span>${a.origem?`<span class="tag">${esc(a.origem)}</span>`:''}${fmtData(a.data)} · ${fmtTam(a.tamanho)}</span></div>${/\.(pdf|jpe?g|png|webp|gif)$/i.test(a.nome)?`<button class="sec mini" data-ver="${a.id}">Ver</button>`:''}<button class="sec mini" data-baixar="${a.id}">Baixar</button><button class="perigo mini" data-del="${a.id}">Excluir</button></div>`).join(''):'<div class="vazio">Nenhum arquivo guardado.</div>'}
  </div>

  <div class="card"><details id="detHist" ${histAberto?'open':''}><summary style="cursor:pointer;color:var(--ouro2);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:13px">Histórico de alterações (${hist.length})</summary>
    <div style="margin-top:8px">${hist.length?hist.slice(0,80).map(h=>{const r=h.resumo||[];return `<div class="hist"><div class="quando">${new Date(h.t).toLocaleString('pt-BR')}</div><div>${r.slice(0,6).map(esc).join('<br>')}${r.length>6?`<br><i>+ ${r.length-6} alteração(ões)</i>`:''}</div>${h.antes||(h.arq&&!arqs.some(a=>a.id===h.arq))?`<button class="sec mini" data-rest="${h.id}" style="margin-top:5px">${h.arq?'Restaurar arquivo':'Voltar a antes desta alteração'}</button>`:''}</div>`}).join(''):'<div class="vazio">Nenhuma alteração registrada ainda.</div>'}${hist.length>80?'<div class="vazio">Mostrando as 80 mais recentes.</div>':''}</div>
  </details><div style="font-size:12px;color:var(--mut);margin-top:6px">Toda alteração fica registrada. Quem tem a senha mestra pode restaurar a versão anterior; a restauração também fica no histórico.</div></div>

  <div class="card"><h2>Gerar documento para este cliente</h2>
    <div class="linha"><select id="selDoc" style="flex:1;min-width:220px">${docs.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select><button id="bGerar">Abrir no gerador →</button></div>
    <div class="rod" style="margin:8px 0 0">Os dados acima entram preenchidos; você só escolhe a data.</div>
  </div>
  <div class="linha" style="justify-content:flex-end"><button class="perigo" id="bExcluir">Excluir cliente</button></div>`;

  const dados=()=>{P.querySelectorAll('[data-k]').forEach(e=>{const k=e.dataset.k;if(k.startsWith('rep.')){(c.rep=c.rep||{})[k.slice(4)]=e.value}else c[k]=e.value});c.cpf=fmtCpf(c.cpf);if(c.rep&&c.rep.cpf)c.rep.cpf=fmtCpf(c.rep.cpf)};
  $('#bSalvar').onclick=async()=>{dados();await COFRE.salvar(c);clientes=await COFRE.listar();lista();painel();toast('Cliente salvo')};
  $('#selBen').onchange=e=>{$('#outroBen').hidden=e.target.value!=='__outro';if(!$('#outroBen').hidden)$('#outroBen').focus()};
  $('#bSrvEd').onclick=()=>{srvAberto=!srvAberto;const k=$('.srvc');k.classList.toggle('aberto',srvAberto);$('#bSrvEd').textContent=srvAberto?'▴ Fechar':'✎ Editar'};
  $('#bMais').onclick=async()=>{let v=$('#selBen').value;if(v==='__outro')v=$('#outroBen').value.trim();if(!v)return toast('Escolha o serviço');dados();c.beneficios=c.beneficios||[];if(c.beneficios.includes(v))return toast('Já está na lista');c.beneficios.push(v);await COFRE.salvar(c);clientes=await COFRE.listar();painel()};
  const mkSalva=async f=>{dados();c.marcas=c.marcas||[];f();await COFRE.salvar(c);clientes=await COFRE.listar();lista();painel()};
  if($('#bMkAbre')){$('#bMkAbre').onclick=e=>{e.stopPropagation();$('#mkMenu').hidden=!$('#mkMenu').hidden};document.addEventListener('click',()=>{const m=$('#mkMenu');if(m)m.hidden=true},{once:true});
    P.querySelectorAll('[data-marcaadd]').forEach(b=>b.onclick=()=>mkSalva(()=>{if(!c.marcas.includes(b.dataset.marcaadd))c.marcas.push(b.dataset.marcaadd)}))}
  P.querySelectorAll('[data-marcax]').forEach(b=>b.onclick=()=>mkSalva(()=>{c.marcas=c.marcas.filter(x=>x!==b.dataset.marcax)}));
  P.querySelectorAll('[data-menos]').forEach(b=>b.onclick=async()=>{dados();c.beneficios.splice(+b.dataset.menos,1);await COFRE.salvar(c);clientes=await COFRE.listar();painel()});
  const salvaHon=async(f)=>{dados();c.honorarios=c.honorarios||{};f(c.honorarios);await COFRE.salvar(c);clientes=await COFRE.listar();painel()};
  $('#bHonSalva').onclick=()=>{const v=numBR($('#honVal').value);if($('#honVal').value.trim()&&!(v>=0))return toast('Valor inválido');salvaHon(h=>{h.valor=v>=0?v:0;h.obs=$('#honObs').value.trim()});toast('Honorários salvos')};
  $('#bPagMais').onclick=()=>{const v=numBR($('#pagVal').value);if(!(v>0))return toast('Informe o valor pago');const d=$('#pagData').value||hoje(),o=$('#pagObs').value.trim();salvaHon(h=>{(h.pagamentos=h.pagamentos||[]).push({id:COFRE.uid(),v,d,o})});toast('Pagamento registrado')};
  P.querySelectorAll('[data-pagx]').forEach(b=>b.onclick=()=>{if(!confirm('Remover este pagamento?'))return;salvaHon(h=>{h.pagamentos.splice(+b.dataset.pagx,1)})});
  const addAnd=async n=>{const pd=padronizaAnd(n);if(!pd.e)return;dados();(c.andamento=c.andamento||[]).push({e:pd.e,t:Date.now()});await COFRE.salvar(c);clientes=await COFRE.listar();painel();toast(pd.mapped&&semAc(n)!==semAc(pd.e)?'Padronizado como: '+pd.e:'Andamento: '+pd.e)};
  $('#detAnd').ontoggle=e=>{andAberto=e.target.open};
  P.querySelectorAll('[data-andadd]').forEach(b=>b.onclick=()=>addAnd(b.dataset.andadd));
  $('#bOutroAnd').onclick=()=>addAnd($('#outroAnd').value);$('#outroAnd').onkeydown=e=>{if(e.key==='Enter')addAnd(e.target.value)};
  P.querySelectorAll('[data-andx]').forEach(b=>b.onclick=async()=>{dados();c.andamento.splice(+b.dataset.andx,1);await COFRE.salvar(c);clientes=await COFRE.listar();painel()});
  $('#bGovAbre').onclick=()=>{const cpf=String(c.cpf).replace(/\D/g,'');if(document.documentElement.dataset.locGovbr==='1'&&c.govSenha){window.postMessage({loc:'govbr-entrar',cpf,senha:c.govSenha,alvo:'inss'},location.origin);toast('Abrindo o Meu INSS e preenchendo…')}else{window.open('https://meu.inss.gov.br/','_blank','noopener');copia(cpf,'CPF (cole no login; a senha está no botão Copiar)')}};
  const salvaCl=async()=>{await COFRE.salvar(c,{semHistorico:true});clientes=await COFRE.listar();lista();painel()};
  $('#bTlAdd').onclick=async()=>{const t=$('#tlTxt').value.trim();if(!t)return toast('Escreva a anotação');dados();(c.tlNotas=c.tlNotas||[]).push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),t,d:$('#tlData').value||hoje()});await salvaCl()};
  $('#tlTxt').onkeydown=e=>{if(e.key==='Enter')$('#bTlAdd').click()};
  P.querySelectorAll('[data-tlx]').forEach(b=>b.onclick=async()=>{dados();c.tlNotas=(c.tlNotas||[]).filter(n=>n.id!==b.dataset.tlx);await salvaCl()});
  const addDoc=async t=>{t=String(t||'').trim();if(!t)return;dados();c.docs=c.docs||[];if(c.docs.some(x=>x.t.toLowerCase()===t.toLowerCase()))return toast('Já está na lista');c.docs.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),t,ok:false});await salvaCl()};
  P.querySelectorAll('[data-docadd]').forEach(b=>b.onclick=()=>addDoc(b.dataset.docadd));$('#bDocAdd').onclick=()=>addDoc($('#docTxt').value);$('#docTxt').onkeydown=e=>{if(e.key==='Enter')addDoc(e.target.value)};
  P.querySelectorAll('[data-docok]').forEach(k=>k.onchange=async()=>{dados();const d=(c.docs||[]).find(x=>x.id===k.dataset.docok);if(d){d.ok=k.checked;await salvaCl()}});
  P.querySelectorAll('[data-docx]').forEach(b=>b.onclick=async()=>{dados();c.docs=(c.docs||[]).filter(x=>x.id!==b.dataset.docx);await salvaCl()});
  $('#bLemAdd').onclick=async()=>{const t=$('#lemTxt').value.trim(),d=$('#lemData').value;if(!t)return toast('Escreva o lembrete');if(!d)return toast('Escolha a data');dados();(c.lembretes=c.lembretes||[]).push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),t,d});await COFRE.salvar(c,{semHistorico:true});clientes=await COFRE.listar();lista();painel();toast('Lembrete agendado')};
  $('#lemTxt').onkeydown=e=>{if(e.key==='Enter')$('#bLemAdd').click()};
  P.querySelectorAll('[data-lemok]').forEach(k=>k.onchange=async()=>{dados();const l=(c.lembretes||[]).find(z=>z.id===k.dataset.lemok);if(l){l.ok=k.checked;await COFRE.salvar(c,{semHistorico:true});clientes=await COFRE.listar();lista();painel()}});
  P.querySelectorAll('[data-lemx]').forEach(b=>b.onclick=async()=>{if(!confirm('Remover este lembrete?'))return;dados();c.lembretes=(c.lembretes||[]).filter(z=>z.id!==b.dataset.lemx);await COFRE.salvar(c,{semHistorico:true});clientes=await COFRE.listar();lista();painel()});
  $('#bCopLogin').onclick=()=>copia(String(c.cpf).replace(/\D/g,''),'Login');
  if($('#bVer'))$('#bVer').onclick=()=>{mostraSenha=!mostraSenha;painel()};
  if($('#bCopSenha'))$('#bCopSenha').onclick=()=>copia(c.govSenha,'Senha');
  $('#bSenha').onclick=async()=>{const v=$('#novaSenha').value;if(!v)return toast('Digite a senha primeiro');dados();c.govSenha=v;await COFRE.salvar(c);clientes=await COFRE.listar();mostraSenha=false;painel();toast('Senha guardada')};
  if($('#bApagaSenha'))$('#bApagaSenha').onclick=async()=>{if(!confirm('Apagar a senha do gov.br deste cliente?'))return;dados();delete c.govSenha;await COFRE.salvar(c);clientes=await COFRE.listar();painel();toast('Senha apagada')};
  $('#fAdd').onchange=async e=>{for(const f of e.target.files)await COFRE.addArquivo(c.id,{nome:f.name,tipo:f.type,origem:'Adicionado',blob:f});painel();toast('Arquivo(s) guardado(s)')};
  P.querySelectorAll('[data-baixar]').forEach(b=>b.onclick=async()=>{const a=arqs.find(x=>x.id===b.dataset.baixar),bl=await COFRE.lerArquivo(a.id),u=document.createElement('a');u.href=URL.createObjectURL(bl);u.download=a.nome;document.body.appendChild(u);u.click();setTimeout(()=>{URL.revokeObjectURL(u.href);u.remove()},4000)});
  P.querySelectorAll('[data-ver]').forEach(b=>b.onclick=async()=>{const a=arqs.find(x=>x.id===b.dataset.ver);let bl=await COFRE.lerArquivo(a.id);const pdf=/\.pdf$/i.test(a.nome);bl=new Blob([bl],{type:pdf?'application/pdf':(bl.type&&bl.type.startsWith('image/')?bl.type:'image/'+(a.nome.split('.').pop().toLowerCase().replace('jpg','jpeg')))});const url=URL.createObjectURL(bl),m=document.createElement('div');m.style.cssText='position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.75);display:flex;flex-direction:column;padding:12px;gap:8px';m.innerHTML=`<div style="display:flex;gap:10px;align-items:center;color:#fff"><b style="flex:1;overflow-wrap:anywhere">${esc(a.nome)}</b><button id="mFecha">Fechar ✕</button></div>`+(pdf?`<iframe src="${url}" style="flex:1;border:0;background:#fff;border-radius:6px"></iframe>`:`<div style="flex:1;overflow:auto;text-align:center"><img src="${url}" style="max-width:100%;border-radius:6px"></div>`);document.body.appendChild(m);const f=()=>{m.remove();URL.revokeObjectURL(url)};m.querySelector('#mFecha').onclick=f;m.onclick=e=>{if(e.target===m)f()}});
  P.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este arquivo? Ele fica registrado no histórico e pode ser restaurado.'))return;await COFRE.arquivoParaLixeira(b.dataset.del);histAberto=true;painel()});
  $('#detHist').ontoggle=e=>{histAberto=e.target.open};
  P.querySelectorAll('[data-rest]').forEach(b=>b.onclick=async()=>{if(!confirm('Restaurar? O cadastro volta ao estado de antes dessa alteração, desfazendo também o que foi alterado depois dela. A restauração fica registrada no histórico, então dá para desfazer.'))return;try{const r=await COFRE.restaurar(b.dataset.rest);clientes=await COFRE.listar();histAberto=true;lista();painel();toast(r==='arquivo'?'Arquivo restaurado':'Versão restaurada')}catch(e){alert(e.message)}});
  if($('#bApagaCli'))$('#bApagaCli').onclick=async()=>{if(!confirm('APAGAR DEFINITIVAMENTE '+(c.nome||'este cliente')+'?\n\nOs dados, os arquivos e o histórico dele serão destruídos, aqui e na nuvem. Isso NÃO pode ser desfeito.'))return;await COFRE.apagarDefinitivo(c.id);clientes=await COFRE.listar();sel=null;if(!clientes.some(x=>x.excluido))verExcl=false;lista();painel();toast('Cliente apagado definitivamente')};
  if($('#bRestCli'))$('#bRestCli').onclick=async()=>{delete c.excluido;await COFRE.salvar(c);clientes=await COFRE.listar();verExcl=false;lista();painel();toast('Cliente restaurado')};
  $('#bGerar').onclick=()=>{dados();try{sessionStorage.setItem('prefill',JSON.stringify(paraGerador(c)))}catch(e){}const u='gerador.html?doc='+$('#selDoc').value+'&cliente='+c.id;if(window.SHELLAPI&&SHELLAPI.gerador)SHELLAPI.gerador(u);else location.href=u};
  $('#bExcluir').onclick=async()=>{if(!confirm('Excluir '+(c.nome||'este cliente')+'? Ele vai para “Excluídos” e pode ser restaurado.'))return;dados();c.excluido=Date.now();await COFRE.salvar(c);clientes=await COFRE.listar();sel=visiveis()[0]?visiveis()[0].id:null;lista();painel();toast('Cliente excluído (pode ser restaurado em “Ver excluídos”)')};
}
/* ---------- novo cliente: documentos (lidos por OCR) ou digitação manual ---------- */
let fila=Promise.resolve(),ocupado=0;
function novoFluxo(){
  sel=null;lista();
  const nd={o:{},arq:[]};  /* arq: {f,rot,origem} */
  const P=$('#painel');
  const slot=(id,tit,sub,mult)=>`<label class="up" style="display:block;border:2px dashed var(--ouro);background:var(--up);border-radius:10px;padding:12px;margin-bottom:10px;cursor:pointer"><b id="t_${id}">${tit}</b><div style="font-size:12px;color:var(--mut)">${sub}</div><input type="file" id="${id}" accept="image/*,application/pdf" ${mult?'multiple':''} hidden><div class="st" id="st_${id}" style="font-size:12px;margin-top:6px"></div></label>`;
  P.innerHTML=`<div class="card"><h2>Novo cliente <span class="esp"></span><button class="sec mini" id="nCancela">Cancelar</button></h2>
    <p style="margin:0 0 10px;color:var(--mut)">Envie os documentos e eu leio os dados. Pode enviar só o que tiver.</p>
    ${slot('nIdent','Identidade / CNH / documento com foto','foto, PDF ou imagem — frente (e verso, se precisar)',true)}
    ${slot('nEnd','Comprovante de endereço','conta de luz/água/telefone etc.')}
    ${slot('nCert','Certidão de nascimento, identidade ou CNH do(a) beneficiário(a)','da filha/do filho/incapaz representado(a). Ao enviar, o cadastro fica no nome do(a) representado(a), e a identidade e o comprovante acima passam a ser do(a) representante. Sem esse documento, o cliente é o próprio beneficiário.')}
    <label class="up" style="display:block;border:2px dashed var(--bd);border-radius:10px;padding:12px;margin-bottom:10px;cursor:pointer"><b>Outros documentos</b><div style="font-size:12px;color:var(--mut)">um por vez — só vai para os arquivos do cliente (não é lido)</div><input type="file" id="nOut" hidden><div id="nOutLista" style="margin-top:6px"></div></label>
    <div class="linha" style="margin-top:6px"><button id="nVai" disabled>Continuar →</button><button class="sec" id="nManual">Digitar manualmente</button><button class="sec" id="nManualRep">Digitar manualmente — cliente representado(a)</button></div>
  </div>`;
  const status=(id,t)=>{$('#st_'+id).innerHTML=t};
  const atualiza=()=>{const rp=nd.arq.some(a=>ehBenef(a.rot));$('#t_nIdent').textContent=rp?'Identidade / CNH do representante':'Identidade / CNH / documento com foto';$('#t_nEnd').textContent=rp?'Comprovante de endereço do representante':'Comprovante de endereço';$('#nVai').disabled=ocupado>0||!nd.arq.length;$('#nOutLista').innerHTML=nd.arq.filter(a=>a.rot==='Outro').map(a=>`<div style="font-size:13px">${esc(a.f.name)} <a href="#" data-x="${nd.arq.indexOf(a)}" style="color:var(--red)">remover</a></div>`).join('');
    P.querySelectorAll('[data-x]').forEach(x=>x.onclick=e=>{e.preventDefault();nd.arq.splice(+x.dataset.x,1);atualiza()})};
  const ocr=(id,rot,ext,keys,NOMES)=>{$('#'+id).onchange=e=>{
    const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
    fs.forEach(f=>nd.arq.push({f,rot,origem:'Enviado'}));ocupado++;atualiza();status(id,'Na fila…');
    fila=fila.then(async()=>{
      try{if(!window.Tesseract||!window.OCR_LER)throw new Error('motor de leitura não carregou — recarregue a página');
        const o=await OCR_LER(fs,OCR_EXTRATORES[ext],keys,t=>status(id,t));
        keys.forEach(k=>{if(o[k]&&!nd.o[k])nd.o[k]=o[k]});
        if(o._tipo==='id')nd.arq.forEach(a=>{if(fs.includes(a.f)&&a.rot==='Certidão de nascimento')a.rot='Documento do(a) beneficiário(a)'});
        const achou=keys.filter(k=>o[k]),falta=keys.filter(k=>!o[k]);
        status(id,(achou.length?'✔ Li: '+achou.map(k=>NOMES[k]).join(', '):'')+(falta.length?(achou.length?'<br>':'')+'⚠ Não consegui ler: '+falta.map(k=>NOMES[k]).join(', ')+' — complete na ficha':''));
      }catch(err){status(id,'⚠ '+esc(err.message));console.error(err)}
      ocupado--;atualiza()})}};
  ocr('nIdent','Identidade','ident',['nome','cpf','rg'],{nome:'nome',cpf:'CPF',rg:'RG'});
  ocr('nEnd','Comprovante de endereço','end',['end','cep','cid'],{end:'endereço',cep:'CEP',cid:'cidade/UF'});
  ocr('nCert','Certidão de nascimento','cert',['fnome','fcpf','fnasc','fsexo'],{fnome:'nome do(a) beneficiário(a)',fcpf:'CPF do(a) beneficiário(a)',fnasc:'data de nascimento',fsexo:'sexo'});
  $('#nOut').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;nd.arq.push({f,rot:'Outro',origem:'Adicionado'});atualiza()};
  $('#nCancela').onclick=()=>{sel=visiveis()[0]?visiveis()[0].id:null;lista();painel()};
  $('#nManual').onclick=async()=>{const c=await COFRE.salvar({nome:'Novo cliente'});clientes=await COFRE.listar();sel=c.id;$('#busca').value='';lista();painel();setTimeout(()=>{const i=document.querySelector('[data-k=nome]');if(i){i.focus();i.select()}},50)};
  $('#nManualRep').onclick=async()=>{const c=await COFRE.salvar({nome:'Novo cliente',repr:true,rep:{},cond:'menor'});clientes=await COFRE.listar();sel=c.id;$('#busca').value='';lista();painel();setTimeout(()=>{const i=document.querySelector('[data-k=nome]');if(i){i.focus();i.select()}},50)};
  $('#nVai').onclick=async()=>{
    $('#nVai').disabled=true;const o=nd.o,pes={};
    ['nome','cpf','rg','end','cep','cid'].forEach(k=>{if(o[k])pes[k]=o[k]});
    if(pes.cpf)pes.cpf=fmtCpf(pes.cpf);
    if(pes.nome&&window.SEXO){const r=SEXO.por(pes.nome);if(r&&r.sexo)pes.sexo=r.sexo}
    const repr=nd.arq.some(a=>ehBenef(a.rot));   /* com certidão: o cadastro é do(a) representado(a) */
    let novo=pes;
    if(repr){novo={repr:true,rep:pes,cond:'menor'};if(o.fnome)novo.nome=o.fnome;if(o.fcpf)novo.cpf=fmtCpf(o.fcpf);if(o.fnasc)novo.nasc=o.fnasc;if(o.fsexo)novo.sexo=o.fsexo}
    const todos=await COFRE.listar(),nm=x=>String(x||'').trim().toLowerCase();
    const ex=(novo.cpf&&await COFRE.porCpf(novo.cpf))||(repr&&novo.nome&&todos.find(x=>x.repr&&nm(x.nome)===nm(novo.nome)))||null;
    const c=ex||novo;
    if(ex){for(const k in novo){if(k==='rep'){ex.rep=Object.assign({},novo.rep,ex.rep)}else if(!ex[k])ex[k]=novo[k]}}
    if(!c.nome)c.nome='Novo cliente';
    const sv=await COFRE.salvar(c),ja=await COFRE.arquivos(sv.id);
    for(const a of nd.arq){const nmA=a.rot==='Outro'?a.f.name:a.rot+(repr&&!ehBenef(a.rot)?' do representante':'')+' - '+a.f.name;if(!ja.some(x=>x.nome===nmA&&x.tamanho===a.f.size))await COFRE.addArquivo(sv.id,{nome:nmA,tipo:a.f.type,origem:a.origem,blob:a.f})}
    clientes=await COFRE.listar();sel=sv.id;$('#busca').value='';lista();painel();
    toast(ex?'Cliente já existia — dados e arquivos acrescentados':'Cliente criado — confira os dados');
  };
}
$('#bNovo').onclick=novoFluxo;

/* ---------- backup ---------- */
$('#bExp').onclick=async()=>{const b=await COFRE.exportar(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='backup-clientes-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);toast('Backup criptografado baixado')};
const importa=async f=>{if(!f)return;try{const r=await COFRE.importar(f);toast(`Restaurado: ${r.clientes} cliente(s), ${r.arquivos} arquivo(s)`);if(r.precisaAbrir||!COFRE.aberto()){COFRE.bloquear();inicia()}else entra()}catch(e){alert(e.message)}};
$('#fImp').onchange=e=>importa(e.target.files[0]);$('#fImp0').onchange=e=>importa(e.target.files[0]);
$('#bLock').onclick=()=>{COFRE.bloquear();if(window.SHELLAPI)SHELLAPI.sair();else location.href='index.html'};

/* ---- ligação com a casca (index.html) ---- */
const irCli=()=>{try{window.SHELLAPI&&SHELLAPI.ir('clientes')}catch(e){}};
window.CLI={entra,inicia,abre:id=>{sel=id;mostraSenha=false;srvAberto=false;lista();painel();irCli()},recarrega:async()=>{clientes=await COFRE.listar();lista();painel();calendario()},avisos:()=>popupDpp(true)};
window.addEventListener('message',e=>{if(e.data&&e.data.loc==='recarregar')window.CLI.recarrega()});
if(!window.SHELL)inicia();
})();
