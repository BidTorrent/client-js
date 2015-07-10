
/*
** BidTorrent loader component.
** copyright the BidTorrent team 2015
*/
bidTorrent = (function ()
{
	var Config = require('./config').Config;
	var Future = require('../concurrent').Future;
	var Query = require('../http').Query;

	var loader;
	var probes;
	var url;

	// BidTorrent JavaScript loader
	loader = function (init)
	{
		var start;

		// Ensure required JavaScript features are supported
		if ((typeof postMessage === 'undefined') ||
		    (typeof XMLHttpRequest === 'undefined') ||
		    (!('withCredentials' in new XMLHttpRequest()) && (typeof XDomainRequest === 'undefined')))
			return;

		// Create the actual loading function
		start = function ()
		{
			// Populate initialization object with missing default value
			init = init || {};

			if (typeof init.configUrl === 'number')
				init.configUrl = 'http://www.bidtorrent.io/api/publishers/' + init.configUrl;

			init.biddersUrl = url(init.biddersUrl || 'http://www.bidtorrent.io/api/bidders');
			init.clientUrl = url(init.clientUrl || 'http://bidtorrent.io/client.html');
			init.configUrl = init.configUrl ? url(init.configUrl) : undefined;
			init.impUrl = url(init.impUrl || 'http://log.bidtorrent.io/imp');

			// Load bidders list and configuration, continue when available
			Future
				.bind
				(
					init.bidders ? Future.make(init.bidders, 200) : Query.json(init.biddersUrl + (init.biddersUrl.indexOf('?') === -1 ? '?' : '&') + document.location.host),
					Config.fetch(init.configUrl, init.config)
				)
				.then(function (biddersResult, configResult)
				{
					var bidders;
					var client;
					var config;
					var debug;
					var element;
					var imp;
					var listener;
					var parse;

					bidders = biddersResult[0];
					config = configResult[0];

					if (!Query.isStatusValid(biddersResult[1]) || !bidders)
					{
						if (init.debug)
							console.error('[BidTorrent] could not read bidders list');

						return;
					}

					if (!Query.isStatusValid(configResult[1]) || !config)
					{
						if (init.debug)
							console.error('[BidTorrent] could not read configuration');

						return;
					}

					if (!config.imp || config.imp.length === 0)
					{
						if (init.debug)
							console.error('[BidTorrent] at least one impression has to be specified');

						return;
					}

					for (var i = 0; i < config.imp.length; ++i)
					{
						imp = config.imp[i];

						if (!imp.id)
						{
							if (init.debug)
								console.error('[BidTorrent] missing DOM element id for impression #' + i);

							return;
						}

						element = document.getElementById(imp.id);

						if (!element)
						{
							if (init.debug)
								console.error('[BidTorrent] no DOM element found for id #' + imp.id);

							return;
						}

						if (imp.banner === undefined || imp.banner.w === undefined || imp.banner.h === undefined)
						{
							imp.banner = imp.banner || {};
							imp.banner.h = imp.banner.h || element.offsetHeight;
							imp.banner.w = imp.banner.w || element.offsetWidth;
						}

						// Create and append client element
						client = document.createElement('iframe');
						client.onload = (function (channel)
						{
							return function ()
							{
								client.contentWindow.postMessage({
									bidders:	bidders,
									channel:	channel,
									config:		config,
									debug:		init.debug,
									impUrl: 	init.impUrl
								}, '*');
							};
						})(i);

						client.frameBorder = 0;
						client.scrolling = 'no';
						client.seamless = 'seamless';
						client.style.height = imp.banner.h + 'px';
						client.style.width = imp.banner.w + 'px';
						client.src = init.clientUrl;

						element.appendChild(client);

						// Create and append debug mode element
						if (init.debug)
						{
							debug = document.createElement('div');
							debug.className = 'bidtorrent-debug';
							debug.style.width = imp.banner.w + 'px';

							element.appendChild(debug);

							parse = document.createElement('a');
							parse.href = init.clientUrl;

							// Connect to messages from client component
							listener = function (channel, debug)
							{
								return function (message)
								{
									if (message.origin !== parse.protocol + '//' + parse.hostname || message.data.channel !== channel)
										return;

									for (var i = 0; i < probes.length; ++i)
										probes[i](message.data.type, debug, message.data.auction, message.data.data);
								};
							};

							addEventListener('message', listener(i, debug), true);
						}
					}
				});
		};

		// Execute loader callback when page is loaded or synchronously
		if (document.readyState === 'complete' || document.readyState === 'loaded')
			start();
		else
			document.addEventListener('DOMContentLoaded', start, false);
	};

	// Parse relative into absolute URL
	url = function (relative)
	{
		var parse = document.createElement('a');

		parse.href = relative;

		return parse.href;
	};

	// BidTorrent JavaScript debug handler
	loader.connect = function (probe)
	{
		probes.push(probe);
	};

	// Probes
	probes = [];

	return loader;
})();
