
var Future = require('./concurrent').Future;

var Query = {
	result: function (url, data)
	{
		var future;
		var xhr;

		future = new Future();

		xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function ()
		{
			var json;
			var status;

			if (xhr.readyState !== 4)
				return;

			try
			{
				json = JSON.parse(xhr.responseText);
			}
			catch (e)
			{
				json = undefined;
			}

			future.signal(json, xhr.status);
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
	},

	json: function(result)
	{
		return result[0];
	},

	hasValidStatus: function(result)
	{
		return (result[1] >= 200 && result[1] < 300) || result[1] === 0;
	}
};

// Module exports
exports.Query = Query;
