import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarDiagnosticoPublico, diagnosticoPertenceAoLead } from '@/lib/repositorio/diagnosticos';
import { consentimentoAtivo } from '@/lib/repositorio/leads';
import { mensagemWhatsapp } from '@/lib/motor/mensagens';
import { fonteTarifaria } from '@/lib/motor/tarifas';
import { formatarDataBr } from '@/lib/formatacao';
import { envOpcional } from '@/lib/config';
import { lerSessao } from '@/lib/sessao';
import { CardEconomia, TextoEconomia } from '@/components/relatorio/CardEconomia';
import { CardBateria } from '@/components/relatorio/CardBateria';
import { CardTarifaPlana } from '@/components/relatorio/CardTarifaPlana';
import { AcoesRelatorio } from '@/components/relatorio/AcoesRelatorio';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Seu diagnóstico de energia',
  // Página de resultado individual não tem por que aparecer em busca.
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * TELA 5 — relatório final.
 *
 * Endereço compartilhável, com token aleatório. Mostra só os números: nada de
 * nome, WhatsApp ou propriedade, porque link mandado em grupo de WhatsApp é
 * link público na prática. Os botões de ação só aparecem para quem fez o
 * diagnóstico, reconhecido pelo cookie de sessão.
 */
export default async function PaginaRelatorio({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();

  const diagnostico = await buscarDiagnosticoPublico(token);
  if (!diagnostico) notFound();

  const leadId = await lerSessao();
  const dono = leadId ? await diagnosticoPertenceAoLead(token, leadId) : null;
  const jaConsentiuParceiro =
    dono && leadId ? await consentimentoAtivo(leadId, 'compartilhamento_parceiro') : false;

  const endereco = `${envOpcional('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')}/relatorio/${token}`;
  const fonte = fonteTarifaria();

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-emerald-800">Diagnóstico pronto</p>

      {/*
        Economia zerada só acontece na tarifa convencional, onde não existe
        diferença de preço por horário. Ali o relatório inteiro muda de
        assunto: o achado é a tarifa, não o porte da bateria.
      */}
      {diagnostico.economiaMensalReais > 0 ? (
        <>
          <CardEconomia diagnostico={diagnostico} />
          <TextoEconomia diagnostico={diagnostico} />
          <CardBateria diagnostico={diagnostico} />
        </>
      ) : (
        <CardTarifaPlana diagnostico={diagnostico} />
      )}

      {dono ? (
        <AcoesRelatorio
          token={token}
          mensagemCompartilhar={mensagemWhatsapp(diagnostico, endereco)}
          jaConsentiuParceiro={jaConsentiuParceiro}
        />
      ) : (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="leading-relaxed text-stone-700">
            Este é o resultado de outra propriedade. Quer saber quanto a sua pode economizar?
          </p>
          <Link
            href="/"
            className="mt-4 block w-full rounded-xl bg-emerald-700 px-6 py-4 text-center text-lg font-semibold text-white active:bg-emerald-800"
          >
            Fazer o meu diagnóstico
          </Link>
        </section>
      )}

      {/*
        De onde saiu o preço da energia. Não é detalhe burocrático: é o que
        permite o produtor — ou o contador dele — conferir a conta em vez de
        ter que acreditar. As tarifas são públicas.
      */}
      <p className="text-sm leading-relaxed text-stone-500">
        Esta é uma estimativa a partir do que você respondeu, para dar uma ordem de grandeza.
        O número exato depende da sua fatura e de uma visita técnica.
      </p>

      <p className="text-sm leading-relaxed text-stone-500">
        O preço da energia usado na conta é o da {fonte.rehCurta} da ANEEL, em vigor para
        a CEMIG até {formatarDataBr(fonte.vigenciaFim)}. É tabela pública — dá para conferir.
      </p>
    </div>
  );
}
