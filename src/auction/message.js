
var Message = {
	send: function (channel, data)
	{
		window.parent.postMessage({channel: channel, data: data}, document.location.href);
	}
};

// Module exports
exports.Message = Message;
