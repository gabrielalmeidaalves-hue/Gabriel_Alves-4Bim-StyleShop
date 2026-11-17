// Comportamento comum do cabeçalho/menu de todas as páginas públicas e do cliente:
//  - mostra quem está logado (Entrar / Sair)
//  - exibe os itens do menu conforme o perfil (cliente x administrador)
//  - atualiza o contador do carrinho

const STORAGE_CARRINHO = 'carrinho_styleshop';

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function brl(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function lerCarrinho() {
  try { return JSON.parse(localStorage.getItem(STORAGE_CARRINHO)) || []; } catch (e) { return []; }
}
function salvarCarrinho(c) {
  localStorage.setItem(STORAGE_CARRINHO, JSON.stringify(c));
  atualizarContadorCarrinho();
}
function atualizarContadorCarrinho() {
  const el = document.getElementById('contadorCarrinho');
  if (el) el.textContent = lerCarrinho().reduce((s, i) => s + i.quantidade, 0);
}
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// Confere o carrinho com o banco: remove produto esgotado, reduz a quantidade que passou do estoque
// e atualiza preço/estoque. Devolve uma lista de avisos para mostrar ao cliente.
async function sincronizarCarrinho() {
  const carrinho = lerCarrinho();
  const avisos = [];
  if (carrinho.length === 0) return avisos;
  let produtos;
  try {
    const r = await fetch('/produto');
    produtos = await r.json();
  } catch (e) {
    return avisos; // sem conexão: o servidor ainda valida o estoque ao finalizar
  }
  const novo = [];
  carrinho.forEach(item => {
    const p = produtos.find(x => x.id_produto === item.id);
    if (!p) { avisos.push(`"${item.nome}" não está mais disponível e foi removido.`); return; }
    const estoque = p.quantidade_estoque_produto;
    if (estoque <= 0) { avisos.push(`"${p.nome_produto}" esgotou e foi removido do carrinho.`); return; }
    if (item.quantidade > estoque) {
      avisos.push(`"${p.nome_produto}": restam apenas ${estoque} unidade(s). A quantidade foi ajustada.`);
      item.quantidade = estoque;
    }
    if (item.preco !== p.preco_unitario_produto) {
      avisos.push(`O preço de "${p.nome_produto}" mudou para ${brl(p.preco_unitario_produto)}.`);
    }
    item.preco = p.preco_unitario_produto;
    item.estoque = estoque;
    novo.push(item);
  });
  salvarCarrinho(novo);
  return avisos;
}

let usuarioAtual = null; // preenchido por carregarUsuario()

async function carregarUsuario() {
  try {
    const r = await fetch('/login/verificaSeUsuarioEstaLogado');
    const d = await r.json();
    usuarioAtual = d.status === 'ok' ? JSON.parse(d.usuario) : null;
  } catch (e) { usuarioAtual = null; }
  return usuarioAtual;
}

async function sair() {
  await fetch('/login/logout');
  // o carrinho e o pagamento pendente são de quem estava logado: limpa ao sair
  localStorage.removeItem(STORAGE_CARRINHO);
  sessionStorage.removeItem('dadosPagamento');
  window.location.href = '/menu';
}

async function montarCabecalho() {
  atualizarContadorCarrinho();
  const u = await carregarUsuario();
  const area = document.getElementById('usuarioArea');
  const voltar = encodeURIComponent(location.pathname);
  if (!u) {
    area.innerHTML = `<a href="/login/?voltar=${voltar}">Entrar</a><a href="/login/?aba=cadastro&voltar=${voltar}">Criar conta</a>`;
  } else {
    const admin = u.admin === true;
    const cargo = u.ehFuncionario && u.ehFuncionario.id_cargo >= 0 ? u.ehFuncionario.nome_cargo : 'Cliente';
    area.innerHTML = `<span>Olá, <strong>${esc(u.nome.split(' ')[0])}</strong> (${esc(cargo)})</span><button type="button" id="btnSair">Sair</button>`;
    document.getElementById('btnSair').addEventListener('click', sair);
  }
  const admin = !!(u && u.admin === true); // só gerente, supervisor e diretor
  document.querySelectorAll('[data-admin]').forEach(e => e.hidden = !admin);
  document.querySelectorAll('[data-logado]').forEach(e => e.hidden = !u);
  // marca o item atual do menu
  document.querySelectorAll('.nav a').forEach(a => { if (a.getAttribute('href') === location.pathname) a.classList.add('ativo'); });
  return u;
}

document.addEventListener('DOMContentLoaded', montarCabecalho);
