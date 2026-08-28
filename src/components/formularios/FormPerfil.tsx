'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Campo } from '@/components/ui/Campo';
import { CaixaOpcao } from '@/components/ui/CaixaOpcao';
import { Grupo } from '@/components/ui/Grupo';
import { Botao } from '@/components/ui/Botao';
import {
  ATIVIDADES,
  EQUIPAMENTOS,
  INSTALACOES,
  type Atividade,
  type Equipamento,
  type Instalacao,
} from '@/lib/dominio';
import { esquemaPerfil, errosPorCampo } from '@/lib/validacao/schemas';
import { useErros } from '@/components/formularios/useErros';

export type ValoresPerfil = {
  atividades: Atividade[];
  atividadeOutro: string;
  equipamentos: Equipamento[];
  instalacao: Instalacao | '';
};

export function FormPerfil({ iniciais }: { iniciais: ValoresPerfil }) {
  const router = useRouter();

  const [atividades, setAtividades] = useState<Atividade[]>(iniciais.atividades);
  const [atividadeOutro, setAtividadeOutro] = useState(iniciais.atividadeOutro);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>(iniciais.equipamentos);
  const [instalacao, setInstalacao] = useState<Instalacao | ''>(iniciais.instalacao);

  const { erros, setErros, limpar } = useErros();
  const [enviando, setEnviando] = useState(false);

  function alternar<T>(lista: T[], valor: T, marcado: boolean): T[] {
    return marcado ? [...lista, valor] : lista.filter((item) => item !== valor);
  }

  const marcouOutra = atividades.includes('outro');

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const bruto = {
      atividades,
      equipamentos,
      instalacao,
      ...(marcouOutra && atividadeOutro.trim() ? { atividadeOutro } : {}),
    };

    const local = esquemaPerfil.safeParse(bruto);
    if (!local.success) {
      setErros(errosPorCampo(local.error));
      return;
    }

    setEnviando(true);
    setErros({});

    try {
      const resposta = await fetch('/api/perfil', {
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
        erro?: string;
        campos?: Record<string, string>;
        proximaEtapa?: string;
      };

      // Sessão perdida (cookie expirado, outro aparelho): recomeça na tela 1.
      if (resposta.status === 401) {
        router.push(falha.proximaEtapa ?? '/');
        return;
      }

      setErros(
        falha.campos ?? {
          formulario: 'Não conseguimos salvar agora. Tente de novo em instantes.',
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
      <Grupo
        titulo="O que a fazenda produz?"
        ajuda="Pode marcar mais de uma."
        erro={erros.atividades}
      >
        {ATIVIDADES.map((opcao) => (
          <CaixaOpcao
            key={opcao.valor}
            tipo="checkbox"
            id={opcao.valor}
            marcado={atividades.includes(opcao.valor)}
            aoMudar={(marcado) => {
              setAtividades((atual) => alternar(atual, opcao.valor, marcado));
              limpar('atividades');
            }}
            titulo={opcao.titulo}
            descricao={opcao.descricao}
          />
        ))}

        {marcouOutra ? (
          <div className="pt-1">
            <Campo
              id="atividadeOutro"
              rotulo="Qual atividade?"
              placeholder="Suinocultura, avicultura…"
              value={atividadeOutro}
              onChange={(e) => {
                setAtividadeOutro(e.target.value);
                limpar('atividadeOutro');
              }}
              erro={erros.atividadeOutro}
            />
          </div>
        ) : null}
      </Grupo>

      <Grupo
        titulo="O que tem funcionando na propriedade?"
        ajuda="Marque o que existe. Se não tiver nenhum, siga em frente."
        erro={erros.equipamentos}
      >
        {EQUIPAMENTOS.map((opcao) => (
          <CaixaOpcao
            key={opcao.valor}
            tipo="checkbox"
            id={opcao.valor}
            marcado={equipamentos.includes(opcao.valor)}
            aoMudar={(marcado) => {
              setEquipamentos((atual) => alternar(atual, opcao.valor, marcado));
              limpar('equipamentos');
            }}
            titulo={opcao.titulo}
            descricao={opcao.descricao}
          />
        ))}
      </Grupo>

      <Grupo titulo="Já tem energia solar ou baterias?" erro={erros.instalacao}>
        {INSTALACOES.map((opcao) => (
          <CaixaOpcao
            key={opcao.valor}
            tipo="radio"
            nome="instalacao"
            id={opcao.valor}
            marcado={instalacao === opcao.valor}
            aoMudar={() => {
              setInstalacao(opcao.valor);
              limpar('instalacao');
            }}
            titulo={opcao.titulo}
          />
        ))}
      </Grupo>

      {erros.formulario ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800">
          {erros.formulario}
        </p>
      ) : null}

      <Botao type="submit" carregando={enviando}>
        Continuar
      </Botao>
    </form>
  );
}
