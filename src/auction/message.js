
var Message = {
	alert: function (channel, message)
	{
		Message.send({channel: channel, type: 'alert', message: message});
	},

	debug: function (channel, auction, event, data)
	{
		Message.send({channel: channel, type: 'debug', auction: auction, event: event, data: data});
	},

	send: function (data)
	{
		window.parent.postMessage(data, document.location.href);
	}
};

// Module exports
exports.Message = Message;
