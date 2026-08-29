import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Atividade, ClasseTarifaria, Equipamento } from '@/lib/dominio';
import type { Diagnostico, DiagnosticoExibivel, EntradasMotor } from '@/lib/motor/tipos';
import type { EntradaCadastro } from '@/lib/repositorio/leads';
import type { EntradaPerfil, PerfilSalvo } from '@/lib/repositorio/perfis';
import type { ConsumoSalvo, EntradaConsumo } from '@/lib/repositorio/consumos';

/**
 * O banco do modo demonstração: um punhado de Maps.
 *
 * Reproduz o comportamento que aparece na tela — inclusive as recusas por
 * falta de consentimento, que são parte do fluxo que se quer avaliar. O que
 * não dá para reproduzir aqui é a garantia: no Postgres essas regras estão
 * dentro do banco, e nenhum código consegue passar por cima.
 */

type Finalidade = 'diagnostico' | 'compartilhamento_parceiro';

type LeadEmMemoria = {
  id: string;
  nome: string;
  whatsapp: string;
  etapa: string;
};

type DiagnosticoEmMemoria = {
  id: string;
  leadId: string;
  token: string;
  diagnostico: Diagnostico;
};

type Dados = {
  leads: Map<string, LeadEmMemoria>;
  consentimentos: { leadId: string; finalidade: Finalidade; concedido: boolean }[];
  perfis: Map<string, PerfilSalvo>;
  consumos: Map<string, ConsumoSalvo>;
  diagnosticos: Map<string, DiagnosticoEmMemoria>;
  interesses: { leadId: string; diagnosticoId: string }[];
};

/**
 * Os dados moram no globalThis, não em variáveis de módulo.
 *
 * Em desenvolvimento o Next compila páginas e rotas de API em bundles
 * separados, e cada um receberia a sua própria cópia do módulo — a tela 3
 * gravaria num Map e a página do relatório leria de outro, vazio. É o mesmo
 * motivo pelo qual cliente de banco em Next vira singleton global.
 */
const global = globalThis as typeof globalThis & { __dadosDemo?: Dados };

const dados: Dados = (global.__dadosDemo ??= {
  leads: new Map(),
  consentimentos: [],
  perfis: new Map(),
  consumos: new Map(),
  diagnosticos: new Map(),
  interesses: [],
});

const { leads, consentimentos, perfis, consumos, diagnosticos, interesses } = dados;

/** Última manifestação vence — mesma regra da fn_consentimento_ativo. */
export function consentimentoAtivoDemo(leadId: string, finalidade: Finalidade): boolean {
  for (let i = consentimentos.length - 1; i >= 0; i--) {
    const registro = consentimentos[i];
    if (registro && registro.leadId === leadId && registro.finalidade === finalidade) {
      return registro.concedido;
    }
  }
  return false;
}

function exigirConsentimentoDeDiagnostico(leadId: string): void {
  if (!consentimentoAtivoDemo(leadId, 'diagnostico')) {
    throw new Error(`Gravação bloqueada: o titular ${leadId} não autorizou o uso dos dados.`);
  }
}

// --- tela 1 -----------------------------------------------------------------

export function registrarCadastroDemo(entrada: EntradaCadastro): string {
  if (!entrada.consenteDiagnostico) {
    throw new Error('Cadastro recusado: o consentimento para gerar o diagnóstico é obrigatório.');
  }

  const id = randomUUID();
  leads.set(id, {
    id,
    nome: entrada.nome,
    whatsapp: entrada.whatsapp,
    etapa: 'cadastro',
  });

  consentimentos.push(
    { leadId: id, finalidade: 'diagnostico', concedido: entrada.consenteDiagnostico },
    { leadId: id, finalidade: 'compartilhamento_parceiro', concedido: entrada.consenteParceiro },
  );

  return id;
}

// --- tela 2 -----------------------------------------------------------------

export function salvarPerfilDemo(entrada: EntradaPerfil): void {
  exigirConsentimentoDeDiagnostico(entrada.leadId);

  perfis.set(entrada.leadId, {
    atividades: entrada.atividades as Atividade[],
    atividadeOutro: entrada.atividadeOutro ?? null,
    equipamentos: entrada.equipamentos as Equipamento[],
    possuiSolar: entrada.possuiSolar,
    possuiBess: entrada.possuiBess,
  });

  const lead = leads.get(entrada.leadId);
  if (lead && lead.etapa === 'cadastro') lead.etapa = 'perfil';
}

export function buscarPerfilDemo(leadId: string): PerfilSalvo | null {
  return perfis.get(leadId) ?? null;
}

// --- tela 3 -----------------------------------------------------------------

export function salvarConsumoDemo(entrada: EntradaConsumo): void {
  exigirConsentimentoDeDiagnostico(entrada.leadId);

  consumos.set(entrada.leadId, {
    valorFaturaReais: entrada.valorFaturaReais,
    consumoKwh: entrada.consumoKwh,
    classeTarifaria: entrada.classeTarifaria as ClasseTarifaria,
    demandaContratadaKw: entrada.demandaContratadaKw,
  });

  const lead = leads.get(entrada.leadId);
  if (lead && (lead.etapa === 'cadastro' || lead.etapa === 'perfil')) lead.etapa = 'consumo';
}

export function buscarConsumoDemo(leadId: string): ConsumoSalvo | null {
  return consumos.get(leadId) ?? null;
}

// --- telas 4 e 5 ------------------------------------------------------------

export function registrarDiagnosticoDemo(
  leadId: string,
  diagnostico: Diagnostico,
  _entradas: EntradasMotor,
): string {
  exigirConsentimentoDeDiagnostico(leadId);

  const token = randomUUID();
  diagnosticos.set(token, { id: randomUUID(), leadId, token, diagnostico });

  const lead = leads.get(leadId);
  if (lead) lead.etapa = 'diagnostico';

  return token;
}

/** Devolve só o que a view diagnosticos_publicos devolveria. */
export function buscarDiagnosticoPublicoDemo(token: string): DiagnosticoExibivel | null {
  const registro = diagnosticos.get(token);
  if (!registro) return null;

  const d = registro.diagnostico;
  return {
    economiaMensalReais: d.economiaMensalReais,
    economiaEnergiaReais: d.economiaEnergiaReais,
    economiaDemandaReais: d.economiaDemandaReais,
    economiaMinReais: d.economiaMinReais,
    economiaMaxReais: d.economiaMaxReais,
    economiaPercentual: d.economiaPercentual,
    bessCapacidadeKwh: d.bessCapacidadeKwh,
    bessPotenciaKw: d.bessPotenciaKw,
    investimentoEstimadoReais: d.investimentoEstimadoReais,
    paybackMeses: d.paybackMeses,
    confianca: d.confianca,
    recomendaRevisarTarifa: d.recomendaRevisarTarifa,
    economiaSeMigrarParaBrancaReais: d.economiaSeMigrarParaBrancaReais,
  };
}

export function diagnosticoPertenceAoLeadDemo(
  token: string,
  leadId: string,
): { diagnosticoId: string } | null {
  const registro = diagnosticos.get(token);
  return registro && registro.leadId === leadId ? { diagnosticoId: registro.id } : null;
}

export function registrarInteresseDemo(
  leadId: string,
  diagnosticoId: string,
  consenteParceiro: boolean,
): void {
  if (consenteParceiro && !consentimentoAtivoDemo(leadId, 'compartilhamento_parceiro')) {
    consentimentos.push({ leadId, finalidade: 'compartilhamento_parceiro', concedido: true });
  }

  if (!consentimentoAtivoDemo(leadId, 'compartilhamento_parceiro')) {
    throw new Error('Interesse não registrado: falta a autorização de contato do parceiro.');
  }

  interesses.push({ leadId, diagnosticoId });

  const lead = leads.get(leadId);
  if (lead) lead.etapa = 'concluido';
}
