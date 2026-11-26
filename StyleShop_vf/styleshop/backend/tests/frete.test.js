const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularDistanciaKm, valorPelaDistancia } = require('../controllers/freteController');
const { LOJA, RAIO_MAXIMO_KM, FAIXAS } = require('../config/frete');

test('distância entre um ponto e ele mesmo é zero', () => {
  assert.equal(calcularDistanciaKm(LOJA.latitude, LOJA.longitude, LOJA.latitude, LOJA.longitude), 0);
});

test('distância Haversine é positiva e simétrica', () => {
  const a = calcularDistanciaKm(-24.0458, -52.3828, -23.5, -52.0);
  const b = calcularDistanciaKm(-23.5, -52.0, -24.0458, -52.3828);
  assert.ok(a > 0);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('faixas de preço do frete permanecem corretas', () => {
  assert.equal(valorPelaDistancia(0), 10);
  assert.equal(valorPelaDistancia(10), 10);
  assert.equal(valorPelaDistancia(10.1), 20);
  assert.equal(valorPelaDistancia(30), 20);
  assert.equal(valorPelaDistancia(30.1), 35);
  assert.equal(valorPelaDistancia(60), 35);
  assert.equal(valorPelaDistancia(60.1), 50);
  assert.equal(valorPelaDistancia(100), 50);
});

test('limite de entrega é configurado independentemente das faixas', () => {
  assert.equal(RAIO_MAXIMO_KM, 100);
  assert.equal(FAIXAS.at(-1).ateKm, 100);
});
