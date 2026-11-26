const msg = (t, tipo = 'erro') => { document.getElementById('mensagem').innerHTML = `<div class="msg ${tipo}">${esc(t)}</div>`; };

let subtotal = 0;        // valor dos produtos
let freteAtual = null;   // resultado do cálculo do frete (null enquanto não calculado)
let podeComprar = false; // carrinho com itens e conta de cliente

// Mostra produtos, frete e total (total = produtos + frete)
function mostrarTotais() {
    document.getElementById('linhaProdutos').textContent = 'Produtos: ' + brl(subtotal);
    if (freteAtual) {
        document.getElementById('linhaFrete').textContent = 'Frete: ' + brl(freteAtual.valor_frete);
        document.getElementById('totalFinal').textContent = 'Total: ' + brl(subtotal + freteAtual.valor_frete);
    } else {
        document.getElementById('linhaFrete').textContent = 'Frete: calcule o CEP';
        document.getElementById('totalFinal').textContent = 'Total: ' + brl(subtotal);
    }
    // só dá para ir ao pagamento depois de calcular o frete
    document.getElementById('btnConfirmar').disabled = !(podeComprar && freteAtual);
}

// Calcula o frete pelo CEP (o servidor consulta a API e a distância)
document.getElementById('btnCalcularFrete').addEventListener('click', async () => {
    const cep = document.getElementById('cep').value;
    if (cep.length !== 8) {
        msg('O CEP deve ter 8 números.');
        return;
    }
    try {
        const r = await fetch('/frete/calcular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cep: cep })
        });
        const d = await r.json();
        if (!r.ok) {
            freteAtual = null;
            document.getElementById('infoFrete').textContent = '';
            msg(d.error || 'Não foi possível calcular o frete.');
        } else {
            freteAtual = d;
            document.getElementById('mensagem').innerHTML = '';
            let texto = (d.rua ? d.rua + ' - ' : '') + d.cidade + '/' + d.estado + ' (' + d.distancia_km + ' km da loja)';
            if (d.precisao === 'bairro') {
                texto += ' - distância aproximada pelo bairro';
            }
            if (d.precisao === 'cidade') {
                texto += ' - distância aproximada (CEP único da cidade)';
            }
            document.getElementById('infoFrete').textContent = texto + ' - localização: © OpenStreetMap';
        }
    } catch (e) {
        freteAtual = null;
        msg('Erro de comunicação com o servidor.');
    }
    mostrarTotais();
});

// se o CEP for alterado depois de calculado, o frete precisa ser calculado de novo
document.getElementById('cep').addEventListener('input', () => {
    freteAtual = null;
    mostrarTotais();
});

async function iniciar() {
    const u = await carregarUsuario();
    if (!u) { window.location.href = '/login/?voltar=/login/visaoclientefinalizar'; return; }
    document.getElementById('dadosCliente').textContent = `Comprador: ${u.nome} (CPF ${u.cpf_pessoa})`;
    const avisos = await sincronizarCarrinho(); // confere estoque e preços atuais
    const carrinho = lerCarrinho();
    const corpo = document.getElementById('listaFinalizar');
    subtotal = 0;
    corpo.innerHTML = '';
    if (carrinho.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px">Carrinho vazio. Volte e adicione itens.</td></tr>';
    }
    carrinho.forEach(i => {
        subtotal += i.preco * i.quantidade;
        corpo.innerHTML += `<tr><td>${esc(i.nome)}</td><td>${esc(i.tamanho)} / ${esc(i.cor)}</td><td>${brl(i.preco)}</td><td>${i.quantidade}</td><td>${brl(i.preco * i.quantidade)}</td></tr>`;
    });
    podeComprar = carrinho.length > 0 && u.ehCliente;
    mostrarTotais();
    if (!u.ehCliente) {
        document.getElementById('mensagem').innerHTML = '<div class="msg erro">Sua conta ainda não tem perfil de cliente (por exemplo, você é funcionário). Para comprar, abra <a href="/login/?aba=cadastro&voltar=/login/visaoclientefinalizar">Criar conta</a> e informe o seu CPF, o seu e-mail e a sua senha atual para ativar o perfil de cliente.</div>';
    } else if (avisos.length > 0) {
        document.getElementById('mensagem').innerHTML = avisos.map(a => `<div class="msg info">${esc(a)}</div>`).join('');
    }
}

// Cria o pedido (com itens) numa única requisição e segue para o pagamento.
// O servidor usa o CPF do cookie, os preços do banco e calcula o frete de novo a partir do CEP.
document.getElementById('btnConfirmar').addEventListener('click', async () => {
    const carrinho = lerCarrinho();
    const btn = document.getElementById('btnConfirmar');
    btn.disabled = true;
    try {
        const r = await fetch('/pedido/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cep: freteAtual.cep, itens: carrinho.map(i => ({ id_produto: i.id, quantidade: i.quantidade })) })
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
