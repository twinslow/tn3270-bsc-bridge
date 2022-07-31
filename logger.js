const winston = require('winston');
const config = require("config");

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        winston.format.printf(info => { return `${info.timestamp} ${info.level}: ${info.message}`; }),
    ),
    transports: [
        //
        // - Write all logs with importance level of `error` or less to `error.log`
        // - Write all logs with importance level of `info` or less to `combined.log`
        //
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log', level: 'debug' }),
        new winston.transports.Console({level: config.get("logger.console-log-level")}),
    ],
});

class LogMgr {
    constructor() {
    }

    debug(msg) {
        logger.log('debug', msg);
    }

    verbose(msg) {
        logger.log('verbose', msg);
    }

    info(msg) {
        logger.log('info', msg);
    }

    warn(msg) {
        logger.log('warn', msg);
    }

    error(msg) {
        logger.log('error', msg);
    }

}

module.exports.logMgr = new LogMgr();
