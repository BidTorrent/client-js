
var Future = require('./concurrent').Future;

var Query = {
	json: function (url, data)
	{
		var future;
		var xhr;

		future = new Future();

		xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function ()
		{
			var json;

			if (xhr.readyState !== 4)
				return;

			if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0)
			{
				try
				{
					json = JSON.parse(xhr.responseText);
				}
				catch (e)
				{
					json = undefined;
				}
			}
			else
				json = undefined;

			future.signal(json);
		};

		if (data !== undefined)
		{
			xhr.open('POST', url, true);
			xhr.send(JSON.stringify(data));
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
