// Configuração do frete (a distância é calculada em linha reta entre a loja e o endereço do cliente)

// Loja: Campo Mourão - PR (coordenadas do centro da cidade)
const LOJA = { latitude: -24.0458, longitude: -52.3828 };

// LIMITE DE ENTREGA, em km a partir da loja.
// Vale para QUALQUER CEP e é independente da tabela de preços logo abaixo.
const RAIO_MAXIMO_KM = 100;

// TABELA DE PREÇOS: só define quanto custa, não define até onde entregamos.
// Até "ateKm" quilômetros o frete custa "valor". (Se a distância passar da última faixa mas ainda
// estiver dentro do limite acima, vale o preço da última faixa.)
const FAIXAS = [
    { ateKm: 10, valor: 10 },
    { ateKm: 30, valor: 20 },
    { ateKm: 60, valor: 35 },
    { ateKm: 100, valor: 50 }
];

// Precisão mínima aceita para um CEP de rua (escala "place_rank" do OpenStreetMap):
// 26 = rua, 20 = bairro, 16 = cidade. Abaixo de 20 o endereço é tratado como "não localizado".
const RANK_MINIMO = 20;

// A API pública do OpenStreetMap exige que o aplicativo se identifique
const USER_AGENT = 'StyleShop/1.0 (projeto escolar DW1; styleshopsuporte123@gmail.com)';

module.exports = { LOJA, RAIO_MAXIMO_KM, FAIXAS, RANK_MINIMO, USER_AGENT };
