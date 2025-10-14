exports.success = (data, meta) => ({ success: true, data, meta });
exports.error = (message, code) => ({ success: false, error: { message, code } });
