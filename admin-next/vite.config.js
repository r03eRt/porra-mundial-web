import { defineConfig } from 'vite';

// App del dashboard de la plataforma multi-porra. Independiente de la app
// legacy del Mundial. base relativa para poder servirla en cualquier subruta.
export default defineConfig({
  base: './'
});
