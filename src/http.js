
var Future = require('./future').Future;

var HTTP = {
	isStatusValid: function (status)
	{
		return (status >= 200 && status < 300) || status === 0;
	},

	json: function (url, data)
	{
		var future = new Future();

		HTTP
			.text(url, data !== undefined ? JSON.stringify(data) : undefined)
			.then(function (text, status)
			{
				var json;

				try
				{
					json = JSON.parse(text);
				}
				catch (e)
				{
					json = undefined;
				}

				future.signal(json, status);
			});

		return future;
	},

	text: function (url, data)
	{
		var future;
		var xhr;

		future = new Future();

		xhr = new XMLHttpRequest();
		xhr.withCredentials = true;
		xhr.onreadystatechange = function ()
		{
			if (xhr.readyState === 4)
				future.signal(xhr.responseText, xhr.status);
		};

		try
		{
			if (data !== undefined)
			{
				xhr.open('POST', url, true);
				xhr.send(data);
			}
			else
			{
				xhr.open('GET', url, true);
				xhr.send();
			}
		}
		catch (e)
		{
			// Simulate proxy error when request is forbidden (e.g. ad blocker)
			future.signal(undefined, 502);
		}

		return future;
	}
};

// Module exports
exports.HTTP = HTTP;
