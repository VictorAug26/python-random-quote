'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Campo } from '@/components/ui/Campo';
import { CaixaOpcao } from '@/components/ui/CaixaOpcao';
import { Grupo } from '@/components/ui/Grupo';
import { Botao } from '@/components/ui/Botao';
import { CLASSES_TARIFARIAS, type ClasseTarifaria } from '@/lib/dominio';
import { formatarNumeroBR, limparEntradaNumerica, parsearNumeroBR } from '@/lib/numeros';
import { esquemaConsumo, errosPorCampo } from '@/lib/validacao/schemas';
import { useErros } from '@/components/formularios/useErros';

export type ValoresConsumo = {
  valorFaturaReais: string;
  consumoKwh: string;
  classeTarifaria: ClasseTarifaria | '';
  demandaContratadaKw: string;
};

export function FormConsumo({ iniciais }: { iniciais: ValoresConsumo }) {
  const router = useRouter();

  const [valorFatura, setValorFatura] = useState(iniciais.valorFaturaReais);
  const [consumoKwh, setConsumoKwh] = useState(iniciais.consumoKwh);
  const [classeTarifaria, setClasseTarifaria] = useState<ClasseTarifaria | ''>(
    iniciais.classeTarifaria,
  );
  const [demandaContratada, setDemandaContratada] = useState(iniciais.demandaContratadaKw);

  // A demanda só é cobrada no Grupo A — perguntar nas outras tarifas seria
  // um campo a mais sem uso nenhum.
  const cobraDemanda = classeTarifaria === 'grupo_a';

  const { erros, setErros, limpar } = useErros();
  const [enviando, setEnviando] = useState(false);

  /** Ao sair do campo, arruma a apresentação sem mexer no que foi digitado. */
  function formatarAoSair(texto: string, casas: number): string {
    const numero = parsearNumeroBR(texto);
    return numero === null ? texto : formatarNumeroBR(numero, casas);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const bruto = {
      valorFaturaReais: valorFatura,
      consumoKwh,
      classeTarifaria,
      ...(cobraDemanda ? { demandaContratadaKw: demandaContratada } : {}),
    };

    const local = esquemaConsumo.safeParse(bruto);
    if (!local.success) {
      const encontrados = errosPorCampo(local.error);
      setErros(encontrados);
      document.getElementById(Object.keys(encontrados)[0] ?? 'valorFaturaReais')?.focus();
      return;
    }

    setEnviando(true);
    setErros({});

    try {
      const resposta = await fetch('/api/consumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bruto),
      });

      if (resposta.ok) {
        const { proximaEtapa } = (await resposta.json()) as { proximaEtapa: string };
        router.push(proximaEtapa);
        return;
      }

      const falha = (await resposta.json().catch(() => ({}))) as {
        campos?: Record<string, string>;
        detalhe?: string;
        proximaEtapa?: string;
      };

      if (resposta.status === 401) {
        router.push(falha.proximaEtapa ?? '/');
        return;
      }

      setErros(
        falha.campos ?? {
          // detalhe só vem em desenvolvimento, quando falta configuração.
          formulario: falha.detalhe ?? 'Não conseguimos salvar agora. Tente de novo em instantes.',
        },
      );
      setEnviando(false);
    } catch {
      setErros({ formulario: 'Sem conexão. Verifique a internet e tente de novo.' });
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-8">
      <div className="space-y-5">
        <Campo
          id="valorFaturaReais"
          rotulo="Quanto veio a última conta de luz?"
          ajuda="O valor total da fatura."
          prefixo="R$"
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          placeholder="8.400"
          value={valorFatura}
          onChange={(e) => {
            setValorFatura(limparEntradaNumerica(e.target.value));
            limpar('valorFaturaReais');
          }}
          onBlur={() => setValorFatura((atual) => formatarAoSair(atual, 2))}
          erro={erros.valorFaturaReais}
        />

        <Campo
          id="consumoKwh"
          rotulo="Consumo em kWh (opcional)"
          ajuda="Se a fatura estiver por perto, o número deixa a conta mais certeira. Se não, siga em frente."
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          placeholder="8.900"
          value={consumoKwh}
          onChange={(e) => {
            setConsumoKwh(limparEntradaNumerica(e.target.value));
            limpar('consumoKwh');
          }}
          onBlur={() => setConsumoKwh((atual) => formatarAoSair(atual, 0))}
          erro={erros.consumoKwh}
        />
      </div>

      <Grupo
        titulo="Qual é a sua tarifa?"
        ajuda="Costuma vir escrito na fatura."
        erro={erros.classeTarifaria}
      >
        {CLASSES_TARIFARIAS.map((opcao) => (
          <CaixaOpcao
            key={opcao.valor}
            tipo="radio"
            nome="classeTarifaria"
            id={opcao.valor}
            marcado={classeTarifaria === opcao.valor}
            aoMudar={() => {
              setClasseTarifaria(opcao.valor);
              limpar('classeTarifaria');
            }}
            titulo={opcao.titulo}
            descricao={opcao.descricao}
          />
        ))}

        {cobraDemanda ? (
          <div className="pt-2">
            <Campo
              id="demandaContratadaKw"
              rotulo="Demanda contratada (opcional)"
              ajuda="Vem na fatura em kW. É o que mais pesa na conta de quem é Grupo A — com esse número, a estimativa fica bem mais próxima."
              prefixo="kW"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="150"
              value={demandaContratada}
              onChange={(e) => {
                setDemandaContratada(limparEntradaNumerica(e.target.value));
                limpar('demandaContratadaKw');
              }}
              onBlur={() => setDemandaContratada((atual) => formatarAoSair(atual, 0))}
              erro={erros.demandaContratadaKw}
            />
          </div>
        ) : null}
      </Grupo>

      {erros.formulario ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800">
          {erros.formulario}
        </p>
      ) : null}

      <Botao type="submit" carregando={enviando}>
        Ver meu resultado
      </Botao>
    </form>
  );
}
