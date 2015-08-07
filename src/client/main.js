/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/

(function ()
{
	var Auction = require('./auction').Auction;
	var Message = require('./message').Message;

	var start = function (message)
	{
		var data;

		try
		{
			data = JSON.parse(message.data);
		}
		catch (e)
		{
			return;
		}

		if (!processConfig(data.config, data.siteUrl, data.channel))
			return;

		everythingLoaded(data.bidders, data.config, data.channel, data.debug, data.impUrl);
	};

	var processConfig = function (config, siteUrl, channel)
	{
		var domain;
		var imp;

		if (!config.site)
		{
			Message.alert(channel, 'missing site');

			return false;
		}

		if (!config.site.id)
		{
			Message.alert(channel, 'missing site id');

			return false;
		}

		if (!config.site.publisher || config.site.publisher.id === undefined)
		{
			Message.alert(channel, 'missing publisher id');

			return false;
		}

		domain = siteUrl.replace(/^[^/]+:\/\//, '').replace(/\/.*/, '');

		config.cur = config.cur || ['USD'];
		config.imp = config.imp && config.imp.length > 0 ? config.imp : [{}];
		config.site.domain = config.site.domain || domain;
		config.site.publisher.name = config.site.publisher.name || domain;
		config.tmax = config.tmax || 500;

		for (var i = 0; i < config.imp.length; ++i)
		{
			imp = config.imp[i];
			imp.bidfloor = imp.bidfloor || 0.1;
			imp.instl = imp.instl || 0;
			imp.secure = imp.secure !== undefined ? imp.secure : siteUrl.substr(0, 6) === 'https:';
		}

		return true;
	}

	var everythingLoaded = function (bidders, config, channel, debug, impUrl)
	{
		var auction;
		var id;
		var send;

		var makeGuid = function ()
		{
			var S4 = function ()
			{
				return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1).toLowerCase();
			};

			return S4() + S4() + "-" + S4() + '-' + S4().substr(0, 3) + '-' + S4() + '-' + S4() + S4() + S4();
		};

		id = makeGuid();

		auction =
		{
			bidders:	bidders,
			expire:		new Date().getTime() + config.tmax,			
			id:			id,
			request:	formatBidRequest(id, config)
		};

		if (debug)
			send = function (event, params) { Message.debug(channel, id, event, params); };
		else
			send = function () {};

		Auction
			.begin(config, auction, send)
			.then(function ()
			{
				Auction.end(auction, bidders, arguments, config, impUrl, send);
			});
	}

	var formatBidRequest = function (id, config)
	{
		return {
			badv: config.badv,
			bcat: config.bcat,
			cur: config.cur,
			device: {
				js: 1,
				language: navigator.language,
				ua: navigator.userAgent
			},
			id: id,
			imp: config.imp,
			site: config.site,
			tmax: config.tmax,
			user: {}
		};
	};

	window.addEventListener('message', start, false);
})();
