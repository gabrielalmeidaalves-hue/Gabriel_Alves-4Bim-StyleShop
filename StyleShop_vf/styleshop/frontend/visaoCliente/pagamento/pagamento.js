const dados = JSON.parse(sessionStorage.getItem('dadosPagamento') || 'null');
const msg = (t, tipo = 'erro') => { document.getElementById('mensagem').innerHTML = `<div class="msg ${tipo}">${esc(t)}</div>`; };
const arred = v => Math.round(v * 100) / 100;

let formas = [];        // formas disponíveis (vindas do banco)
let linhas = [];        // forma escolhida (uma por vez): { uid, id, nome, valor }
const valorTotal = dados ? Number(dados.valor_total) : 0;

function restante() { return arred(valorTotal - linhas.reduce((s, l) => s + l.valor, 0)); }

function atualizarResumo() {
    const r = restante();
    document.getElementById('valorTotal').textContent = brl(valorTotal);
    const el = document.getElementById('valorRestante');
    el.textContent = brl(r);
    el.style.color = r === 0 ? 'var(--ok)' : 'var(--erro)';
    document.getElementById('btnConfirmar').disabled = !(r === 0 && linhas.length > 0 && linhas.every(l => l.valor > 0));
}

function detalhes(nome, uid) {
    const n = nome.toLowerCase();
    if (n.includes('cart')) return `
        <div class="form-grid" style="margin-top:10px">
            <div class="campo cheio"><label>Número do cartão</label><input type="text" inputmode="numeric" maxlength="19" placeholder="1234 5678 9012 3456" data-card="${uid}-num"></div>
            <div class="campo cheio"><label>Nome no cartão</label><input type="text" placeholder="NOME COMPLETO" data-card="${uid}-nome"></div>
            <div class="campo"><label>Validade</label><input type="text" maxlength="5" placeholder="MM/AA" data-card="${uid}-val"></div>
            <div class="campo"><label>CVV</label><input type="text" inputmode="numeric" maxlength="4" placeholder="123" data-card="${uid}-cvv"></div>
        </div>`;
    if (n.includes('pix')) return '<div class="qr">QR Code do PIX (simulação)</div>';
    if (n.includes('boleto')) return '<p class="dica">O boleto seria gerado após a confirmação (simulação). Vencimento em 3 dias úteis.</p>';
    return '';
}

function renderLinhas() {
    const box = document.getElementById('formasAdicionadas');
    box.innerHTML = '';
    linhas.forEach(l => {
        const div = document.createElement('div');
        div.className = 'forma-item';
        // o valor é sempre o total do pedido (não há divisão entre formas), por isso o campo só mostra o valor
        div.innerHTML = `
            <div class="cab"><span>${esc(l.nome)}</span></div>
            <div class="campo"><label for="v${l.uid}">Valor a pagar (R$)</label>
                <input type="number" id="v${l.uid}" value="${l.valor.toFixed(2)}" readonly></div>
            ${detalhes(l.nome, l.uid)}`;
        box.appendChild(div);
    });
    atualizarResumo();
}

// Escolher uma forma de pagamento TROCA a forma anterior (os campos abaixo mudam junto)
document.getElementById('formaPagamento').addEventListener('change', () => {
    const id = document.getElementById('formaPagamento').value;
    document.getElementById('mensagem').innerHTML = '';
    if (!id) {
        linhas = [];   // voltou para "Selecione...": nenhuma forma escolhida
        renderLinhas();
        return;
    }
    const f = formas.find(x => String(x.id_forma_pagamento) === id);
    linhas = [{ uid: Date.now(), id: f.id_forma_pagamento, nome: f.nome_forma_pagamento, valor: valorTotal }];
    renderLinhas();
});

// Dados do cartão: o próprio campo só aceita o que for permitido enquanto a pessoa digita
document.getElementById('formasAdicionadas').addEventListener('input', e => {
    const campo = e.target.dataset.card;   // exemplo: "1700000000000-num"
    if (!campo) return;

    if (campo.endsWith('-num')) {
        // só números, no máximo 16, com um espaço a cada 4 números
        const numeros = e.target.value.replace(/[^0-9]/g, '').slice(0, 16);
        e.target.value = numeros.replace(/(\d{4})(?=\d)/g, '$1 ');
    }
    if (campo.endsWith('-nome')) {
        // só letras (com acentos) e espaços
        e.target.value = e.target.value.replace(/[^A-Za-zÀ-ÿ ]/g, '');
    }
    if (campo.endsWith('-val')) {
        // só números, no máximo 4, com a barra depois do mês (MM/AA)
        let numeros = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        if (numeros.length > 2) {
            numeros = numeros.slice(0, 2) + '/' + numeros.slice(2);
        }
        e.target.value = numeros;
    }
    if (campo.endsWith('-cvv')) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    }
});

function validarCartoes() {
    for (const l of linhas) {
        if (!l.nome.toLowerCase().includes('cart')) continue;
        const g = k => (document.querySelector(`[data-card="${l.uid}-${k}"]`) || {}).value || '';
        if (!/^\d{16}$/.test(g('num').replace(/\s/g, ''))) return 'Número do cartão inválido (16 dígitos).';
        const nome = g('nome').trim();
        if (nome.length < 3) return 'Informe o nome no cartão (mínimo 3 letras).';
        if (/[^A-Za-zÀ-ÿ ]/.test(nome)) return 'O nome no cartão deve ter apenas letras.';
        if (!/^\d{2}\/\d{2}$/.test(g('val'))) return 'Validade inválida (MM/AA).';
        // mês de 01 a 12 e cartão não vencido (vale até o fim do mês de validade)
        const mes = Number(g('val').slice(0, 2));
        const ano = 2000 + Number(g('val').slice(3, 5));
        const hoje = new Date();
        if (mes < 1 || mes > 12) return 'Validade inválida: o mês deve ser de 01 a 12.';
        if (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes < hoje.getMonth() + 1)) return 'Cartão vencido.';
        if (!/^\d{3,4}$/.test(g('cvv'))) return 'CVV inválido.';
    }
    return null;
}

document.getElementById('btnConfirmar').addEventListener('click', async () => {
    const erro = validarCartoes();
    if (erro) return msg(erro);
    const btn = document.getElementById('btnConfirmar');
    btn.disabled = true;
    try {
        const r = await fetch('/pagamento/' + dados.id_pedido, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formasPagamento: linhas.map(l => ({ tipo: l.id, valor: l.valor })) })
        });
        const d = await r.json();
        if (!r.ok) { msg(d.error || 'Erro ao processar o pagamento.'); btn.disabled = false; return; }
        sessionStorage.removeItem('dadosPagamento');
        msg('Pagamento aprovado! Redirecionando para seus pedidos...', 'sucesso');
        setTimeout(() => { window.location.href = '/pedido/abrirMeusPedidos'; }, 1500);
    } catch (e) {
        msg('Erro de comunicação com o servidor.'); btn.disabled = false;
    }
});

async function iniciar() {
    if (!dados) {
        document.querySelector('main').innerHTML = '<section class="painel"><p>Nenhum pedido selecionado para pagamento.</p><a class="btn" href="/pedido/abrirMeusPedidos">Ver meus pedidos</a></section>';
        return;
    }
    document.getElementById('idPedido').textContent = '#' + dados.id_pedido;
    try {
        const r = await fetch('/forma_pagamento');
        if (!r.ok) { msg('Não foi possível carregar as formas de pagamento. Entre novamente na sua conta e tente de novo.'); return; }
        formas = await r.json();
        const sel = document.getElementById('formaPagamento');
        formas.forEach(f => sel.insertAdjacentHTML('beforeend', `<option value="${f.id_forma_pagamento}">${esc(f.nome_forma_pagamento)}</option>`));
    } catch (e) { msg('Não foi possível carregar as formas de pagamento.'); }
    atualizarResumo();
}
iniciar();
