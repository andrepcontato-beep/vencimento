/* Geração dos documentos (.docx) a partir dos modelos do escritório */
(function(){
'use strict';
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const X=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const UX=t=>t.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');

/* ---------- concordância de gênero ---------- */
function conc(sexo){
  const f=sexo==='F',m=sexo==='M',a=(mas,fem,neu)=>m?mas:f?fem:neu;
  return{
    nac:n=>{n=n.trim();return f?n.replace(/o$/i,'a'):m||!/o$/i.test(n)?n:n.replace(/o$/i,'o(a)')},
    ec:e=>{e=e.trim();if(f)return e.replace(/^solteiro/,'solteira').replace(/^casado/,'casada').replace(/^divorciado/,'divorciada').replace(/^viúvo/,'viúva').replace(/^separado/,'separada');
      if(m||!sexo&&!/^(solteiro|casado|divorciado|viúvo|separado)/.test(e))return e;return e.replace(/^(solteiro|casado|divorciado|separado)/,'$1(a)').replace(/^viúvo/,'viúvo(a)')},
    portador:a('portador','portadora','portador(a)'),inscrito:a('inscrito','inscrita','inscrito(a)'),domic:a('domiciliado','domiciliada','domiciliado(a)'),
    ele:a('o outorgante','a outorgante','o(a) outorgante'),lo:a('defendê-lo','defendê-la','defendê-lo(a)')
  };
}

/* ---------- números por extenso (pt-BR) ---------- */
const U=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const D=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const C=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
function ate999(n){
  if(n===100)return 'cem';
  const c=Math.floor(n/100),r=n%100,p=[];
  if(c)p.push(C[c]);
  if(r){if(r<20)p.push(U[r]);else{const d=Math.floor(r/10),u=r%10;p.push(u?D[d]+' e '+U[u]:D[d])}}
  return p.join(' e ');
}
function extenso(n){
  n=Math.floor(n);if(n===0)return 'zero';
  const mi=Math.floor(n/1e6),mil=Math.floor(n%1e6/1000),r=n%1000,p=[];
  if(mi)p.push(ate999(mi)+(mi===1?' milhão':' milhões'));
  if(mil)p.push(mil===1?'mil':ate999(mil)+' mil');
  if(r)p.push(ate999(r));
  // "e" entre as partes só quando a última parte é < 100 ou centena exata
  let s=p[0]||'';
  for(let i=1;i<p.length;i++){const ult=i===p.length-1,pequeno=r&&(r<100||r%100===0);s+=(ult&&(pequeno||p.length===2&&!r)?' e ':', ')+p[i]}
  return s;
}
function brl(v){return v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function reais(v){
  const t=Math.round(v*100),r=Math.floor(t/100),c=t%100;
  let s='R$ '+brl(t/100)+' ('+extenso(r)+(r===1?' real':' reais');
  if(c)s+=' e '+extenso(c)+(c===1?' centavo':' centavos');
  return s+')';
}
function numBR(s){ // "2.000,00" | "2000" | "2000.5" → number
  s=String(s).trim().replace(/R\$\s*/,'');if(!s)return NaN;
  if(/,/.test(s))s=s.replace(/\./g,'').replace(',','.');
  return parseFloat(s);
}

/* ---------- utilitários de XML ---------- */
async function abre(b64){return JSZip.loadAsync(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)))}
const paragrafos=x=>[...x.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(m=>m[0]);
const txt=p=>(p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g)||[]).join('').replace(/<[^>]+>/g,'');
const rPrDe=r=>(r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)||[''])[0];
const run=(rp,t)=>`<w:r>${rp}<w:t xml:space="preserve">${X(t)}</w:t></w:r>`;
const modelo=()=>{throw new Error('O modelo do escritório mudou; avise o responsável pelo site.')};
const dataExt=d=>d?`${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`:'____ de ______________ de ______';

/* troca um trecho de texto, mesmo quebrado em vários runs; mantém a formatação do primeiro run envolvido */
function sub(p,velho,novo){
  const re=/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g,ns=[];let m;
  while((m=re.exec(p)))ns.push({s:m.index,e:m.index+m[0].length,t:UX(m[1])});
  const cheio=ns.map(n=>n.t).join(''),i=cheio.indexOf(velho);
  if(i<0)modelo();
  let pos=0;const novos=ns.map(n=>n.t),fim=i+velho.length;let primeiro=-1;
  ns.forEach((n,k)=>{const a=pos,b=pos+n.t.length;pos=b;
    if(b<=i||a>=fim)return;
    const pre=n.t.slice(0,Math.max(0,i-a)),pos2=n.t.slice(Math.min(n.t.length,fim-a));
    if(primeiro<0){primeiro=k;novos[k]=pre+novo+pos2}else novos[k]=pos2});
  let out=p;
  for(let k=ns.length-1;k>=0;k--)out=out.slice(0,ns[k].s)+`<w:t xml:space="preserve">${X(novos[k])}</w:t>`+out.slice(ns[k].e);
  return out;
}
/* parágrafo inteiro com o texto trocado (mantém pPr e o rPr do primeiro run) */
function paraComTexto(p,t,negrito){
  const pPr=(p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)||[''])[0];
  let rp=rPrDe((p.match(/<w:r[ >][\s\S]*?<\/w:r>/)||[''])[0]);
  if(negrito&&!/<w:b\/>/.test(rp))rp=rp?rp.replace('</w:rPr>','<w:b/><w:bCs/></w:rPr>'):'<w:rPr><w:b/><w:bCs/></w:rPr>';
  return `<w:p>${pPr}${run(rp,t)}</w:p>`;
}
const ou=(v,k,ph)=>(v[k]||'').toString().trim()||ph;
const B='__________';

function qualificacao(v,c){
  const nac=v.nac&&v.nac.trim()?c.nac(v.nac):'brasileiro(a)',ec=v.ec?c.ec(v.ec):B,cep=v.cep&&v.cep.trim()?', CEP '+v.cep.trim():'';
  return{nac,ec,cep,nome:ou(v,'nome',B).toUpperCase()};
}
/* assinatura do cliente: nome (negrito) e CPF centralizados */
function blocoAssinatura(modeloP,v){
  const nomeP=paraComTexto(modeloP,ou(v,'nome',B).toUpperCase(),true);
  const cpfP=paraComTexto(modeloP,'CPF nº '+ou(v,'cpf',B),false).replace(/<w:b\/><w:bCs\/>|<w:b\/>/g,'');
  return nomeP+cpfP;
}

/* assinatura da procuração/declaração: linha centralizada (11 cm) acima do nome em negrito e do CPF, sem marcador */
function assinaturaPessoa(pData,v,rotulo){
  const rp=rPrDe(pData.match(/<w:r>[\s\S]*?<\/w:r>/)[0]),rb=rp.replace('<w:color','<w:b/><w:bCs/><w:color');
  const pBase=pData.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0];
  const pNome=pBase.replace('<w:pStyle w:val="Normal"/>','<w:pStyle w:val="Normal"/><w:keepNext/><w:pBdr><w:top w:val="single" w:sz="6" w:space="2" w:color="000000"/></w:pBdr>').replace(/<w:spacing [^>]*\/>|<w:ind [^>]*\/>/g,'').replace(/<w:jc /,'<w:spacing w:before="720" w:after="0" w:lineRule="auto" w:line="360"/><w:ind w:left="1417" w:right="1417"/><w:jc ');
  return `<w:p>${pNome}${run(rb,ou(v,'nome',B).toUpperCase())}</w:p><w:p>${pBase.replace(/<w:b\/>|<w:bCs\/>/g,'')}${run(rp.replace(/<w:b\/>|<w:bCs\/>/g,''),'CPF nº '+ou(v,'cpf',B))}</w:p>`+(rotulo?`<w:p>${pBase.replace(/<w:b\/>|<w:bCs\/>/g,'')}${run(rp.replace(/<w:b\/>|<w:bCs\/>/g,''),rotulo)}</w:p>`:'');
}

/* ---------- procuração e hipossuficiência (mesmo modelo-base) ---------- */
async function basePessoa(v,data,tipo){
  const zip=await abre(MODELOS.proc);let x=await zip.file('word/document.xml').async('string');
  const ps=paragrafos(x);
  if(!txt(ps[3]).startsWith('OUTORGANTE')||!txt(ps[10]).startsWith('PODERES')||!/de 2026\.$/.test(txt(ps[11])))modelo();
  const c=conc(v.sexo),q=qualificacao(v,c);
  const pPr=ps[3].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0],rs=ps[3].match(/<w:r>[\s\S]*?<\/w:r>/g);
  const rB=rPrDe(rs[0]),rN=rPrDe(rs[1]);
  const dt=`${ou(v,'local','Piracanjuba/GO')}, ${dataExt(data)}.`;
  const resto=`, ${q.nac}, ${q.ec}, ${ou(v,'prof',B)}, ${c.portador} do RG nº ${ou(v,'rg',B)}, ${c.inscrito} no CPF nº ${ou(v,'cpf',B)}, residente e ${c.domic} na ${ou(v,'end',B)}, ${ou(v,'cid',B)}${q.cep}`;
  const subst=(i,novo)=>{x=x.replace(ps[i],()=>novo)};
  const rpTit='<w:rPr><w:rFonts w:cs="Arial" w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:bCs/><w:color w:val="9C7D33"/><w:spacing w:val="77"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
  const respiro=tipo==='hipossuficiencia'?'<w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:before="0" w:after="0" w:lineRule="auto" w:line="360"/><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:pPr></w:p>'.repeat(10):'';
  subst(0,`<w:p>${ps[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0]}${run(rpTit,tipo==='procuracao'?'PROCURAÇÃO':'DECLARAÇÃO DE HIPOSSUFICIÊNCIA')}</w:p>${respiro}`);
  const p10=ps[10].replace(/w:left="-397"/,'w:left="-454"').replace(/w:line="360"/,'w:line="323"').replace(/<w:sz w:val="20"\/>/g,'<w:sz w:val="19"/>').replace(/<w:szCs w:val="20"\/>/g,'<w:szCs w:val="19"/>');
  if(tipo==='procuracao')subst(8,ps[8].replace(/<w:sz w:val="22"\/>/g,'<w:sz w:val="21"/>').replace(/<w:szCs w:val="22"\/>/g,'<w:szCs w:val="21"/>'));
  if(tipo==='procuracao'){
    subst(3,`<w:p>${pPr}${run(rB,'OUTORGANTE: ')}${run(rB,q.nome)}${run(rN,resto+'.')}</w:p>`);
    if(v.pmodo==='digitar'){
      const pp=p10.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0],r10=p10.match(/<w:r>[\s\S]*?<\/w:r>/g);
      const digitado=(v.ptxt||'').trim().replace(/\s*\n\s*/g,' ')||'__________________________________________________';
      subst(10,`<w:p>${pp}${r10[0]}${r10[1]}${run(rPrDe(r10[2]),digitado)}</w:p>`);
    }else subst(10,p10.replace(/defendê-lo/,c.lo).replace(/o outorgante/,c.ele));
  }else{
    const t1='em razão de minha atual condição financeira, não tenho condições de arcar com nenhum tipo de pagamento de custos processuais, pois o pagamento implicaria prejuízo ao meu sustento e ao de minha família, nos termos do Art. 5º, LXXIV, da Constituição da República, da Lei nº 1.060/50, bem como nos artigos 82, 98 e 99, §3º, do Código de Processo Civil.';
    const t2='Reiterando minha incapacidade de custear quaisquer ações, solicito, ainda, que tal benefício abranja todos os atos do processo, de acordo com o artigo 98 do Código de Processo Civil.';

    subst(3,`<w:p>${pPr}${run(rN,'Eu, ')}${run(rB,q.nome)}${run(rN,resto+', venho declarar que, '+t1)}</w:p>`);
    subst(8,`<w:p>${pPr}${run(rN,t2)}</w:p>`);
    subst(10,'');
  }
  subst(4,'');subst(5,'');subst(6,'');
  x=x.replace(ps[11],()=>ps[11].replace(/<w:t>[^<]*<\/w:t>/,()=>`<w:t>${X(dt)}</w:t>`).replace('w:line="360"/>','w:line="360" w:before="480"/>'));
  x=x.replace(ps[13],()=>assinaturaPessoa(ps[11],v,tipo==='hipossuficiencia'?'DECLARANTE':''));
  x=x.replace(/w:line="360"/g,'w:line="313"').replace(/w:left="-(454|397)"/g,'w:left="0"'); // entrelinha e alinhamento do modelo
  zip.file('word/document.xml',x);
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}

/* ---------- contrato de honorários — salário-maternidade rural ---------- */
async function contratoSM(v,data){
  const zip=await abre(MODELOS.sm);let x=await zip.file('word/document.xml').async('string');
  const ps=paragrafos(x);
  if(!/CONTRATANT/.test(txt(ps[2]))||!/Salário-Maternidade/.test(txt(ps[7]))||!/Piracanjuba, /.test(txt(ps[32])))modelo();
  const c=conc('F'),q=qualificacao(v,c);
  const rs=ps[2].match(/<w:r[ >][\s\S]*?<\/w:r>/g);
  const rB=rPrDe(rs[0]),rN=rPrDe(rs.find(r=>!/<w:b\/>/.test(r)&&/<w:t/.test(r)));
  const pPr=ps[2].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0];
  const tel=ou(v,'tel',B);
  const resto=`, ${q.nac}, ${q.ec}, ${ou(v,'prof',B)}, ${c.portador} do RG nº ${ou(v,'rg',B)} e ${c.inscrito} no CPF sob o nº ${ou(v,'cpf',B)}, residente e ${c.domic} na ${ou(v,'end',B)}${q.cep}, Município de ${ou(v,'cid',B)}, telefone/WhatsApp ${tel}.`;
  const subst=(i,novo)=>{x=x.replace(ps[i],()=>novo)};
  if(!/PREVIDENCI/.test(txt(ps[1])))modelo();
  { // título no mesmo layout do contrato de serviços previdenciários
    const xf=await (await abre(MODELOS.fc)).file('word/document.xml').async('string'),pf=paragrafos(xf);
    const rpT=rPrDe(pf[0].match(/<w:r[ >][\s\S]*?<\/w:r>/)[0]);
    subst(0,`<w:p>${pf[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0].replace('<w:pStyle w:val="Heading1"/>','<w:pStyle w:val="Normal"/>').replace(/<w:spacing [^>]*\/>/,'<w:spacing w:lineRule="auto" w:line="257" w:before="94" w:after="0"/>')}${run(rpT,'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS')}</w:p>${pf[1]}${pf[2]}`);
  }
  subst(1,''); // tira o subtítulo "(PREVIDENCIÁRIO – ADMINISTRATIVO)"
  subst(2,`<w:p>${pPr}${run(rB,'CONTRATANTE: ')}${run(rN,q.nome+resto)}</w:p>`);
  // data provável do parto
  let dpp='o dia ____ de ______________ de ______';
  if(v.dpp){const[a,m,d]=v.dpp.split('-').map(Number);if(a)dpp=`o dia ${d} de ${MESES[m-1]} de ${a}`}
  subst(7,sub(ps[7],'o dia ____ de novembro',dpp));
  // honorários
  const val=numBR(v.honor),smin=numBR(v.smin),parc=Math.max(1,parseInt(v.parc,10)||1);
  if(!(val>0)||!(smin>0))throw new Error('Informe o valor dos honorários e o salário mínimo.');
  let p24=sub(ps[24],'R$ 2.000,00 (dois mil reais) ou seja ',reais(val)+' ou seja ');
  p24=sub(p24,'1,23 ',(val/smin).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ');
  p24=sub(p24,'parcelados em 2 parcelas',parc===1?'em parcela única':`parcelados em ${parc} (${extenso(parc)}) parcelas`);
  subst(24,p24);
  subst(26,sub(ps[26],'032.195.131-07',ou(v,'pix','032.195.131-07')));
  subst(28,sub(ps[28],'50% do valor',`${parseInt(v.resc,10)||50}% do valor`));
  subst(30,sub(ps[30],'Piracanjuba/GO',ou(v,'foro','Piracanjuba/GO')));
  subst(32,sub(ps[32],'Piracanjuba, 16 de novembro de 2026.',`${ou(v,'local','Piracanjuba/GO')}, ${dataExt(data)}.`));
  subst(34,sub(ps[34],'DAYANNE MOREIRA DA SILVA',q.nome));
  subst(38,ps[38].replace('w:before="760"','w:before="1300"'));
  subst(36,sub(ps[36],'064.420.551-24',ou(v,'cpf',B)));
  zip.file('word/document.xml',x);
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}

/* ---------- contrato de prestação de serviços previdenciários ---------- */
async function contratoFC(v,data){
  const zip=await abre(MODELOS.fc);let x=await zip.file('word/document.xml').async('string');
  const ps=paragrafos(x);
  if(!/CONTRATA/.test(txt(ps[3]))||!/cinquenta/.test(txt(ps[26]))||!/R\$ 5\.000,00/.test(txt(ps[26]))||!/Piracanjuba/.test(txt(ps[38])))modelo();
  const c=conc(v.sexo),q=qualificacao(v,c);
  const rs=ps[3].match(/<w:r[ >][\s\S]*?<\/w:r>/g);
  const rB=rPrDe(rs[0]),rN=rPrDe(rs[2]);
  const pPr=ps[3].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0].replace(/<w:ind [^>]*\/>/,'<w:ind w:right="156"/>'); // alinha com os demais parágrafos
  const resto=`, ${q.nac}, ${q.ec}, ${ou(v,'prof',B)}, ${c.portador} do RG nº ${ou(v,'rg',B)}, CPF nº ${ou(v,'cpf',B)}, residente e ${c.domic} na ${ou(v,'end',B)}${q.cep}, ${ou(v,'cid',B)}.`;
  const subst=(i,novo)=>{x=x.replace(ps[i],()=>novo)};
  subst(3,`<w:p>${pPr}${run(rB,'CONTRATANTE: ')}${run(rN,q.nome+resto)}</w:p>`);
  subst(4,'');subst(5,'');subst(6,'');
  const pct=parseFloat(String(v.pct).replace(',','.'))||50,min=numBR(v.minimo);
  if(!(min>0))throw new Error('Informe o valor mínimo dos honorários.');
  let p26=sub(ps[26],'50% (cinquenta por cento)',`${String(pct).replace('.',',')}% (${extenso(Math.floor(pct))} por cento)`);
  p26=sub(p26,'R$ 5.000,00 (cinco mil reais)',reais(min));
  subst(26,p26);
  // um único contratado (o advogado): singular em todo o contrato
  const ed=(i,pares)=>{let p=ps[i];pares.forEach(([a,b])=>{p=sub(p,a,b)});subst(i,p)};
  ed(10,[['CONTRATADOS','CONTRATADO']]);
  ed(13,[['Os Contratados, obrigam-se','O Contratado obriga-se']]);
  ed(17,[['pelos CONTRATADOS','pelo CONTRATADO']]);
  ed(18,[['CONTRATADO(A)','CONTRATADO']]);
  ed(19,[['estes ficam, desde já, obrigados','este fica, desde já, obrigado']]);
  ed(21,[['DOS CONTRATADOS','DO CONTRATADO']]);
  ed(24,[['Envidarem','Envidar']]);
  ed(33,[['utilizarem','utilizar']]);
  ed(35,[['A CONTRATADA se responsabiliza por manterem','O CONTRATADO se responsabiliza por manter'],['protegerem','proteger']]);
  subst(38,sub(ps[38],'Comarca de Piracanjuba','Comarca de '+ou(v,'foro','Piracanjuba')));
  const dt=`${ou(v,'local','Piracanjuba/GO')}, ${dataExt(data)}.`;
  const p42=ps[42],pp=p42.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)[0].replace(/<w:tabs>[\s\S]*?<\/w:tabs>/,'');
  subst(42,`<w:p>${pp}${run(rPrDe(p42.match(/<w:r>[\s\S]*?<\/w:r>/g).pop()),dt)}</w:p>`);
  [39,41,43,44,45,48,49,50,51,55,56,57,58,59,60].forEach(i=>subst(i,'')); // parágrafos vazios: a assinatura do advogado volta para a mesma página
  subst(52,ps[52].replace('w:before="720"','w:before="1000"'));
  subst(46,''); // tira a linha desenhada (fixa na página) e a palavra CONTRATANTE: a assinatura é nome + CPF sob uma linha
  subst(47,assinaturaPessoa(ps[47],v));
  zip.file('word/document.xml',x);
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}

const GERADORES={
  procuracao:(v,d)=>basePessoa(v,d,'procuracao'),
  hipossuficiencia:(v,d)=>basePessoa(v,d,'hipossuficiencia'),
  'salario-maternidade':contratoSM,
  previdenciario:contratoFC
};
window.DOCS={conc,extenso,reais,numBR,MESES,dataExt,gerar:(tipo,v,data)=>GERADORES[tipo](v,data)};
})();
