const msg = (t, tipo = 'erro') => { document.getElementById('mensagem').innerHTML = `<div class="msg ${tipo}">${esc(t)}</div>`; };

async function iniciar() {
    const u = await carregarUsuario();
    if (!u) { window.location.href = '/login/?voltar=/login/visaoclientefinalizar'; return; }
    document.getElementById('dadosCliente').textContent = `Comprador: ${u.nome} (CPF ${u.cpf_pessoa})`;
    const avisos = await sincronizarCarrinho(); // confere estoque e preços atuais
    const carrinho = lerCarrinho();
    const corpo = document.getElementById('listaFinalizar');
    let total = 0;
    corpo.innerHTML = '';
    if (carrinho.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px">Carrinho vazio. Volte e adicione itens.</td></tr>';
        document.getElementById('btnConfirmar').disabled = true;
    }
    carrinho.forEach(i => {
        total += i.preco * i.quantidade;
        corpo.innerHTML += `<tr><td>${esc(i.nome)}</td><td>${esc(i.tamanho)} / ${esc(i.cor)}</td><td>${brl(i.preco)}</td><td>${i.quantidade}</td><td>${brl(i.preco * i.quantidade)}</td></tr>`;
    });
    document.getElementById('totalFinal').textContent = 'Total: ' + brl(total);
    if (!u.ehCliente) {
        document.getElementById('mensagem').innerHTML = '<div class="msg erro">Sua conta ainda não tem perfil de cliente (por exemplo, você é funcionário). Para comprar, abra <a href="/login/?aba=cadastro&voltar=/login/visaoclientefinalizar">Criar conta</a> e informe o seu CPF, o seu e-mail e a sua senha atual para ativar o perfil de cliente.</div>';
        document.getElementById('btnConfirmar').disabled = true;
    } else if (avisos.length > 0) {
        document.getElementById('mensagem').innerHTML = avisos.map(a => `<div class="msg info">${esc(a)}</div>`).join('');
    }
}

// Cria o pedido (com itens) numa única requisição e segue para o pagamento.
// O servidor usa o CPF do cookie e os preços do banco.
document.getElementById('btnConfirmar').addEventListener('click', async () => {
    const carrinho = lerCarrinho();
    const btn = document.getElementById('btnConfirmar');
    btn.disabled = true;
    try {
        const r = await fetch('/pedido/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itens: carrinho.map(i => ({ id_produto: i.id, quantidade: i.quantidade })) })
        });
        const d = await r.json();
        if (r.status === 401) { window.location.href = '/login/?voltar=/login/visaoclientefinalizar'; return; }
        if (!r.ok) { msg(d.error || 'Não foi possível criar o pedido.'); btn.disabled = false; return; }
        sessionStorage.setItem('dadosPagamento', JSON.stringify({ id_pedido: d.id_pedido, valor_total: d.valor_total }));
        salvarCarrinho([]);
        window.location.href = '/pagamento/abrirTelaPagamento';
    } catch (e) {
        msg('Erro de comunicação com o servidor.');
        btn.disabled = false;
    }
});
iniciar();
