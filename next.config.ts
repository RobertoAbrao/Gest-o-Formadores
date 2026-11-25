import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Erro de tipo derruba o build (desde 25/11/2026). Antes era ignorado, e foi assim que
  // a linha do tempo passou meses lendo um campo que não existe mais (`dataImplantacao`).
  // O lint roda no CI (npm run lint), não aqui.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
