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

let clientes=[],sel=null,mostraSenha=false,verExcl=false,histAberto=false,andAberto=false;
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
    try{if(!SYNC.configurado())throw new Error('A nuvem ainda não está configurada neste site (falta o projeto Firebase).');
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
function ligaNuvem(){ligaOlho();
  if(ligaNuvem.ok)return;ligaNuvem.ok=true;
  COFRE.aoMudar=()=>SYNC.agendar();
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
    if(!SYNC.configurado()){toast('A nuvem ainda não está configurada neste site (falta o projeto Firebase)');return}
    try{await SYNC.executar(true)}catch(e){if(e&&e.message!=='SEM_CONFIG')toast('Erro: '+(e.message||e))}};
  if(SYNC.configurado())SYNC.executar(false).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&SYNC.configurado()&&Date.now()-SYNC.ultima()>60000)SYNC.executar(false).catch(()=>{})});
}
async function entra(){
  $('#trava').hidden=true;$('#barraCofre').hidden=false;$('#app').hidden=false;ligaNuvem();
  clientes=await COFRE.listar();
  for(const c of clientes){if(!c.repr&&(c.fnome||c.fcpf)){   /* cadastros antigos: passa o cadastro para o nome do(a) representado(a) */
    const r={};['nome','cpf','rg','tel','nac','ec','prof','sexo','end','cep','cid'].forEach(k=>{if(c[k])r[k]=c[k];delete c[k]});
    Object.assign(c,{repr:true,rep:r,nome:c.fnome||'',cpf:c.fcpf||'',nasc:c.fnasc||'',sexo:c.fsexo||'',cond:c.fcond||'menor'});['fnome','fcpf','fnasc','fsexo','fcond'].forEach(k=>delete c[k]);await COFRE.salvar(c,{semHistorico:true})}}
  for(const c of clientes){if(c.etapa!==undefined){if(c.etapa&&!(c.andamento||[]).length)c.andamento=[{e:c.etapa,t:c.atualizado||Date.now()}];delete c.etapa;delete c.fluxo;await COFRE.salvar(c,{semHistorico:true})}}
  clientes=await COFRE.listar();
  const q=new URLSearchParams(location.search).get('id');
  sel=q&&clientes.find(c=>c.id===q)?q:null;
  lista();painel();
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
  const f=base.filter(c=>!t||(c.nome||'').toLowerCase().includes(t)||((c.rep&&c.rep.nome)||'').toLowerCase().includes(t)||(d&&(String(c.cpf||'')+String((c.rep&&c.rep.cpf)||'')).replace(/\D/g,'').includes(d)));
  $('#lista').innerHTML=(f.length?f.map(c=>`<div class="itemw"><button class="item ${c.id===sel?'on':''}${zapDe(c)||mkDe(c).length?' cz':''}" style="--pl:${(zapDe(c)?25:0)+mkDe(c).length*25+(zapDe(c)||mkDe(c).length?1:0)}px" data-id="${c.id}"><b>${esc(c.nome||'(sem nome)')}</b><span>${esc(fmtCpf(c.cpf)||'CPF não informado')}${c.repr?' · representado(a) por '+esc((c.rep&&c.rep.nome)||'—'):(c.cid?' · '+esc(c.cid):'')}${atualDe(c)?`<span style="display:block;color:var(--ouro2)">● ${esc(atualDe(c).e)}</span>`:''}</span></button>${zapDe(c)||mkDe(c).length?`<div class="mk">${zapDe(c)?`<a class="zap" href="https://wa.me/${zapDe(c)}" target="_blank" rel="noopener" title="Falar com ${c.repr?'o(a) representante':'este cliente'} no WhatsApp" aria-label="WhatsApp">${ZAP_SVG}</a>`:''}${mkDe(c).map(k=>`<span class="mki" title="${esc(MARCAS[k].nome)}">${MARCAS[k].svg}</span>`).join('')}</div>`:''}</div>`).join(''):`<div class="vazio">${base.length?'Nenhum cliente encontrado.':'Nenhum cliente ainda.<br>Eles entram aqui quando você gerar um contrato e escolher “Salvar cliente”, ou pelo botão “+ Novo”.'}</div>`)+(nExcl||verExcl?`<div style="margin-top:8px;font-size:12px"><a href="#" id="lnkExcl" style="color:var(--ouro2)">${verExcl?'← Voltar à lista':'Ver excluídos ('+nExcl+')'}</a></div>`:'');
  if($('#lnkExcl'))$('#lnkExcl').onclick=e=>{e.preventDefault();verExcl=!verExcl;sel=null;lista();painel()};
  $('#lista').querySelectorAll('.item').forEach(b=>b.onclick=()=>{sel=b.dataset.id;mostraSenha=false;lista();painel()});
}
$('#busca').oninput=lista;

/* ---------- painel do cliente ---------- */
const CAMPOS=[['nome','Nome completo'],['cpf','CPF (é o login do gov.br)'],['rg','RG nº (+ órgão)'],['tel','Telefone / WhatsApp'],['nac','Nacionalidade'],['ec','Estado civil'],['prof','Profissão'],['sexo','Sexo'],['end','Endereço'],['cep','CEP'],['cid','Cidade/UF']];
/* andamentos possíveis (nem sempre acontecem em ordem: você adiciona conforme vão ocorrendo; dá para repetir e digitar outros) */
const ANDAMENTOS=['Assinar contrato','Contrato assinado','Refazer senha','Atualizar dados cadastrais','Aguardando atualização cadastral','Aguardando docs do cliente','Aguardando agendamento médico','Aguardando laudo médico','Aguardando protocolar','Protocolado','Aguardando perícia','Entrar em contato com o cliente'];
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
  <div class="card"><h2>Serviços contratados <span class="esp"></span></h2>
    <div id="bens">${(c.beneficios||[]).length?(c.beneficios||[]).map((b,i)=>`<div class="arq"><div class="t"><b>${esc(b)}</b></div><button class="perigo mini" data-menos="${i}" title="Remover">−</button></div>`).join(''):'<div class="vazio" style="padding:8px">Nenhum serviço contratado.</div>'}</div>
    <div class="mkw" style="margin-top:12px"><label style="margin-top:0">Marcadores <span style="font-weight:400;color:var(--mut)">— aparecem na lista, ao lado do WhatsApp</span></label>
      <div class="linha" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">${(c.marcas||[]).filter(k=>window.MARCAS&&MARCAS[k]).map(k=>`<span class="mkc" title="${esc(MARCAS[k].nome)}">${MARCAS[k].svg}<button type="button" class="mkx" data-marcax="${k}" title="Remover ${esc(MARCAS[k].nome)}" aria-label="Remover">×</button></span>`).join('')||'<span style="color:var(--mut);font-size:13px">Nenhum marcador.</span>'}</div>
      <div style="position:relative"><button type="button" class="sec" id="bMkAbre" style="width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center">Escolha o marcador… <span>▾</span></button>
        <div id="mkMenu" hidden>${Object.keys(window.MARCAS||{}).filter(k=>!(c.marcas||[]).includes(k)).map(k=>`<button type="button" class="mkop" data-marcaadd="${k}" title="${esc(MARCAS[k].nome)}" aria-label="${esc(MARCAS[k].nome)}">${MARCAS[k].svg}</button>`).join('')||'<span style="color:var(--mut);font-size:13px;padding:4px 8px">Todos já escolhidos.</span>'}</div></div></div>
    <div class="linha" style="margin-top:10px"><select id="selBen" style="flex:1;min-width:220px"><option value="">Escolha o serviço…</option><optgroup label="Previdenciário">${BENEFICIOS.map(b=>`<option>${esc(b)}</option>`).join('')}</optgroup><option value="__outro">Outro serviço (digitar)…</option></select><input type="text" id="outroBen" placeholder="Nome do serviço" hidden style="flex:1;min-width:200px"><button class="mini" id="bMais" title="Adicionar">+</button></div>
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

  <div class="card"><h2>Acesso gov.br / Meu INSS</h2>
    <div class="gov">
      <span class="k">Login</span><span class="v">${esc(fmtCpf(c.cpf))||'<i>informe o CPF acima</i>'}</span><button class="sec mini" id="bCopLogin" ${c.cpf?'':'disabled'}>Copiar</button>
      <span class="k">Senha</span><span class="v">${c.govSenha?(mostraSenha?esc(c.govSenha):'••••••••••'):'<i style="color:var(--mut)">não cadastrada</i>'}</span>
      <span class="linha">${c.govSenha?`<button class="sec mini" id="bVer">${mostraSenha?'Ocultar':'Mostrar'}</button><button class="sec mini" id="bCopSenha">Copiar</button>`:''}</span>
    </div>
    <div class="linha" style="margin-top:10px;gap:8px"><button class="sec" id="bGovAbre" ${c.cpf?'':'disabled'} title="Copia o CPF e abre o Meu INSS / gov.br em outra aba">🔗 Abrir Meu INSS</button><button id="bGovExt" hidden ${c.cpf&&c.govSenha?'':'disabled'} title="Preenche CPF e senha no gov.br (extensão do Chrome)">🔑 Entrar sozinho</button></div>
    <div class="linha" style="margin-top:10px"><input type="password" id="novaSenha" placeholder="${c.govSenha?'Nova senha (substitui a atual)':'Digite a senha do gov.br'}" style="flex:1;min-width:200px" autocomplete="off"><button class="sec" id="bSenha">${c.govSenha?'Alterar':'Guardar'}</button>${c.govSenha?'<button class="perigo mini" id="bApagaSenha">Apagar senha</button>':''}</div>
    <div class="aviso" style="margin-bottom:0">A senha fica criptografada junto com os demais dados (cofre protegido pela sua senha mestra).</div>
  </div>
  </div>

  <div class="card"><h2>Andamento <span class="esp"></span></h2>
    ${(()=>{const A=c.andamento||[];return A.length?`<div class="tlh">${A.map((x,i)=>`<div class="tl ${i===A.length-1?'atual':''}"><b>${esc(x.e)}</b><small>${i===A.length-1?'atual · ':''}${new Date(x.t).toLocaleDateString('pt-BR')}</small><button class="x" data-andx="${i}" title="Remover este andamento">×</button></div>`).join('')}</div>`:'<div class="vazio" style="padding:8px">Nenhum andamento registrado.</div>'})()}
    <details id="detAnd" ${andAberto?'open':''} style="margin-top:12px"><summary style="cursor:pointer;color:var(--ouro2);font-weight:600;font-size:13px">Adicionar andamento (na ordem em que acontecer)</summary>
    <div class="cats" style="margin-top:8px">${ANDAMENTOS.map(n=>`<button class="cat" data-andadd="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
    <div class="linha" style="margin-top:8px"><input type="text" id="outroAnd" placeholder="Outro andamento (digitar)…" style="flex:1;min-width:200px"><button class="mini" id="bOutroAnd">+</button></div>
    </details>
  </div>

  <div class="card"><h2>Dados do cliente<span class="esp"></span><button id="bSalvar">Salvar alterações</button></h2>
    ${c.repr?`<div class="g2">${[['nome','Nome do(a) beneficiário(a) (representado(a))'],['cpf','CPF do(a) beneficiário(a) (é o login do gov.br)'],['nasc','Data de nascimento'],['sexo','Sexo'],['cond','Condição']].map(([k,r])=>campo(k,r,c)).join('')}</div>
    <h2 style="margin:16px 0 0">Representante legal</h2><div class="g2">${REP.map(([k,r])=>campo(k,r,c.rep||{},'rep.')).join('')}</div>`
    :`<div class="g2">${CAMPOS.map(([k,r])=>campo(k,r,c)).join('')}</div>`}
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
  const addAnd=async n=>{n=String(n||'').trim();if(!n)return;dados();(c.andamento=c.andamento||[]).push({e:n,t:Date.now()});await COFRE.salvar(c);clientes=await COFRE.listar();painel();toast('Andamento: '+n)};
  $('#detAnd').ontoggle=e=>{andAberto=e.target.open};
  P.querySelectorAll('[data-andadd]').forEach(b=>b.onclick=()=>addAnd(b.dataset.andadd));
  $('#bOutroAnd').onclick=()=>addAnd($('#outroAnd').value);$('#outroAnd').onkeydown=e=>{if(e.key==='Enter')addAnd(e.target.value)};
  P.querySelectorAll('[data-andx]').forEach(b=>b.onclick=async()=>{dados();c.andamento.splice(+b.dataset.andx,1);await COFRE.salvar(c);clientes=await COFRE.listar();painel()});
  $('#bGovAbre').onclick=()=>{window.open('https://meu.inss.gov.br/','_blank','noopener');copia(String(c.cpf).replace(/\D/g,''),'CPF (cole no login; a senha está no botão Copiar)')};
  if(document.documentElement.dataset.locGovbr==='1'){const g=$('#bGovExt');g.hidden=false;g.onclick=()=>{window.postMessage({loc:'govbr-entrar',cpf:String(c.cpf).replace(/\D/g,''),senha:c.govSenha,alvo:'inss'},location.origin);toast('Abrindo o gov.br e preenchendo…')}}
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
  $('#bGerar').onclick=()=>{dados();try{sessionStorage.setItem('prefill',JSON.stringify(paraGerador(c)))}catch(e){}location.href='gerador.html?doc='+$('#selDoc').value+'&cliente='+c.id};
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
$('#bLock').onclick=()=>{COFRE.bloquear();location.href='clientes.html'};

inicia();
})();
