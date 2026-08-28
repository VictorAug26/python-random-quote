'use client';

import { useState } from 'react';
import { CaixaConsentimento } from '@/components/ui/CaixaConsentimento';
import { Botao } from '@/components/ui/Botao';
import { TEXTO_CONSENTIMENTO } from '@/lib/consentimento';

type Props = {
  token: string;
  mensagemCompartilhar: string;
  /** Se o produtor já autorizou o compartilhamento lá na tela 1. */
  jaConsentiuParceiro: boolean;
};

/**
 * Compartilhar e pedir contato.
 *
 * Só aparece para quem fez o diagnóstico — quem recebe o link vê os números,
 * mas não pede contato no lugar do produtor.
 */
export function AcoesRelatorio({ token, mensagemCompartilhar, jaConsentiuParceiro }: Props) {
  const [querContato, setQuerContato] = useState(false);
  const [consente, setConsente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precisaConsentir = !jaConsentiuParceiro;

  async function pedirContato() {
    if (enviando) return;

    if (precisaConsentir && !consente) {
      setErro('Para o parceiro falar com você, precisamos da sua autorização.');
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const resposta = await fetch('/api/interesse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, consenteParceiro: precisaConsentir ? consente : true }),
      });

      if (resposta.ok) {
        setEnviado(true);
        return;
      }

      const falha = (await resposta.json().catch(() => ({}))) as { erro?: string };
      setErro(
        falha.erro === 'falta_consentimento'
          ? 'Para o parceiro falar com você, precisamos da sua autorização.'
          : 'Não conseguimos registrar agora. Tente de novo em instantes.',
      );
      setEnviando(false);
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.');
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-900">Combinado</h2>
        <p className="mt-2 leading-relaxed text-emerald-900">
          Um parceiro vai falar com você pelo WhatsApp para montar um orçamento. Se mudar de
          ideia, é só avisar no mesmo número.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensagemCompartilhar)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-xl border-2 border-emerald-700 px-6 py-4 text-center text-lg font-semibold text-emerald-800"
      >
        Mandar no WhatsApp
      </a>

      {querContato ? (
        <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
          <p className="leading-relaxed text-stone-700">
            Um parceiro que instala esses sistemas pode falar com você e montar um orçamento
            sem compromisso.
          </p>

          {precisaConsentir ? (
            <CaixaConsentimento
              id="consenteParceiroRelatorio"
              marcado={consente}
              aoMudar={(marcado) => {
                setConsente(marcado);
                setErro(null);
              }}
            >
              {TEXTO_CONSENTIMENTO.compartilhamento_parceiro}
            </CaixaConsentimento>
          ) : null}

          {erro ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {erro}
            </p>
          ) : null}

          <Botao type="button" onClick={pedirContato} carregando={enviando}>
            Pode me chamar
          </Botao>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setQuerContato(true)}
          className="w-full rounded-xl bg-emerald-700 px-6 py-4 text-lg font-semibold text-white active:bg-emerald-800"
        >
          Quero saber mais
        </button>
      )}
    </section>
  );
}
