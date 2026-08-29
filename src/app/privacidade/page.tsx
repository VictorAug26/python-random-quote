import type { Metadata } from 'next';
import Link from 'next/link';
import { VERSAO_POLITICA } from '@/lib/consentimento';
import { whatsappContato, whatsappContatoLink } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Política de privacidade',
};

/*
  PENDÊNCIA antes de ir ao ar: preencher o nome do controlador (a pessoa ou
  empresa responsável pelos dados) e o nome do parceiro integrador. Está
  marcado com [DEFINIR] no texto abaixo.
*/

export default function PaginaPrivacidade() {
  const contato = whatsappContato();

  return (
    <article className="prose-stone">
      <h1 className="text-2xl font-bold text-stone-900">Política de privacidade</h1>
      <p className="mt-2 text-sm text-stone-500">Versão {VERSAO_POLITICA}</p>

      <p className="mt-6 leading-relaxed text-stone-700">
        Este diagnóstico é oferecido por <strong>[DEFINIR: nome do responsável]</strong>, que
        responde pelos dados coletados aqui. Abaixo está, em português claro, o que
        guardamos e o que fazemos com isso.
      </p>

      <Secao titulo="O que coletamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Seu nome e WhatsApp</li>
          <li>O nome da propriedade e o município</li>
          <li>A atividade da fazenda e os equipamentos que você marcar</li>
          <li>O valor da última fatura de energia e, se você souber, o consumo em kWh</li>
        </ul>
        <p className="mt-3">
          <strong>Não pedimos CPF, RG, e-mail, endereço nem dados bancários.</strong> Se um
          dado não muda nenhum número do diagnóstico, ele não é coletado.
        </p>
      </Secao>

      <Secao titulo="Para que usamos">
        <p>
          Para calcular a estimativa de economia com baterias e enviar o resultado para você.
          Se você autorizar separadamente, também para apresentar seu contato a um parceiro
          fornecedor de baterias — <strong>[DEFINIR: nome do parceiro]</strong> — que pode
          falar com você sobre um orçamento.
        </p>
        <p className="mt-3">
          As duas autorizações são independentes. Recusar a segunda não impede o diagnóstico,
          e você pode mudar de ideia depois.
        </p>
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <p>
          Só com o parceiro fornecedor, e só se você tiver marcado essa autorização e pedido
          para ser contatado. Enviamos nome, WhatsApp, propriedade, município e o resumo do
          diagnóstico. Não vendemos seus dados nem mandamos para mais ninguém.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>18 meses, se você só fez o diagnóstico</li>
          <li>24 meses, se pediu contato comercial</li>
          <li>Na hora, se você pedir a exclusão</li>
        </ul>
        <p className="mt-3">Passado o prazo, os dados são apagados automaticamente.</p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          Você pode pedir para ver, corrigir ou apagar seus dados, e retirar qualquer
          autorização, a qualquer momento — sem precisar justificar. É só mandar mensagem no
          WhatsApp{' '}
          <a
            href={`https://wa.me/${whatsappContatoLink()}`}
            className="font-medium text-emerald-800 underline"
          >
            {contato}
          </a>
          . Respondemos em até 15 dias.
        </p>
        <p className="mt-3">
          Veja também a página <Link href="/meus-dados" className="font-medium text-emerald-800 underline">Meus dados</Link>.
        </p>
      </Secao>

      <Secao titulo="Segurança">
        <p>
          O site usa conexão criptografada (HTTPS) e os dados ficam num banco com acesso
          restrito. O relatório que você pode compartilhar no WhatsApp mostra só os números
          da economia — não leva seu nome nem seu telefone.
        </p>
      </Secao>

      <p className="mt-10">
        <Link href="/" className="font-medium text-emerald-800 underline">
          ← Voltar
        </Link>
      </p>
    </article>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-stone-900">{titulo}</h2>
      <div className="mt-2 leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}
