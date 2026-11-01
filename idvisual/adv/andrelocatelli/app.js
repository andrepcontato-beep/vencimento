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
      const alvo = $('#paginas');
      alvo.innerHTML = '';
      await docx.renderAsync(estado.blob, alvo, null, {
        className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true,
        ignoreLastRenderedPageBreak: true, useBase64URL: true, renderHeaders: true, renderFooters: true,
        renderFootnotes: true, renderEndnotes: true
      });
      $('#previa').hidden = false;
      $('#previa').scrollIntoView({ behavior: 'smooth', block: 'start' });
      msg('Pronto. Baixe o Word com a identidade aplicada.', 'ok');
    } catch (e) {
      msg('Não consegui aplicar a identidade: ' + (e.message || e), 'erro');
    } finally { estado.ocupado = false; }
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
