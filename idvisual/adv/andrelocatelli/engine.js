/*
 * Motor da identidade visual: aplica cabeçalho (logo), marca d'água e rodapé a um .docx.
 * Roda 100% no navegador: o documento nunca é enviado a nenhum servidor.
 * Depende de JSZip (vendor/jszip.min.js).
 */
(function (global) {
  'use strict';

  const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const CT_HDR = 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml';
  const CT_FTR = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml';
  const EMU_CM = 360000;
  const TWIP_CM = 566.929;
  const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

  const PADRAO = {
    nome: 'Nova identidade',
    logo: null, logoUrl: null, logoData: null,
    removerFundoBranco: false,
    cabecalho: { logoLarguraCm: 1.1, alinhamento: 'center', filete: true, corFilete: 'C6A253' },
    rodape: { texto: '', cor: '5B5B58', fonte: 'Cambria', tamanhoPt: 8, numeroPagina: true, filete: true, corFilete: 'C6A253' },
    marcaDagua: { ativa: true, opacidade: 0.08, larguraCm: 11.2, posicao: 'inferior-direita' },
    margensCm: { topo: 4, inferior: 3, esquerda: 3, direita: 2 },
    aplicarMargens: true,
    assinatura: { ativa: false, nome: '', titulo: 'ADVOGADO', oab: '', corTitulo: 'C6A253' }
  };

  function mesclar(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(extra || {}).forEach(function (k) {
      const v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') out[k] = mesclar(base[k], v);
      else if (v !== undefined) out[k] = v;
    });
    return out;
  }
  function normalizarPerfil(p) {
    const perfil = mesclar(PADRAO, p || {});
    ['corFilete'].forEach(function (k) { perfil.cabecalho[k] = hex(perfil.cabecalho[k], 'C6A253'); });
    perfil.rodape.corFilete = hex(perfil.rodape.corFilete, 'C6A253');
    perfil.rodape.cor = hex(perfil.rodape.cor, '5B5B58');
    perfil.assinatura.corTitulo = hex(perfil.assinatura.corTitulo, 'C6A253');
    perfil.rodape.tamanhoPt = Math.min(14, Math.max(5, Number(perfil.rodape.tamanhoPt) || 8));
    perfil.cabecalho.logoLarguraCm = Math.min(8, Math.max(0.3, Number(perfil.cabecalho.logoLarguraCm) || 1.1));
    perfil.marcaDagua.opacidade = Math.min(0.6, Math.max(0.01, Number(perfil.marcaDagua.opacidade) || 0.08));
    perfil.marcaDagua.larguraCm = Math.min(21, Math.max(2, Number(perfil.marcaDagua.larguraCm) || 11.2));
    return perfil;
  }
  function hex(v, padrao) {
    v = String(v || '').replace('#', '').trim();
    return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : padrao;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- imagens ---------- */
  function carregarImagem(src) {
    return new Promise(function (ok, erro) {
      const img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { erro(new Error('Não consegui abrir a imagem do logo.')); };
      img.src = src;
    });
  }
  function desenhar(img, larguraMax, removerFundo, opacidade) {
    const nw = img.naturalWidth || img.width || 800;
    const nh = img.naturalHeight || img.height || 800;
    const w = Math.min(nw, larguraMax);
    const h = Math.max(1, Math.round(w * nh / nw));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    if (removerFundo || opacidade < 1) {
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      let amax = 1;
      if (removerFundo) {
        for (let i = 0; i < px.length; i += 4) {
          const a = (255 - Math.min(px[i], px[i + 1], px[i + 2])) * (px[i + 3] / 255);
          if (a > amax) amax = a;
        }
      }
      for (let i = 0; i < px.length; i += 4) {
        let a = px[i + 3];
        if (removerFundo) {
          const m = Math.min(px[i], px[i + 1], px[i + 2]);
          const aN = Math.min(255, ((255 - m) * 255) / amax) * (px[i + 3] / 255);
          if (aN > 0) {
            for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, ((px[i + c] - 255 + aN) * 255) / aN));
          }
          a = aN;
        }
        px[i + 3] = Math.round(a * opacidade);
      }
      ctx.putImageData(data, 0, 0);
    }
    return { canvas: canvas, ratio: h / w };
  }
  function canvasParaBytes(canvas) {
    return new Promise(function (ok, erro) {
      canvas.toBlob(function (b) {
        if (!b) return erro(new Error('Falha ao preparar a imagem.'));
        b.arrayBuffer().then(function (ab) { ok(new Uint8Array(ab)); });
      }, 'image/png');
    });
  }
  async function prepararImagens(perfilEntrada) {
    const perfil = normalizarPerfil(perfilEntrada);
    const src = perfil.logoData || perfil.logoUrl;
    if (!src) throw new Error('Esta identidade ainda não tem logo. Envie um arquivo de imagem.');
    const img = await carregarImagem(src);
    const logo = desenhar(img, 700, perfil.removerFundoBranco, 1);
    const out = { logo: await canvasParaBytes(logo.canvas), logoRatio: logo.ratio, marca: null, marcaRatio: 1 };
    if (perfil.marcaDagua.ativa) {
      const wm = desenhar(img, 900, perfil.removerFundoBranco, perfil.marcaDagua.opacidade);
      out.marca = await canvasParaBytes(wm.canvas);
      out.marcaRatio = wm.ratio;
    }
    return out;
  }

  /* ---------- XML de cabeçalho e rodapé ---------- */
  const ROOT_NS = 'xmlns:w="' + NS_W + '" xmlns:r="' + NS_R + '"' +
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

  function grafico(rId, cx, cy, id, nome) {
    return '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic><pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + nome + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>';
  }
  function xmlCabecalho(p, imgs, pagina) {
    const cab = p.cabecalho;
    const cx = Math.round(cab.logoLarguraCm * EMU_CM);
    const cy = Math.round(cx * imgs.logoRatio);
    const jc = { left: 'left', right: 'right', center: 'center' }[cab.alinhamento] || 'center';
    const logoP =
      '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="' + jc + '"/></w:pPr>' +
      '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
      '<wp:docPr id="9101" name="Logo da identidade"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      grafico('rIdIdvLogo', cx, cy, 9101, 'logo.png') + '</wp:inline></w:drawing></w:r></w:p>';

    let ancora = '';
    if (imgs.marca) {
      const wcx = Math.round(p.marcaDagua.larguraCm * EMU_CM);
      const wcy = Math.round(wcx * imgs.marcaRatio);
      // coordenadas absolutas a partir do tamanho real da página (mais confiável que "alinhar" entre Word e LibreOffice)
      const pgW = (pagina && pagina.largura ? pagina.largura : 11906) * 635;
      const pgH = (pagina && pagina.altura ? pagina.altura : 16838) * 635;
      const posX = { esquerda: 0, direita: pgW - wcx, centro: Math.round((pgW - wcx) / 2) };
      const posY = { superior: 0, inferior: pgH - wcy, centro: Math.round((pgH - wcy) / 2) };
      const chave = p.marcaDagua.posicao === 'centro' ? ['centro', 'centro'] : p.marcaDagua.posicao.split('-').map(function (s, i) { return s; });
      const offY = Math.max(0, posY[chave[0]] !== undefined ? posY[chave[0]] : posY.inferior);
      const offX = Math.max(0, posX[chave[1]] !== undefined ? posX[chave[1]] : posX.direita);
      ancora =
        '<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251650048" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">' +
        '<wp:simplePos x="0" y="0"/>' +
        '<wp:positionH relativeFrom="page"><wp:posOffset>' + Math.round(offX) + '</wp:posOffset></wp:positionH>' +
        '<wp:positionV relativeFrom="page"><wp:posOffset>' + Math.round(offY) + '</wp:posOffset></wp:positionV>' +
        '<wp:extent cx="' + wcx + '" cy="' + wcy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>' +
        '<wp:docPr id="9102" name="Marca dagua da identidade"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
        grafico('rIdIdvMarca', wcx, wcy, 9102, 'marca.png') + '</wp:anchor></w:drawing></w:r>';
    }
    const borda = cab.filete
      ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="' + cab.corFilete + '"/></w:pBdr>' : '';
    const miudo = '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>';
    const regraP =
      '<w:p><w:pPr>' + borda + '<w:spacing w:before="80" w:after="0" w:line="240" w:lineRule="auto"/>' + miudo + '</w:pPr>' +
      ancora + '<w:r>' + miudo + '<w:t xml:space="preserve"></w:t></w:r></w:p>';
    return XML_DECL + '<w:hdr ' + ROOT_NS + '>' + logoP + regraP + '</w:hdr>';
  }
  function xmlRodape(p, larguraTextoTwips) {
    const r = p.rodape;
    const borda = r.filete ? '<w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="' + r.corFilete + '"/></w:pBdr>' : '';
    const sz = Math.round(r.tamanhoPt * 2);
    const rpr = '<w:rPr><w:rFonts w:ascii="' + esc(r.fonte) + '" w:hAnsi="' + esc(r.fonte) + '" w:cs="' + esc(r.fonte) + '"/>' +
      '<w:color w:val="' + r.cor + '"/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr>';
    let runs = '';
    if (r.texto) runs += '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(r.texto) + '</w:t></w:r>';
    if (r.numeroPagina) {
      runs += '<w:r>' + rpr + '<w:tab/></w:r>' +
        '<w:fldSimple w:instr=" PAGE ">' + '<w:r>' + rpr + '<w:t>1</w:t></w:r></w:fldSimple>';
    }
    const tabs = r.numeroPagina ? '<w:tabs><w:tab w:val="right" w:pos="' + larguraTextoTwips + '"/></w:tabs>' : '';
    return XML_DECL + '<w:ftr ' + ROOT_NS + '><w:p><w:pPr>' + borda + tabs +
      '<w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>' + rpr + '</w:pPr>' + runs + '</w:p></w:ftr>';
  }

  /* ---------- pacote .docx ---------- */
  function lerXml(texto, nome) {
    const doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo parece corrompido (' + nome + ').');
    return doc;
  }
  function gravarXml(zip, caminho, doc) {
    zip.file(caminho, XML_DECL + new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, ''));
  }
  function alvoParaCaminho(alvo) {
    return alvo.charAt(0) === '/' ? alvo.slice(1) : 'word/' + alvo.replace(/^\.\//, '');
  }
  // resolve o destino de um relacionamento a partir da pasta da parte de origem (ex.: "word/")
  function resolverAlvo(dirBase, alvo) {
    if (alvo.charAt(0) === '/') return alvo.slice(1);
    const partes = (dirBase + alvo).split('/');
    const out = [];
    partes.forEach(function (s) { if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s); });
    return out.join('/');
  }

  async function detectarFormato(arrayBuffer) {
    const b = new Uint8Array(arrayBuffer.slice(0, 8));
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return 'doc';
    if (b[0] === 0x7B && b[1] === 0x5C && b[2] === 0x72 && b[3] === 0x74) return 'rtf';
    if (b[0] === 0x50 && b[1] === 0x4B) {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        if (zip.file('word/document.xml')) return 'docx';
        if (zip.file('content.xml')) return 'odt';
      } catch (e) { /* cai em desconhecido */ }
    }
    return 'desconhecido';
  }

  /* ---------- assinatura padronizada ---------- */
  function textoDe(par) {
    let t = '';
    (function walk(n) {
      for (let c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        if (c.namespaceURI === NS_W && c.localName === 't') t += c.textContent;
        else if (c.namespaceURI === NS_W && (c.localName === 'br' || c.localName === 'cr')) t += '\n';
        else if (c.namespaceURI === NS_W && c.localName === 'tab') t += ' ';
        else walk(c);
      }
    })(par);
    return t;
  }
  const RE_OAB = /OAB\s*[\/\-]?\s*[A-Z]{2}\b[^\n]*\d/i;
  function ehLinha(par, t) {
    if (/^[\s_\-\u2013\u2014.=\u2500]{5,}$/.test(t)) return true;
    if (t.trim() === '') {
      return !!par.getElementsByTagNameNS(NS_W, 'pBdr').length;
    }
    return false;
  }
  function padronizarAssinatura(doc, body, p) {
    const a = p.assinatura;
    if (!a.ativa || !a.nome) return 'desligada';
    const pars = Array.prototype.filter.call(body.childNodes, function (n) { return n.nodeType === 1 && n.namespaceURI === NS_W && n.localName === 'p'; });
    const limite = Math.max(0, pars.length - 14);
    let iOab = -1;
    for (let i = pars.length - 1; i >= limite; i--) {
      const t = textoDe(pars[i]).trim();
      if (t && t.length <= 90 && RE_OAB.test(t) && !/[a-zà-ú]{4,}\s+[a-zà-ú]{3,}\s+[a-zà-ú]{3,}\s+[a-zà-ú]{3,}/.test(t)) { iOab = i; break; }
    }
    if (iOab < 0) return 'nao-encontrada';
    let ini = iOab;
    const tOab = textoDe(pars[iOab]).trim();
    if (tOab.indexOf('\n') < 0) {
      // parágrafos acima: título (ADVOGADO ou traços), nome, linha
      let k = iOab - 1;
      const pula = function () { return k >= 0 && textoDe(pars[k]).trim() === '' && !pars[k].getElementsByTagNameNS(NS_W, 'pBdr').length; };
      let guarda = 0;
      while (k >= 0 && guarda++ < 4) {
        const t = textoDe(pars[k]).trim();
        if (ehLinha(pars[k], t)) { ini = k; k--; continue; }
        if (/^[\u2014\u2013\-\s]*advogad[oa][\u2014\u2013\-\s]*$/i.test(t)) { ini = k; k--; continue; }
        if (t && t.length <= 60 && !/[.,:;]$/.test(t) && !/\d/.test(t) && !RE_OAB.test(t)) { ini = k; k--; continue; }
        break;
      }
    }
    const NSDECL = ' xmlns:w="' + NS_W + '"';
    const rf = '<w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman"/>';
    const par = function (before, runs) {
      return '<w:p' + NSDECL + '><w:pPr><w:keepNext/><w:spacing w:before="' + before + '" w:after="0"/><w:jc w:val="center"/></w:pPr>' + runs + '</w:p>';
    };
    const run = function (txt, rpr) { return '<w:r><w:rPr>' + rf + rpr + '</w:rPr><w:t xml:space="preserve">' + esc(txt) + '</w:t></w:r>'; };
    const ouro = '<w:color w:val="' + a.corTitulo + '"/><w:spacing w:val="70"/><w:sz w:val="18"/><w:szCs w:val="18"/>';
    let xml = par(720, run(a.nome, '<w:b/><w:bCs/><w:color w:val="262624"/><w:spacing w:val="30"/><w:sz w:val="24"/><w:szCs w:val="24"/>'));
    if (a.titulo) {
      xml += par(0, run('\u2014\u2014\u2014', '<w:strike/>' + ouro) + run('  ', ouro) + run(a.titulo + '  ', ouro) + run('\u2014\u2014\u2014', '<w:strike/>' + ouro));
    }
    if (a.oab) xml += par(0, run(a.oab, '<w:color w:val="5B5B58"/><w:spacing w:val="20"/><w:sz w:val="22"/><w:szCs w:val="22"/>'));
    const frag = new DOMParser().parseFromString('<root' + NSDECL + '>' + xml.replace(/ xmlns:w="[^"]+"/g, '') + '</root>', 'application/xml');
    if (frag.getElementsByTagName('parsererror').length) return 'nao-encontrada';
    const ref = pars[iOab].nextSibling;
    for (let i = ini; i <= iOab; i++) body.removeChild(pars[i]);
    Array.prototype.slice.call(frag.documentElement.childNodes).forEach(function (n) {
      body.insertBefore(doc.importNode(n, true), ref);
    });
    return 'padronizada';
  }

  async function aplicarIdentidade(arrayBuffer, perfilEntrada, imgs) {
    const p = normalizarPerfil(perfilEntrada);
    const zip = await JSZip.loadAsync(arrayBuffer);
    const arqDoc = zip.file('word/document.xml');
    if (!arqDoc) throw new Error('Este arquivo não é um .docx válido.');

    // 1) seções: remove cabeçalhos/rodapés antigos e aponta para os novos
    const doc = lerXml(await arqDoc.async('string'), 'document.xml');
    const body = doc.getElementsByTagNameNS(NS_W, 'body')[0];
    if (!body) throw new Error('Documento sem corpo de texto.');
    let sects = Array.prototype.filter.call(doc.getElementsByTagNameNS(NS_W, 'sectPr'),
      function (s) { return !(s.parentNode && s.parentNode.localName === 'sectPrChange'); });
    if (!sects.length) {
      const s = doc.createElementNS(NS_W, 'w:sectPr');
      body.appendChild(s);
      sects = [s];
    }
    const cm = p.margensCm;
    let larguraTexto = null;
    const pagina = { largura: 0, altura: 0 };
    sects.forEach(function (sect) {
      Array.prototype.slice.call(sect.childNodes).forEach(function (n) {
        if (n.nodeType === 1 && n.namespaceURI === NS_W &&
          (n.localName === 'headerReference' || n.localName === 'footerReference' || n.localName === 'titlePg')) sect.removeChild(n);
      });
      const f = doc.createElementNS(NS_W, 'w:footerReference');
      f.setAttributeNS(NS_W, 'w:type', 'default'); f.setAttributeNS(NS_R, 'r:id', 'rIdIdvFtr');
      const h = doc.createElementNS(NS_W, 'w:headerReference');
      h.setAttributeNS(NS_W, 'w:type', 'default'); h.setAttributeNS(NS_R, 'r:id', 'rIdIdvHdr');
      sect.insertBefore(f, sect.firstChild);
      sect.insertBefore(h, f);

      let mar = Array.prototype.find.call(sect.childNodes, function (n) { return n.localName === 'pgMar' && n.namespaceURI === NS_W; });
      if (p.aplicarMargens) {
        if (!mar) {
          mar = doc.createElementNS(NS_W, 'w:pgMar');
          const sz = Array.prototype.find.call(sect.childNodes, function (n) { return n.localName === 'pgSz' && n.namespaceURI === NS_W; });
          if (sz && sz.nextSibling) sect.insertBefore(mar, sz.nextSibling); else sect.appendChild(mar);
        }
        const t = function (v) { return String(Math.round(v * TWIP_CM)); };
        mar.setAttributeNS(NS_W, 'w:top', t(cm.topo)); mar.setAttributeNS(NS_W, 'w:bottom', t(cm.inferior));
        mar.setAttributeNS(NS_W, 'w:left', t(cm.esquerda)); mar.setAttributeNS(NS_W, 'w:right', t(cm.direita));
        mar.setAttributeNS(NS_W, 'w:header', '708'); mar.setAttributeNS(NS_W, 'w:footer', '708');
        if (!mar.getAttributeNS(NS_W, 'gutter')) mar.setAttributeNS(NS_W, 'w:gutter', '0');
      }
      if (larguraTexto === null) {
        const sz = Array.prototype.find.call(sect.childNodes, function (n) { return n.localName === 'pgSz' && n.namespaceURI === NS_W; });
        const pw = sz ? parseInt(sz.getAttributeNS(NS_W, 'w'), 10) : 11906;
        pagina.largura = pw || 11906;
        pagina.altura = (sz && parseInt(sz.getAttributeNS(NS_W, 'h'), 10)) || 16838;
        const l = mar ? parseInt(mar.getAttributeNS(NS_W, 'left'), 10) : 1701;
        const r = mar ? parseInt(mar.getAttributeNS(NS_W, 'right'), 10) : 1134;
        larguraTexto = Math.max(1000, (pw || 11906) - (l || 0) - (r || 0));
      }
    });
    global.IDV.ultimaAssinatura = padronizarAssinatura(doc, body, p);
    gravarXml(zip, 'word/document.xml', doc);

    // 2) relacionamentos: descarta cabeçalhos/rodapés antigos, registra os novos
    const relPath = 'word/_rels/document.xml.rels';
    const relFile = zip.file(relPath);
    const rels = relFile ? lerXml(await relFile.async('string'), 'document.xml.rels')
      : lerXml('<Relationships xmlns="' + NS_PKG + '"/>', 'rels');
    const antigos = [];
    Array.prototype.slice.call(rels.getElementsByTagName('Relationship')).forEach(function (r) {
      const tipo = r.getAttribute('Type') || '';
      if (tipo === REL + 'header' || tipo === REL + 'footer') {
        antigos.push(alvoParaCaminho(r.getAttribute('Target')));
        r.parentNode.removeChild(r);
      }
    });
    const novoRel = function (id, tipo, alvo) {
      const r = rels.createElementNS(NS_PKG, 'Relationship');
      r.setAttribute('Id', id); r.setAttribute('Type', REL + tipo); r.setAttribute('Target', alvo);
      rels.documentElement.appendChild(r);
    };
    novoRel('rIdIdvHdr', 'header', 'header_idv.xml');
    novoRel('rIdIdvFtr', 'footer', 'footer_idv.xml');
    gravarXml(zip, relPath, rels);

    // 3) tipos de conteúdo
    const ctFile = zip.file('[Content_Types].xml');
    if (!ctFile) throw new Error('Arquivo .docx sem [Content_Types].xml.');
    const ct = lerXml(await ctFile.async('string'), '[Content_Types].xml');
    Array.prototype.slice.call(ct.getElementsByTagName('Override')).forEach(function (o) {
      const parte = (o.getAttribute('PartName') || '').replace(/^\//, '');
      if (antigos.indexOf(parte) >= 0) o.parentNode.removeChild(o);
    });
    if (!Array.prototype.some.call(ct.getElementsByTagName('Default'), function (d) { return (d.getAttribute('Extension') || '').toLowerCase() === 'png'; })) {
      const d = ct.createElementNS(NS_CT, 'Default');
      d.setAttribute('Extension', 'png'); d.setAttribute('ContentType', 'image/png');
      ct.documentElement.insertBefore(d, ct.documentElement.firstChild);
    }
    [['/word/header_idv.xml', CT_HDR], ['/word/footer_idv.xml', CT_FTR]].forEach(function (par) {
      const o = ct.createElementNS(NS_CT, 'Override');
      o.setAttribute('PartName', par[0]); o.setAttribute('ContentType', par[1]);
      ct.documentElement.appendChild(o);
    });
    gravarXml(zip, '[Content_Types].xml', ct);

    // 4) remove partes antigas (e as imagens que só elas usavam) e grava as novas
    const midiasAntigas = [];
    for (const caminho of antigos) {
      const relAntigo = zip.file(caminho.replace(/([^/]+)$/, '_rels/$1.rels'));
      if (relAntigo) {
        const x = lerXml(await relAntigo.async('string'), caminho + '.rels');
        Array.prototype.forEach.call(x.getElementsByTagName('Relationship'), function (r) {
          if (r.getAttribute('Type') === REL + 'image' && r.getAttribute('TargetMode') !== 'External') {
            midiasAntigas.push(resolverAlvo(caminho.replace(/[^/]+$/, ''), r.getAttribute('Target')));
          }
        });
      }
      zip.remove(caminho);
      zip.remove(caminho.replace(/([^/]+)$/, '_rels/$1.rels'));
    }
    if (midiasAntigas.length) {
      const emUso = {};
      for (const nome of Object.keys(zip.files)) {
        if (!/\.rels$/.test(nome)) continue;
        const dirParte = nome.replace(/_rels\/[^/]+$/, '');
        const x = lerXml(await zip.file(nome).async('string'), nome);
        Array.prototype.forEach.call(x.getElementsByTagName('Relationship'), function (r) {
          if (r.getAttribute('TargetMode') !== 'External') emUso[resolverAlvo(dirParte, r.getAttribute('Target'))] = true;
        });
      }
      midiasAntigas.forEach(function (m) { if (!emUso[m]) zip.remove(m); });
    }
    zip.file('word/header_idv.xml', xmlCabecalho(p, imgs, pagina));
    zip.file('word/footer_idv.xml', xmlRodape(p, larguraTexto));
    let relH = '<Relationships xmlns="' + NS_PKG + '"><Relationship Id="rIdIdvLogo" Type="' + REL + 'image" Target="media/idv_logo.png"/>';
    zip.file('word/media/idv_logo.png', imgs.logo);
    if (imgs.marca) {
      relH += '<Relationship Id="rIdIdvMarca" Type="' + REL + 'image" Target="media/idv_marca.png"/>';
      zip.file('word/media/idv_marca.png', imgs.marca);
    }
    zip.file('word/_rels/header_idv.xml.rels', XML_DECL + relH + '</Relationships>');

    // 5) configurações: sem "páginas pares/ímpares" diferentes
    const setFile = zip.file('word/settings.xml');
    if (setFile) {
      const s = await setFile.async('string');
      zip.file('word/settings.xml', s.replace(/<w:evenAndOddHeaders\b[^>]*\/>/g, ''));
    }

    return zip.generateAsync({
      type: 'blob', compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  global.IDV = {
    PADRAO: PADRAO, normalizarPerfil: normalizarPerfil, prepararImagens: prepararImagens,
    detectarFormato: detectarFormato, aplicarIdentidade: aplicarIdentidade
  };
})(window);
