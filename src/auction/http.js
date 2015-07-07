
var Future = require('./concurrent').Future;

var Query = {
	isStatusValid: function (status)
	{
		return (status >= 200 && status < 300) || status === 0;
	},

	json: function (url, data)
	{
		var future = new Future();

		Query
			.text(url, data !== undefined ? JSON.stringify(data) : undefined)
			.then(function (text, status)
			{
				try
				{
					future.signal(JSON.parse(text), status);
				}
				catch (e)
				{
					future.signal(undefined, status);
				}
			});

		return future;
	},

	text: function (url, data)
	{
		var future;
		var xhr;

		future = new Future();

		xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function ()
		{
			if (xhr.readyState === 4)
				future.signal(xhr.responseText, xhr.status);
		};

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

		return future;
	}
};

// Module exports
exports.Query = Query;
