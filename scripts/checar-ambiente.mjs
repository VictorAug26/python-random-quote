/**
 * Confere se o ambiente está pronto ANTES de você abrir o app.
 *
 * Sem isto, uma variável faltando só aparece quando você já preencheu o
 * formulário inteiro — e uma de cada vez.
 *
 *   npm run checar
 */
import { readFileSync, existsSync } from 'node:fs';

const VERDE = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const AMARELO = '\x1b[33m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

const ok = (t) => console.log(`${VERDE}  ok  ${FIM} ${t}`);
const falha = (t, comoResolver) => {
  console.log(`${VERMELHO} falta ${FIM} ${t}`);
  if (comoResolver) console.log(`${CINZA}        ${comoResolver}${FIM}`);
  problemas++;
};
const aviso = (t) => console.log(`${AMARELO} aviso ${FIM} ${t}`);

let problemas = 0;

// --- carrega o .env.local do mesmo jeito que o Next faz ----------------------
if (existsSync('.env.local')) {
  for (const linha of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
} else {
  falha('arquivo .env.local não existe', 'cp .env.example .env.local — depois preencha os valores');
}

console.log('\nVariáveis obrigatórias');

const OBRIGATORIAS = {
  SUPABASE_URL: {
    dica: 'Supabase → Project Settings → Data API → Project URL',
    // Aceita projeto na nuvem ou o Supabase local do CLI (supabase start).
    valida: (v) =>
      /^https:\/\/[^/]+\.supabase\.co\/?$/.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(v)
        ? null
        : 'não parece uma URL de projeto Supabase nem o Supabase local',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    dica: 'Supabase → Project Settings → API Keys → service_role (secreta)',
    valida: (v) => (v.length > 30 ? null : 'curta demais para ser a chave'),
  },
  SESSAO_SECRET: {
    dica: 'gere com: openssl rand -base64 32',
    valida: (v) => (v.length >= 24 ? null : 'use pelo menos 24 caracteres aleatórios'),
  },
  IP_HASH_PEPPER: {
    dica: 'gere com: openssl rand -base64 32',
    valida: (v) => (v.length >= 24 ? null : 'use pelo menos 24 caracteres aleatórios'),
  },
};

for (const [nome, { dica, valida }] of Object.entries(OBRIGATORIAS)) {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    falha(`${nome} não está definida`, dica);
    continue;
  }
  const problema = valida(valor);
  if (problema) falha(`${nome}: ${problema}`, dica);
  else ok(nome);
}

// --- alerta de chave no lugar errado ----------------------------------------
if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  falha(
    'existe uma chave do Supabase com prefixo NEXT_PUBLIC_',
    'esse prefixo publica o valor no navegador. Este projeto não usa chave no cliente — remova.',
  );
}

console.log('\nOpcionais');
for (const [nome, padrao] of [
  ['WHATSAPP_CONTATO', 'o número de exemplo aparece na política e em /meus-dados'],
  ['NEXT_PUBLIC_SITE_URL', 'o link compartilhado sai como localhost'],
]) {
  if (process.env[nome]?.trim()) ok(nome);
  else aviso(`${nome} não definida — ${padrao}`);
}

// --- o banco responde? As migrations foram aplicadas? ------------------------
if (problemas === 0) {
  console.log('\nBanco de dados');
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Uma tabela por migration, para dizer exatamente onde parou.
  const ESPERADAS = [
    ['leads', '0001'],
    ['diagnosticos_publicos', '0006'],
    ['expurgos_lgpd', '0007'],
  ];

  for (const [tabela, migration] of ESPERADAS) {
    try {
      const resposta = await fetch(`${base}/rest/v1/${tabela}?select=*&limit=0`, {
        headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      });

      if (resposta.ok) {
        ok(`tabela ${tabela} existe (migration ${migration})`);
      } else if (resposta.status === 401 || resposta.status === 403) {
        falha(
          'o Supabase recusou a chave',
          'confira se copiou a service_role, e não a anon/publishable',
        );
        break;
      } else {
        falha(
          `${tabela} não encontrada — migration ${migration} não foi aplicada`,
          'rode as migrations: supabase db push (ou cole os arquivos de supabase/migrations no SQL Editor, em ordem)',
        );
      }
    } catch (erro) {
      falha(`não consegui falar com o Supabase: ${erro.message}`, 'confira a SUPABASE_URL e sua conexão');
      break;
    }
  }
}

console.log('');
if (problemas === 0) {
  console.log(`${VERDE}Tudo pronto.${FIM} Rode: npm run dev\n`);
} else {
  console.log(
    `${VERMELHO}${problemas} problema(s).${FIM} Veja docs/como-rodar.md para o passo a passo.\n`,
  );
  process.exitCode = 1;
}
