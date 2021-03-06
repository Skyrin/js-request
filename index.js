var request = require('./request');

module.exports = function (url, req, opts) {
	return new Promise(function (resolve, reject) {
		request(url, req, opts, function (err, res) {
			if (err) {
				reject(err);
			} else {
				resolve(res);
			}
		});
	});
};