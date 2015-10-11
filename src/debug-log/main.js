
(function (parent)
{
	var DOM = require('../dom').DOM;

	if (parent.bidTorrent !== undefined)
	{
		parent.bidTorrent.connect(function (element, flow, params)
		{
			if (flow === 'bid_error' || flow === 'init_error')
				DOM.pixel(document.body, 'http://api.bidtorrent.io/debug?t=' + encodeURIComponent(type) + '&d=' + encodeURIComponent(JSON.stringify (params)));
		});
	}
})(window);
