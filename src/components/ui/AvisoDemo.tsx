import { modoDemo } from '@/lib/demo/modo';

/**
 * Faixa fixa no topo quando o app roda sem banco.
 *
 * Existe para ninguém confundir o que está vendo: os dados vão para a memória
 * do servidor e somem quando ele reinicia.
 */
export function AvisoDemo() {
  if (!modoDemo()) return null;

  return (
    <div className="rounded-xl bg-amber-100 px-4 py-3 text-sm leading-relaxed text-amber-900">
      <strong className="font-semibold">Modo demonstração.</strong> Sem banco de dados
      configurado: o que você preencher fica só na memória e some quando o servidor
      reinicia. Bom para avaliar as telas, não para guardar nada.
    </div>
  );
}
