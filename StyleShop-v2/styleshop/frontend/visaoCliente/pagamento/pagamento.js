const dados = JSON.parse(sessionStorage.getItem('dadosPagamento') || 'null');
const msg = (t, tipo = 'erro') => { document.getElementById('mensagem').innerHTML = `<div class="msg ${tipo}">${esc(t)}</div>`; };
const arred = v => Math.round(v * 100) / 100;

let formas = [];        // formas disponíveis (vindas do banco)
let linhas = [];        // formas escolhidas: { uid, id, nome, valor }
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
        div.innerHTML = `
            <div class="cab"><span>${esc(l.nome)}</span><button type="button" class="btn btn-perigo" data-rem="${l.uid}">Remover</button></div>
            <div class="campo"><label for="v${l.uid}">Valor (R$)</label>
                <input type="number" id="v${l.uid}" min="0.01" step="0.01" value="${l.valor.toFixed(2)}"></div>
            ${detalhes(l.nome, l.uid)}`;
        box.appendChild(div);
        div.querySelector('input[type=number]').addEventListener('input', e => {
            l.valor = arred(parseFloat(e.target.value) || 0);
            atualizarResumo();
        });
        div.querySelector('[data-rem]').addEventListener('click', () => {
            linhas = linhas.filter(x => x.uid !== l.uid); renderLinhas(); atualizarResumo();
        });
    });
    atualizarResumo();
}

document.getElementById('formaPagamento').addEventListener('change', () => {
    const id = document.getElementById('formaPagamento').value;
    if (!id) return;
    if (restante() <= 0) return msg('O valor total já foi distribuído.', 'info');
    const f = formas.find(x => String(x.id_forma_pagamento) === id);
    if (linhas.some(l => String(l.id) === id)) return msg('Essa forma já foi adicionada; ajuste o valor dela.', 'info');
    linhas.push({ uid: Date.now(), id: f.id_forma_pagamento, nome: f.nome_forma_pagamento, valor: restante() });
    document.getElementById('formaPagamento').value = '';
    document.getElementById('mensagem').innerHTML = '';
    renderLinhas();
});

function validarCartoes() {
    for (const l of linhas) {
        if (!l.nome.toLowerCase().includes('cart')) continue;
        const g = k => (document.querySelector(`[data-card="${l.uid}-${k}"]`) || {}).value || '';
        if (!/^\d{16}$/.test(g('num').replace(/\s/g, ''))) return 'Número do cartão inválido (16 dígitos).';
        if (!g('nome').trim()) return 'Informe o nome no cartão.';
        if (!/^\d{2}\/\d{2}$/.test(g('val'))) return 'Validade inválida (MM/AA).';
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
