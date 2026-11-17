async function carregar() {
    const box = document.getElementById('listaPedidos');
    try {
        const r = await fetch('/pedido/meus');
        const d = await r.json();
        if (r.status === 401) { window.location.href = '/login/?voltar=/pedido/abrirMeusPedidos'; return; }
        if (!r.ok) { box.innerHTML = `<div class="painel"><p>${esc(d.error)}</p><a class="btn" href="/menu">Voltar à loja</a></div>`; return; }
        if (d.length === 0) { box.innerHTML = '<div class="painel"><p>Você ainda não fez nenhum pedido.</p><a class="btn" href="/menu">Ir às compras</a></div>'; return; }
        box.innerHTML = d.map(p => `
            <article class="painel pedido-card">
                <header>
                    <h3 style="margin:0">Pedido #${p.id_pedido} <small class="card-detalhe">${new Date(p.data_pedido).toLocaleDateString('pt-BR')}</small></h3>
                    <span class="badge ${p.pago ? 'ok' : 'pend'}">${p.pago ? 'Pago' : 'Aguardando pagamento'}</span>
                </header>
                <ul>${p.itens.map(i => `<li><span>${i.quantidade}x ${esc(i.nome)} (${esc(i.tamanho)}, ${esc(i.cor)})</span><span>${brl(i.quantidade * i.preco)}</span></li>`).join('')}</ul>
                <p class="total">Total: ${brl(p.total)}</p>
                ${p.pago ? '' : `<div class="acoes"><button type="button" class="btn" data-pagar="${p.id_pedido}" data-total="${p.total}">Pagar agora</button></div>`}
            </article>`).join('');
        box.querySelectorAll('[data-pagar]').forEach(b => b.addEventListener('click', () => {
            sessionStorage.setItem('dadosPagamento', JSON.stringify({ id_pedido: +b.dataset.pagar, valor_total: +b.dataset.total }));
            window.location.href = '/pagamento/abrirTelaPagamento';
        }));
    } catch (e) { box.innerHTML = '<div class="msg erro">Erro ao carregar os pedidos.</div>'; }
}
carregar();
