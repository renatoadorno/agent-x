import { createLogger, format, transports } from 'winston';
// import { resolve, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import { $ } from 'bun';

// const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'app.log' }),
  ],
});

export default logger;