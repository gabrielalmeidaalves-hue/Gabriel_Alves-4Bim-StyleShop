// ===== Validações desta tela =====

// Tamanhos mais comuns (o servidor confere a mesma lista em produtoController.js)
const TAMANHOS = [
    'PP', 'P', 'M', 'G', 'GG', 'XG', 'Único',
    '34', '36', '38', '40', '42', '44', '46',
    '2', '4', '6', '8', '10', '12', '14'
];

// true se o texto tiver só dígitos (0 a 9)
function soDigitos(texto) {
    return /^[0-9]+$/.test(texto);
}

// ID: número inteiro maior que zero
function idValido(texto) {
    if (!soDigitos(texto)) { return false; }
    if (Number(texto) < 1) { return false; }
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

// ===== Fim das validações =====

// Configuração da API, IP e porta.
const API_BASE_URL = '';
let currentPersonId = null;
let operacao = null;

// --- CONSTANTES DE CAMINHO DE IMAGEM ---
// Rota base para servir a imagem (do seu routerImagem.js)
const VIEW_IMAGE_BASE_URL = `${API_BASE_URL}/view-image`;
// Rota base para o upload/download da imagem (do seu routerImagem.js)
// Fallback para quando a imagem não for encontrada
const FALLBACK_IMAGE_PATH = '/imagens/silhueta.webp';
// =====================================

// Elementos do DOM
const form = document.getElementById('produtoForm');
const searchId = document.getElementById('searchId');
const btnBuscar = document.getElementById('btnBuscar');
const btnIncluir = document.getElementById('btnIncluir');
const btnAlterar = document.getElementById('btnAlterar');
const btnExcluir = document.getElementById('btnExcluir');
const btnCancelar = document.getElementById('btnCancelar');
const btnSalvar = document.getElementById('btnSalvar');
const produtosTableBody = document.getElementById('produtosTableBody');
const messageContainer = document.getElementById('messageContainer');

// >>> ELEMENTOS DOM PARA IMAGEM <<<
const imgProdutoVisualizacao = document.getElementById('imgProdutoVisualizacao');
const imgProdutoInput = document.getElementById('imgProdutoInput');


// Carregar lista de produtos ao inicializar
document.addEventListener('DOMContentLoaded', () => {
    carregarTamanhos();
    carregarCategorias();
    carregarProdutos();
    // Garante que a imagem inicial seja o fallback
    imgProdutoVisualizacao.src = FALLBACK_IMAGE_PATH;
    imgProdutoVisualizacao.alt = 'Imagem Padrão';
});

// Event Listeners
btnBuscar.addEventListener('click', buscarProduto);
btnIncluir.addEventListener('click', incluirProduto);
btnAlterar.addEventListener('click', alterarProduto);
btnExcluir.addEventListener('click', excluirProduto);
btnCancelar.addEventListener('click', cancelarOperacao);
btnSalvar.addEventListener('click', salvarOperacao);

// >>> NOVO EVENT LISTENER PARA UPLOAD DA IMAGEM <<<


mostrarBotoes(true, false, false, false, false, false);// mostrarBotoes(btBuscar, btIncluir, btAlterar, btExcluir, btSalvar, btCancelar)
bloquearCampos(false);//libera pk e bloqueia os demais campos

// Função para mostrar mensagens
// Preenche o menu de tamanhos com a lista TAMANHOS (no começo deste arquivo)
function carregarTamanhos() {
    const sel = document.getElementById('tamanho');
    sel.innerHTML = '';
    TAMANHOS.forEach(t => {
        sel.innerHTML += `<option value="${t}">${t}</option>`;
    });
}

async function carregarCategorias() {
    try {
        const r = await fetch(`${API_BASE_URL}/categoria_roupa/listar`);
        const d = await r.json();
        const sel = document.getElementById('id_categoria_roupa');
        sel.innerHTML = (d.categorias || []).map(c => `<option value="${c.id_categoria_roupa}">${c.nome_categoria_roupa}</option>`).join('');
    } catch (e) { console.error('Erro ao carregar categorias', e); }
}

function mostrarMensagem(texto, tipo = 'info') {
    messageContainer.innerHTML = `<div class="message ${tipo}">${texto}</div>`;
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 3000);
}

function bloquearCampos(bloquearPrimeiro) {
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach((input) => {
        // Se for o searchId (PK)
        if (input.id === 'searchId') {
            // Bloqueia searchId se 'bloquearPrimeiro' for TRUE, libera se for FALSE
            input.disabled = bloquearPrimeiro;
        } else {
            // Demais campos: Bloqueia se 'bloquearPrimeiro' for FALSE, libera se for TRUE
            input.disabled = !bloquearPrimeiro;
        }
    });
}

// Função para limpar formulário
function limparFormulario() {
    form.reset();
    // Garante que a imagem volta para o padrão quando o formulário é limpo
    imgProdutoVisualizacao.src = FALLBACK_IMAGE_PATH;
    imgProdutoVisualizacao.alt = 'Imagem Padrão';
}


function mostrarBotoes(btBuscar, btIncluir, btAlterar, btExcluir, btSalvar, btCancelar) {
    btnBuscar.style.display = btBuscar ? 'inline-block' : 'none';
    btnIncluir.style.display = btIncluir ? 'inline-block' : 'none';
    btnAlterar.style.display = btAlterar ? 'inline-block' : 'none';
    btnExcluir.style.display = btExcluir ? 'inline-block' : 'none';
    btnSalvar.style.display = btSalvar ? 'inline-block' : 'none';
    btnCancelar.style.display = btCancelar ? 'inline-block' : 'none';
}

// Funções de formatação (mantidas)
function formatarData(dataString) {
    if (!dataString) return '';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
}
function converterDataParaISO(dataString) {
    if (!dataString) return null;
    return new Date(dataString).toISOString();
}

// Função para buscar produto por ID
async function buscarProduto() {
    const id = searchId.value.trim();
    if (!id) {
        mostrarMensagem('Digite um ID para buscar', 'warning');
        return;
    }
    if (!idValido(id)) {
        mostrarMensagem('O ID deve ser um número inteiro maior que zero.', 'warning');
        return;
    }
    searchId.focus();
    try {
        const response = await fetch(`${API_BASE_URL}/produto/${id}`);
        // console.log(JSON.stringify(response));

        if (response.ok) {
            const produto = await response.json();
            preencherFormulario(produto);

            mostrarBotoes(true, false, true, true, false, true);// Mostrar Alterar/Excluir, Cancelar
            bloquearCampos(false); // Libera PK (Search ID) e Bloqueia os demais.
            mostrarMensagem('Produto encontrado!', 'success');

        } else if (response.status === 404) {
            limparFormulario();
            searchId.value = id;
            mostrarBotoes(true, true, false, false, false, false); // Mostrar Buscar/Incluir
            bloquearCampos(false); // Libera PK (Search ID) e Bloqueia os demais.
            mostrarMensagem('Produto não encontrado. Você pode incluir um novo produto.', 'info');
        } else {
            throw new Error('Erro ao buscar produto');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao buscar produto', 'error');
    }
}

// Função para preencher formulário com dados da produto
function preencherFormulario(produto) {

    // Assumindo que o backend retorna 'idproduto', 'nomeproduto', etc.,
    // e o seu HTML usa 'id_produto', 'nome_produto', etc.
    // Usaremos a coerência do backend onde possível, mas o HTML é o padrão:

    const produtoId = produto.idproduto || produto.id_produto;
    currentPersonId = produtoId;
    searchId.value = produtoId;
    document.getElementById('reporId').value = produtoId;

    // >>> USANDO OS NOVOS IDs DO HTML: nome_produto, quantidade_estoque_produto, preco_unitario_produto <<<
    document.getElementById('nome_produto').value = produto.nomeproduto || produto.nome_produto || '';
    document.getElementById('quantidade_estoque_produto').value = produto.quantidadeemestoque || produto.quantidade_estoque_produto || 0;
    document.getElementById('preco_unitario_produto').value = produto.preco_unitario_produto || 0;
    document.getElementById('id_categoria_roupa').value = produto.id_categoria_roupa || '';
    // se o produto tem um tamanho que não está na lista, acrescenta para não perder o valor
    if (produto.tamanho && !TAMANHOS.includes(produto.tamanho)) {
        document.getElementById('tamanho').innerHTML += `<option value="${produto.tamanho}">${produto.tamanho}</option>`;
    }
    document.getElementById('tamanho').value = produto.tamanho || TAMANHOS[0];
    document.getElementById('cor').value = produto.cor || '';

    // Lógica para carregamento dinâmico da imagem com fallback
    const imgElement = document.getElementById('imgProdutoVisualizacao');

    if (imgElement) {
        imgElement.style.width = '200px';
        imgElement.style.height = '200px';
    }

    // Limpa erro anterior e define o handler de erro para o fallback
    imgElement.onerror = function() {
        // Se a imagem com o ID não for encontrada via /view-image, carrega o fallback.
        imgElement.src = FALLBACK_IMAGE_PATH;
        imgElement.alt = 'Imagem Padrão não encontrada';
        imgElement.onerror = null; // Evita loop
    };

    if (imgElement && produtoId) {
        // Tenta carregar a imagem usando a rota /view-image/:produtoId
        // Adiciona um timestamp para forçar o navegador a recarregar (burlar o cache)
        const imagePath = `${VIEW_IMAGE_BASE_URL}/${produtoId}?t=${new Date().getTime()}`;
        imgElement.src = imagePath;
        imgElement.alt = `Imagem do Produto ID ${produtoId}`;

    } else if (imgElement) {
        // Se não houver ID do produto, mostra o fallback imediatamente
        imgElement.src = FALLBACK_IMAGE_PATH;
        imgElement.alt = 'Imagem Padrão';
        imgElement.onerror = null;
    }
}


// ----- Imagem do produto (mesmo funcionamento do projeto LojaRoupas) -----
// 1) clica na imagem  2) escolhe o arquivo (aparece a prévia)  3) o envio acontece ao clicar em Salvar

function acionarUpload() {
    if (operacao !== 'incluir' && operacao !== 'alterar') {
        mostrarMensagem('Clique em Incluir ou Alterar primeiro para poder escolher uma imagem.', 'warning');
        return;
    }
    imgProdutoInput.click();
}

function previewImagem() {
    if (imgProdutoInput.files.length > 0) {
        imgProdutoVisualizacao.src = URL.createObjectURL(imgProdutoInput.files[0]);
        mostrarMensagem('Imagem escolhida! Clique em Salvar para concluir.', 'info');
    }
}

// Envia a imagem escolhida para o servidor. Devolve '' se deu certo (ou se não havia imagem)
// ou o texto do erro.
async function uploadImagemParaServidor(id) {
    if (imgProdutoInput.files.length === 0) return '';
    const formData = new FormData();
    formData.append('imagem', imgProdutoInput.files[0]);
    try {
        const resposta = await fetch(`${API_BASE_URL}/produto/upload/${id}`, { method: 'POST', body: formData });
        const dados = await resposta.json();
        return dados.sucesso ? '' : dados.mensagem;
    } catch (erro) {
        return 'Erro ao enviar a imagem.';
    }
}

// ----- Reposição de estoque -----
async function reporEstoque() {
    const id = document.getElementById('reporId').value.trim();
    const qtd = document.getElementById('reporQtd').value.trim();
    if (!idValido(id)) {
        mostrarMensagem('O ID deve ser um número inteiro maior que zero.', 'warning');
        return;
    }
    if (!idValido(qtd)) {
        mostrarMensagem('A quantidade deve ser um número inteiro maior que zero.', 'warning');
        return;
    }
    try {
        const resposta = await fetch(`${API_BASE_URL}/produto/${id}/estoque`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade: parseInt(qtd, 10) })
        });
        const dados = await resposta.json();
        if (resposta.ok) {
            mostrarMensagem(`Estoque de "${dados.nome_produto}" agora é ${dados.quantidade_estoque_produto}.`, 'success');
            document.getElementById('reporQtd').value = '';
            carregarProdutos();
        } else {
            mostrarMensagem(dados.error || 'Erro ao repor estoque', 'error');
        }
    } catch (erro) {
        mostrarMensagem('Erro ao comunicar com o servidor', 'error');
    }
}
document.getElementById('btnRepor').addEventListener('click', reporEstoque);

// Função para incluir produto
async function incluirProduto() {
    mostrarMensagem('Digite os dados!', 'success');
    currentPersonId = searchId.value;
    limparFormulario();
    searchId.value = currentPersonId;
    bloquearCampos(true); // Bloqueia PK (Search ID) e Libera os demais.

    mostrarBotoes(false, false, false, false, true, true); // Mostrar Salvar/Cancelar
    // >>> FOCA NO PRIMEIRO CAMPO DE DADOS <<<
    document.getElementById('nome_produto').focus();
    operacao = 'incluir';
}

// Função para alterar produto
async function alterarProduto() {
    mostrarMensagem('Digite os dados!', 'success');
    bloquearCampos(true); // Bloqueia PK (Search ID) e Libera os demais.
    mostrarBotoes(false, false, false, false, true, true);// Mostrar Salvar/Cancelar
    // >>> FOCA NO PRIMEIRO CAMPO DE DADOS <<<
    document.getElementById('nome_produto').focus();
    operacao = 'alterar';
}

// Função para excluir produto
async function excluirProduto() {
    mostrarMensagem('Confirmar exclusão? Clique em Salvar!', 'info');
    currentPersonId = searchId.value;
    searchId.disabled = true; // Bloqueia searchId para exclusão
    bloquearCampos(false); // Mantém os campos bloqueados
    mostrarBotoes(false, false, false, false, true, true);// Mostrar Salvar/Cancelar
    operacao = 'excluir';
}

async function salvarOperacao() {
    console.log('Operação:', operacao + ' - currentPersonId: ' + currentPersonId + ' - searchId: ' + searchId.value);

    // >>> USANDO OS NOVOS IDs DO HTML PARA PEGAR OS VALORES <<<
    const produto = {
        id_produto: searchId.value,
        nome_produto: document.getElementById('nome_produto').value,
        quantidade_estoque_produto: document.getElementById('quantidade_estoque_produto').value,
        preco_unitario_produto: document.getElementById('preco_unitario_produto').value,
        id_categoria_roupa: document.getElementById('id_categoria_roupa').value,
        tamanho: document.getElementById('tamanho').value,
        cor: document.getElementById('cor').value,
    };

   // alert(JSON.stringify(produto));

    if (operacao === 'incluir' || operacao === 'alterar') {
        if (Number(produto.quantidade_estoque_produto) < 0 || produto.quantidade_estoque_produto === '') {
            mostrarMensagem('O estoque não pode ser negativo.', 'warning');
            return;
        }
        if (Number(produto.preco_unitario_produto) < 0 || produto.preco_unitario_produto === '') {
            mostrarMensagem('O preço não pode ser negativo.', 'warning');
            return;
        }
    }
    let response = null;
    try {
        let url = `${API_BASE_URL}/produto`;

        let method = 'POST';
        let body = JSON.stringify(produto);
        let headers = { 'Content-Type': 'application/json' };

        if (operacao === 'alterar') {
            url = `${API_BASE_URL}/produto/${currentPersonId}`;
            method = 'PUT';
        } else if (operacao === 'excluir') {
            url = `${API_BASE_URL}/produto/${currentPersonId}`;
            method = 'DELETE';
            body = undefined;
            headers = {};
        }

        response = await fetch(url, { method, headers, body });

        if (response.ok) {
            if (operacao === 'excluir') {
                mostrarMensagem('Produto excluído com sucesso!', 'success');
            } else {
                // id do produto salvo: na inclusão vem na resposta (pode ter sido gerado pela sequence)
                const salvo = await response.json();
                const erroImagem = await uploadImagemParaServidor(salvo.id_produto);
                if (erroImagem) {
                    mostrarMensagem(`Produto salvo, mas a imagem falhou: ${erroImagem}`, 'warning');
                } else {
                    mostrarMensagem(`Operação ${operacao} realizada com sucesso!`, 'success');
                }
            }
            limparFormulario();
            carregarProdutos();
        } else {
            const error = await response.json();
            mostrarMensagem(error.error || `Erro ao ${operacao} produto`, 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao comunicar com o servidor', 'error');
    }

    mostrarBotoes(true, false, false, false, false, false);// Mostrar Buscar
    bloquearCampos(false);// Libera PK e Bloqueia os demais.
    document.getElementById('searchId').focus();
}

// Função para cancelar operação
function cancelarOperacao() {
    limparFormulario();
    mostrarBotoes(true, false, false, false, false, false);// Mostrar Buscar
    bloquearCampos(false);// Libera PK e Bloqueia os demais.
    document.getElementById('searchId').focus();
    mostrarMensagem('Operação cancelada', 'info');
}

// Função para carregar lista de produtos
async function carregarProdutos() {
    try {
        const response = await fetch(`${API_BASE_URL}/produto`);

        if (response.ok) {
            const produtos = await response.json();
            renderizarTabelaProdutos(produtos);
        } else {
            throw new Error('Erro ao carregar produtos');
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('Erro ao carregar lista de produtos', 'error');
    }
}

// Função para renderizar tabela de produtos
function renderizarTabelaProdutos(produtos) {
    produtosTableBody.innerHTML = '';

    produtos.forEach(produto => {
        // Tenta usar os nomes mais comuns do backend/JSON
        const id = produto.idproduto || produto.id_produto;
        const nome = produto.nomeproduto || produto.nome_produto;
        const estoque = produto.quantidadeemestoque || produto.quantidade_estoque_produto;
        const preco = produto.precounitario || produto.preco_unitario_produto;

        const row = document.createElement('tr');
        row.innerHTML = `
                    <td>
                        <button class="btn-id" onclick="selecionarProduto(${id})">
                            ${id}
                        </button>
                    </td>
                    <td>${nome}</td>
                    <td>${estoque}</td>
                    <td>${Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>${produto.nome_categoria_roupa || produto.id_categoria_roupa}</td>
                    <td>${produto.tamanho}</td>
                    <td>${produto.cor}</td>
                `;
        produtosTableBody.appendChild(row);
    });
}

// Função para selecionar produto da tabela
async function selecionarProduto(id) {
    searchId.value = id;
    await buscarProduto();
}