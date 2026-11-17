// ===== Validações desta tela =====

// true se o texto tiver só dígitos (0 a 9)
function soDigitos(texto) {
    return /^[0-9]+$/.test(texto);
}

// CPF: exatamente 11 dígitos
function cpfValido(texto) {
    if (texto.length !== 11) { return false; }
    return soDigitos(texto);
}

// Data de hoje no formato AAAA-MM-DD (o mesmo formato do <input type="date">)
function hojeISO() {
    var d = new Date();
    var mes = String(d.getMonth() + 1);
    var dia = String(d.getDate());
    if (mes.length < 2) { mes = '0' + mes; }
    if (dia.length < 2) { dia = '0' + dia; }
    return d.getFullYear() + '-' + mes + '-' + dia;
}

// true se a data (AAAA-MM-DD) for depois de hoje
function dataEhFutura(texto) {
    if (!texto) { return false; }
    return texto > hojeISO();   // comparar textos nesse formato funciona como comparar datas
}

// E-mail simples: algo@dominio.ext (qualquer domínio)
function emailValido(texto) {
    var posArroba = texto.indexOf('@');
    if (posArroba < 1) { return false; }                 // precisa ter texto antes do @
    if (texto.indexOf(' ') !== -1) { return false; }     // sem espaços
    var resto = texto.slice(posArroba + 1);
    if (resto.indexOf('@') !== -1) { return false; }     // só um @
    var posPonto = resto.indexOf('.');
    if (posPonto < 1) { return false; }                  // precisa de "." depois do @
    if (resto.slice(-1) === '.') { return false; }       // não pode terminar em "."
    return true;
}

// Impede digitar -, +, e, E nos campos numéricos (e . e , quando o campo só aceita inteiros)
// Uso no HTML: onkeydown="bloquearTeclas(event, true)"
function bloquearTeclas(evento, soInteiro) {
    var tecla = evento.key;
    if (tecla === '-' || tecla === '+' || tecla === 'e' || tecla === 'E') {
        evento.preventDefault();
    }
    if (soInteiro && (tecla === '.' || tecla === ',')) {
        evento.preventDefault();
    }
}

// Corta o que passar do tamanho máximo (vale também para texto colado)
function limitarTamanho(campo, tamanho) {
    if (campo.value.length > tamanho) {
        campo.value = campo.value.slice(0, tamanho);
    }
}

// ===== Fim das validações =====

const params = new URLSearchParams(location.search);
// só aceita caminhos internos como destino (evita redirecionamento para outro site)
let voltar = params.get('voltar') || '';
if (!voltar.startsWith('/') || voltar.startsWith('//')) voltar = '';

const el = id => document.getElementById(id);
const msg = (t, tipo = 'erro') => { el('mensagem').innerHTML = `<div class="msg ${tipo}">${esc(t)}</div>`; };

function mostrarAba(cadastro) {
    el('formLogin').hidden = cadastro;
    el('formEsqueci').hidden = true;
    el('formCodigo').hidden = true;
    el('formCadastro').hidden = !cadastro;
    el('abaEntrar').classList.toggle('ativa', !cadastro);
    el('abaCadastro').classList.toggle('ativa', cadastro);
    el('mensagem').innerHTML = '';
}
el('abaEntrar').addEventListener('click', () => mostrarAba(false));
el('abaCadastro').addEventListener('click', () => mostrarAba(true));
if (params.get('aba') === 'cadastro') mostrarAba(true);

async function entrar(email, senha) {
    const r = await fetch('/login/verificarSenha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha })
    });
    const d = await r.json();
    if (d.status === 'ok') {
        // sem destino definido: administrador vai ao painel; cliente, à loja
        window.location.href = voltar || (d.admin ? '/menu/admin' : '/menu');
        return;
    }
    msg(d.status === 'senha_incorreta' ? 'E-mail ou senha incorretos.' : (d.mensagem || 'Erro ao entrar.'));
}

el('formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    try { await entrar(el('email').value, el('senha').value); } catch (err) { msg('Erro de comunicação com o servidor.'); }
});

// a data de nascimento não pode ser escolhida no futuro
el('cNasc').max = hojeISO();

el('formCadastro').addEventListener('submit', async e => {
    e.preventDefault();
    if (el('cNome').value.trim().length < 3) {
        return msg('O nome deve ter pelo menos 3 caracteres.');
    }
    if (!cpfValido(el('cCpf').value)) {
        return msg('O CPF deve ter exatamente 11 números.');
    }
    if (dataEhFutura(el('cNasc').value)) {
        return msg('A data de nascimento não pode ser no futuro.');
    }
    if (!emailValido(el('cEmail').value.trim())) {
        return msg('Informe um e-mail válido (exemplo: nome@dominio.com).');
    }
    const corpo = {
        nome_pessoa: el('cNome').value, cpf_pessoa: el('cCpf').value, data_nascimento_pessoa: el('cNasc').value,
        endereco_pessoa: el('cEnd').value, email_pessoa: el('cEmail').value, senha_pessoa: el('cSenha').value
    };
    try {
        const r = await fetch('/login/cadastrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
        const d = await r.json();
        if (!r.ok) return msg(d.error || 'Erro ao criar a conta.');
        await entrar(corpo.email_pessoa, corpo.senha_pessoa);
    } catch (err) { msg('Erro de comunicação com o servidor.'); }
});

// ---------- Recuperação de senha ----------
// e-mail usado no pedido do código (é enviado de novo junto com o código digitado)
let emailRecuperacao = '';

function mostrarEsqueci(mostrar) {
    el('formLogin').hidden = mostrar;
    el('formEsqueci').hidden = !mostrar;
    el('formCodigo').hidden = true;
    el('mensagem').innerHTML = '';
    if (mostrar) el('eEmail').value = el('email').value;
}
el('linkEsqueci').addEventListener('click', e => { e.preventDefault(); mostrarEsqueci(true); });
el('linkVoltarLogin').addEventListener('click', e => { e.preventDefault(); mostrarEsqueci(false); });

el('formEsqueci').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = el('btnEnviarLink');
    btn.disabled = true;
    try {
        const r = await fetch('/login/esqueci-senha', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: el('eEmail').value })
        });
        const d = await r.json();
        if (!r.ok) {
            msg(d.error || 'Não foi possível enviar o código.');
        } else {
            // etapa 2: digitar o código recebido e a nova senha
            emailRecuperacao = el('eEmail').value.trim();
            el('formEsqueci').hidden = true;
            el('formCodigo').hidden = false;
            msg(d.mensagem, 'sucesso');
        }
    } catch (err) { msg('Erro de comunicação com o servidor.'); }
    btn.disabled = false;
});

// Etapa 2: confere o código e troca a senha
el('linkNovoCodigo').addEventListener('click', e => { e.preventDefault(); mostrarEsqueci(true); });

el('formCodigo').addEventListener('submit', async e => {
    e.preventDefault();
    const codigo = el('rCodigo').value;
    if (codigo.length !== 6 || !soDigitos(codigo)) {
        return msg('O código deve ter 6 números.');
    }
    if (el('rSenha').value.length < 6) {
        return msg('A nova senha deve ter pelo menos 6 caracteres.');
    }
    if (el('rSenha').value !== el('rSenha2').value) {
        return msg('A confirmação da senha não confere.');
    }
    el('btnRedefinir').disabled = true;
    try {
        const r = await fetch('/login/redefinir-senha', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailRecuperacao, codigo: codigo, nova_senha: el('rSenha').value, confirmar_senha: el('rSenha2').value })
        });
        const d = await r.json();
        if (!r.ok) {
            msg(d.error || 'Erro ao redefinir a senha.');
        } else {
            msg('Senha alterada com sucesso! Entre com a nova senha.', 'sucesso');
            el('formCodigo').reset();
            el('formCodigo').hidden = true;
            el('formLogin').hidden = false;
            el('email').value = emailRecuperacao;
        }
    } catch (err) {
        msg('Erro de comunicação com o servidor.');
    }
    el('btnRedefinir').disabled = false;
});
