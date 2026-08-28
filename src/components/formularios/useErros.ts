'use client';

import { useState } from 'react';

export type Erros = Record<string, string>;

/**
 * Erros de formulário que somem assim que o campo é corrigido.
 *
 * Deixar a mensagem na tela depois de o produtor ter arrumado é dizer que ele
 * errou quando ele já acertou — e no celular a mensagem antiga fica bem
 * embaixo do campo certo, parecendo que ainda tem coisa errada.
 */
export function useErros() {
  const [erros, setErros] = useState<Erros>({});

  function limpar(campo: string) {
    setErros((atual) => {
      if (!(campo in atual)) return atual;
      const resto = { ...atual };
      delete resto[campo];
      return resto;
    });
  }

  return { erros, setErros, limpar };
}
