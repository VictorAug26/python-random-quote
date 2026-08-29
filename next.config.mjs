const emDesenvolvimento = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy.
 *
 * O formulário não carrega recurso de terceiro nenhum — sem analytics, sem
 * fonte externa, sem pixel — então dá para fechar bem apertado em produção.
 * Em desenvolvimento, o Next precisa de eval() para recompilar e de um
 * websocket para o hot reload; nada disso vale no build de produção.
 */
const csp = [
  "default-src 'self'",
  "img-src 'self' data:",
  // 'unsafe-inline' é exigido pelos scripts de hidratação do Next.
  `script-src 'self' 'unsafe-inline'${emDesenvolvimento ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self'${emDesenvolvimento ? ' ws: http:' : ''}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/:caminho*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
