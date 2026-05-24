#!/usr/bin/env node
import { startServer } from './server.js';

startServer().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
