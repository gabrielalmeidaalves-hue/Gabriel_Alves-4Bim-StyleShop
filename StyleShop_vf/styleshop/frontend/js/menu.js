// ===== Validações desta tela =====

// Tamanhos mais comuns (o servidor confere a mesma lista em produtoController.js)
const TAMANHOS = [
    'PP', 'P', 'M', 'G', 'GG', 'XG', 'Único',
    '34', '36', '38', '40', '42', '44', '46',
    '2', '4', '6', '8', '10', '12', '14'
];

// ===== Fim das validações =====

// Vitrine: lista os produtos, aplica filtros e adiciona ao carrinho
let produtos = [];

const el = id => document.getElementById(id);

function preencherSelect(select, valores) {
    const primeiro = select.options[0];
    select.innerHTML = '';
    select.appendChild(primeiro);
    valores.forEach(v => select.insertAdjacentHTML('beforeend', `<option value="${esc(v.valor)}">${esc(v.texto)}</option>`));
}

function unicos(lista) { return [...new Set(lista)].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })); }

async function carregar() {
    try {
        const [rp, rc] = await Promise.all([fetch('/produto'), fetch('/categoria_roupa/listar')]);
        produtos = await rp.json();
        const cats = (await rc.json()).categorias || [];
        preencherSelect(el('fCategoria'), cats.map(c => ({ valor: c.id_categoria_roupa, texto: c.nome_categoria_roupa })));
        // mesma lista do cadastro de produto, na mesma ordem
        preencherSelect(el('fTamanho'), TAMANHOS.map(t => ({ valor: t, texto: t })));
        preencherSelect(el('fCor'), unicos(produtos.map(p => p.cor)).map(c => ({ valor: c, texto: c })));
        render();
    } catch (e) {
        console.error(e);
        el('grade').innerHTML = '<div class="mensagem-info" style="color:var(--erro)">Erro ao carregar os produtos.</div>';
    }
}

function filtrar() {
    const busca = el('busca').value.trim().toLowerCase();
    const cat = el('fCategoria').value, tam = el('fTamanho').value, cor = el('fCor').value;
    let lista = produtos.filter(p =>
        (!busca || p.nome_produto.toLowerCase().includes(busca)) &&
        (!cat || p.id_categoria_roupa === cat) &&
        (!tam || p.tamanho === tam) &&
        (!cor || p.cor === cor) &&
        (!el('fEstoque').checked || p.quantidade_estoque_produto > 0));
    const ordem = el('fOrdem').value;
    if (ordem === 'menor') lista.sort((a, b) => a.preco_unitario_produto - b.preco_unitario_produto);
    else if (ordem === 'maior') lista.sort((a, b) => b.preco_unitario_produto - a.preco_unitario_produto);
    else if (ordem === 'nome') lista.sort((a, b) => a.nome_produto.localeCompare(b.nome_produto, 'pt-BR'));
    return lista;
}

function card(p) {
    const esgotado = p.quantidade_estoque_produto <= 0;
    return `
    <article class="produto-card">
        <img src="/view-image/${p.id_produto}" alt="${esc(p.nome_produto)}" loading="lazy">
        <div class="card-corpo">
            <span class="badge">${esc(p.nome_categoria_roupa)}</span>
            <div class="card-titulo">${esc(p.nome_produto)}</div>
            <div class="card-detalhe">Tamanho: ${esc(p.tamanho)} &bull; Cor: ${esc(p.cor)}</div>
            <div class="card-preco">${brl(p.preco_unitario_produto)}</div>
            <div class="card-detalhe">${esgotado ? '<span class="esgotado">Esgotado</span>' : p.quantidade_estoque_produto + ' em estoque'}</div>
            <div class="card-acoes">
                <div class="linha">
                    <input type="number" min="1" max="${p.quantidade_estoque_produto}" value="1" id="qtd-${p.id_produto}" aria-label="Quantidade" ${esgotado ? 'disabled' : ''}>
                    <button type="button" class="btn" data-add="${p.id_produto}" ${esgotado ? 'disabled' : ''}>Adicionar</button>
                </div>
                <button type="button" class="btn btn-sec" data-comprar="${p.id_produto}" ${esgotado ? 'disabled' : ''}>Comprar agora</button>
            </div>
        </div>
    </article>`;
}

function render() {
    const lista = filtrar();
    el('qtdResultados').textContent = `(${lista.length} ${lista.length === 1 ? 'item' : 'itens'})`;
    el('grade').innerHTML = lista.length ? lista.map(card).join('') : '<div class="mensagem-info">Nenhum produto encontrado com esses filtros.</div>';
    document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => adicionar(+b.dataset.add, false)));
    document.querySelectorAll('[data-comprar]').forEach(b => b.addEventListener('click', () => adicionar(+b.dataset.comprar, true)));
}

function adicionar(id, irParaCarrinho) {
    const p = produtos.find(x => x.id_produto === id);
    let qtd = parseInt(el('qtd-' + id).value, 10);
    if (isNaN(qtd) || qtd < 1) qtd = 1;
    const carrinho = lerCarrinho();
    const existente = carrinho.find(i => i.id === id);
    const jaNoCarrinho = existente ? existente.quantidade : 0;
    if (jaNoCarrinho + qtd > p.quantidade_estoque_produto) {
        toast(`Estoque insuficiente: restam ${p.quantidade_estoque_produto} un. (você já tem ${jaNoCarrinho} no carrinho)`);
        return;
    }
    if (existente) { existente.quantidade += qtd; existente.estoque = p.quantidade_estoque_produto; }
    else carrinho.push({ id, nome: p.nome_produto, preco: p.preco_unitario_produto, tamanho: p.tamanho, cor: p.cor, estoque: p.quantidade_estoque_produto, quantidade: qtd });
    salvarCarrinho(carrinho);
    if (irParaCarrinho) window.location.href = '/login/visaoclientecarrinho';
    else toast(`"${p.nome_produto}" adicionado ao carrinho`);
}

['busca', 'fCategoria', 'fTamanho', 'fCor', 'fOrdem', 'fEstoque'].forEach(id => {
    el(id).addEventListener(id === 'busca' ? 'input' : 'change', render);
});
el('btnLimpar').addEventListener('click', () => {
    el('busca').value = ''; ['fCategoria', 'fTamanho', 'fCor'].forEach(i => el(i).value = ''); el('fOrdem').value = 'id'; el('fEstoque').checked = false; render();
});

if (new URLSearchParams(location.search).get('acessoNegado')) {
    document.addEventListener('DOMContentLoaded', () => toast('Acesso restrito a funcionários/administradores.'));
}
carregar();
