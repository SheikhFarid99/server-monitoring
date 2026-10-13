class BaseError extends Error {
    constructor(message) {
        super(message)
        Object.setPrototypeOf(this, new.target.prototype)
        Error.captureStackTrace(this, this.constructor)
    }
}

module.exports = BaseError