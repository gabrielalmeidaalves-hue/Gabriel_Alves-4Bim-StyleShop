function carregarCarrinho() {
    const carrinho = lerCarrinho();
    const corpo = document.getElementById('corpoTabela');
    let total = 0;
    corpo.innerHTML = '';
    if (carrinho.length === 0) {
        corpo.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px">Seu carrinho está vazio.</td></tr>';
        document.getElementById('btnFinalizar').disabled = true;
        document.getElementById('btnLimpar').disabled = true;
        document.getElementById('totalGeral').textContent = 'Total: ' + brl(0);
        return;
    }
    document.getElementById('btnFinalizar').disabled = false;
    document.getElementById('btnLimpar').disabled = false;
    carrinho.forEach((item, i) => {
        const subtotal = item.preco * item.quantidade;
        total += subtotal;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="/view-image/${item.id}" alt="${esc(item.nome)}"></td>
            <td>${esc(item.nome)}</td>
            <td>${esc(item.tamanho)} / ${esc(item.cor)}</td>
            <td>${brl(item.preco)}</td>
            <td><input type="number" min="1" max="${item.estoque}" value="${item.quantidade}" data-i="${i}" aria-label="Quantidade de ${esc(item.nome)}"></td>
            <td>${brl(subtotal)}</td>
            <td><button type="button" class="btn btn-perigo" data-remover="${i}">Remover</button></td>`;
        corpo.appendChild(tr);
    });
    document.getElementById('totalGeral').textContent = 'Total: ' + brl(total);
    corpo.querySelectorAll('input[type=number]').forEach(inp => inp.addEventListener('change', e => {
        const c = lerCarrinho(); const i = +e.target.dataset.i;
        let q = parseInt(e.target.value, 10);
        if (isNaN(q) || q < 1) q = 1;
        if (q > c[i].estoque) { q = c[i].estoque; toast('Máximo em estoque: ' + c[i].estoque); }
        c[i].quantidade = q; salvarCarrinho(c); carregarCarrinho();
    }));
    corpo.querySelectorAll('[data-remover]').forEach(b => b.addEventListener('click', e => {
        const c = lerCarrinho(); c.splice(+e.target.dataset.remover, 1); salvarCarrinho(c); carregarCarrinho();
    }));
}
document.getElementById('btnLimpar').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar o carrinho?')) { salvarCarrinho([]); carregarCarrinho(); }
});
// O servidor redireciona para o login caso não exista cookie (rota protegida)
document.getElementById('btnFinalizar').addEventListener('click', () => { window.location.href = '/login/visaoclientefinalizar'; });
// Antes de mostrar, confere o estoque atual (ele pode ter mudado desde que o item foi adicionado)
sincronizarCarrinho().then(avisos => {
    document.getElementById('avisos').innerHTML = avisos.map(a => `<div class="msg info">${esc(a)}</div>`).join('');
    carregarCarrinho();
});
