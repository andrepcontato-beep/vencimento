/* Leitura dos documentos do cliente (OCR no navegador) e extração dos dados */
/* ---------- extração ---------- */
function limpa(t){return t.replace(/[|]/g,'I').replace(/\r/g,'')}
function extrairId(t){
  t=limpa(t);const o={};
  const cl=t.match(/C\s?P\s?F\W{0,12}(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})(?!\d)/i);
  const cpf=cl||t.match(/(?<!\d)(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})(?!\d)/);
  if(cpf)o.cpf=`${cpf[1]}.${cpf[2]}.${cpf[3]}-${cpf[4]}`;
  const L=t.split('\n').map(s=>s.trim()).filter(Boolean);
  for(let i=0;i<L.length;i++){
    if(!o.nome&&/^NOME(\s+E\s+SOBRENOME)?\b/i.test(L[i])&&!/^NOME\s+SOCIAL/i.test(L[i])){   /* CIN: "Nome Social / Social Name" não é o nome */
      let r=L[i].replace(/^NOME(\s+E\s+SOBRENOME)?[:\s]*/i,'').replace(/^[\/\s]*NAME\b[:\s]*/i,'');
      if(r.length<5&&L[i+1])r=L[i+1];
      r=r.split(/\s{3,}|\s[|!¡]/)[0];
      r=r.replace(/[^A-ZÀ-Ú\s]/gi,' ').replace(/\s+/g,' ').trim();
      if(r.split(' ').length>=2)o.nome=r;
    }
    if(!o.rg&&/EXPEDI[ÇC]/i.test(L[i])&&!/\b(SSP|SDS|SESP|DGPC|PCGO|IFP|DETRAN)\b/i.test(L[i])){   /* CIN (nova identidade): o RG fica na linha de "DATA DE EXPEDIÇÃO" */
      const tx=L[i].replace(/\b\d{2}\/\d{2}\/\d{4}\b/g,' ').replace(/\b\d[\dOo]?\s?[ªº°]\s*VIA/gi,' ');
      const m=tx.match(/(?<![\d.])(\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]?)(?![\d])/);if(m)o.rg=m[1].replace(/\D+$/,'');
    }
    if(!o.rg&&!/PROFISSIONAL|CREA|CRM|OAB|CONFEA|CRO\b/i.test(L[i])&&/REGISTRO\s+GERAL|IDENTIDADE|[ÓO]RG\.?\s*EMISS|\bRG\b|\bR\.?G\.?\s*[:Nº°]/i.test(L[i])){
      /* valor na própria linha (depois do rótulo) ou nas 2 linhas seguintes */
      for(const j of [i,i+1,i+2]){
        if(j>=L.length)break;
        let tx=j===i?L[i].replace(/^.*?(REGISTRO\s+GERAL|IDENTIDADE[^0-9]*|[ÓO]RG\.?\s*EMISS[^0-9]*|\bRG\b)[^0-9A-Z]{0,6}/i,''):L[j];
        tx=tx.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,' ').replace(/\b\d{2}\/\d{2}\/\d{4}\b/g,' ');
        const m=tx.match(/(?:^|[^\d])(\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]|\d{5,10}-?[\dXx]?)(?:\s*[-\/ ]?\s*(SSP|SDS|SESP|DGPC|PC|PCGO|IFP|DETRAN|PM|SJS|SJTC)\s*[-\/ ]?\s*([A-Z]{2})?)?/);
        if(m){o.rg=m[1]+(m[2]?` ${m[2].toUpperCase()}/${(m[3]||'GO').toUpperCase()}`:'');break}
      }
    }
  }
  /* CIN (nova Carteira de Identidade Nacional): "Registro Geral - CPF / Personal Number" — o RG é o próprio número do CPF */
  if(o.cpf&&/REGISTRO\s+GER\S*\s*[-–—]?\s*CPF|CPF\s*\/\s*PERSONAL\s+NUMBER/i.test(t))o.rg=o.cpf;
  if(o.rg&&!/[A-Z]{2,}/.test(o.rg)&&o.rg!==o.cpf){const uf=(t.match(/ESTADO\s+D[EO]\s+([A-ZÀ-Ú ]{4,20}?)\s*(?:\n|SECRETARIA|\s{2,})/i)||[])[1];const U={'GOIÁS':'GO','GOIAS':'GO','SÃO PAULO':'SP','MINAS GERAIS':'MG','MATO GROSSO':'MT','TOCANTINS':'TO','BAHIA':'BA','DISTRITO FEDERAL':'DF'};const u=uf&&U[uf.trim().toUpperCase()];if(u&&/SEGURAN[ÇC]A/i.test(t))o.rg+=' SSP/'+u}
  if(!o.rg){const m=t.match(/(\d{5,9}[-.]?\d?)\s*(SSP|SDS|DGPC|PC|IFP)[\s\/-]*([A-Z]{2})/i);if(m)o.rg=`${m[1]} ${m[2].toUpperCase()}/${m[3].toUpperCase()}`}
  return o;
}
/* ---------- padrões por emissor do comprovante ---------- */
const MINUS=new Set(['de','da','do','das','dos','e']);
function titulo(x){return x.toLowerCase().split(/(\s+)/).map((w,i)=>{if(!w.trim()||MINUS.has(w)&&i>0)return w;if(/\d|[.\/]|^.{1,2}$/.test(w))return w.toUpperCase().replace(/^([A-Z])([A-Z]+)$/,(m,a,b)=>a+b.toLowerCase());return w[0].toUpperCase()+w.slice(1)}).join('')}
function fmtCpf(d){return d.length===11?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`:''}
const PADROES=[
 {nome:'Equatorial Goiás',detecta:t=>/EQUATORIAL/i.test(t),
  /* Bloco do cliente: [NOME] / CNPJ/CPF: … / RUA … / SETOR … / CEP: 75640000 CIDADE UF BRASIL. O endereço da própria Equatorial (cabeçalho) é ignorado. */
  extrai(t){
   const L=t.split('\n').map(s=>s.trim()).filter(Boolean),o={};
   const i=L.findIndex(l=>/CNPJ\s*\/\s*CPF/i.test(l));if(i<0)return null;
   const d=(L[i].match(/CPF\s*:?\s*([\d.\-\/ ]{11,20})/i)||[])[1];if(d){const c=fmtCpf(d.replace(/\D/g,''));if(c)o.cpf=c}
   const nm=(L[i-1]||'').replace(/[^A-ZÀ-Úa-zà-ú'\s]/g,' ').replace(/\s+/g,' ').trim();if(nm.split(' ').length>=2)o.nome=nm.toUpperCase();
   const ad=[];for(let j=i+1;j<Math.min(L.length,i+6);j++){if(/^CEP/i.test(L[j])||/^PERDAS/i.test(L[j]))break;const x=L[j].replace(/N[ÚU]MERO DA UC.*$/i,'').replace(/[>?|]+\s*$/,'').trim();if(x)ad.push(x)}
   if(ad.length)o.end=titulo(ad.join(', ').replace(/\s*,\s*,/g,','));
   const cl=L.slice(i).find(l=>/^CEP/i.test(l));
   if(cl){const m=cl.match(/CEP\s*:?\s*(\d{5})\D?(\d{3})\s+(.+?)\s+([A-Z]{2})(?:\s+BRASIL)?\s*$/i);
     if(m){o.cep=m[1]+'-'+m[2];o.cid=titulo(m[3])+'/'+m[4].toUpperCase()}else{const c=cl.match(/(\d{5})\D?(\d{3})/);if(c)o.cep=c[1]+'-'+c[2]}}
   return o}},
];
function extrairEnd(t){
  t=limpa(t);
  for(const p of PADROES){if(p.detecta(t)){const o=p.extrai(t);if(o&&(o.end||o.cpf)){o._padrao=p.nome;return o}}}
  return extrairEndGenerico(t);
}
function extrairEndGenerico(t){
  t=limpa(t);const o={};
  const cep=t.match(/\b(\d{5})[-.\s]?(\d{3})\b/);if(cep)o.cep=cep[1]+'-'+cep[2];
  const L=t.split('\n').map(s=>s.trim()).filter(s=>s.length>3);
  const re=/^(?:ENDERE[ÇC]O[:\s]*)?((?:RUA|R\.|AV\.?|AVENIDA|ALAMEDA|AL\.|TRAVESSA|PRA[ÇC]A|RODOVIA|ROD\.|ESTRADA|FAZENDA|S[ÍI]TIO|CH[ÁA]CARA|QUADRA|QD\.?)\s.+)/i;
  for(let i=0;i<L.length;i++){const m=L[i].match(re);if(m){let e=m[1].replace(/\s{2,}/g,' ').replace(/[;|]/g,',');
      const nx=L[i+1]||'';if(/^(SETOR|BAIRRO|JD|JARDIM|VILA|CENTRO|ST\.?|RES)/i.test(nx))e+=', '+nx;o.end=e;break}}
  const cu=t.match(/([A-ZÀ-Ú][A-Za-zÀ-ú' ]{2,30})\s*[-\/,]\s*([A-Z]{2})\b/g);
  if(cu){const x=cu.map(s=>s.match(/^(.*?)\s*[-\/,]\s*([A-Z]{2})$/)).filter(Boolean).find(m=>/^[A-ZÀ-Ú]/.test(m[1])&&m[1].trim().split(' ').length<=3&&!/CEP|RUA|AV/i.test(m[1]));if(x)o.cid=x[1].trim()+'/'+x[2]}
  return o;
}
function aplica(o,mapa,alvoStatus){
  let n=0;for(const k in mapa){const el=$('#'+mapa[k]);if(o[k]&&!el.value.trim()){el.value=o[k];el.classList.add('auto');n++}}
  render();return n;
}

/* ---------- OCR 100% no navegador (imagem, foto ou PDF escaneado) ---------- */
let _worker=null,_stAtual=null,_passe=1;   /* _stAtual: campo de status do documento em leitura agora */
async function getWorker(S){
  _stAtual=S;
  if(_worker)return _worker;
  S.textContent='Carregando motor de leitura…';
  if(window.OCR_PRE)await window.OCR_PRE();   /* versão em arquivo único: prepara o idioma embutido */
  const cfg=window.OCR_CFG||{workerPath:'gerador/ocr/worker.min.js',corePath:'gerador/ocr/',langPath:'gerador/ocr/',gzip:true};
  _worker=await Tesseract.createWorker('por',1,Object.assign({
    logger:m=>{const S=_stAtual;if(m.status&&S&&m.status==='recognizing text')S.textContent='Lendo… '+Math.round((m.progress||0)*100)+'%'}},cfg));
  await _worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
  return _worker;
}
function carregaImg(file){return new Promise((ok,er)=>{const u=URL.createObjectURL(file),i=new Image();i.onload=()=>{ok(i)};i.onerror=()=>er(new Error('imagem inválida'));i.src=u})}
/* pré-processa: aumenta (alvo ~2400px no lado maior), cinza, autocontraste, limiar suave */
function preprocessa(src,w,h){
  const alvo=2400,k=Math.max(1,alvo/Math.max(w,h)),cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);
  const g=cv.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);g.drawImage(src,0,0,cv.width,cv.height);
  const im=g.getImageData(0,0,cv.width,cv.height),d=im.data,hist=new Uint32Array(256);
  for(let i=0;i<d.length;i+=4){const y=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)|0;d[i]=y;hist[y]++}
  const tot=cv.width*cv.height;let lo=0,hi=255,c=0;for(let i=0;i<256;i++){c+=hist[i];if(c>tot*.01){lo=i;break}}c=0;for(let i=255;i>=0;i--){c+=hist[i];if(c>tot*.01){hi=i;break}}
  const r=Math.max(1,hi-lo);
  for(let i=0;i<d.length;i+=4){let y=Math.max(0,Math.min(255,(d[i]-lo)*255/r));d[i]=d[i+1]=d[i+2]=y;d[i+3]=255}
  g.putImageData(im,0,0);return cv;
}
async function paraImagens(file){
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
    pdfjsLib.GlobalWorkerOptions.workerSrc=window.PDF_WORKER?window.PDF_WORKER():'gerador/ocr/pdf.worker.min.js';
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
    for(let i=1;i<=Math.min(pdf.numPages,3);i++){const pg=await pdf.getPage(i),vp=pg.getViewport({scale:2.5}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;out.push(preprocessa(cv,cv.width,cv.height))}
    return out;
  }
  const im=await carregaImg(file);return [preprocessa(im,im.naturalWidth,im.naturalHeight)];
}
let _fila=Promise.resolve();
function ler(files,st,extrator,mapa,box){$(st).textContent='Na fila…';_fila=_fila.then(()=>lerUm(files,st,extrator,mapa,box));return _fila}   /* um documento por vez */
async function lerUm(files,st,extrator,mapa,box){
  const S=$(st);S.textContent='Preparando…';
  try{
    if(!window.Tesseract)throw new Error('motor de OCR não carregou — recarregue a página');
    const w=await getWorker(S);let txt='';
    let o={};const esperados=Object.keys(mapa);
    const NOMES={nome:'nome',cpf:'CPF',rg:'RG',end:'endereço',cep:'CEP',cid:'cidade/UF'};
    for(const f of files){
      const imgs=await paraImagens(f);
      for(const cv of imgs){
        /* 1 passada (rápida); só repete com outro modo se ainda faltar algum campo */
        for(const psm of ['4','6']){
          if(esperados.every(k=>o[k]))break;
          await w.setParameters({tessedit_pageseg_mode:psm});S.textContent='Lendo…'+(psm==='6'?' (conferindo o que faltou)':'');
          const t=(await w.recognize(cv)).data.text;txt+='\n'+t;
          const x=extrator(t);for(const k in x)if(x[k]&&!o[k])o[k]=x[k];
        }
      }
    }
    window.__ocr=(window.__ocr||'')+txt;
    aplica(o,mapa);window.__o=o;
    const achou=esperados.filter(k=>o[k]),falta=esperados.filter(k=>!o[k]);
    S.innerHTML=(achou.length?`✔ Li: ${achou.map(k=>NOMES[k]).join(', ')}`+(o._padrao?' (padrão '+o._padrao+')':''):'')+(falta.length?`${achou.length?'<br>':''}⚠ <b>Não consegui ler:</b> ${falta.map(k=>NOMES[k]).join(', ')} — preencha na etapa 2`:'')+(achou.length?'<br><small>confira os campos em amarelo</small>':'');
    $(box).classList.add('ok');liberaSeguir();
  }catch(e){S.textContent='⚠ '+e.message;console.error(e)}
}
$('#f1').onchange=e=>ler([...e.target.files],'#s1',extrairId,{nome:'nome',cpf:'cpf',rg:'rg'},'#u1');
$('#f2').onchange=e=>ler([...e.target.files],'#s2',extrairEnd,{end:'end',cep:'cep',cid:'cid'},'#u2');
