
var Message = {
	/*
	** Send alert message along with error text.
	*/
	alert: function (channel, text)
	{
		Message.send({channel: channel, type: 'alert', text: text});
	},

	/*
	** Send debug message along with flow step and step-dependent parameters.
	*/
	debug: function (channel, flow, params)
	{
		Message.send({channel: channel, type: 'debug', flow: flow, params: params});
	},

	/*
	** Send passback message along with passback HTML code.
	*/
	pass: function (channel, code)
	{
		Message.send({channel: channel, type: 'pass', code: code});
	},

	/*
	** Raw message sending method.
	*/
	send: function (data)
	{
		window.parent.postMessage(JSON.stringify(data), '*');
	}
};

// Module exports
exports.Message = Message;
