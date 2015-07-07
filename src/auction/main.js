/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/

(function ()
{
	var Auction = require('./workflow').Auction;
	var Future = require('./concurrent').Future;
	var Query = require('./http').Query;

	var start = function (event)
	{
		var bidders = event.data.bidders;
		var configURL = event.data.configUrl;
		var debug = event.data.debug;
		var index = event.data.index;
		var localConfig = event.data.config;
		var slots = event.data.slots;
		var statUrl = event.data.statUrl;

		Future
			.bind
			(
				typeof bidders === 'string' ? Query.json(bidders) : Future.make(bidders),
				makeConfig(configURL, localConfig)
			)
			.then(
				function (biddersResult, configResult)
				{
					var bidders;
					var config;
					var debugId;

					if (!Query.isStatusValid(biddersResult[1]) ||
						!Query.isStatusValid(configResult[1]))
						return;

					debugId = debug ? index : undefined;

					applyDefaultValue(configResult[0]);

					if (!isConfigOK(configResult[0], debugId))
						return;

					everythingLoaded(biddersResult[0], configResult[0], slots[0], debugId, statUrl);
				});
	};

	var makeConfig = function(configURL, localConfig)
	{
		if (!configURL)
			return Future.make([!localConfig ? {} : localConfig, 200]);// TODO: replace this hack
		
		return Query.json(configURL)
			.chain(
				function(config, status)
				{
					var result;

					// TODO log this
					if (!Query.isStatusValid(status) || !config)
						return [config, status];

					if (!localConfig)
						return [config, status];

					return [mergeConfig(config, localConfig), status];
				});
  	} 

	var mergeConfig = function(serverConfig, localConfig)
	{
		var result;

		if (!serverConfig)
			return localConfig;

		result = {};

		if (localConfig.site !== undefined)
		{
			result.site = {};
			result.site.cat = localConfig.site.cat;
			result.site.domain = localConfig.site.domain;
			result.site.mobile = localConfig.site.mobile;

			if (localConfig.site.publisher !== undefined)
			{
				result.site.publisher = {};
				result.site.publisher.id = localConfig.site.publisher.id;
				result.site.publisher.name = localConfig.site.publisher.name;
				result.site.publisher.country = localConfig.site.publisher.country;
			}
		}

		result.badv = localConfig.badv;
		result.bcat = localConfig.bcat;
		result.cur = localConfig.cur;
		result.tmax = localConfig.tmax;

		if (localConfig.imp !== undefined)
		{
			result.imp = [];
			result.imp.concat(localConfig.imp);
		}

		if (serverConfig.site !== undefined)
		{
			result.site = result.site || {};

			if (serverConfig.site.cat !== undefined)
				result.site.cat = serverConfig.site.cat;
			
			if (serverConfig.site.domain !== undefined)
				result.site.domain = serverConfig.site.domain;

			if (serverConfig.site.mobile !== undefined)
				result.site.mobile = serverConfig.site.mobile;

			if (serverConfig.site.publisher !== undefined)
			{
				result.site.publisher = result.site.publisher || {};

				if (serverConfig.site.publisher.id !== undefined)
					result.site.publisher.id = serverConfig.site.publisher.id;

				if (serverConfig.site.publisher.name !== undefined)
					result.site.publisher.name = serverConfig.site.publisher.name;

				if (serverConfig.site.publisher.country !== undefined)
					result.site.publisher.country = serverConfig.site.publisher.country;
			}
		}

		if (serverConfig.badv !== undefined)
			result.badv = serverConfig.badv;

		if (serverConfig.bcat !== undefined)
			result.bcat = serverConfig.bcat;

		if (serverConfig.cur !== undefined)
			result.cur = serverConfig.cur;

		if (serverConfig.tmax !== undefined)
			result.tmax = serverConfig.tmax;

		if (serverConfig.imp !== undefined)
		{
			result.imp = result.imp || [];
			result.imp.concat(serverConfig.imp);
		}

		return result;
	}

	var applyDefaultValue = function(config)
	{
		config.cur = config.cur || ['USD'];
		config.imp = config.imp && config.imp.length > 0 ? config.imp : [{}];
		config.imp[0].bidfloor = config.imp[0].bidfloor || 0.01;
		config.site = config.site || {};
		config.site.domain = config.site.domain || 'bidtorrent.com';
		config.tmax = config.tmax || 500;
	}

	var isConfigOK = function(config, debug)
	{
		if (!config.site || !config.site.publisher || config.site.publisher.id === undefined)
		{
			sendDebug(debug,
			{
				event:		'init_error',
				reason:		'missing publisher id'
			});

			return false;
		}

		if (!config.cur || config.cur.length === 0)
		{
			sendDebug(debug,
			{
				event:		'init_error',
				reason:		'missing currency'
			});

			return false;
		}

		if (!config.imp || config.imp.length === 0 || config.imp[0].bidfloor === undefined)
		{
			sendDebug(debug,
			{
				event:		'init_error',
				reason:		'missing impression bidfloor'
			});

			return false;
		}

		if (config.tmax === undefined)
		{
			sendDebug(debug,
			{
				event:		'init_error',
				reason:		'missing timeout (tmax)'
			});

			return false;
		}

		return true;
	}

	var everythingLoaded = function (bidders, config, slot, debug, statUrl)
	{
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
			request:	formatBidRequest(id, config, slot),
			bidders:	bidders,
			config:		config,
			expire:		new Date().getTime() + config.tmax,			
			id:			id,
			_debug:		debug
		}

		sendDebug(auction._debug,
		{
			event:		'init_valid',
			auction:	auction.id,
			bidders:	bidders
		});

		Auction
			.begin(auction)
			.then(function ()
			{
				Auction.end(auction, bidders, arguments, config, statUrl, sendDebug);
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

	var sendDebug = function (debug, data)
	{
		if (debug !== undefined)
			window.parent.postMessage({data: data, id: debug}, document.location.href);
	};

	addEventListener('message', start, false);
})();
