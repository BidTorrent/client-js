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
		var slots = event.data.slots;
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

				everythingLoaded(biddersResult[0], configResult[0], slots[0], channel, debug, statUrl);
			});
	};

	var processConfig = function (config, channel)
	{
		if (!config.site || !config.site.publisher || config.site.publisher.id === undefined)
		{
			Message.send(channel,
			{
				event:		'init_error',
				reason:		'missing publisher id'
			});

			return false;
		}

		config.cur = config.cur || ['USD'];
		config.site = config.site || {};
		config.site.domain = config.site.domain || 'bidtorrent.com';
		config.imp = config.imp && config.imp.length > 0 ? config.imp : [{}];
		config.imp[0].bidfloor = config.imp[0].bidfloor || 0.10;
		config.imp[0].instl = config.imp[0].instl || 0;
		config.imp[0].secure = config.imp[0].secure || false;
		config.tmax = config.tmax || 500;

		return true;
	}

	var everythingLoaded = function (bidders, config, slot, channel, debug, statUrl)
	{
		var send;

		var makeGuid = function ()
		{
			function S4()
			{
				return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
			}

			return (S4() + S4() + "-" + S4() +
				"-" + S4().substr(0,3) + "-" +
				S4() + "-" + S4() + S4() + S4()).toLowerCase();
		}

		var auction;
		var id;

		id = makeGuid();

		auction =
		{
			bidders:	bidders,
			config:		config,
			expire:		new Date().getTime() + config.tmax,			
			id:			id,
			request:	formatBidRequest(id, config, slot)
		}

		if (debug)
			send = function (data) { Message.send(channel, data); };
		else
			send = function () {};

		Auction
			.begin(auction, send)
			.then(function ()
			{
				Auction.end(auction, bidders, arguments, config, statUrl, send);
			});
	}

	var formatBidRequest = function (id, config, slot)
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
			imp: [{
				banner: {
					btype: config.imp[0].banner === undefined ? undefined : config.imp[0].banner.btype,
					w: slot.width,
					h: slot.height
				},
				bidfloor: slot.floor,
				id: 1,
				instl: config.imp[0].instl,
				secure: config.imp[0].secure
			}],
			site: config.site,
			tmax: config.tmax,
			user: {}
		};

		return auctionRequest;
	};

	addEventListener('message', start, false);
})();
