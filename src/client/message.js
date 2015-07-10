
var Message = {
	alert: function (channel, message)
	{
		Message.send({channel: channel, type: 'alert', message: message});
	},

	debug: function (channel, auction, event, data)
	{
		Message.send({channel: channel, type: event, auction: auction, data: data});
	},

	send: function (data)
	{
		window.parent.postMessage(data, '*');
	}
};

// Module exports
exports.Message = Message;
