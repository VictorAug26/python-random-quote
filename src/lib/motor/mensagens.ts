import { formatarMoeda } from '@/lib/formatacao';
import type { Confianca, DiagnosticoExibivel } from '@/lib/motor/tipos';

/**
 * O texto do relatório.
 *
 * Regra: se a frase não faria sentido dita em voz alta no curral, reescreve.
 * Nada de "dispatch", "peak shaving", "arbitragem tarifária" ou "EMS".
 */

/** A frase principal muda de tom conforme a confiança do cálculo. */
export function frasePrincipal(diagnostico: DiagnosticoExibivel): string {
  const valor = formatarMoeda(diagnostico.economiaMensalReais);

  switch (diagnostico.confianca) {
    case 'alta':
      return `Com um sistema de baterias, você pode economizar cerca de ${valor} por mês.`;
    case 'media':
      return `Pelas contas, um sistema de baterias pode economizar por volta de ${valor} por mês.`;
    case 'baixa':
      return `Pelo que dá para estimar, um sistema de baterias pode economizar algo em torno de ${valor} por mês.`;
  }
}

export function explicacaoConfianca(confianca: Confianca): string {
  switch (confianca) {
    case 'alta':
      return 'Você informou o consumo em kWh e a sua tarifa, então essa estimativa é bem próxima do que dá para esperar.';
    case 'media':
      return 'Faltou uma informação da fatura, então trabalhamos com uma média da região. Com a fatura em mãos, a conta fica mais precisa.';
    case 'baixa':
      return 'Como não tínhamos o consumo em kWh nem a sua tarifa, estimamos por média da região. Com a fatura em mãos, esse número pode mudar bastante.';
  }
}

export function textoPorte(diagnostico: DiagnosticoExibivel): string {
  return `Para a sua propriedade, o porte indicado é de ${diagnostico.bessCapacidadeKwh} kWh de bateria, com ${formatarPotencia(diagnostico.bessPotenciaKw)} de potência.`;
}

export function textoRetorno(diagnostico: DiagnosticoExibivel): string {
  const investimento = formatarMoeda(diagnostico.investimentoEstimadoReais);

  if (diagnostico.paybackMeses === null) {
    return `Um sistema desse porte custa por volta de ${investimento}. Com a economia estimada, o retorno não se paga em prazo razoável.`;
  }

  const anos = (diagnostico.paybackMeses / 12).toFixed(1).replace('.', ',');
  return `Um sistema desse porte custa por volta de ${investimento} instalado, e se pagaria em cerca de ${anos} anos.`;
}

/**
 * Aparece quando a bateria funciona, mas demora demais para se pagar.
 *
 * O outro caso — tarifa sem diferença de horário, em que a bateria não
 * economiza nada — não passa por aqui: ele troca o relatório inteiro pelo
 * CardTarifaPlana, porque ali o assunto deixa de ser o porte da bateria.
 */
export function alertaRevisarTarifa(diagnostico: DiagnosticoExibivel): string | null {
  if (!diagnostico.recomendaRevisarTarifa) return null;
  if (diagnostico.paybackMeses === null) return null;

  return 'Pelo seu perfil de consumo, a bateria demoraria muito para se pagar. Vale conversar antes sobre a sua tarifa e sobre energia solar — pode render mais, com menos investimento.';
}

/** Mensagem pré-formatada do botão de compartilhar. Sem dado pessoal. */
export function mensagemWhatsapp(diagnostico: DiagnosticoExibivel, endereco: string): string {
  // Na tarifa convencional a economia é R$ 0, e mandar "economizo R$ 0 com
  // uma bateria de 15 kWh" para o vizinho não diz nada. O achado ali é outro.
  if (diagnostico.economiaMensalReais <= 0) {
    return [
      `Fiz um diagnóstico de energia da minha propriedade.`,
      `Deu que a minha tarifa cobra o mesmo preço a qualquer hora, então bateria ainda não compensa — o primeiro passo é rever a tarifa.`,
      ``,
      `Veja o resultado: ${endereco}`,
    ].join('\n');
  }

  const valor = formatarMoeda(diagnostico.economiaMensalReais);
  return [
    `Fiz um diagnóstico de energia da minha propriedade.`,
    `Deu que dá para economizar cerca de ${valor} por mês com um sistema de baterias de ${diagnostico.bessCapacidadeKwh} kWh.`,
    ``,
    `Veja o resultado: ${endereco}`,
  ].join('\n');
}

function formatarPotencia(kw: number): string {
  return `${kw.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kW`;
}

/**
 * Quando parte da economia vem de cortar o pico de demanda, vale dizer —
 * é uma economia de natureza diferente, e o produtor do Grupo A reconhece
 * esse item na fatura dele.
 */
export function detalheDaEconomia(diagnostico: DiagnosticoExibivel): string | null {
  if (diagnostico.economiaDemandaReais <= 0) return null;

  return `Desse total, ${formatarMoeda(diagnostico.economiaEnergiaReais)} vêm de usar energia no horário mais barato, e ${formatarMoeda(diagnostico.economiaDemandaReais)} de reduzir a demanda contratada — aquele valor em kW que aparece na sua conta.`;
}
