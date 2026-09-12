import cluster from 'node:cluster';
import os from 'node:os';
import { bootstrap } from './bootstrap.js';

// Multi-core utilization: the primary process forks one worker per CPU core,
// each running its own Nest application instance behind the same port
// (the OS scheduler load-balances incoming connections across workers).
// Disabled by default in development — set CLUSTERING_ENABLED=true for
// production-like load testing or deployment.
const clusteringEnabled = process.env.CLUSTERING_ENABLED === 'true';

if (clusteringEnabled && cluster.isPrimary) {
  const cpuCount = os.cpus().length;
  // eslint-disable-next-line no-console
  console.log(`[Cluster] Primary ${process.pid} forking ${cpuCount} worker(s)`);

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    // eslint-disable-next-line no-console
    console.warn(`[Cluster] Worker ${worker.process.pid} exited (code=${code}, signal=${signal}) — restarting`);
    cluster.fork();
  });
} else {
  await bootstrap();
}
