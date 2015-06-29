
/*
** BidTorrent loader component.
** copyright the BidTorrent team 2015
*/
bidTorrent = function (params)
{
	var loader;

	loader = function ()
	{
		var debug;
		var iframe;
		var parse;

		params = params || {};
		params.auction = params.auction || 'http://bidtorrent.com/auction.html';
		params.config = params.config !== undefined ? params.config : 'http://bidtorrent.com/config.json';
		params.publisher = params.publisher || document.location.href;
		params.slot = params.slot || {};
		params.slot.width = params.slot.width || 300;
		params.slot.height = params.slot.height || 250;
		params.slot.id = params.slot.id || 'bidtorrent-ad';
		params.passback = params.passback || '<div><img src="http://bidder.com/Ads/passback_1.jpg" width="' + params.slot.width + '" height="' + params.slot.height + '" /></div>';

		parse = document.createElement('a');
		parse.href = params.auction;

		if (params.debug !== undefined)
		{
			debug = params.debug;

			if (typeof debug === 'string' && window[debug] !== undefined)
				debug = window[debug];

			addEventListener('message', function (message)
			{
				if (message.origin === parse.protocol + '//' + parse.hostname)
					debug(message.data);
			}, true);

			params.debug = true;
		}

		iframe = document.createElement('iframe');
		iframe.onload = function ()
		{
			iframe.contentWindow.postMessage(params, '*');
		};

		iframe.frameBorder = 0;
		iframe.seamless = 'seamless';
		iframe.width = params.slot.width + 'px';
		iframe.height = params.slot.height + 'px';
		iframe.scrolling = 'no';
		iframe.src = params.auction;

		document.getElementById(params.slot.id).appendChild(iframe);
	};

	if (document.readyState === 'complete' || document.readyState === 'loaded')
		loader();
	else
		document.addEventListener('DOMContentLoaded', loader, false);
};
