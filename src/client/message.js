
var Message = {
	alert: function (channel, text)
	{
		Message.send({channel: channel, type: 'alert', text: text});
	},

	debug: function (channel, flow, params)
	{
		Message.send({channel: channel, type: 'debug', flow: flow, params: params});
	},

	send: function (data)
	{
		window.parent.postMessage(JSON.stringify(data), '*');
	}
};

// Module exports
exports.Message = Message;
