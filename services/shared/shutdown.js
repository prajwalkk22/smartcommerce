function setupGracefulShutdown(server, pool, serviceName) {
  const log = (msg) => console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    service: serviceName,
    event: msg,
  }));

  async function shutdown(signal) {
    log(`shutdown_initiated:${signal}`);

    // Stop accepting new connections
    server.close(async () => {
      log('http_server_closed');

      // Close DB pool
      try {
        await pool.end();
        log('db_pool_closed');
      } catch (err) {
        log('db_pool_close_error');
      }

      log('shutdown_complete');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      log('shutdown_forced');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

module.exports = { setupGracefulShutdown };
