import { defineConfig } from 'vite';

// Vista pública + jugador de la plataforma multi-porra. Independiente de la
// app legacy del Mundial y del dashboard admin. base relativa para servirla
// en cualquier subruta. fs.allow para poder importar src/lib/ del repo raíz.
export default defineConfig({
  base: './',
  server: {
    fs: { allow: ['..'] }
  }
});
