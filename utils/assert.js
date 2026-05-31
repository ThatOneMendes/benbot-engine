/**
 * Throws an error with a message if the first passed argument is not a true value.
 * @param {any} what
 * @param {string|undefined} message
 */
module.exports = function (what, message) {
    if (!what) throw new Error(message);
};
