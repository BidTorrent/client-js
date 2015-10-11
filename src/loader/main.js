
/*
** BidTorrent loader component.
** copyright the BidTorrent team 2015
*/
bidTorrent = (function ()
{
	var Config = require('./config').Config;
	var DOM = require('../dom').DOM;
	var Future = require('../future').Future;
	var HTTP = require('../http').HTTP;

	var loader;
	var probes;
	var url;

	// BidTorrent JavaScript loader
	loader = function (init)
	{
		var running;
		var start;

		// Ensure required JavaScript features are supported
		if ((window.JSON === undefined) ||
		    (window.postMessage === undefined) ||
		    (window.XMLHttpRequest === undefined) ||
		    (new XMLHttpRequest().withCredentials === undefined))
		{
			if (init.debug)
				console.error('[BidTorrent] unsupported browser, BidTorrent can\'t execute');

			return;
		}

		// Create the actual loading function
		running = false;
		start = function ()
		{
			if (running)
				return;

			running = true;

			// Populate initialization object with missing default value
			init = init || {};

			if (typeof init.configUrl === 'number')
				init.configUrl = 'http://www.bidtorrent.io/api/publishers/' + init.configUrl;

			init.biddersUrl = url(init.biddersUrl || 'http://www.bidtorrent.io/api/bidders');
			init.clientUrl = url(init.clientUrl || 'http://bidtorrent.io/client.html');
			init.configUrl = init.configUrl ? url(init.configUrl) : undefined;
			init.impUrl = url(init.impUrl || 'http://api.bidtorrent.io/imp');

			// Load bidders list and configuration, continue when available
			Future
				.bind
				(
					init.bidders ? Future.make(init.bidders, 200) : HTTP.json(init.biddersUrl + (init.biddersUrl.indexOf('?') === -1 ? '?' : '&') + document.location.host),
					Config.fetch(init.configUrl, init.config)
				)
				.then(function (biddersResult, configResult)
				{
					var bidders;
					var client;
					var config;
					var from;
					var imp;
					var parent;
					var parse;
					var success;

					bidders = biddersResult[0];
					config = configResult[0];

					if (!HTTP.isStatusValid(biddersResult[1]) || !bidders)
					{
						if (init.debug)
							console.error('[BidTorrent] could not read bidders list');

						return;
					}

					if (!HTTP.isStatusValid(configResult[1]) || !config)
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

					success = 0;

					for (var i = 0; i < config.imp.length; ++i)
					{
						imp = config.imp[i];

						if (!imp.id)
						{
							if (init.debug)
								console.error('[BidTorrent] missing DOM element id for impression #' + i);

							return;
						}

						parent = document.getElementById(imp.id);

						if (!parent)
							continue;

						++success;

						if (imp.banner === undefined || imp.banner.w === undefined || imp.banner.h === undefined)
						{
							imp.banner = imp.banner || {};
							imp.banner.h = imp.banner.h || parent.offsetHeight;
							imp.banner.w = imp.banner.w || parent.offsetWidth;
						}

						// Create and append client element
						client = document.createElement('iframe');
						client.onload = (function (channel, client)
						{
							return function ()
							{
								client.contentWindow.postMessage(JSON.stringify({
									bidders:	bidders,
									channel:	channel,
									impId:		channel,
									config:		config,
									debug:		init.debug,
									impUrl: 	init.impUrl,
									siteUrl:	url('/')
								}), '*');
							};
						})(i, client);

						client.frameBorder = 0;
						client.scrolling = 'no';
						client.seamless = 'seamless';
						client.style.height = imp.banner.h + 'px';
						client.style.width = imp.banner.w + 'px';
						client.src = init.clientUrl;

						parent.appendChild(client);

						// Connect message listener on client iframe
						parse = document.createElement('a');
						parse.href = init.clientUrl;

						from = parse.protocol + '//' + parse.hostname;

						window.addEventListener('message', (function (channel, parent)
						{
							return function (message)
							{
								var data;

								if (message.origin !== from)
									return;

								try
								{
									data = JSON.parse(message.data);
								}
								catch (e)
								{
									return;
								}

								if (!data || data.channel !== channel)
									return;

								switch (data.type)
								{
									case 'alert':
										if (init.debug)
											console.error(data.text);

										break;

									case 'debug':
										if (init.debug)
										{
											for (var i = 0; i < probes.length; ++i)
												probes[i](parent, data.flow, data.params);
										}

										break;

									case 'pass':
										DOM.html(parent, data.code || '');

										break;
								}
							};
						})(i, parent), false);
					}

					if (init.debug && success === 0)
						console.info('[BidTorrent] no compatible DOM element found');
				});
		};

		// Execute loader callback when page is loaded or synchronously
		if (document.readyState !== 'complete' && document.readyState !== 'loaded')
			document.addEventListener('DOMContentLoaded', start, false);
		else
			start();
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
