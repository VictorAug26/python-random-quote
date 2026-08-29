/**
 * Junta as migrations num arquivo só, para colar de uma vez no SQL Editor do
 * Supabase — em vez de abrir sete arquivos e rodar um por um.
 *
 *   npm run sql
 *
 * A fonte da verdade continua sendo supabase/migrations/. Este arquivo é
 * gerado; rode de novo sempre que criar ou mudar uma migration.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEM = 'supabase/migrations';
const DESTINO = 'supabase/instalar.sql';

const arquivos = readdirSync(ORIGEM)
  .filter((nome) => nome.endsWith('.sql'))
  .sort();

if (arquivos.length === 0) {
  console.error(`Nenhuma migration encontrada em ${ORIGEM}/`);
  process.exit(1);
}

const partes = [
  `-- =============================================================================
-- Diagnóstico energético rural — instalação completa do banco
--
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-unico.mjs. Não edite aqui:
-- mexa nos arquivos de supabase/migrations/ e rode \`npm run sql\`.
--
-- ⚠️ ESTE ARQUIVO É PARA BANCO VAZIO. Rode UMA VEZ, na primeira instalação.
--
-- JÁ TEM O BANCO E QUER SÓ ATUALIZAR? Não rode este arquivo. Ele para na
-- primeira tabela ("relation already exists") e NADA depois é executado — as
-- migrations novas, que ficam no fim, nunca chegam a rodar. Rode apenas os
-- arquivos de supabase/migrations/ que ainda faltam, um por um, em ordem.
--
-- Para saber quais faltam: \`npm run checar\` compara o seu banco com o código.
--
-- Se precisar recomeçar do zero, rode antes:
--
--   drop schema public cascade;
--   create schema public;
--   grant usage on schema public to postgres, service_role;
--
-- ⚠️ Isso apaga TODOS os dados. Só use em ambiente de teste.
--
-- Contém ${arquivos.length} migrations, na ordem:
${arquivos.map((nome) => `--   ${nome}`).join('\n')}
-- =============================================================================
`,
];

for (const nome of arquivos) {
  partes.push(`
-- ##########################################################################
-- ${nome}
-- ##########################################################################

${readFileSync(join(ORIGEM, nome), 'utf8').trim()}
`);
}

writeFileSync(DESTINO, `${partes.join('\n')}\n`);
console.log(`${DESTINO} gerado a partir de ${arquivos.length} migrations.`);
