
/*
** BidTorrent loader component.
** copyright the BidTorrent team 2015
*/
bidTorrent = function (params, complete)
{
	var loader;

	loader = function ()
	{
		var debug;
		var iframe;
		var parse;

		params = params || {};
		params.base = params.base || 'http://bidtorrent.io';
		params.publisher = params.publisher || document.location.href;
		params.slot = params.slot || {};
		params.slot.width = params.slot.width || 300;
		params.slot.height = params.slot.height || 250;
		params.slot.id = params.slot.id || 'bidtorrent-ad';
		params.passback = params.passback || '<div><img src="http://www.fundamentalfootball.com/images/PassbackLogo.gif" width="' + params.slot.width + '" height="' + params.slot.height + '" /></div>';

		parse = document.createElement('a');
		parse.href = params.base;

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
		iframe.height = params.slot.height + 'px';
		iframe.seamless = 'seamless';
		iframe.scrolling = 'no';
		iframe.width = params.slot.width + 'px';
		iframe.src = params.base + '/auction.html';

		document.getElementById(params.slot.id).appendChild(iframe);

		complete(params);
	};

	if (document.readyState === 'complete' || document.readyState === 'loaded')
		loader();
	else
		document.addEventListener('DOMContentLoaded', loader, false);
};
