const BaseError = require('./baseError')

class AppError extends BaseError {
    statusCode
    errors
    author
    constructor(message, statusCode, errors, author) {
        super(message)
        this.statusCode = statusCode
        this.errors = errors
        this.author = author
    }
}

module.exports = AppError