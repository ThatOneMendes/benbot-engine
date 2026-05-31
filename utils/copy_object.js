/**
 * Deep copies an object.
 * @param {Object} obj The object to copy 
 * @returns {Object} Quite literally the same object you passed as the argument.
*/
function copyObject(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    const copy = Array.isArray(obj) ? [] : {};
    for (let key in obj) {
        copy[key] = copyObject(obj[key]);
    }
    return copy;
}

module.exports = copyObject