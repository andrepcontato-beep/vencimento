/* Tela do gerador: documentos do cliente → dados → local/data → prévia paginada com a identidade do escritório */
(function(){
'use strict';
const MESES=DOCS.MESES;
const TIPOS={
  procuracao:{nome:'Procuração',arq:'procuracao',extras:[{k:'pmodo',custom:true,r:'Poderes'}]},
  hipossuficiencia:{nome:'Declaração de hipossuficiência',arq:'hipossuficiencia',extras:[]},
  'salario-maternidade':{nome:'Contrato de honorários — salário-maternidade',arq:'contrato-salario-maternidade',sexoFixo:true,extras:[
    {k:'tel',r:'Telefone / WhatsApp',ph:'64-99999-9999',need:true},
    {k:'dpp',r:'Data provável do parto (DPP)',t:'date'},
    {k:'honor',r:'Honorários (R$)',v:'2.000,00',need:true},
    {k:'smin',r:'Salário mínimo vigente (R$)',v:'1.621,00',need:true},
    {k:'parc',r:'Nº de parcelas (descontadas do benefício)',v:'2'},
    {k:'pix',r:'Chave PIX',v:'032.195.131-07'},
    {k:'resc',r:'Honorários proporcionais em caso de rescisão (%)',v:'50'},
    {k:'foro',r:'Foro (comarca)',v:'Piracanjuba/GO'}]},
  previdenciario:{nome:'Contrato de serviços previdenciários',arq:'contrato-previdenciario',extras:[
    {k:'pct',r:'Percentual dos honorários (%)',v:'50'},
    {k:'minimo',r:'Valor mínimo dos honorários (R$)',v:'5.000,00',need:true},
    {k:'foro',r:'Foro (comarca)',v:'Piracanjuba'}]}
};
const tipo=(new URLSearchParams(location.search).get('doc'))||'procuracao';
const T=TIPOS[tipo]||TIPOS.procuracao;
$('#h1').textContent=tipo==='procuracao'?'Gerador de Procurações':T.nome;document.title=T.nome+' · André Locatelli';

/* ---------- campos ---------- */
const BASE=[
 {k:'nome',r:'Nome completo',need:true},
 {k:'sexo',r:'Sexo (para concordância)',sel:[['','(a) — neutro'],['M','Masculino'],['F','Feminino']]},
 {k:'nac',r:'Nacionalidade',v:'brasileiro'},
 {k:'ec',r:'Estado civil',need:true,sel:[['','— escolher —'],'solteiro','casado','divorciado','viúvo','separado judicialmente','em união estável']},
 {k:'prof',r:'Profissão',need:true},
 {k:'rg',r:'RG nº (+ órgão)',ph:'1234567 SSP/GO',need:true},
 {k:'cpf',r:'CPF',ph:'000.000.000-00',need:true},
 {k:'end',r:'Endereço (rua, nº, bairro)',need:true},
 {k:'cid',r:'Cidade/UF',need:true},
 {k:'cep',r:'CEP'}
].filter(f=>!(T.sexoFixo&&f.k==='sexo')).concat(T.extras);
$('#campos').innerHTML=BASE.map(f=>{
  if(f.custom)return `<div class="fld" data-k="pmodo"><label>Poderes</label>
   <label style="display:block;margin:4px 0;color:var(--tx);font-size:13px"><input type="radio" name="pmodo" value="prev" checked> Modelo previdenciário (padrão)</label>
   <label style="display:block;margin:4px 0;color:var(--tx);font-size:13px"><input type="radio" name="pmodo" value="digitar"> Digitar</label>
   <div id="boxPtxt" hidden style="margin-top:6px"><div class="st" style="color:var(--mut)">O rótulo <b>PODERES:</b> já vem em negrito; o que você digitar entra logo depois dele.</div><textarea id="ptxt" rows="6" style="width:100%;padding:7px 8px;border:1px solid var(--bd);border-radius:6px;font:inherit;background:var(--card);color:var(--tx)" placeholder="pelo presente instrumento o outorgante confere aos outorgados poderes para…"></textarea></div></div>`;
  const ctl=f.sel?`<select id="${f.k}">${f.sel.map(o=>Array.isArray(o)?`<option value="${o[0]}">${o[1]}</option>`:`<option>${o}</option>`).join('')}</select>`
   :`<input type="${f.t||'text'}" id="${f.k}" value="${f.v||''}" placeholder="${f.ph||''}">`;
  return `<div class="fld" data-k="${f.k}"><label>${f.r}</label>${ctl}${f.k==='sexo'?'<div class="st" id="dicaSexo" style="color:var(--mut)"></div>':''}</div>`}).join('');
const IDS=BASE.map(f=>f.k),PRECISA=BASE.filter(f=>f.need).map(f=>f.k);
const vazio=k=>!$('#'+k).value.trim();
const valores=()=>{const o={};IDS.forEach(k=>{if(k==='pmodo'){const r=document.querySelector('[name=pmodo]:checked');o.pmodo=r?r.value:'prev';o.ptxt=$('#ptxt').value}else o[k]=$('#'+k).value});o.local=$('#local').value;if(T.sexoFixo)o.sexo='F';return o};

/* ---------- data ---------- */
function proxUtil(d){const x=new Date(d);do{x.setDate(x.getDate()+1)}while([0,6].includes(x.getDay()));return x}
const fmtL=d=>d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
const agora=new Date(),hoje=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()),prox=proxUtil(hoje);
let dataSel=null;
function montaData(){
  const noite=agora.getHours()>=18||agora.getHours()<5,fds=[0,6].includes(hoje.getDay());
  $('#alertaData').innerHTML='Agora são <b>'+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'</b>'+(noite?' — você costuma trabalhar à noite.':'.')+(fds?' Hoje é fim de semana.':'')+' <b>Qual data vai no documento?</b>';
  $('#dias').innerHTML=`<label><input type="radio" name="dt" value="hoje">Hoje<br><small>${fmtL(hoje)}</small></label>
   <label><input type="radio" name="dt" value="prox">Próximo dia útil<br><small>${fmtL(prox)}</small></label>
   <label><input type="radio" name="dt" value="outra">Outra<br><input type="date" id="dtOutra" style="margin-top:4px"></label>`;
  document.querySelectorAll('[name=dt]').forEach(r=>r.onchange=()=>{dataSel=r.value;document.querySelectorAll('#dias label').forEach(l=>l.classList.toggle('sel',l.contains(r)&&r.checked));render()});
  $('#dtOutra').onchange=()=>{dataSel='outra';document.querySelector('[name=dt][value=outra]').checked=true;render()};
}
function dataEscolhida(){
  if(dataSel==='hoje')return hoje;if(dataSel==='prox')return prox;
  if(dataSel==='outra'&&$('#dtOutra').value){const[y,m,d]=$('#dtOutra').value.split('-').map(Number);return new Date(y,m-1,d)}
  return null;
}

/* ---------- identidade + prévia ---------- */
let perfil=null,imgs=null,blobFinal=null,tok=0,timer=null,base=null;
const PESSOA=t=>t==='procuracao'||t==='hipossuficiencia';
const variantes={};
async function carregaBase(){
  if(base)return base;
  const url=new URL('perfis/andrelocatelli/perfil.json',location.href),p=await (await fetch(url)).json();
  p.logoUrl=new URL(p.logo,url).href;base=p;return p;
}
/* identidade por tipo: procuração e declaração seguem o modelo (logo maior, margens 2,5 cm); contratos, a identidade padrão */
async function identidade(tp){
  const chave=PESSOA(tp)?'pessoa':'padrao';
  if(variantes[chave])return variantes[chave];
  const p0=await carregaBase(),pf=IDV.normalizarPerfil(JSON.parse(JSON.stringify(p0)));pf.logoUrl=p0.logoUrl;
  pf.assinatura=Object.assign({},pf.assinatura,{ativa:false}); // os modelos já trazem a assinatura própria
  if(chave==='pessoa'){
    pf.cabecalho=Object.assign({},pf.cabecalho,{logoLarguraCm:1.75});
    pf.margensCm=Object.assign({},pf.margensCm,{topo:4.6,esquerda:2.5,direita:2.5,rodapeCm:0.9});
    pf.fileteExtEsquerdaCm=0.3;
    pf.rodape=Object.assign({},pf.rodape,{tamanhoPt:7});
    pf.marcaDagua=Object.assign({},pf.marcaDagua,{posicao:'centro',larguraCm:12,opacidade:0.07});
  }
  return variantes[chave]={perfil:pf,imgs:await IDV.prepararImagens(pf)};
}
async function carregaPerfil(){const v=await identidade(tipo);perfil=v.perfil;imgs=v.imgs}
async function montaDocumento(tp){
  tp=tp||tipo;const v=await identidade(tp);
  const vals=valores();if(tp!==tipo){vals.pmodo='prev'} // documentos extras usam o texto padrão
  if(T.sexoFixo&&tp!==tipo)vals.sexo='F';
  const buf=await DOCS.gerar(tp,vals,dataEscolhida());
  return IDV.aplicarIdentidade(buf,v.perfil,v.imgs);
}
let sexoManual=false,sexoAuto='';
function inferirSexo(){
  const sel=document.getElementById('sexo');if(!sel||sexoManual)return;
  const r=SEXO.por($('#nome').value),dica=$('#dicaSexo');
  if(r.sexo){sel.value=r.sexo;sel.classList.add('auto');sexoAuto=r.sexo;
    if(dica)dica.textContent='Detectado pelo nome ('+(r.sexo==='F'?'feminino':'masculino')+(r.base==='terminação'?', menos certo':'')+') — confira.'}
  else{if(sexoAuto){sel.value='';sexoAuto=''}sel.classList.remove('auto');
    if(dica)dica.textContent=$('#nome').value.trim()?'Não consegui saber pelo nome: sai como "brasileiro(a)", "casado(a)"… Escolha para ajustar.':''}
}
function render(){
  inferirSexo();
  const f=PRECISA.filter(vazio).map(k=>BASE.find(b=>b.k===k).r);if(!dataEscolhida())f.push('data');
  $('#falta').textContent=f.length?'Falta: '+f.join(', '):'';
  clearTimeout(timer);timer=setTimeout(previa,400);
}
async function previa(){
  if(pag<2)return;
  const meu=++tok,m=$('#msgP');
  try{
    m.textContent='Montando prévia…';
    const b=await montaDocumento();if(meu!==tok)return;
    blobFinal=b;await PAGINAR.montar(b,imgs,perfil);if(meu!==tok)return;
    m.textContent='';
  }catch(e){if(meu!==tok)return;blobFinal=null;$('#paginas').innerHTML='';m.textContent='⚠ '+(e.message||e)}
}
window.render=render;

/* ---------- ações ---------- */
const slug=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const nomeArq=()=>T.arq+($('#nome').value.trim()?'-'+slug($('#nome').value):'');
$('#baixar').onclick=async()=>{
  const m=$('#msgBaixar');
  if(!dataEscolhida()){vai(3);$('#falta').textContent='Escolha a data para baixar.';return}
  try{
    m.textContent='Gerando…';const b=await montaDocumento(),a=document.createElement('a');
    a.href=URL.createObjectURL(b);a.download=nomeArq()+'.docx';document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},5000);m.textContent='✔ '+nomeArq()+'.docx';
  }catch(e){m.textContent='⚠ '+(e.message||'erro ao gerar')}
};
$('#pdf').onclick=async()=>{
  const m=$('#msgBaixar');
  if(!dataEscolhida()){vai(3);$('#falta').textContent='Escolha a data para salvar o PDF.';return}
  await previa();if(!document.querySelector('#paginas .pagina')){m.textContent='⚠ Prévia indisponível.';return}
  m.textContent='Na janela de impressão, escolha "Salvar como PDF".';PAGINAR.imprimir(nomeArq());
};
async function baixaExtra(tp,rotulo,arq){
  const m=$('#msgBaixar');
  if(!dataEscolhida()){vai(3);$('#falta').textContent='Escolha a data para baixar.';return}
  try{
    m.textContent='Gerando…';const b=await montaDocumento(tp),a=document.createElement('a'),n=arq+($('#nome').value.trim()?'-'+slug($('#nome').value):'')+'.docx';
    a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},5000);m.textContent='✔ '+n;
  }catch(e){m.textContent='⚠ '+(e.message||'erro ao gerar')}
}
if(!PESSOA(tipo)){
  const barra=document.querySelector('.barra'),mk=(id,t,tp,arq)=>{const b=document.createElement('button');b.id=id;b.className='sec';b.textContent=t;b.onclick=()=>baixaExtra(tp,t,arq);barra.insertBefore(b,$('#msgBaixar'))};
  mk('baixaProc','⬇ Baixar procuração','procuracao','procuracao');
  mk('baixaHipo','⬇ Baixar dec. de hipossuficiência','hipossuficiencia','hipossuficiencia');
}
$('#limpar').onclick=()=>location.reload();
$('#cpf').addEventListener('blur',()=>{const d=$('#cpf').value.replace(/\D/g,'');if(d.length===11){$('#cpf').value=`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;render()}});
if($('#sexo'))$('#sexo').addEventListener('change',()=>{sexoManual=true;$('#sexo').classList.remove('auto');$('#dicaSexo').textContent=''});
document.querySelectorAll('[name=pmodo]').forEach(r=>r.addEventListener('change',()=>{$('#boxPtxt').hidden=document.querySelector('[name=pmodo]:checked').value!=='digitar'}));
document.querySelectorAll('#campos input,#campos select,#campos textarea,#local').forEach(el=>{el.addEventListener('input',()=>{el.classList.remove('auto');render()});el.addEventListener('change',render)});

/* ---------- navegação ---------- */
let pag=1,lidos=false,manualMode=false;
function organiza(manual){
  inferirSexo();
  const F=$('#boxFalta'),L=$('#boxLido');
  IDS.forEach(k=>{const w=document.querySelector('.fld[data-k='+k+']');
    const falta=k==='pmodo'?false:manual?true:(PRECISA.includes(k)?vazio(k):k==='sexo'?!$('#sexo').value:false);
    (falta?F:L).appendChild(w)});
  $('#nadaFalta').hidden=!!F.children.length;$('#gLido').hidden=!L.children.length;
}
function vai(n){
  pag=n;document.body.className='p'+n;
  document.querySelectorAll('section[data-p]').forEach(x=>x.hidden=x.dataset.p!=n);
  document.querySelectorAll('.abas button').forEach(b=>b.classList.toggle('on',b.dataset.p==n));
  if(n===2)organiza(manualMode);
  render();
}
window.vai=vai;window.liberaSeguir=()=>{$('#seguir').disabled=false;lidos=true};
document.querySelectorAll('.abas button').forEach(b=>b.onclick=()=>{manualMode=!lidos;vai(+b.dataset.p)});
document.querySelectorAll('[data-vai]').forEach(b=>b.onclick=()=>vai(+b.dataset.vai));
$('#manual').onclick=()=>{manualMode=true;vai(2)};
$('#seguir').onclick=()=>{manualMode=false;vai(2)};
$('#seguir2').onclick=()=>vai(3);
montaData();vai(1);carregaPerfil().catch(()=>{});
})();
