/**
 * Busca as tarifas vigentes da CEMIG-D no portal de dados abertos da ANEEL e
 * grava em src/lib/motor/tarifas-cemig.json.
 *
 *   npm run tarifas            # atualiza o arquivo
 *   npm run tarifas -- --check # só verifica se mudou (usado no CI)
 *
 * POR QUE UM ARQUIVO COMMITADO, E NÃO UMA CHAMADA EM TEMPO REAL
 *
 * O app poderia consultar a ANEEL a cada diagnóstico. Não faz, de propósito:
 *
 *   1. Um diagnóstico precisa ser reproduzível. Se o produtor voltar em março
 *      no link do relatório, os números têm que ser os mesmos — e explicáveis
 *      por uma resolução específica, que fica registrada aqui.
 *   2. O portal cair não pode derrubar o diagnóstico.
 *   3. Número que muda sozinho em produção não tem revisão humana. Tarifa
 *      errada vira promessa errada de economia para o produtor.
 *
 * Então a atualização é: script busca → gera diff → alguém olha → merge.
 * O workflow .github/workflows/tarifas.yml faz isso semanalmente e abre PR.
 *
 * FONTE
 *
 * Dataset "Tarifas de aplicação das distribuidoras de energia elétrica",
 * regerado diariamente pela ANEEL, cobrindo todas as distribuidoras do país
 * desde 2010. É dado aberto, sem chave e sem cadastro.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const API = 'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search';
const PORTAL =
  'https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica';
const DISTRIBUIDORA = 'CEMIG-D';
const DESTINO = 'src/lib/motor/tarifas-cemig.json';

/**
 * Recortes que interessam ao diagnóstico.
 *
 * `DscDetalhe` é o campo que separa quem é o consumidor:
 *   "Não se aplica" — consumidor cativo comum. É o nosso caso.
 *   "SCEE"          — quem já tem geração própria e compensa energia.
 *   "APE"           — autoprodutor.
 * Pegar a linha errada aqui dá um número plausível e errado, então o filtro
 * é explícito e a validação no fim confere que veio exatamente uma linha.
 */
const RECORTES = {
  b2_rural_convencional: {
    rotulo: 'B2 Rural — Convencional',
    filtros: {
      DscSubGrupo: 'B2',
      DscClasse: 'Rural',
      DscSubClasse: 'Não se aplica',
      DscModalidadeTarifaria: 'Convencional',
    },
    postos: { unico: 'Não se aplica' },
  },
  b2_rural_branca: {
    rotulo: 'B2 Rural — Branca',
    filtros: {
      DscSubGrupo: 'B2',
      DscClasse: 'Rural',
      DscSubClasse: 'Não se aplica',
      DscModalidadeTarifaria: 'Branca',
    },
    postos: { fora_ponta: 'Fora ponta', intermediario: 'Intermediário', ponta: 'Ponta' },
  },
  a4_verde: {
    rotulo: 'A4 — Verde',
    filtros: { DscSubGrupo: 'A4', DscModalidadeTarifaria: 'Verde' },
    postos: { fora_ponta: 'Fora ponta', ponta: 'Ponta' },
    demanda: { demanda: 'Não se aplica' },
  },
  a4_azul: {
    rotulo: 'A4 — Azul',
    filtros: { DscSubGrupo: 'A4', DscModalidadeTarifaria: 'Azul' },
    postos: { fora_ponta: 'Fora ponta', ponta: 'Ponta' },
    demanda: { demanda_fora_ponta: 'Fora ponta', demanda_ponta: 'Ponta' },
  },
};

/** A ANEEL manda "1.361,78". */
function paraNumero(texto) {
  const n = Number(String(texto).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`valor não numérico vindo da ANEEL: ${texto}`);
  return n;
}

async function buscar(filtros) {
  const url = new URL(API);
  url.searchParams.set('resource_id', RESOURCE_ID);
  url.searchParams.set(
    'filters',
    JSON.stringify({
      SigAgente: DISTRIBUIDORA,
      DscBaseTarifaria: 'Tarifa de Aplicação',
      DscDetalhe: 'Não se aplica',
      ...filtros,
    }),
  );
  url.searchParams.set('sort', 'DatInicioVigencia desc');
  url.searchParams.set('limit', '200');

  const resposta = await fetch(url, { headers: { accept: 'application/json' } });
  if (!resposta.ok) {
    throw new Error(`ANEEL respondeu ${resposta.status} ${resposta.statusText}`);
  }
  const corpo = await resposta.json();
  if (!corpo.success) {
    throw new Error(`ANEEL recusou a consulta: ${JSON.stringify(corpo.error)}`);
  }
  return corpo.result.records;
}

/** Só as linhas da vigência mais recente — o dataset guarda o histórico todo. */
function apenasVigentes(registros, rotulo) {
  if (registros.length === 0) {
    throw new Error(`nenhuma linha para "${rotulo}" — o filtro ou o dataset mudou`);
  }
  const inicio = registros[0].DatInicioVigencia;
  return registros.filter((r) => r.DatInicioVigencia === inicio);
}

/**
 * Uma linha por posto tarifário e unidade. Duas linhas para o mesmo posto
 * significa que algum filtro deixou de discriminar — falha em vez de escolher.
 */
function acharUnica(linhas, posto, unidade, rotulo) {
  const achadas = linhas.filter(
    (r) => r.NomPostoTarifario === posto && r.DscUnidadeTerciaria === unidade,
  );
  if (achadas.length !== 1) {
    throw new Error(
      `"${rotulo}" posto "${posto}" (${unidade}): esperava 1 linha, veio ${achadas.length}. ` +
        `O dataset da ANEEL mudou de forma — confira os filtros em ${import.meta.url}.`,
    );
  }
  return achadas[0];
}

async function coletar() {
  const tarifas = {};
  const vigencias = new Set();
  const rehs = new Set();
  let datasetGeradoEm = null;

  for (const [chave, recorte] of Object.entries(RECORTES)) {
    const vigentes = apenasVigentes(await buscar(recorte.filtros), recorte.rotulo);

    vigencias.add(`${vigentes[0].DatInicioVigencia}|${vigentes[0].DatFimVigencia}`);
    rehs.add(vigentes[0].DscREH);
    datasetGeradoEm = vigentes[0].DatGeracaoConjuntoDados;

    const valores = {};

    // Consumo: a ANEEL publica em R$/MWh; o motor pensa em R$/kWh.
    for (const [nome, posto] of Object.entries(recorte.postos)) {
      const linha = acharUnica(vigentes, posto, 'MWh', recorte.rotulo);
      valores[nome] = Number(
        ((paraNumero(linha.VlrTUSD) + paraNumero(linha.VlrTE)) / 1000).toFixed(5),
      );
    }

    // Demanda: já vem em R$/kW por mês.
    for (const [nome, posto] of Object.entries(recorte.demanda ?? {})) {
      const linha = acharUnica(vigentes, posto, 'kW', recorte.rotulo);
      valores[nome] = Number(
        (paraNumero(linha.VlrTUSD) + paraNumero(linha.VlrTE)).toFixed(2),
      );
    }

    tarifas[chave] = valores;
  }

  if (vigencias.size !== 1 || rehs.size !== 1) {
    throw new Error(
      `os recortes caíram em resoluções diferentes (${[...rehs].join(' | ')}). ` +
        `Provável reajuste no meio da coleta — rode de novo.`,
    );
  }

  const [inicio, fim] = [...vigencias][0].split('|');
  return {
    distribuidora: DISTRIBUIDORA,
    reh: [...rehs][0],
    vigencia: { inicio, fim },
    tarifas,
    fonte: {
      portal: PORTAL,
      resource_id: RESOURCE_ID,
      dataset_gerado_em: datasetGeradoEm,
    },
    observacao:
      'Valores em R$/kWh (consumo) e R$/kW por mês (demanda), SEM tributos e SEM ' +
      'bandeira tarifária. O motor aplica o fator de tributos separadamente — ' +
      'ver PARAMETROS.fatorTributos.',
  };
}

/**
 * Trava de sanidade. Se a ANEEL publicar lixo, ou o filtro pegar a linha
 * errada, é melhor o script quebrar do que o produtor receber promessa errada.
 */
function validar(dados) {
  const t = dados.tarifas;
  const problemas = [];

  const faixa = (rotulo, valor, min, max) => {
    if (typeof valor !== 'number' || valor < min || valor > max) {
      problemas.push(`${rotulo} = ${valor} fora da faixa esperada (${min}–${max})`);
    }
  };

  faixa('b2 convencional', t.b2_rural_convencional.unico, 0.3, 3);
  faixa('b2 branca fora ponta', t.b2_rural_branca.fora_ponta, 0.2, 3);
  faixa('b2 branca ponta', t.b2_rural_branca.ponta, 0.3, 6);
  faixa('a4 verde fora ponta', t.a4_verde.fora_ponta, 0.1, 3);
  faixa('a4 verde ponta', t.a4_verde.ponta, 0.3, 8);
  faixa('a4 verde demanda', t.a4_verde.demanda, 5, 150);
  faixa('a4 azul demanda ponta', t.a4_azul.demanda_ponta, 5, 300);

  if (t.b2_rural_branca.ponta <= t.b2_rural_branca.fora_ponta) {
    problemas.push('branca: ponta não é mais cara que fora ponta — ordem invertida?');
  }
  if (t.a4_verde.ponta <= t.a4_verde.fora_ponta) {
    problemas.push('verde: ponta não é mais cara que fora ponta — ordem invertida?');
  }
  if (!/RESOLU/i.test(dados.reh)) {
    problemas.push(`REH com formato inesperado: "${dados.reh}"`);
  }
  if (new Date(dados.vigencia.fim) < new Date()) {
    problemas.push(
      `a vigência mais recente terminou em ${dados.vigencia.fim} — a ANEEL pode ` +
        `estar atrasada em publicar o reajuste, ou o filtro parou de achar as linhas novas.`,
    );
  }

  if (problemas.length > 0) {
    throw new Error(`tarifas rejeitadas pela validação:\n  - ${problemas.join('\n  - ')}`);
  }
}

// -----------------------------------------------------------------------------

const soVerificar = process.argv.includes('--check');

const dados = await coletar();
validar(dados);

const novo = `${JSON.stringify(dados, null, 2)}\n`;

let atual = null;
try {
  atual = readFileSync(DESTINO, 'utf8');
} catch {
  // primeira execução
}

if (atual === novo) {
  console.log(`Tarifas já estão atualizadas (${dados.reh}).`);
  process.exit(0);
}

if (soVerificar) {
  console.log('As tarifas da ANEEL mudaram em relação ao arquivo commitado.');
  console.log(`  arquivo: ${atual ? JSON.parse(atual).reh : '(não existe)'}`);
  console.log(`  ANEEL:   ${dados.reh}`);
  process.exit(1);
}

writeFileSync(DESTINO, novo);
console.log(`${DESTINO} atualizado.`);
console.log(`  ${dados.reh}`);
console.log(`  vigência ${dados.vigencia.inicio} → ${dados.vigencia.fim}`);
console.log('\n⚠️  Revise o diff antes de commitar: estes números viram promessa');
console.log('   de economia no relatório do produtor.');
