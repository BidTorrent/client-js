
var Message = {
	alert: function (channel, message)
	{
		Message.send({channel: channel, type: 'alert', message: message});
	},

	debug: function (channel, auction, event, params)
	{
		Message.send({channel: channel, type: event, auction: auction, params: params});
	},

	send: function (data)
	{
		window.parent.postMessage(JSON.stringify(data), '*');
	}
};

// Module exports
exports.Message = Message;
