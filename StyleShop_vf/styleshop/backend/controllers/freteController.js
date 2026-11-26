// Frete por distância.
// 1) BrasilAPI (CEP v2) devolve o endereço do CEP: rua, bairro, cidade e estado
// 2) OpenStreetMap (Nominatim) localiza essa rua e devolve latitude e longitude
//    (a BrasilAPI sozinha dá, para muitos CEPs, só o ponto central da cidade, e aí todos os CEPs
//     da mesma cidade ficavam com a mesma distância)
// 3) a distância até a loja é calculada com a fórmula de Haversine
// 4) acima do limite (RAIO_MAXIMO_KM) não entregamos; dentro do limite o valor vem da tabela de faixas
// Se o endereço não puder ser localizado com segurança, o usuário recebe uma mensagem (nunca um chute).
const { LOJA, RAIO_MAXIMO_KM, FAIXAS, RANK_MINIMO, USER_AGENT } = require('../config/frete');

const MSG_SERVICO = 'Não foi possível consultar a localização agora. Tente novamente em instantes.';
const MSG_NAO_LOCALIZADO = 'Não conseguimos localizar esse endereço com precisão. Confira o CEP ou tente outro.';

const cache = {};    // CEP -> localização já encontrada (a API pública do OpenStreetMap pede que se evite repetir consultas)
let proximaVez = 0;  // controle de no máximo 1 consulta por segundo ao OpenStreetMap

// minúsculas e sem acento, para comparar nomes de cidade ("Maringá" = "maringa")
function semAcento(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Distância em linha reta entre dois pontos da Terra, em km (fórmula de Haversine)
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const raioTerra = 6371; // km
  const paraRadianos = (graus) => graus * Math.PI / 180;

  const dLat = paraRadianos(lat2 - lat1);
  const dLon = paraRadianos(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(paraRadianos(lat1)) * Math.cos(paraRadianos(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return raioTerra * c;
}

// Valor do frete pela tabela de faixas. Só é chamada para distâncias que já estão dentro do limite.
function valorPelaDistancia(km) {
  for (const faixa of FAIXAS) {
    if (km <= faixa.ateKm) {
      return faixa.valor;
    }
  }
  return FAIXAS[FAIXAS.length - 1].valor; // dentro do limite, mas além da última faixa
}

// Espera a vez: o OpenStreetMap só aceita 1 consulta por segundo
async function esperarVez() {
  const agora = Date.now();
  const minhaVez = Math.max(agora, proximaVez);
  proximaVez = minhaVez + 1100;
  if (minhaVez > agora) {
    await new Promise((resolve) => setTimeout(resolve, minhaVez - agora));
  }
}

// Consulta o OpenStreetMap (texto livre) e devolve a lista de resultados
async function consultarOpenStreetMap(texto) {
  await esperarVez();
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&q=' + encodeURIComponent(texto);
  const resposta = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
    signal: AbortSignal.timeout(8000)
  });
  if (!resposta.ok) {
    throw new Error('OpenStreetMap respondeu ' + resposta.status);
  }
  return await resposta.json();
}

// Escolhe o primeiro resultado que é da MESMA cidade do CEP e tem a precisão mínima.
// Resultado de outra cidade, ou só o ponto da cidade para um CEP de rua, é descartado.
function escolherResultado(resultados, cidade, rankMinimo) {
  for (const r of resultados) {
    const a = r.address || {};
    const cidadeDoResultado = a.city || a.town || a.village || a.municipality;
    if (semAcento(cidadeDoResultado) !== semAcento(cidade)) continue;
    if (Number(r.place_rank) < rankMinimo) continue;
    const latitude = parseFloat(r.lat);
    const longitude = parseFloat(r.lon);
    if (isNaN(latitude) || isNaN(longitude)) continue;
    return { latitude: latitude, longitude: longitude, rank: Number(r.place_rank) };
  }
  return null;
}

// Consulta o endereço do CEP na BrasilAPI
async function buscarEndereco(cep) {
  try {
    const resposta = await fetch('https://brasilapi.com.br/api/cep/v2/' + cep, { signal: AbortSignal.timeout(6000) });
    if (resposta.status === 404) {
      return { erro: 'CEP não encontrado. Confira os números digitados.' };
    }
    if (!resposta.ok) {
      return { erro: MSG_SERVICO };
    }
    return { dados: await resposta.json() };
  } catch (erro) {
    return { erro: MSG_SERVICO };
  }
}

// Descobre latitude/longitude do endereço do CEP. Devolve { latitude, longitude, precisao } ou { erro }.
async function localizar(dados) {
  const rua = dados.street;
  const bairro = dados.neighborhood;
  const cidade = dados.city;
  const estado = dados.state;

  try {
    // CEP único da cidade (não tem rua): o ponto da cidade é a melhor localização que existe
    if (!rua) {
      const c = dados.location && dados.location.coordinates;
      const lat = c ? parseFloat(c.latitude) : NaN;
      const lon = c ? parseFloat(c.longitude) : NaN;
      if (!isNaN(lat) && !isNaN(lon)) {
        return { latitude: lat, longitude: lon, precisao: 'cidade' };
      }
      const achou = escolherResultado(await consultarOpenStreetMap([cidade, estado, 'Brasil'].join(', ')), cidade, 12);
      if (achou) {
        return { latitude: achou.latitude, longitude: achou.longitude, precisao: 'cidade' };
      }
      return { erro: MSG_NAO_LOCALIZADO };
    }

    // CEP de rua: localiza a rua. Primeiro com o bairro; se não achar, só com a cidade.
    const tentativas = [[rua, cidade, estado, 'Brasil']];
    if (bairro) {
      tentativas.unshift([rua, bairro, cidade, estado, 'Brasil']);
    }
    for (const partes of tentativas) {
      const achou = escolherResultado(await consultarOpenStreetMap(partes.join(', ')), cidade, RANK_MINIMO);
      if (achou) {
        return { latitude: achou.latitude, longitude: achou.longitude, precisao: achou.rank >= 26 ? 'rua' : 'bairro' };
      }
    }
    return { erro: MSG_NAO_LOCALIZADO };
  } catch (erro) {
    console.error('Erro ao localizar endereço:', erro.message);
    return { erro: MSG_SERVICO };
  }
}

// Calcula o frete de um CEP.
// Devolve { erro } ou { cep, cidade, estado, rua, bairro, precisao, distancia_km, valor_frete }
async function calcularFrete(cepInformado) {
  const cep = String(cepInformado || '').replace('-', '').trim();
  if (cep.length !== 8 || !/^[0-9]+$/.test(cep)) {
    return { erro: 'CEP inválido. Digite os 8 números.' };
  }

  // localização do CEP (usa a guardada, se este CEP já foi consultado)
  let local = cache[cep];
  if (!local) {
    const endereco = await buscarEndereco(cep);
    if (endereco.erro) {
      return { erro: endereco.erro };
    }
    const ponto = await localizar(endereco.dados);
    if (ponto.erro) {
      return { erro: ponto.erro };
    }
    local = {
      cidade: endereco.dados.city,
      estado: endereco.dados.state,
      rua: endereco.dados.street,
      bairro: endereco.dados.neighborhood,
      latitude: ponto.latitude,
      longitude: ponto.longitude,
      precisao: ponto.precisao
    };
    cache[cep] = local;
  }

  const distancia = Math.round(calcularDistanciaKm(LOJA.latitude, LOJA.longitude, local.latitude, local.longitude) * 10) / 10;

  // LIMITE DE ENTREGA: vale para qualquer CEP e não depende da tabela de preços
  if (distancia > RAIO_MAXIMO_KM) {
    return { erro: 'Não entregamos nessa região (' + local.cidade + '/' + local.estado + ', a ' + distancia + ' km da loja). Entregamos em até ' + RAIO_MAXIMO_KM + ' km.' };
  }

  return {
    cep: cep,
    cidade: local.cidade,
    estado: local.estado,
    rua: local.rua,
    bairro: local.bairro,
    precisao: local.precisao,
    distancia_km: distancia,
    valor_frete: valorPelaDistancia(distancia)
  };
}

// POST /frete/calcular  { cep }
exports.calcular = async (req, res) => {
  try {
    const cep = req.body && req.body.cep;
    const frete = await calcularFrete(cep);
    if (frete.erro) {
      return res.status(400).json({ error: frete.erro });
    }
    return res.json(frete);
  } catch (erro) {
    console.error('Erro inesperado ao calcular frete:', erro);
    return res.status(500).json({ error: MSG_SERVICO });
  }
};

exports.calcularFrete = calcularFrete;
exports.calcularDistanciaKm = calcularDistanciaKm;
exports.valorPelaDistancia = valorPelaDistancia;
