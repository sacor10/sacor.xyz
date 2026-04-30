/**
 * @typedef {Object} OhlcBar
 * @property {number} time   Unix epoch seconds at the bar's open.
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * @typedef {Object} HistoryResponse
 * @property {string} symbol
 * @property {OhlcBar[]} bars
 */

/**
 * @typedef {Object} Quote
 * @property {string} symbol
 * @property {number} price       Current price.
 * @property {number} change      Absolute change vs previous close.
 * @property {number} changePct   Percent change vs previous close.
 * @property {number} ts          Unix epoch seconds of the quote.
 */

/**
 * @typedef {Object} TradeTick
 * @property {string} symbol
 * @property {number} price
 * @property {number} ts
 */

export {}
