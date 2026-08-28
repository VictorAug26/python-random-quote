import type { Metadata } from 'next';
import Link from 'next/link';
import { whatsappContato, whatsappContatoLink } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Meus dados',
};

/** Canal de exclusão, correção e acesso — exigência de LGPD, em uma tela só. */
export default function PaginaMeusDados() {
  const contato = whatsappContato();
  const mensagem = encodeURIComponent(
    'Olá! Fiz o diagnóstico de energia e quero tratar dos meus dados pessoais.',
  );

  return (
    <article>
      <h1 className="text-2xl font-bold text-stone-900">Meus dados</h1>

      <p className="mt-4 leading-relaxed text-stone-700">
        Os dados que você preencheu são seus. A qualquer momento você pode pedir para:
      </p>

      <ul className="mt-4 space-y-2 leading-relaxed text-stone-700">
        <li>• ver tudo o que guardamos sobre você;</li>
        <li>• corrigir alguma informação errada;</li>
        <li>• apagar tudo;</li>
        <li>• retirar a autorização de contato do parceiro, continuando com o diagnóstico.</li>
      </ul>

      <p className="mt-6 leading-relaxed text-stone-700">
        Basta mandar uma mensagem. Não precisa explicar o motivo. Respondemos em até 15 dias.
      </p>

      <a
        href={`https://wa.me/${whatsappContatoLink()}?text=${mensagem}`}
        className="mt-6 block w-full rounded-xl bg-emerald-700 px-6 py-4 text-center text-lg font-semibold text-white active:bg-emerald-800"
      >
        Falar no WhatsApp
      </a>

      <p className="mt-3 text-center text-sm text-stone-500">{contato}</p>

      <p className="mt-10">
        <Link href="/" className="font-medium text-emerald-800 underline">
          ← Voltar
        </Link>
      </p>
    </article>
  );
}
