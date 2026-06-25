import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function bootstrap() {
  await connectDB();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] API EHS escuchando en http://localhost:${env.port}/api`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Error al iniciar:', err);
  process.exit(1);
});
