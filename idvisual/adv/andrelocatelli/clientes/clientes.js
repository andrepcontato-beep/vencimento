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

let clientes=[],sel=null,mostraSenha=false;

/* ---------- senha mestra ---------- */
async function inicia(){
  $('#barraCofre').hidden=true;$('#app').hidden=true;
  if(await COFRE.retomar())return entra();
  const novo=!(await COFRE.configurado());
  $('#trava').hidden=false;$('#travaNovo').hidden=!novo;$('#travaAbrir').hidden=novo;$('#lbImp0').hidden=!novo;
  $('#travaT').textContent=novo?'Criar senha mestra':'Desbloquear clientes';
  setTimeout(()=>(novo?$('#s1'):$('#s0')).focus(),50);
  $('#bTrava').onclick=async()=>{
    const er=$('#erroTrava');er.textContent='';
    try{
      if(novo){if($('#s1').value!==$('#s2').value)throw new Error('As senhas não conferem.');await COFRE.criar($('#s1').value)}
      else await COFRE.abrir($('#s0').value);
      $('#trava').hidden=true;entra();
    }catch(e){er.textContent=e.message}};
  ['#s0','#s2'].forEach(s=>$(s).onkeydown=e=>{if(e.key==='Enter')$('#bTrava').click()});
}
async function entra(){
  $('#trava').hidden=true;$('#barraCofre').hidden=false;$('#app').hidden=false;
  clientes=await COFRE.listar();
  const q=new URLSearchParams(location.search).get('id');
  sel=q&&clientes.find(c=>c.id===q)?q:(clientes[0]&&clientes[0].id)||null;
  lista();painel();
}

/* ---------- lista ---------- */
function lista(){
  const t=$('#busca').value.trim().toLowerCase(),d=t.replace(/\D/g,'');
  const f=clientes.filter(c=>!t||(c.nome||'').toLowerCase().includes(t)||(d&&String(c.cpf||'').replace(/\D/g,'').includes(d)));
  $('#lista').innerHTML=f.length?f.map(c=>`<button class="item ${c.id===sel?'on':''}" data-id="${c.id}"><b>${esc(c.nome||'(sem nome)')}</b><span>${esc(fmtCpf(c.cpf)||'CPF não informado')}${c.cid?' · '+esc(c.cid):''}</span></button>`).join(''):`<div class="vazio">${clientes.length?'Nenhum cliente encontrado.':'Nenhum cliente ainda.<br>Eles entram aqui quando você gerar um contrato e escolher “Salvar cliente”, ou pelo botão “+ Novo”.'}</div>`;
  $('#lista').querySelectorAll('.item').forEach(b=>b.onclick=()=>{sel=b.dataset.id;mostraSenha=false;lista();painel()});
}
$('#busca').oninput=lista;

/* ---------- painel do cliente ---------- */
const CAMPOS=[['nome','Nome completo'],['cpf','CPF (é o login do gov.br)'],['rg','RG nº (+ órgão)'],['tel','Telefone / WhatsApp'],['nac','Nacionalidade'],['ec','Estado civil'],['prof','Profissão'],['sexo','Sexo'],['end','Endereço'],['cep','CEP'],['cid','Cidade/UF']];
const BENEFICIOS=['Aposentadoria por idade urbana','Regras de transição (antiga aposentadoria por tempo de contribuição)','Aposentadoria por idade rural','Aposentadoria por idade híbrida','Aposentadoria por idade da pessoa com deficiência','Aposentadoria por tempo de contribuição da pessoa com deficiência','Aposentadoria especial','Aposentadoria do professor','Auxílio-doença (incapacidade temporária)','Aposentadoria por invalidez (incapacidade permanente)','Auxílio-acidente','BPC/LOAS da pessoa com deficiência','BPC/LOAS do idoso','Salário-maternidade urbano','Salário-maternidade rural (segurada especial)','Pensão por morte urbana','Pensão por morte rural','Auxílio-reclusão'];
const BEN=[['fnome','Nome do(a) beneficiário(a)'],['fcpf','CPF do(a) beneficiário(a)'],['fnasc','Data de nascimento'],['fsexo','Sexo'],['fcond','Condição']];
function campo(k,r,c,tipo){
  if(k==='sexo')return `<div><label>${r}</label><select data-k="${k}"><option value="">—</option><option value="F" ${c[k]==='F'?'selected':''}>Feminino</option><option value="M" ${c[k]==='M'?'selected':''}>Masculino</option></select></div>`;
  if(k==='fsexo')return `<div><label>${r}</label><select data-k="${k}"><option value="F" ${c[k]!=='M'?'selected':''}>Filha</option><option value="M" ${c[k]==='M'?'selected':''}>Filho</option></select></div>`;
  if(k==='fcond')return `<div><label>${r}</label><select data-k="${k}"><option value="menor" ${c[k]!=='incapaz'?'selected':''}>Menor de idade</option><option value="incapaz" ${c[k]==='incapaz'?'selected':''}>Incapaz (maior)</option></select></div>`;
  return `<div><label>${r}</label><input type="${k==='fnasc'?'date':'text'}" data-k="${k}" value="${esc(c[k])}"></div>`;
}
async function painel(){
  const P=$('#painel');
  if(!sel){P.innerHTML=`<div class="card"><div class="vazio">Escolha um cliente na lista ou clique em <b>+ Novo</b>.</div></div>`;return}
  const c=clientes.find(x=>x.id===sel);if(!c){P.innerHTML='';return}
  const arqs=await COFRE.arquivos(c.id),tem=c.fnome||c.fcpf||c.fnasc;
  P.innerHTML=`
  <div class="duo">
  <div class="card"><h2>Benefícios <span class="esp"></span></h2>
    <div id="bens">${(c.beneficios||[]).length?(c.beneficios||[]).map((b,i)=>`<div class="arq"><div class="t"><b>${esc(b)}</b></div><button class="perigo mini" data-menos="${i}" title="Remover">−</button></div>`).join(''):'<div class="vazio" style="padding:8px">Nenhum benefício vinculado.</div>'}</div>
    <div class="linha" style="margin-top:10px"><select id="selBen" style="flex:1;min-width:220px"><option value="">Escolha o benefício…</option>${BENEFICIOS.map(b=>`<option>${esc(b)}</option>`).join('')}<option value="__outro">Outro (digitar)…</option></select><input type="text" id="outroBen" placeholder="Nome do benefício" hidden style="flex:1;min-width:200px"><button class="mini" id="bMais" title="Adicionar">+</button></div>
  </div>

  <div class="card"><h2>Acesso gov.br / Meu INSS</h2>
    <div class="gov">
      <span class="k">Login</span><span class="v">${esc(fmtCpf(c.cpf))||'<i>informe o CPF acima</i>'}</span><button class="sec mini" id="bCopLogin" ${c.cpf?'':'disabled'}>Copiar</button>
      <span class="k">Senha</span><span class="v">${c.govSenha?(mostraSenha?esc(c.govSenha):'••••••••••'):'<i style="color:var(--mut)">não cadastrada</i>'}</span>
      <span class="linha">${c.govSenha?`<button class="sec mini" id="bVer">${mostraSenha?'Ocultar':'Mostrar'}</button><button class="sec mini" id="bCopSenha">Copiar</button>`:''}</span>
    </div>
    <div class="linha" style="margin-top:10px"><input type="password" id="novaSenha" placeholder="${c.govSenha?'Nova senha (substitui a atual)':'Digite a senha do gov.br'}" style="flex:1;min-width:200px" autocomplete="off"><button class="sec" id="bSenha">${c.govSenha?'Alterar':'Guardar'}</button>${c.govSenha?'<button class="perigo mini" id="bApagaSenha">Apagar senha</button>':''}</div>
    <div class="aviso" style="margin-bottom:0">A senha fica criptografada junto com os demais dados (cofre protegido pela sua senha mestra).</div>
  </div>
  </div>

  <div class="card"><h2>Dados do cliente <button class="mini" id="bZap" title="Abrir conversa no WhatsApp" style="text-transform:none;letter-spacing:0;background:#25D366;color:#fff;border:1px solid #1ebe5b"><svg viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-3px;margin-right:5px"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/></svg>Falar com este cliente</button><span class="esp"></span><button id="bSalvar">Salvar alterações</button></h2>
    <div class="g2">${CAMPOS.map(([k,r])=>campo(k,r,c)).join('')}</div>
    <details ${tem?'open':''} style="margin-top:10px"><summary style="cursor:pointer;color:var(--ouro2);font-weight:600">Beneficiário(a) representado(a) (contrato “PREV incapaz”)</summary>
      <div class="g2">${BEN.map(([k,r])=>campo(k,r,c)).join('')}</div></details>
    <label>Observações</label><textarea data-k="notas">${esc(c.notas)}</textarea>
  </div>

  <div class="card"><h2>Arquivos <span class="esp"></span><label class="btn mini" style="margin:0;cursor:pointer">+ Adicionar<input type="file" id="fAdd" multiple hidden></label></h2>
    ${arqs.length?arqs.map(a=>`<div class="arq">${icone(a.nome)}<div class="t"><b>${esc(a.nome)}</b><span>${a.origem?`<span class="tag">${esc(a.origem)}</span>`:''}${fmtData(a.data)} · ${fmtTam(a.tamanho)}</span></div>${/\.(pdf|jpe?g|png|webp|gif)$/i.test(a.nome)?`<button class="sec mini" data-ver="${a.id}">Ver</button>`:''}<button class="sec mini" data-baixar="${a.id}">Baixar</button><button class="perigo mini" data-del="${a.id}">Excluir</button></div>`).join(''):'<div class="vazio">Nenhum arquivo guardado.</div>'}
  </div>

  <div class="card"><h2>Gerar documento para este cliente</h2>
    <div class="linha"><select id="selDoc" style="flex:1;min-width:220px">${DOCS.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select><button id="bGerar">Abrir no gerador →</button></div>
    <div class="rod" style="margin:8px 0 0">Os dados acima entram preenchidos; você só escolhe a data.</div>
  </div>
  <div class="linha" style="justify-content:flex-end"><button class="perigo" id="bExcluir">Excluir cliente</button></div>`;

  const dados=()=>{P.querySelectorAll('[data-k]').forEach(e=>{c[e.dataset.k]=e.value});c.cpf=fmtCpf(c.cpf)};
  $('#bSalvar').onclick=async()=>{dados();await COFRE.salvar(c);clientes=await COFRE.listar();lista();painel();toast('Cliente salvo')};
  $('#selBen').onchange=e=>{$('#outroBen').hidden=e.target.value!=='__outro';if(!$('#outroBen').hidden)$('#outroBen').focus()};
  $('#bMais').onclick=async()=>{let v=$('#selBen').value;if(v==='__outro')v=$('#outroBen').value.trim();if(!v)return toast('Escolha o benefício');dados();c.beneficios=c.beneficios||[];if(c.beneficios.includes(v))return toast('Já está na lista');c.beneficios.push(v);await COFRE.salvar(c);clientes=await COFRE.listar();painel()};
  P.querySelectorAll('[data-menos]').forEach(b=>b.onclick=async()=>{dados();c.beneficios.splice(+b.dataset.menos,1);await COFRE.salvar(c);clientes=await COFRE.listar();painel()});
  $('#bZap').onclick=()=>{let d=((P.querySelector('[data-k=tel]')||{}).value||'').replace(/\D/g,'');if(d.length<10)return toast('Informe o telefone do cliente (com DDD)');if(!d.startsWith('55')||d.length<12)d='55'+d;window.open('https://wa.me/'+d,'_blank','noopener')};
  $('#bCopLogin').onclick=()=>copia(String(c.cpf).replace(/\D/g,''),'Login');
  if($('#bVer'))$('#bVer').onclick=()=>{mostraSenha=!mostraSenha;painel()};
  if($('#bCopSenha'))$('#bCopSenha').onclick=()=>copia(c.govSenha,'Senha');
  $('#bSenha').onclick=async()=>{const v=$('#novaSenha').value;if(!v)return toast('Digite a senha primeiro');dados();c.govSenha=v;await COFRE.salvar(c);clientes=await COFRE.listar();mostraSenha=false;painel();toast('Senha guardada')};
  if($('#bApagaSenha'))$('#bApagaSenha').onclick=async()=>{if(!confirm('Apagar a senha do gov.br deste cliente?'))return;dados();delete c.govSenha;await COFRE.salvar(c);clientes=await COFRE.listar();painel();toast('Senha apagada')};
  $('#fAdd').onchange=async e=>{for(const f of e.target.files)await COFRE.addArquivo(c.id,{nome:f.name,tipo:f.type,origem:'Adicionado',blob:f});painel();toast('Arquivo(s) guardado(s)')};
  P.querySelectorAll('[data-baixar]').forEach(b=>b.onclick=async()=>{const a=arqs.find(x=>x.id===b.dataset.baixar),bl=await COFRE.lerArquivo(a.id),u=document.createElement('a');u.href=URL.createObjectURL(bl);u.download=a.nome;document.body.appendChild(u);u.click();setTimeout(()=>{URL.revokeObjectURL(u.href);u.remove()},4000)});
  P.querySelectorAll('[data-ver]').forEach(b=>b.onclick=async()=>{const a=arqs.find(x=>x.id===b.dataset.ver);let bl=await COFRE.lerArquivo(a.id);const pdf=/\.pdf$/i.test(a.nome);bl=new Blob([bl],{type:pdf?'application/pdf':(bl.type&&bl.type.startsWith('image/')?bl.type:'image/'+(a.nome.split('.').pop().toLowerCase().replace('jpg','jpeg')))});const url=URL.createObjectURL(bl),m=document.createElement('div');m.style.cssText='position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.75);display:flex;flex-direction:column;padding:12px;gap:8px';m.innerHTML=`<div style="display:flex;gap:10px;align-items:center;color:#fff"><b style="flex:1;overflow-wrap:anywhere">${esc(a.nome)}</b><button id="mFecha">Fechar ✕</button></div>`+(pdf?`<iframe src="${url}" style="flex:1;border:0;background:#fff;border-radius:6px"></iframe>`:`<div style="flex:1;overflow:auto;text-align:center"><img src="${url}" style="max-width:100%;border-radius:6px"></div>`);document.body.appendChild(m);const f=()=>{m.remove();URL.revokeObjectURL(url)};m.querySelector('#mFecha').onclick=f;m.onclick=e=>{if(e.target===m)f()}});
  P.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este arquivo?'))return;await COFRE.excluirArquivo(b.dataset.del);painel()});
  $('#bGerar').onclick=()=>{dados();try{sessionStorage.setItem('prefill',JSON.stringify(c))}catch(e){}location.href='gerador.html?doc='+$('#selDoc').value+'&cliente='+c.id};
  $('#bExcluir').onclick=async()=>{if(!confirm('Excluir '+(c.nome||'este cliente')+' e todos os arquivos dele? Isso não pode ser desfeito.'))return;await COFRE.excluir(c.id);clientes=await COFRE.listar();sel=clientes[0]?clientes[0].id:null;lista();painel();toast('Cliente excluído')};
}
/* ---------- novo cliente: documentos (lidos por OCR) ou digitação manual ---------- */
let fila=Promise.resolve(),ocupado=0;
function novoFluxo(){
  sel=null;lista();
  const nd={o:{},arq:[]};  /* arq: {f,rot,origem} */
  const P=$('#painel');
  const slot=(id,tit,sub,mult)=>`<label class="up" style="display:block;border:2px dashed var(--ouro);background:var(--up);border-radius:10px;padding:12px;margin-bottom:10px;cursor:pointer"><b>${tit}</b><div style="font-size:12px;color:var(--mut)">${sub}</div><input type="file" id="${id}" accept="image/*,application/pdf" ${mult?'multiple':''} hidden><div class="st" id="st_${id}" style="font-size:12px;margin-top:6px"></div></label>`;
  P.innerHTML=`<div class="card"><h2>Novo cliente <span class="esp"></span><button class="sec mini" id="nCancela">Cancelar</button></h2>
    <p style="margin:0 0 10px;color:var(--mut)">Envie os documentos e eu leio os dados. Pode enviar só o que tiver.</p>
    ${slot('nIdent','Identidade / CNH / documento com foto','foto, PDF ou imagem — frente (e verso, se precisar)',true)}
    ${slot('nEnd','Comprovante de endereço','conta de luz/água/telefone etc.')}
    ${slot('nCert','Certidão de nascimento do(a) beneficiário(a)','da filha/do filho representado(a). Se não enviar, entende-se que o beneficiário é o próprio cliente.')}
    <label class="up" style="display:block;border:2px dashed var(--bd);border-radius:10px;padding:12px;margin-bottom:10px;cursor:pointer"><b>Outros documentos</b><div style="font-size:12px;color:var(--mut)">um por vez — só vai para os arquivos do cliente (não é lido)</div><input type="file" id="nOut" hidden><div id="nOutLista" style="margin-top:6px"></div></label>
    <div class="linha" style="margin-top:6px"><button id="nVai" disabled>Continuar →</button><button class="sec" id="nManual">Digitar manualmente</button></div>
  </div>`;
  const status=(id,t)=>{$('#st_'+id).innerHTML=t};
  const atualiza=()=>{$('#nVai').disabled=ocupado>0||!nd.arq.length;$('#nOutLista').innerHTML=nd.arq.filter(a=>a.rot==='Outro').map(a=>`<div style="font-size:13px">${esc(a.f.name)} <a href="#" data-x="${nd.arq.indexOf(a)}" style="color:var(--red)">remover</a></div>`).join('');
    P.querySelectorAll('[data-x]').forEach(x=>x.onclick=e=>{e.preventDefault();nd.arq.splice(+x.dataset.x,1);atualiza()})};
  const ocr=(id,rot,ext,keys,NOMES)=>{$('#'+id).onchange=e=>{
    const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
    fs.forEach(f=>nd.arq.push({f,rot,origem:'Enviado'}));ocupado++;atualiza();status(id,'Na fila…');
    fila=fila.then(async()=>{
      try{if(!window.Tesseract||!window.OCR_LER)throw new Error('motor de leitura não carregou — recarregue a página');
        const o=await OCR_LER(fs,OCR_EXTRATORES[ext],keys,t=>status(id,t));
        keys.forEach(k=>{if(o[k]&&!nd.o[k])nd.o[k]=o[k]});
        const achou=keys.filter(k=>o[k]),falta=keys.filter(k=>!o[k]);
        status(id,(achou.length?'✔ Li: '+achou.map(k=>NOMES[k]).join(', '):'')+(falta.length?(achou.length?'<br>':'')+'⚠ Não consegui ler: '+falta.map(k=>NOMES[k]).join(', ')+' — complete na ficha':''));
      }catch(err){status(id,'⚠ '+esc(err.message));console.error(err)}
      ocupado--;atualiza()})}};
  ocr('nIdent','Identidade','ident',['nome','cpf','rg'],{nome:'nome',cpf:'CPF',rg:'RG'});
  ocr('nEnd','Comprovante de endereço','end',['end','cep','cid'],{end:'endereço',cep:'CEP',cid:'cidade/UF'});
  ocr('nCert','Certidão de nascimento','cert',['fnome','fcpf','fnasc','fsexo'],{fnome:'nome do(a) beneficiário(a)',fcpf:'CPF do(a) beneficiário(a)',fnasc:'data de nascimento',fsexo:'sexo'});
  $('#nOut').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;nd.arq.push({f,rot:'Outro',origem:'Adicionado'});atualiza()};
  $('#nCancela').onclick=()=>{sel=clientes[0]?clientes[0].id:null;lista();painel()};
  $('#nManual').onclick=async()=>{const c=await COFRE.salvar({nome:'Novo cliente'});clientes=await COFRE.listar();sel=c.id;$('#busca').value='';lista();painel();setTimeout(()=>{const i=document.querySelector('[data-k=nome]');if(i){i.focus();i.select()}},50)};
  $('#nVai').onclick=async()=>{
    $('#nVai').disabled=true;const o=nd.o,novo={};
    ['nome','cpf','rg','end','cep','cid','fnome','fcpf','fnasc','fsexo'].forEach(k=>{if(o[k])novo[k]=o[k]});
    if(novo.cpf)novo.cpf=fmtCpf(novo.cpf);if(novo.fcpf)novo.fcpf=fmtCpf(novo.fcpf);
    if(novo.nome&&window.SEXO){const r=SEXO.por(novo.nome);if(r&&r.sexo)novo.sexo=r.sexo}
    if(novo.fnome&&!novo.fcond)novo.fcond='menor';
    const ex=novo.cpf?await COFRE.porCpf(novo.cpf):null;
    const c=ex?Object.assign(novo,ex,Object.fromEntries(Object.entries(novo).filter(([k])=>!ex[k]))):novo;
    if(!c.nome)c.nome='Novo cliente';
    const sv=await COFRE.salvar(c),ja=await COFRE.arquivos(sv.id);
    for(const a of nd.arq){const nm=a.rot==='Outro'?a.f.name:a.rot+' - '+a.f.name;if(!ja.some(x=>x.nome===nm&&x.tamanho===a.f.size))await COFRE.addArquivo(sv.id,{nome:nm,tipo:a.f.type,origem:a.origem,blob:a.f})}
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
