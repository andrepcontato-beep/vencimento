(function () {
  'use strict';
  const $ = function (s) { return document.querySelector(s); };
  const CHAVE = 'idv.perfis.v1';
  const estado = { catalogo: [], salvos: [], perfil: null, origem: '', buffer: null, nomeBase: '', blob: null, ocupado: false };

  /* ---------- utilidades ---------- */
  function msg(texto, tipo) {
    const el = $('#msg');
    el.textContent = texto || '';
    el.className = tipo || '';
  }
  function lerSalvos() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { return []; }
  }
  function gravarSalvos(lista) {
    try { localStorage.setItem(CHAVE, JSON.stringify(lista)); return true; } catch (e) { return false; }
  }
  function arquivoParaDataUrl(arq) {
    return new Promise(function (ok, erro) {
      const r = new FileReader();
      r.onload = function () { ok(r.result); };
      r.onerror = function () { erro(new Error('Não consegui ler o arquivo.')); };
      r.readAsDataURL(arq);
    });
  }
  async function urlParaDataUrl(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Logo não encontrado.');
    return arquivoParaDataUrl(await resp.blob());
  }
  function slug(s) {
    return String(s || 'identidade').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'identidade';
  }
  function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  /* ---------- identidades ---------- */
  async function carregarCatalogo() {
    try {
      const r = await fetch('perfis/index.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error();
      estado.catalogo = await r.json();
    } catch (e) { estado.catalogo = []; }
  }
  async function perfilDoCatalogo(entrada) {
    const url = new URL('perfis/' + entrada.caminho, location.href);
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Não consegui carregar a identidade "' + entrada.nome + '".');
    const p = await r.json();
    if (p.logo && !p.logoData) p.logoUrl = new URL(p.logo, url).href;
    return p;
  }
  function montarSeletor(selecionar) {
    const sel = $('#selPerfil');
    sel.innerHTML = '';
    const add = function (grupo, valor, rotulo) {
      let g = Array.prototype.find.call(sel.children, function (n) { return n.label === grupo; });
      if (!g) { g = document.createElement('optgroup'); g.label = grupo; sel.appendChild(g); }
      const o = document.createElement('option'); o.value = valor; o.textContent = rotulo; g.appendChild(o);
    };
    estado.catalogo.forEach(function (e) { add('Escritórios disponíveis', 'cat:' + e.id, e.nome); });
    estado.salvos.forEach(function (p, i) { add('Salvos neste navegador', 'loc:' + i, p.nome); });
    const o = document.createElement('option'); o.value = 'novo'; o.textContent = '+ Nova identidade em branco';
    sel.appendChild(o);
    if (selecionar) sel.value = selecionar;
  }
  async function escolher(valor) {
    try {
      let p;
      if (valor.indexOf('cat:') === 0) {
        const e = estado.catalogo.find(function (x) { return 'cat:' + x.id === valor; });
        p = await perfilDoCatalogo(e);
      } else if (valor.indexOf('loc:') === 0) {
        p = JSON.parse(JSON.stringify(estado.salvos[Number(valor.slice(4))]));
      } else {
        p = { nome: 'Novo escritório' };
        $('#detalhesEditar').open = true;
      }
      estado.perfil = IDV.normalizarPerfil(p);
      estado.perfil.logoUrl = p.logoUrl || null;
      estado.perfil.logoData = p.logoData || null;
      preencherFormulario(estado.perfil);
      atualizarTopo();
      if (estado.buffer) await processar();
    } catch (e) { msg(e.message, 'erro'); }
  }
  function atualizarTopo() {
    const img = $('#logoTopo');
    const src = estado.perfil && (estado.perfil.logoData || estado.perfil.logoUrl);
    if (src) { img.src = src; img.hidden = false; img.alt = 'Logo de ' + estado.perfil.nome; } else { img.hidden = true; }
    document.title = (estado.perfil ? estado.perfil.nome + ' · ' : '') + 'Identidade visual para petições';
  }

  /* ---------- formulário <-> perfil ---------- */
  function preencherFormulario(p) {
    $('#fNome').value = p.nome;
    $('#fFundo').checked = !!p.removerFundoBranco;
    $('#fLogoLarg').value = p.cabecalho.logoLarguraCm;
    $('#fAlin').value = p.cabecalho.alinhamento;
    $('#fCorFilete').value = '#' + p.cabecalho.corFilete;
    $('#fFileteCab').checked = !!p.cabecalho.filete;
    $('#fRodape').value = p.rodape.texto;
    $('#fRodapeCor').value = '#' + p.rodape.cor;
    $('#fRodapeTam').value = p.rodape.tamanhoPt;
    $('#fFileteRod').checked = !!p.rodape.filete;
    $('#fNumPag').checked = !!p.rodape.numeroPagina;
    $('#fMarca').checked = !!p.marcaDagua.ativa;
    $('#fOpac').value = Math.round(p.marcaDagua.opacidade * 100);
    $('#fOpacVal').textContent = $('#fOpac').value;
    $('#fMarcaLarg').value = p.marcaDagua.larguraCm;
    $('#fMarcaPos').value = p.marcaDagua.posicao;
    $('#fAplicaMar').checked = !!p.aplicarMargens;
    $('#fMTopo').value = p.margensCm.topo;
    $('#fMInf').value = p.margensCm.inferior;
    $('#fMEsq').value = p.margensCm.esquerda;
    $('#fMDir').value = p.margensCm.direita;
  }
  function lerFormulario() {
    const n = function (id) { return Number($(id).value); };
    const cor = function (id) { return $(id).value.replace('#', '').toUpperCase(); };
    return IDV.normalizarPerfil({
      nome: $('#fNome').value.trim() || 'Sem nome',
      logoUrl: estado.perfil.logoUrl, logoData: estado.perfil.logoData,
      removerFundoBranco: $('#fFundo').checked,
      cabecalho: { logoLarguraCm: n('#fLogoLarg'), alinhamento: $('#fAlin').value, corFilete: cor('#fCorFilete'), filete: $('#fFileteCab').checked },
      rodape: {
        texto: $('#fRodape').value.trim(), cor: cor('#fRodapeCor'), tamanhoPt: n('#fRodapeTam'),
        filete: $('#fFileteRod').checked, numeroPagina: $('#fNumPag').checked, corFilete: cor('#fCorFilete'),
        fonte: estado.perfil.rodape.fonte
      },
      marcaDagua: { ativa: $('#fMarca').checked, opacidade: n('#fOpac') / 100, larguraCm: n('#fMarcaLarg'), posicao: $('#fMarcaPos').value },
      aplicarMargens: $('#fAplicaMar').checked,
      margensCm: { topo: n('#fMTopo'), inferior: n('#fMInf'), esquerda: n('#fMEsq'), direita: n('#fMDir') }
    });
  }
  async function usarIdentidade() {
    try {
      estado.perfil = lerFormulario();
      atualizarTopo();
      if (estado.buffer) { await processar(); } else { msg('Identidade pronta. Agora escolha o documento.', 'ok'); }
    } catch (e) { msg(e.message, 'erro'); }
  }
  async function salvarNoNavegador() {
    try {
      const p = lerFormulario();
      if (!p.logoData && p.logoUrl) p.logoData = await urlParaDataUrl(p.logoUrl);
      p.logoUrl = null;
      const lista = lerSalvos();
      const i = lista.findIndex(function (x) { return x.nome === p.nome; });
      if (i >= 0) lista[i] = p; else lista.push(p);
      if (!gravarSalvos(lista)) throw new Error('O navegador não permitiu salvar (modo privado ou armazenamento cheio). Use "Exportar identidade".');
      estado.salvos = lista;
      montarSeletor('loc:' + lista.findIndex(function (x) { return x.nome === p.nome; }));
      estado.perfil = p;
      msg('Identidade "' + p.nome + '" salva neste navegador.', 'ok');
    } catch (e) { msg(e.message, 'erro'); }
  }
  async function exportarIdentidade() {
    try {
      const p = lerFormulario();
      if (!p.logoData && p.logoUrl) p.logoData = await urlParaDataUrl(p.logoUrl);
      p.logoUrl = null;
      baixar(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), slug(p.nome) + '.identidade.json');
    } catch (e) { msg(e.message, 'erro'); }
  }
  async function importarIdentidade(arq) {
    try {
      const p = JSON.parse(await arq.text());
      if (!p || typeof p !== 'object' || (!p.logoData && !p.logo)) throw new Error('Arquivo de identidade inválido (sem logo).');
      if (!p.logoData) throw new Error('Este .json aponta para um logo externo. Use um .json exportado por esta ferramenta (logo embutido).');
      const norm = IDV.normalizarPerfil(p);
      norm.logoData = p.logoData; norm.logoUrl = null;
      const lista = lerSalvos();
      const i = lista.findIndex(function (x) { return x.nome === norm.nome; });
      if (i >= 0) lista[i] = norm; else lista.push(norm);
      gravarSalvos(lista);
      estado.salvos = lista;
      montarSeletor('loc:' + lista.findIndex(function (x) { return x.nome === norm.nome; }));
      await escolher($('#selPerfil').value);
      msg('Identidade "' + norm.nome + '" importada.', 'ok');
    } catch (e) { msg(e.message || 'Não consegui importar.', 'erro'); }
  }

  /* ---------- documento ---------- */
  async function receberArquivo(arq) {
    if (!arq) return;
    msg('');
    $('#previa').hidden = true;
    estado.blob = null; estado.buffer = null;
    estado.nomeBase = arq.name.replace(/\.[^.]+$/, '');
    try {
      const buf = await arq.arrayBuffer();
      const formato = await IDV.detectarFormato(buf);
      if (formato !== 'docx') {
        const nomes = { doc: 'Word antigo (.doc)', odt: 'LibreOffice (.odt)', rtf: 'RTF', desconhecido: 'desconhecido' };
        throw new Error('Formato ' + nomes[formato] + ' ainda não é lido direto no navegador. Abra o arquivo no Word ou LibreOffice, use Salvar como → Word (.docx) e envie o .docx (leva segundos).');
      }
      estado.buffer = buf;
      await processar();
    } catch (e) { msg(e.message, 'erro'); }
  }
  async function processar() {
    if (estado.ocupado) return;
    estado.ocupado = true;
    try {
      msg('Aplicando a identidade…');
      const imgs = await IDV.prepararImagens(estado.perfil);
      estado.blob = await IDV.aplicarIdentidade(estado.buffer, estado.perfil, imgs);
      $('#previa').hidden = false;
      await montarPaginas(estado.blob, imgs, estado.perfil);
      $('#previa').scrollIntoView({ behavior: 'smooth', block: 'start' });
      msg('Pronto. Baixe o Word com a identidade aplicada.', 'ok');
    } catch (e) {
      msg('Não consegui aplicar a identidade: ' + (e.message || e), 'erro');
    } finally { estado.ocupado = false; }
  }
  /* ---------- prévia paginada ---------- */
  const PX_CM = 96 / 2.54;
  let urlsPrevia = [];
  function urlDe(bytes) {
    const u = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    urlsPrevia.push(u);
    return u;
  }
  function criarEl(tag, css, filhos) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    return e;
  }
  /* ---------- fidelidade ao Word: entrelinha ---------- */
  // No Word, "1,5 linha" = 1,5 x a altura natural da fonte (TNR 12pt: 20,7pt), não 1,5 x o corpo.
  // O docx-preview trata o valor como pontos exatos; aqui convertemos para a altura que o Word usa.
  const razaoFonte = {};
  function razaoNatural(fonte) {
    if (razaoFonte[fonte]) return razaoFonte[fonte];
    const s = document.createElement('span');
    s.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-size:100px;line-height:normal;font-family:"' + fonte + '",serif;';
    s.textContent = 'Hxgpq';
    document.body.appendChild(s);
    const r = s.getBoundingClientRect().height / 100;
    s.remove();
    razaoFonte[fonte] = r > 0.8 && r < 2 ? r : 1.15;
    return razaoFonte[fonte];
  }
  async function prepararParaPrevia(blob) {
    const info = { fonte: 'Times New Roman', tamanhoPt: 10 };
    let zip;
    try { zip = await JSZip.loadAsync(await blob.arrayBuffer()); } catch (e) { return { blob: blob, info: info }; }
    const arqEstilos = zip.file('word/styles.xml'), arqDoc = zip.file('word/document.xml');
    if (!arqDoc) return { blob: blob, info: info };
    let estilos = arqEstilos ? await arqEstilos.async('string') : '';
    let doc = await arqDoc.async('string');
    // fonte e corpo padrão do documento
    const dd = (estilos.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [''])[0];
    const normal = (estilos.match(/<w:style [^>]*w:default="1"[^>]*w:type="paragraph"[\s\S]*?<\/w:style>|<w:style [^>]*w:type="paragraph"[^>]*w:default="1"[\s\S]*?<\/w:style>/) || [''])[0];
    const pegaFonte = function (x) { const m = x.match(/w:ascii="([^"]+)"/); return m ? m[1] : null; };
    const pegaSz = function (x) { const m = x.match(/<w:sz w:val="(\d+)"/); return m ? Number(m[1]) / 2 : null; };
    let fonteTema = null;
    if (/w:asciiTheme="minor/.test(dd + normal) && zip.file('word/theme/theme1.xml')) {
      const th = await zip.file('word/theme/theme1.xml').async('string');
      const mm = th.match(/<a:minorFont>\s*<a:latin typeface="([^"]+)"/);
      if (mm) fonteTema = mm[1];
    }
    info.fonte = pegaFonte(normal) || pegaFonte(dd) || fonteTema || info.fonte;
    info.tamanhoPt = pegaSz(normal) || pegaSz(dd) || info.tamanhoPt;
    const reAuto = /<w:spacing\b([^>]*?)\sw:line="(\d+)"([^>]*?)\/>/g;
    function converte(bloco, fonteBase, szBase) {
      return bloco.replace(reAuto, function (todo, a, linha, b) {
        const resto = a + ' ' + b;
        const regra = (resto.match(/w:lineRule="(\w+)"/) || [])[1];
        if (regra && regra !== 'auto') return todo;
        const fonte = pegaFonte(bloco) || fonteBase;
        const sz = pegaSz(bloco) || szBase;
        const twips = Math.round(Number(linha) / 240 * razaoNatural(fonte) * sz * 20);
        const limpo = (a + b).replace(/\sw:lineRule="\w+"/, '');
        return '<w:spacing' + limpo + ' w:line="' + twips + '" w:lineRule="exact"/>';
      });
    }
    doc = doc.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, function (p) { return converte(p, info.fonte, info.tamanhoPt); });
    // espaçamento entre caracteres (w:spacing dentro de w:rPr): o docx-preview ignora; marcamos o texto e aplicamos depois
    doc = doc.replace(/<w:r(?: [^>]*)?>\s*<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<w:spacing w:val="(-?\d+)"\s*\/>[\s\S]*?<\/w:r>/g, function (run, val) {
      return run.replace(/(<w:t(?: [^>]*)?>)/, '$1\uE000' + val + '\uE001');
    });
    zip.file('word/document.xml', doc);
    if (estilos) {
      estilos = estilos.replace(/<w:style [\s\S]*?<\/w:style>/g, function (st) { return converte(st, info.fonte, info.tamanhoPt); });
      estilos = estilos.replace(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/, function (x) { return converte(x, info.fonte, info.tamanhoPt); });
      zip.file('word/styles.xml', estilos);
    }
    const novo = await zip.generateAsync({ type: 'blob', mimeType: blob.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return { blob: novo, info: info };
  }
  async function montarPaginas(blobOriginal, imgs, perfil) {
    const prep = await prepararParaPrevia(blobOriginal);
    const blob = prep.blob;
    urlsPrevia.forEach(function (u) { URL.revokeObjectURL(u); });
    urlsPrevia = [];
    const med = $('#medidor');
    med.innerHTML = '';
    // o docx-preview só serve para converter o corpo do texto em HTML; a paginação e a identidade são desenhadas aqui
    await docx.renderAsync(blob, med, null, {
      className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true,
      useBase64URL: true, renderHeaders: false, renderFooters: false, renderFootnotes: true, renderEndnotes: true
    });
    nosDeTexto(med).forEach(function (n) {
      const m = n.nodeValue.match(/\uE000(-?\d+)\uE001/);
      if (!m) return;
      n.nodeValue = n.nodeValue.replace(/\uE000-?\d+\uE001/g, '');
      if (n.parentElement) n.parentElement.style.letterSpacing = (Number(m[1]) / 20) + 'pt';
    });
    const secoes = Array.prototype.slice.call(med.querySelectorAll('section.docx'));
    const alvo = $('#paginas');
    alvo.innerHTML = ''; alvo.style.zoom = '1';
    const urlLogo = urlDe(imgs.logo);
    const urlMarca = imgs.marca ? urlDe(imgs.marca) : null;
    const cab = perfil.cabecalho, rod = perfil.rodape, wm = perfil.marcaDagua;
    let numero = 0;

    const lista = [];
    let secaoAtual = 0;
    function novaPagina(W, H, pad, aposDe) {
      numero += 1;
      const pg = criarEl('div', 'position:relative;box-sizing:border-box;background:#fff;box-shadow:0 1px 8px rgba(0,0,0,.25);margin:0 auto 20px;overflow:hidden;' +
        'width:' + W + 'px;min-height:' + H + 'px;padding:' + pad.t + 'px ' + pad.r + 'px ' + pad.b + 'px ' + pad.l + 'px;');
      pg.className = 'docx pagina';
      if (urlMarca) {
        const w = wm.larguraCm * PX_CM;
        const m = criarEl('img', 'position:absolute;z-index:0;pointer-events:none;width:' + w + 'px;height:auto;');
        m.src = urlMarca; m.alt = '';
        const pos = wm.posicao.split('-');
        if (wm.posicao === 'centro') { m.style.left = '50%'; m.style.top = '50%'; m.style.transform = 'translate(-50%,-50%)'; }
        else {
          m.style.bottom = pos[0] === 'inferior' ? '0' : 'auto'; m.style.top = pos[0] === 'superior' ? '0' : 'auto';
          m.style.right = pos[1] === 'direita' ? '0' : 'auto'; m.style.left = pos[1] === 'esquerda' ? '0' : 'auto';
        }
        pg.appendChild(m);
      }
      const topo = criarEl('div', 'position:absolute;z-index:1;top:' + (1.25 * PX_CM) + 'px;left:' + pad.l + 'px;right:' + pad.r + 'px;' +
        'padding-bottom:6pt;' + (cab.filete ? 'border-bottom:.75pt solid #' + cab.corFilete + ';' : ''));
      const li = criarEl('img', 'display:block;height:auto;width:' + (cab.logoLarguraCm * PX_CM) + 'px;' +
        'margin:' + (cab.alinhamento === 'center' ? '0 auto' : cab.alinhamento === 'right' ? '0 0 0 auto' : '0') + ';');
      li.src = urlLogo; li.alt = '';
      topo.appendChild(li);
      pg.appendChild(topo);
      const base = criarEl('div', 'position:absolute;z-index:1;bottom:' + (1.25 * PX_CM) + 'px;left:' + pad.l + 'px;right:' + pad.r + 'px;' +
        'display:flex;justify-content:space-between;gap:12px;padding-top:6pt;font:' + rod.tamanhoPt + 'pt ' + rod.fonte + ',Georgia,serif;color:#' + rod.cor + ';' +
        (rod.filete ? 'border-top:.75pt solid #' + rod.corFilete + ';' : ''));
      const t = criarEl('span'); t.textContent = rod.texto; base.appendChild(t);
      if (rod.numeroPagina) { const n = criarEl('span'); n.className = 'num'; n.textContent = String(numero); base.appendChild(n); }
      pg.appendChild(base);
      const cont = criarEl('div', 'position:relative;z-index:1;display:flow-root;color:#000;line-height:normal;font-family:"' + prep.info.fonte + '","Times New Roman",serif;font-size:' + prep.info.tamanhoPt + 'pt;');
      pg.appendChild(cont);
      const obj = { pg: pg, cont: cont, limite: H - pad.t - pad.b, secao: secaoAtual, W: W, H: H, pad: pad };
      if (aposDe) {
        alvo.insertBefore(pg, aposDe.pg.nextSibling);
        lista.splice(lista.indexOf(aposDe) + 1, 0, obj);
      } else { alvo.appendChild(pg); lista.push(obj); }
      return obj;
    }

    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* segue */ } }
    secoes.forEach(function (sec, idxSecao) {
      secaoAtual = idxSecao;
      const cs = getComputedStyle(sec);
      const W = sec.getBoundingClientRect().width || parseFloat(cs.width);
      const H = parseFloat(cs.minHeight) || parseFloat(cs.height) || 1123;
      const pad = { t: parseFloat(cs.paddingTop), r: parseFloat(cs.paddingRight), b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft) };
      const artigo = sec.querySelector('article');
      if (!artigo) return;
      let atual = novaPagina(W, H, pad);
      Array.prototype.slice.call(artigo.children).forEach(function (filho) {
        let resto = filho;
        let recem = atual.cont.children.length === 0;
        let guarda = 0;
        while (resto && guarda++ < 200) {
          atual.cont.appendChild(resto);
          if (!estoura(atual)) break;
          atual.cont.removeChild(resto);
          // parágrafo longo: divide linha a linha, como o Word (com controle de linha viúva/órfã)
          const partes = dividirParagrafo(atual, resto);
          if (partes) {
            atual.cont.appendChild(partes[0]);
            resto = partes[1];
            atual = novaPagina(W, H, pad);
            recem = true;
            continue;
          }
          if (recem || atual.cont.children.length === 0) { atual.cont.appendChild(resto); break; }
          const novo = novaPagina(W, H, pad);
          // título não fica sozinho no pé da página: vai junto com o parágrafo seguinte
          const anterior = atual.cont.lastElementChild;
          if (anterior && atual.cont.children.length > 1 && ehTitulo(anterior)) novo.cont.appendChild(anterior);
          atual = novo;
          recem = true;
        }
      });
    });
    // conferência final: se algo ainda passar do limite (a tipografia pode mudar após a medição), empurra para a página seguinte
    for (let i = 0; i < lista.length; i++) {
      let guarda = 0;
      while (estoura(lista[i]) && lista[i].cont.children.length > 1 && guarda++ < 500) {
        let prox = lista[i + 1];
        if (!prox || prox.secao !== lista[i].secao) prox = novaPagina(lista[i].W, lista[i].H, lista[i].pad, lista[i]);
        const ultimo = lista[i].cont.lastElementChild;
        prox.cont.insertBefore(ultimo, prox.cont.firstChild);
        const ant = lista[i].cont.lastElementChild;
        if (ant && lista[i].cont.children.length > 1 && ehTitulo(ant)) prox.cont.insertBefore(ant, prox.cont.firstChild);
      }
    }
    lista.forEach(function (pg, i) { const n = pg.pg.querySelector('.num'); if (n) n.textContent = String(i + 1); });
    ajustarEscala();
    // remove só o invólucro vazio; as folhas de estilo do documento ficam, pois as páginas dependem delas
    Array.prototype.forEach.call(med.querySelectorAll('.docx-wrapper'), function (w) { w.remove(); });
  }
  /* ---------- divisão de parágrafo entre páginas ---------- */
  function nosDeTexto(raiz) {
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null);
    const out = []; let n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function cortarEm(p, nos, k) {
    // localiza o nó/posição do caractere k e devolve duas cópias do parágrafo (antes / depois)
    let acc = 0, alvoNo = null, off = 0;
    for (let i = 0; i < nos.length; i++) {
      const len = nos[i].nodeValue.length;
      if (k <= acc + len) { alvoNo = nos[i]; off = k - acc; break; }
      acc += len;
    }
    if (!alvoNo) return null;
    const r1 = document.createRange(); r1.setStart(p, 0); r1.setEnd(alvoNo, off);
    const r2 = document.createRange(); r2.setStart(alvoNo, off); r2.setEnd(p, p.childNodes.length);
    const p1 = p.cloneNode(false), p2 = p.cloneNode(false);
    p1.appendChild(r1.cloneContents()); p2.appendChild(r2.cloneContents());
    p1.removeAttribute('id'); p2.removeAttribute('id');
    p1.style.marginBottom = '0';
    p2.style.marginTop = '0'; p2.style.textIndent = '0';
    if (getComputedStyle(p).textAlign === 'justify') p1.style.textAlignLast = 'justify';
    return [p1, p2];
  }
  function alturaLinhaPx(el) {
    const cs = getComputedStyle(el);
    let lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh)) lh = parseFloat(cs.fontSize) * 1.2;
    return lh || 20;
  }
  function numLinhas(el, lh) {
    return Math.round(el.getBoundingClientRect().height / (Number($('#paginas').style.zoom) || 1) / lh);
  }
  function dividirParagrafo(pg, p) {
    if (p.tagName !== 'P') return null;
    if (p.querySelector('img,svg,table,canvas,object,br')) return null;
    const nos = nosDeTexto(p);
    const texto = nos.map(function (n) { return n.nodeValue; }).join('');
    if (texto.length < 60) return null;
    const cont = pg.cont;
    const lh = alturaLinhaPx(p);
    // maior k para o qual o predicado vale (monótono)
    function maiorK(pred) {
      let lo = 0, hi = texto.length - 1;
      while (lo < hi) {
        const meio = Math.ceil((lo + hi) / 2);
        if (pred(meio)) lo = meio; else hi = meio - 1;
      }
      return lo;
    }
    function ajustaPalavra(k) {
      if (k <= 0) return 0;
      if (texto[k] === ' ' || texto[k - 1] === ' ') return k;
      const i = texto.lastIndexOf(' ', k);
      return i < 0 ? 0 : i + 1;
    }
    function cabe(k, maxLinhas) {
      const par = cortarEm(p, nos, k); if (!par) return false;
      cont.appendChild(par[0]);
      const ok = !estoura(pg) && (maxLinhas == null || numLinhas(par[0], lh) <= maxLinhas);
      cont.removeChild(par[0]);
      return ok;
    }
    let k = ajustaPalavra(maiorK(function (x) { return cabe(x); }));
    if (k <= 0) return null;
    function medir(kk) {
      const par = cortarEm(p, nos, kk); if (!par) return null;
      cont.appendChild(par[0]);
      const l1 = numLinhas(par[0], lh);
      cont.removeChild(par[0]);
      cont.appendChild(par[1]);
      const l2 = numLinhas(par[1], lh);
      cont.removeChild(par[1]);
      return { par: par, l1: l1, l2: l2 };
    }
    let m = medir(k);
    if (!m) return null;
    // órfã: ao menos 2 linhas no pé da página
    if (m.l1 < 2) return null;
    // viúva: ao menos 2 linhas na página seguinte
    if (m.l2 < 2 && k < texto.length) {
      const alvoLinhas = m.l1 - 1;
      if (alvoLinhas < 2) return null;
      k = ajustaPalavra(maiorK(function (x) { return cabe(x, alvoLinhas); }));
      if (k <= 0) return null;
      m = medir(k);
      if (!m || m.l1 < 2 || m.l2 < 2) return null;
    }
    // reconstrói as partes definitivas (o texto da 2ª parte não começa com espaço)
    const par = m.par;
    const ns = nosDeTexto(par[1]);
    if (ns.length) ns[0].nodeValue = ns[0].nodeValue.replace(/^\s+/, '');
    return par;
  }
  // Word/LibreOffice colocam a entrelinha extra acima do texto: a última linha da página só precisa caber na altura natural da fonte
  function folgaUltimaLinha(pg) {
    const ult = pg.cont.lastElementChild;
    if (!ult) return 0;
    const cs = getComputedStyle(ult);
    const lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
    if (!isFinite(lh) || !isFinite(fs)) return 0;
    const fonte = (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim() || 'Times New Roman';
    return Math.max(0, lh - fs * razaoNatural(fonte));
  }
  function estoura(pg) { return pg.cont.offsetHeight > pg.limite + 1 + folgaUltimaLinha(pg); }
  function ehTitulo(el) {
    if (!el || el.tagName !== 'P') return false;
    const txt = (el.textContent || '').trim();
    if (!txt || txt.length > 140) return false;
    const spans = el.querySelectorAll('span');
    const alvo = spans.length ? spans[0] : el;
    const peso = getComputedStyle(alvo).fontWeight;
    return peso === 'bold' || parseInt(peso, 10) >= 600;
  }
  function ajustarEscala() {
    const caixa = document.querySelector('.previa-caixa'), alvo = $('#paginas');
    const p = alvo.firstElementChild;
    if (!p) return;
    const disponivel = caixa.clientWidth - 24;
    const w = p.getBoundingClientRect().width / (Number(alvo.style.zoom) || 1);
    alvo.style.zoom = w > disponivel && disponivel > 0 ? String(disponivel / w) : '1';
  }
  window.addEventListener('resize', function () { if (!$('#previa').hidden) ajustarEscala(); });

  function baixarPdf() {
    const paginas = Array.prototype.slice.call(document.querySelectorAll('#paginas .pagina'));
    if (!paginas.length) return;
    const W = paginas[0].getBoundingClientRect().width / (Number($('#paginas').style.zoom) || 1);
    const H = parseFloat(paginas[0].style.minHeight);
    let estilo = document.getElementById('estiloPagina');
    if (!estilo) { estilo = document.createElement('style'); estilo.id = 'estiloPagina'; document.head.appendChild(estilo); }
    estilo.textContent = '@page { size: ' + W.toFixed(2) + 'px ' + H.toFixed(2) + 'px; margin: 0; }';
    // altura fixa (2px a menos) para o arredondamento não empurrar uma página em branco
    paginas.forEach(function (p) { p.style.height = (H - 2) + 'px'; });
    const tituloOriginal = document.title;
    document.title = estado.nomeBase + ' - ' + slug(estado.perfil.nome);
    const restaurar = function () {
      paginas.forEach(function (p) { p.style.height = ''; });
      document.title = tituloOriginal;
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    window.print();
  }
  function baixarDocx() {
    if (estado.blob) baixar(estado.blob, estado.nomeBase + ' - ' + slug(estado.perfil.nome) + '.docx');
  }
  /* ---------- eventos ---------- */
  function ligar() {
    $('#selPerfil').addEventListener('change', function (e) { escolher(e.target.value); });
    $('#fOpac').addEventListener('input', function (e) { $('#fOpacVal').textContent = e.target.value; });
    $('#fLogo').addEventListener('change', async function (e) {
      const arq = e.target.files[0];
      if (!arq) return;
      try { estado.perfil.logoData = await arquivoParaDataUrl(arq); estado.perfil.logoUrl = null; msg('Logo carregado. Clique em "Usar esta identidade".', 'ok'); }
      catch (err) { msg(err.message, 'erro'); }
    });
    $('#btnAplicarId').addEventListener('click', usarIdentidade);
    $('#btnSalvarNav').addEventListener('click', salvarNoNavegador);
    $('#btnExportar').addEventListener('click', exportarIdentidade);
    $('#btnImportar').addEventListener('click', function () { $('#fImportar').click(); });
    $('#fImportar').addEventListener('change', function (e) { importarIdentidade(e.target.files[0]); e.target.value = ''; });
    const zona = $('#zona'), input = $('#fArquivo');
    zona.addEventListener('click', function () { input.click(); });
    zona.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function (e) { receberArquivo(e.target.files[0]); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('sobre'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('sobre'); }); });
    zona.addEventListener('drop', function (e) { receberArquivo(e.dataTransfer.files[0]); });
    $('#btnDocx').addEventListener('click', baixarDocx);
    $('#btnPdf').addEventListener('click', baixarPdf);
  }

  async function iniciar() {
    ligar();
    estado.salvos = lerSalvos();
    await carregarCatalogo();
    const pedido = new URLSearchParams(location.search).get('perfil');
    let inicial = estado.catalogo.length ? 'cat:' + estado.catalogo[0].id : (estado.salvos.length ? 'loc:0' : 'novo');
    if (pedido && estado.catalogo.some(function (e) { return e.id === pedido; })) inicial = 'cat:' + pedido;
    montarSeletor(inicial);
    if (!estado.catalogo.length && location.protocol === 'file:') {
      msg('Abra esta página pelo endereço publicado (https) ou por um servidor local para carregar as identidades do site.', 'erro');
    }
    await escolher(inicial);
  }
  iniciar();
})();
