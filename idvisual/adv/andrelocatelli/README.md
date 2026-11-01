# Identidade visual para petições (`/idvisual/adv/andrelocatelli`)

Página única que aplica a identidade visual de um escritório (logo no cabeçalho, marca d'água ao fundo, filetes e rodapé com numeração) a uma minuta em Word e devolve o `.docx` pronto.

Tudo roda no navegador. O documento **não é enviado a nenhum servidor**. Não há backend, build nem dependência externa: as bibliotecas ficam em `vendor/`.

## Como usar

1. Abra a página e confira o escritório selecionado (por padrão, André Locatelli).
2. Arraste o `.docx` para a área de envio.
3. Baixe o Word com a identidade aplicada.

Link direto para outro escritório do catálogo: `?perfil=<id>`.

## PDF

A página não gera PDF: um PDF fiel precisa de um motor de layout (o do Word ou do LibreOffice) e a alternativa é enviar a petição a um servidor. Abra o `.docx` baixado e use **Arquivo → Salvar como → PDF**; a paginação sai idêntica à do Word.

## .doc e LibreOffice (.odt)

Ainda não são lidos direto no navegador. Salve como `.docx` no Word/LibreOffice (leva segundos) e envie o `.docx`. A página reconhece o formato e orienta quando recebe um desses arquivos.

## Identidades de outros escritórios

**Pela página:** `Criar ou ajustar identidade` → envie o logo, ajuste rodapé, marca d'água e margens → `Usar esta identidade`. Em `Salvar neste navegador` ela fica na lista; `Exportar identidade (.json)` gera um arquivo portátil (logo embutido) que outra pessoa carrega em `Importar identidade`.

**Para todos verem na lista do site (catálogo):**

1. Exporte o `.json` pela página.
2. Salve-o como `perfis/<id>/perfil.json`.
3. Acrescente uma linha em `perfis/index.json`:

```json
{ "id": "<id>", "nome": "Nome do escritório", "caminho": "<id>/perfil.json" }
```

Se preferir manter o logo como arquivo, use `"logo": "logo.png"` no `perfil.json` e coloque o `logo.png` na mesma pasta (veja `perfis/andrelocatelli/`).

Atenção: tudo que está em `perfis/` fica visível a quem acessar o site (logo, endereço, OAB). Em repositório público, isso é público.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Interface |
| `app.js` | Fluxo: escolher identidade, receber arquivo, baixar |
| `engine.js` | Motor: injeta cabeçalho, marca d'água e rodapé no `.docx` |
| `perfis/` | Catálogo de identidades (`index.json` + uma pasta por escritório) |
| `vendor/` | JSZip 3.10.1 e docx-preview 0.3.5 (locais, sem CDN) |

## O que o motor faz no `.docx`

- Substitui qualquer cabeçalho/rodapé existente (e remove as imagens antigas deles do pacote).
- Aplica em todas as seções e em todas as páginas (inclusive a primeira).
- Ajusta as margens ao perfil (opcional, desligável na página).
- Não altera o texto, estilos, tabelas ou imagens do corpo.
