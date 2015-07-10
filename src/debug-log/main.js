
(function (parent)
{
	var DOM = require('../dom').DOM;

	if (parent.bidTorrent !== undefined)
	{
		parent.bidTorrent.connect(function (type, element, auction, data)
		{
			if (type === 'alert' || type === 'bid_error' || type === 'init_error')
				DOM.pixel(document.body, 'http://log.bidtorrent.io/debug?t=' + encodeURIComponent(type) + '&d=' + encodeURIComponent(JSON.stringify(data)));
		});
	}
})(window);
