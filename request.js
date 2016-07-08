var cache = {};
var timeouts = {};
var queue = [];
var id = 0;

function queryStringify(obj) {
	return Object.keys(obj).sort().map(function(key) {
		return encodeURIComponent(key)+'='+encodeURIComponent(obj[key]);
	}).join('&');
}

var sendRequests = function(url) {
	var thisQueue = queue.splice(0);
	var xhr = new XMLHttpRequest();

	xhr.onload = function(e) {
		try {
			var res = JSON.parse(e.target.response);
			var responses = res && res.responses && Array.isArray(res.responses) ? res.responses : [];

			thisQueue.forEach(function(el, i) {
				if (responses[i]) {
					if (el.expires) {
						if (!cache[url]) {
							cache[url] = {};
						}

						cache[url][JSON.stringify(el.request)] = {
							response: responses[i],
							expires: Date.now()+el.expires,
						};
					}

					el.callback(undefined, responses[i]);
				} else {
					el.callback(new Error('response missing'), undefined);
				}
			});
		} catch (e) {
			thisQueue.forEach(function(el) { return el.callback(new Error('invalid JSON in response')); })
		}
	};
	xhr.onerror = function(err) {
		thisQueue.forEach(function(el) {
			return el.callback(new Error('xhr failed'))
		});
	};
	xhr.open('POST', url);
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');
	xhr.withCredentials = true;
	xhr.send(queryStringify({
		format: 'json',
		version: 1,
		id: ++id,
		requests: JSON.stringify(thisQueue.map(function(el) {
			return el.request;
		})),
	}));
};

module.exports = function(url, request, opts = {}, callback) {
	if (opts.expires) {
		var key = JSON.stringify(request);

		if (cache[url] && cache[url][key]) {
			if (cache[url][key].expires > Date.now()) {
				callback(undefined, cache[url][key].response);
				return;
			}
		}
	}

	if (timeouts[url]) {
		clearTimeout(timeouts[url]);
	}
	queue.push({request, callback, expires: opts.expires});
	timeouts[url] = setTimeout(function() {
		sendRequests(url);
	}, 5);
};