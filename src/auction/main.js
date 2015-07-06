/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/

(function ()
{
	var Future = require('./concurrent').Future;
	var Query = require('./http').Query;

	var start = function (event)
	{
		var bidders = event.data.bidders;
		var config = event.data.config;
		var debug = event.data.debug;
		var index = event.data.index;
		var slots = event.data.slots;
		var statUrl = event.data.statUrl;

		Future
			.bind
			(
				typeof bidders === 'string' ? Query.json(bidders) : Future.make(bidders),
				typeof config === 'string' ? Query.json(config) : Future.make(config)
			)
			.then(function(biddersArgs, configArgs)
			{
				var bidders = biddersArgs[0];
				var config = configArgs[0];
				var debugId;

				debugId = debug ? index : undefined;

				applyDefaultValue(config);

				if (!isConfigOK(config, debugId))
					return;				

				everythingLoaded(bidders, config, slots[0], debugId, statUrl);
			});
	};

	var applyDefaultValue = function(config)
	{
		config = config || {};
		config.cur = config.cur || ['USD'];
		config.site = config.site || {};
		config.site.domain = config.site.domain || 'bidtorrent.com';
		config.imp = config.imp || [{}];
		config.imp[0].bidfloor = config.imp[0].bidfloor || 0.0;
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

		auctionBegin(auction).then(function ()
		{
			var results = [];
			for (var i = 0; i < arguments.length; i++) 
			{
				results.push(arguments[i][0]);
			}
			auctionEnd(auction, bidders, results, config, statUrl);
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

	var auctionEnd = function (auction, bidders, results, config, statUrl)
	{
		var bid;
		var currentPrice;
		var index;
		var seatbid;
		var secondPrice;
		var timeout;
		var winner;
		var domContainer;

		secondPrice = auction.config.floor;
		timeout = new Date().getTime() >= auction.timeout;

		for (var i = 0; i < results.length; ++i)
		{
			var result = results[i];

			if (timeout)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'timeout'
				});

				continue;
			}

			if (result === null)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter'
				});

				continue;
			}

			if (!result || !result.seatbid)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'empty'
				});

				continue;
			}

			if (result.cur && result.cur !== auction.request.cur)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'invalid currency'
				});

				continue;
			}

			seatbid = result.seatbid[0];

			if (!seatbid || !seatbid.bid)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'no bid'
				});

				continue;
			}

			bid = seatbid.bid[0];

			if (!bid || !bid.creative || !bid.price)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'no price'
				});

				continue;
			}

			if (!bid.signature)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'missing signature'
				});

				continue;
			}

			if (bid.impid && bid.impid != auction.request.imp[0].id)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'invalid imp id'
				});

				continue;
			}

			if (bid.adomain && auction.request.badv)
			{
				var domBlId = 0;

				for (; domBlId < auction.request.badv.length; ++domBlId)
				{
					if (auction.request.badv[domBlId] === bid.adomain)
					{
						sendDebug(auction._debug,
						{
							auction:	auction.id,
							bidder:		bidders[i].id,
							event:		'bid_error',
							reason:		'invalid advertiser domain'
						});

						break;
					}
				}

				if (domBlId !== auction.request.badv.length)
					continue;
			}

			currentPrice = bid.price;

			sendDebug(auction._debug,
			{
				auction:	auction.id,
				bidder:		bidders[i].id,
				event:		'bid_valid',
				price:		currentPrice
			});

			if (winner === undefined || winner.price < currentPrice)
			{
				if (winner !== undefined)
					secondPrice = winner.price;

				index = i;
				winner = bid;
			}
			else if (secondPrice === undefined || currentPrice > secondPrice)
				secondPrice = currentPrice;
		}

		if (winner === undefined)
		{
			document.body.innerHTML = auction.config.passback;

			return;
		}

		secondPrice += 0.01;

		sendDebug(auction._debug,
		{
			event:		'end',
			auction:	auction.id,
			winner:		bidders[index].id,
			price:		secondPrice
		});

		domContainer = makeSucceededHtml
		(
			winner.creative,
			winner.nurl,
			secondPrice
		);

		renderImpressionPixel(
			config,
			auction,
			bidders,
			results,
			domContainer,
			statUrl
		);
	};

	var auctionBegin = function (auction)
	{
		var futures = [];

		for (var i = 0; i < auction.bidders.length; ++i)
		{
			var bidder = auction.bidders[i];

			if (acceptBidder(bidder, auction))
				futures.push(auctionSend(auction, bidder));
			else
				futures.push(Future.make(null));
		}

		return Future.bind.apply(null, futures);
	};

	var auctionSend = function (auction, bidder)
	{
		var timeout = new Future();

		setTimeout(function ()
		{
			if (timeout.signal(/*bidder*/))
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidder.id,
					event:		'bid_filter',
					reason:		'timeout'
				});
			}
		}, auction.config.tmax);

		return Future.first(Query.json(bidder.bid_ep, auction.request), timeout);
	};

	var acceptBidder = function (bidder, auction)
	{
		var filters;

		if (bidder.id === undefined)
			return false;

		if (!bidder.bid_ep)
			return false;

		filters = bidder.filters;

		if (filters === undefined)
			return true;

		if (filters.sampling !== undefined && Math.random() * 100 > filters.sampling)
			return false;

		// if publisher country is not part of whitelist countries => bidder banished
		// if publisher country is part of blacklist countries => bidder banished
		if (filters.pub_ctry !== undefined && 
			filters.pub_ctry.length !== 0 && 
			auction.config.site.publisher.country !== undefined)
		{
			// if whitelist mode
			if (filters.pub_ctry_wl !== undefined && filters.pub_ctry_wl === true)
			{
				var ctryId = 0;
				
				for (; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === auction.config.site.publisher.country)
						break;
				}

				if (ctryId === filters.pub_ctry.length)
					return false;
			}
			else
			{
				for (var ctryId = 0; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === auction.config.site.publisher.country)
						return false;
				}
			}
		}

		// if user language is not part of whitelist language => bidder banished
		// if user language is part of blacklist language => bidder banished
		if (filters.user_lang !== undefined &&
			filters.user_lang.length !== 0)
		{
			// if whitelist mode
			if (filters.user_lang_wl !== undefined && filters.user_lang_wl === true)
			{
				var userLangId = 0;

				for (; userLangId < filters.user_lang.length; ++userLangId)
				{
					if (filters.user_lang[userLangId] === auction.request.device.language)
						break;
				}

				if (userLangId === filters.user_lang.length)
					return false;
			}
			else
			{
				for (var userLangId = 0; userLangId < filters.user_lang.length; ++userLangId)
				{
					if (filters.user_lang[userLangId] === auction.request.device.language)
						return false;
				}
			}
		}

		// if 1 site category of publisher is blacklisted per bidder => bidder banished
		if (filters.cat_bl !== undefined && 
			auction.config.site !== undefined && 
			auction.config.site.cat !== undefined)
		{ 
			for (var catId = 0; catId < filters.cat_bl.length; ++catId)
			{
				var catBl = filters.cat_bl[catId];

				if (auction.config.site.cat.contains(catBl))
					return false;
			}
		}


		// if the publisher domain is blacklisted per bidder => bidder banished
		if (filtes.pub !== undefined)
		{
			for (var pubId = 0; pubId < filters.pub.length; ++pubId)
			{
				var pubBl = filters.pub[pubId];

				if (auction.config.site.domain === pubBl)
					return false;
			}
		}
		

		return true;
	}

	var makeSucceededHtml = function (creativeCode, notifyUrl, secondPrice)
	{
		var creativeImg;
		var pixel;

		creativeImg = document.createElement('div');
		creativeImg.innerHTML  = creativeCode;

		document.body.appendChild(creativeImg);

		if (notifyUrl)
		{
			addPixel(
				notifyUrl.replace('${AUCTION_PRICE}', secondPrice),
				document.body
			);
		}

		evalBodyJS(document.body);
		return creativeImg;
	};

	var evalBodyJS = function (body)
	{
		var apply;
		var node;
		var nodes;
		var trick;

		apply = function (node)
		{
			var child;
			var nodes = [];

			for (var i = 0; i < node.childNodes.length; ++i)
			{
				child = node.childNodes[i];

				if (child.nodeName.toUpperCase() === 'SCRIPT' && (!child.type || child.type.toLowerCase() === 'text/javascript'))
					nodes.push(child);
				else
					nodes = nodes.concat(apply(child));
			}

			return nodes;
		};

		function trick(elem)
		{
			var script = document.createElement('script');
			var source = elem.text || elem.textContent || elem.innerHTML || '';
			var target = document.getElementsByTagName('head')[0] || document.documentElement;

			script.src = elem.src;
			script.type = 'text/javascript';

			try
			{
				// Standard way to set script source code
				script.appendChild(document.createTextNode(source));
			}
			catch (e)
			{
				// Workaround for IE <= 7
				script.text = source;
			}

			target.insertBefore(script, target.firstChild);
			target.removeChild(script);
		};

		nodes = apply(body);

		for (i = 0; i < nodes.length; i++)
		{
			node = nodes[i];

			if (node.parentNode)
				node.parentNode.removeChild(node);

			trick(node);
		}
	};

	/*
	* Renders an impression pixel in the bottom of the ad
	*/
	var renderImpressionPixel = function(config, auction, bidders, results, domContainer, statUrl)
	{
		var response;
		var bids;
		var bid;
		var bidder;

		var parts = {
			'a': auction.id,
			'p': config.site.publisher.id,
			'f': auction.config.imp[0].bidfloor
		};

		for(var resultIndex = 0; resultIndex < results.length; resultIndex++)
		{
			response = results[resultIndex];
			if (response == null) continue;
			bidder = bidders[resultIndex];

			bids = response.seatbid;
			for(var bidIndex = 0; bidIndex < bids.length; bidIndex ++)
			{
				var bid = bids[bidIndex].bid[0];
				parts['d[' + bidders[resultIndex].id + ']'] =
					bid.price
					+ '-'
					+ bid.signature;
			}
		}

		var url = statUrl;
		var firstParam = true;
		for(var key in parts) {
			url = url + (firstParam ? '?' : '&') + key + '=' + encodeURIComponent(parts[key]);
			firstParam = false;
		}
		addPixel(url, domContainer);
	}

	var sendDebug = function (debug, data)
	{
		if (debug !== undefined)
			window.parent.postMessage({data: data, id: debug}, document.location.href);
	};

	var addPixel = function (url, parent) {
		var pixel = document.createElement('img');
		pixel.height = '1px';
		pixel.width = '1px';
		pixel.src = url;
		parent.appendChild(pixel);
	}

	addEventListener('message', start, false);
})();
