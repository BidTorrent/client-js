/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/
(function ()
{
	var Future = function ()
	{
		this.arguments = undefined;
		this.complete = undefined;
	};

	Future.bind = function ()
	{
		var complete;
		var future;
		var results;
		var wait;

		future = new Future();

		if (arguments.length <= 0)
			future.signal();
		else
		{
			complete = function (index)
			{
				return function ()
				{
					results[index] = arguments;

					if (--wait <= 0)
						future.signal.apply(future, results);
				};
			};

			results = new Array(arguments.length);
			wait = arguments.length;

			for (var i = 0; i < arguments.length; ++i)
				arguments[i].then(complete(i));
		}

		return future;
	};

	Future.first = function ()
	{
		var complete;
		var future;
		var wait;

		complete = function (futures)
		{
			return function ()
			{
				if (wait)
				{
					wait = false;

					for (var i = 0; i < futures.length; ++i)
						futures[i].signal();

					future.signal.apply(future, arguments);
				}
			};
		};

		future = new Future();
		wait = true;

		for (var i = 0; i < arguments.length; ++i)
			arguments[i].then(complete(arguments));

		return future;
	};

	Future.make = function ()
	{
		var future;

		future = new Future();
		future.signal.apply(future, arguments);

		return future;
	};

	Future.prototype.signal = function ()
	{
		if (this.arguments !== undefined)
			return false;

		this.arguments = arguments;

		if (this.complete !== undefined)
			this.complete.apply(null, arguments);

		return true;
	};

	Future.prototype.then = function (complete)
	{
		if (this.arguments !== undefined)
			complete.apply(null, this.arguments);
		else
			this.complete = complete;
	};

	var start = function (event)
	{
		var bidders = event.data.bidders;
		var config = event.data.config;
		var debug = event.data.debug;
		var index = event.data.index;
		var slot = event.data.slot;

		Future
			.bind
			(
				typeof bidders === 'string' ? sendQuery(bidders) : Future.make(bidders),
				typeof config === 'string' ? sendQuery(config) : Future.make(config)
			)
			.then(function(biddersArgs, configArgs)
			{
				var bidders = biddersArgs[0];
				var config = configArgs[0];

				applyDefaultValue(config);

				everythingLoaded(bidders, config, slot, debug ? index : undefined);
			});
	};

	var applyDefaultValue = function(config)
	{
		config = config || {};
		config.cur = config.cur || "EUR";
		config.passback = config.passback || '';
		config.site = config.site || {};
		config.site.domain = config.site.domain || "bidtorrent.com";
		config.site.publisher = config.site.publisher || {};
		config.site.publisher.id = config.site.publisher.id || 123;
		config.site.publisher.country = config.site.publisher.country || "FR";
		config.tmax = config.tmax || 500;
	}

	var everythingLoaded = function (bidders, config, slot, debug)
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

		sendDebug(auction,
		{
			event:		'begin',
			auction:	auction.id,
			bidders:	bidders
		});

		auctionBegin(auction).then(function ()
		{
			auctionEnd(auction, bidders, arguments);
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
					w:	slot.width,
					h:	slot.height
				},
				bidfloor: slot.floor
			}],
			site: config.site,
			tmax: config.tmax,
			user: {}
		};

		return auctionRequest;
	};

	var auctionEnd = function (auction, bidders, results)
	{
		var bid;
		var currentPrice;
		var index;
		var seatbid;
		var secondPrice;
		var timeout;
		var winner;

		secondPrice = auction.config.floor;
		timeout = new Date().getTime() >= auction.timeout;

		for (var i = 0; i < results.length; ++i)
		{
			var result = results[i][0];

			if (timeout)
			{
				sendDebug(auction,
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
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter'
				});

				continue;
			}

			if (!result || result.seatbid === undefined)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'empty'
				});

				continue;
			}

			if (result.cur !== undefined && 
				result.cur !== auction.request.cur)
			{
				sendDebug(
					auction,
					{
						auction:	auction.id,
						bidder:		bidders[i].id,
						event:		'bid_filter',
						reason:		"invalid currency"
					});

				continue;
			}

			seatbid = result.seatbid[0];

			if (!seatbid || seatbid.bid === undefined)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter',
					reason:		'nobid'
				});

				continue;
			}

			bid = seatbid.bid[0];

			if (!bid || bid.creative === undefined || bid.price === undefined || bid.price <= 0)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'corrupted'
				});

				continue;
			}

			if (bid.signature === undefined)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'missing signature'
				});

				continue;
			}

			if (bid.impid !== undefined && bid.impid !== auction.request.imp[0].id)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter',
					reason:		'invalid imp id'
				});

				continue;
			}

			if (bid.adomain !== undefined && auction.request.badv !== undefined)
			{
				var domBlId = 0;

				for (; domBlId < auction.request.badv.length; ++domBlId)
				{
					if (auction.request.badv[domBlId] === bid.adomain)
					{
						sendDebug(
							auction,
							{
								auction:	auction.id,
								bidder:		bidders[i].id,
								event:		'bid_filter',
								reason:		"invalid advertiser domain"
							});

						break;
					}
				}

				if (domBlId !== auction.request.badv.length)
					continue;
			}

			currentPrice = bid.price;

			sendDebug(auction,
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

		sendDebug(auction,
		{
			event:		'end',
			auction:	auction.id,
			winner:		bidders[index].id,
			price:		secondPrice
		});

		makeSucceededHtml
		(
			winner.creative,
			winner.nurl,
			secondPrice
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
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidder.id,
					event:		'bid_filter',
					reason:		'timeout'
				});
			}
		}, auction.config.tmax);

		return Future.first(sendQuery(bidder.bid_ep, auction.request), timeout);
	};

	var acceptBidder = function (bidder, auction)
	{
		var filters = bidder.filters;

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
			pixel = document.createElement('img');
			pixel.height = '1px';
			pixel.width = '1px';

			pixel.src = notifyUrl.replace('${AUCTION_PRICE}', secondPrice);

			document.body.appendChild(pixel);
		}

		evalBodyJS(document.body);
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

	var sendDebug = function (auction, data)
	{
		if (auction._debug !== undefined)
			window.parent.postMessage({data: data, id: auction._debug}, document.location.href);
	};

	var sendQuery = function (url, data)
	{
		var future;
		var xhr;

		future = new Future();

		xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function ()
		{
			var json;

			if (xhr.readyState !== 4)
				return;

			if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0)
			{
				try
				{
					json = JSON.parse(xhr.responseText);
				}
				catch (e)
				{
					json = undefined;
				}
			}
			else
				json = undefined;

			future.signal(json);
		};

		if (data !== undefined)
		{
			xhr.open('POST', url, true);
			xhr.send(JSON.stringify(data));
		}
		else
		{
			xhr.open('GET', url, true);
			xhr.send();
		}

		return future;
	};

	addEventListener('message', start, false);
})();
