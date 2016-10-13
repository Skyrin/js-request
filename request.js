function queryStringify(obj) {
	return Object.keys(obj).sort().map(function(key) {
		return encodeURIComponent(key)+'='+encodeURIComponent(obj[key]);
	}).join('&');
}

var sendRequests = (function(){
	var id = 0;

	function sendRequests(url, queue, retries) {
		var xhr = new XMLHttpRequest();

		xhr.onload = function(e) {
			try {
				var res = JSON.parse(e.target.response);
				var responses = res && res.responses && Array.isArray(res.responses) ? res.responses : [];

				queue.forEach(function(el, i) {
					if (responses[i]) {
						el.callback(undefined, responses[i]);
					} else {
						el.callback(new Error('response missing'), undefined);
					}
				});
			} catch (e) {
				queue.forEach(function(el) { return el.callback(new Error('invalid JSON in response')); })
			}
		};
		xhr.onerror = function(err) {
			queue.forEach(function(el) {
				var message = 'Service Error: status:'+xhr.status+', responseText: '+xhr.responseText+', location:'+location.href+', url:'+url+', params:'+JSON.stringify(el.request);
				return el.callback(new Error(message))
			});
		};
		xhr.ontimeout = function (e) {
			if (retries) {
				sendRequests(url, queue, retries - 1);
			} else {
				queue.forEach(function(el) { 
					var message = 'Service Error: timed out, location:'+location.href+', url:'+url+', params:'+JSON.stringify(el.request);
					return el.callback(new Error(message)); 
				})
			}
		};
		xhr.open('POST', url);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');
		xhr.withCredentials = true;
		xhr.send(queryStringify({
			format: 'json',
			version: 1,
			id: ++id,
			requests: JSON.stringify(queue.map(function(el) {
				return el.request;
			})),
		}));
	}

	return sendRequests;
}());

var queueRequest = (function(){
	var queue = [];
	var timeouts = {};

	return function (url, request, callback) {
		if (timeouts[url]) {
			clearTimeout(timeouts[url]);
		}

		queue.push({
			request: request,
			callback: callback,
		});

		timeouts[url] = setTimeout(function() {
			sendRequests(url, queue, 1);
			queue = [];
		}, 5);
	};
}());

var cacheRequest = (function(){
	var cache = {};

	return function(url, request, opts, callback) {
		opts = opts || {};

		if (opts.expires) {
			var key = JSON.stringify(request);

			if (cache[url] && cache[url][key] && cache[url][key].expires > Date.now()) {
				callback(undefined, cache[url][key].response);
				return;
			} else {
				callback = (function(cb, err, response) {
					if (!err) {
						if (!cache[url]) {
							cache[url] = {};
						}

						cache[url][key] = {
							response: response,
							expires: Date.now()+opts.expires,
						};
					}

					cb(err, response);
				}).bind(this, callback);
			}
		}

		queueRequest(url, request, callback);
	};
}());

module.exports = cacheRequest;