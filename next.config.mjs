import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    // permite `@use 'tokens' as *;` desde cualquier .scss / .module.scss
    loadPaths: [path.join(raiz, 'styles')],
  },
};

export default nextConfig;
