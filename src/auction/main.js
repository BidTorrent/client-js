/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/

(function ()
{
	var Auction = require('./workflow').Auction;
	var Config = require('./config').Config;
	var Future = require('./concurrent').Future;
	var Message = require('./message').Message;
	var Query = require('./http').Query;

	var start = function (event)
	{
		var bidders = event.data.bidders;
		var channel = event.data.channel;
		var debug = event.data.debug;
		var statUrl = event.data.statUrl;

		Future
			.bind
			(
				typeof bidders === 'string' ? Query.json(bidders) : Future.make(bidders),
				Config.fetch(event.data.configUrl, event.data.config)
			)
			.then(function (biddersResult, configResult)
			{
				var bidders;
				var config;

				if (!Query.isStatusValid(biddersResult[1]) ||
					!Query.isStatusValid(configResult[1]) || 
					!processConfig(configResult[0], channel))
					return;

				everythingLoaded(biddersResult[0], configResult[0], channel, debug, statUrl);
			});
	};

	var processConfig = function (config, channel)
	{
		if (!config.site || !config.site.publisher || config.site.publisher.id === undefined)
		{
			Message.alert(channel, 'missing publisher id');

			return false;
		}

		config.cur = config.cur || ['USD'];
		config.site = config.site || {};
		config.site.domain = config.site.domain || 'bidtorrent.com';
		config.imp = config.imp && config.imp.length > 0 ? config.imp : [{}];
		config.imp[0].bidfloor = config.imp[0].bidfloor || 0.1;
		config.imp[0].instl = config.imp[0].instl || 0;
		config.imp[0].secure = config.imp[0].secure || false;
		config.tmax = config.tmax || 500;

		return true;
	}

	var everythingLoaded = function (bidders, config, channel, debug, statUrl)
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
			config:		config,
			expire:		new Date().getTime() + config.tmax,			
			id:			id,
			request:	formatBidRequest(id, config)
		};

		if (debug)
			send = function (event, data) { Message.debug(channel, id, event, data); };
		else
			send = function () {};

		Auction
			.begin(auction, send)
			.then(function ()
			{
				Auction.end(auction, bidders, arguments, config, statUrl, send);
			});
	}

	var formatBidRequest = function (id, config)
	{
		var auctionRequest;
		var impression;

		auctionRequest =
		{
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

		return auctionRequest;
	};

	addEventListener('message', start, false);
})();
