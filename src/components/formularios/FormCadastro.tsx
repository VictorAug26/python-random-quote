'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Campo } from '@/components/ui/Campo';
import { CaixaConsentimento } from '@/components/ui/CaixaConsentimento';
import { Botao } from '@/components/ui/Botao';
import { mascararTelefone } from '@/lib/telefone';
import { MUNICIPIOS_REGIAO } from '@/lib/municipios';
import { TEXTO_CONSENTIMENTO } from '@/lib/consentimento';
import { esquemaCadastro, errosPorCampo } from '@/lib/validacao/schemas';
import { useErros } from '@/components/formularios/useErros';

export function FormCadastro({ origem }: { origem?: string | undefined }) {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nomePropriedade, setNomePropriedade] = useState('');
  const [municipio, setMunicipio] = useState('');

  // Os dois começam desmarcados. Sempre.
  const [consenteDiagnostico, setConsenteDiagnostico] = useState(false);
  const [consenteParceiro, setConsenteParceiro] = useState(false);

  const { erros, setErros, limpar } = useErros();
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const bruto = {
      nome,
      whatsapp,
      nomePropriedade,
      municipio,
      consenteDiagnostico,
      consenteParceiro,
      ...(origem ? { origem } : {}),
    };

    // Validação local só para mostrar o erro na hora. Quem manda é o servidor.
    const local = esquemaCadastro.safeParse(bruto);
    if (!local.success) {
      const encontrados = errosPorCampo(local.error);
      setErros(encontrados);
      document.getElementById(Object.keys(encontrados)[0] ?? 'nome')?.focus();
      return;
    }

    setEnviando(true);
    setErros({});

    try {
      const resposta = await fetch('/api/cadastro', {
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
      };

      setErros(
        falha.campos ?? {
          formulario: 'Não conseguimos salvar seus dados agora. Tente de novo em instantes.',
        },
      );
      setEnviando(false);
    } catch {
      setErros({ formulario: 'Sem conexão. Verifique a internet e tente de novo.' });
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <Campo
        id="nome"
        rotulo="Seu nome"
        autoComplete="name"
        enterKeyHint="next"
        placeholder="João da Silva"
        value={nome}
        onChange={(e) => {
          setNome(e.target.value);
          limpar('nome');
        }}
        erro={erros.nome}
      />

      <Campo
        id="whatsapp"
        rotulo="WhatsApp"
        ajuda="É por onde mandamos o resultado."
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        enterKeyHint="next"
        placeholder="(34) 99123-4567"
        value={whatsapp}
        onChange={(e) => {
          setWhatsapp(mascararTelefone(e.target.value));
          limpar('whatsapp');
        }}
        erro={erros.whatsapp}
      />

      <Campo
        id="nomePropriedade"
        rotulo="Nome da propriedade"
        enterKeyHint="next"
        placeholder="Fazenda Boa Vista"
        value={nomePropriedade}
        onChange={(e) => {
          setNomePropriedade(e.target.value);
          limpar('nomePropriedade');
        }}
        erro={erros.nomePropriedade}
      />

      <Campo
        id="municipio"
        rotulo="Município"
        list="municipios"
        autoComplete="address-level2"
        enterKeyHint="done"
        placeholder="Patrocínio"
        value={municipio}
        onChange={(e) => {
          setMunicipio(e.target.value);
          limpar('municipio');
        }}
        erro={erros.municipio}
      />
      <datalist id="municipios">
        {MUNICIPIOS_REGIAO.map((nomeMunicipio) => (
          <option key={nomeMunicipio} value={nomeMunicipio} />
        ))}
      </datalist>

      <fieldset className="space-y-3 pt-2">
        <legend className="mb-3 text-base font-medium text-stone-800">
          Antes de continuar
        </legend>

        <CaixaConsentimento
          id="consenteDiagnostico"
          marcado={consenteDiagnostico}
          aoMudar={(marcado) => {
            setConsenteDiagnostico(marcado);
            limpar('consenteDiagnostico');
          }}
          erro={erros.consenteDiagnostico}
        >
          {TEXTO_CONSENTIMENTO.diagnostico}
        </CaixaConsentimento>

        <CaixaConsentimento
          id="consenteParceiro"
          marcado={consenteParceiro}
          aoMudar={setConsenteParceiro}
        >
          {TEXTO_CONSENTIMENTO.compartilhamento_parceiro}{' '}
          <span className="text-stone-500">
            Sem isso você recebe o diagnóstico do mesmo jeito.
          </span>
        </CaixaConsentimento>

        <p className="text-sm text-stone-500">
          Seus dados são usados só para isso. Leia a{' '}
          <Link href="/privacidade" className="font-medium text-emerald-800 underline">
            política de privacidade
          </Link>{' '}
          ou peça a exclusão quando quiser.
        </p>
      </fieldset>

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
