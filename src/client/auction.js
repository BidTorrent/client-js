
var DOM = require('../dom').DOM;
var Future = require('../future').Future;
var HTTP = require('../http').HTTP;
var Signature = require('./signature').Signature;

var Auction = {
	acceptBidder: function (config, auction, bidder)
	{
		var filters;

		if (bidder.id === undefined || bidder.key === undefined || !bidder.bid_ep)
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
			config.site.publisher.country !== undefined)
		{
			// if whitelist mode
			if (filters.pub_ctry_wl !== undefined && filters.pub_ctry_wl === true)
			{
				var ctryId = 0;

				for (; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === config.site.publisher.country)
						break;
				}

				if (ctryId === filters.pub_ctry.length)
					return false;
			}
			else
			{
				for (var ctryId = 0; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === config.site.publisher.country)
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
			config.site !== undefined &&
			config.site.cat !== undefined)
		{
			for (var catId = 0; catId < filters.cat_bl.length; ++catId)
			{
				var catBl = filters.cat_bl[catId];

				if (config.site.cat.contains(catBl))
					return false;
			}
		}

		// if the publisher domain is blacklisted per bidder => bidder banished
		if (filtes.pub !== undefined)
		{
			for (var pubId = 0; pubId < filters.pub.length; ++pubId)
			{
				var pubBl = filters.pub[pubId];

				if (config.site.domain === pubBl)
					return false;
			}
		}

		return true;
	},

	begin: function (config, auction, sendDebug)
	{
		var futures = [];

		for (var i = 0; i < auction.bidders.length; ++i)
		{
			var bidder = auction.bidders[i];

			if (Auction.acceptBidder(config, auction, bidder))
				futures.push(Auction.send(config, auction, bidder));
			else
				futures.push(Future.make('filter', undefined));
		}

		sendDebug('init_valid', {bidders: auction.bidders});

		return Future.bind.apply(null, futures);
	},

	end: function (auction, bidders, results, config, impUrl, sendDebug, sendPass)
	{
		var bid;
		var candidates;
		var domainBidder;
		var domainForbidden;
		var domainPattern;
		var pass;
		var seatbid;
		var secondPrice;
		var winnerBid;
		var winnerId;

		candidates = [];
		secondPrice = config.imp[0].bidfloor;

		for (var i = 0; i < results.length; ++i)
		{
			var action = results[i][0];
			var data = results[i][1];

			if (action === 'error')
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: data});

				continue;
			}

			if (action === 'filter')
			{
				sendDebug('bid_filter', {bidder: bidders[i].id});

				continue;
			}

			if (action === 'pass')
			{
				sendDebug('bid_pass', {bidder: bidders[i].id});

				continue;
			}

			if (action === 'empty' || !data || !data.seatbid)
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'empty response'});

				continue;
			}

			if (action !== 'take')
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'unknown error'});

				continue;
			}

			// Check currency against allowed ones
			if (data.cur)
			{
				pass = false;

				for (var j = 0; !pass && j < auction.request.cur.length; ++j)
					pass = data.cur === auction.request.cur[j];

				if (!pass)
				{
					sendDebug('bid_error', {bidder: bidders[i].id, reason: 'invalid currency "' + data.cur + '"'});

					continue;
				}
			}

			// Find first seat if any
			seatbid = data.seatbid[0];

			if (!seatbid || !seatbid.bid)
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'no bid'});

				continue;
			}

			// Find first bid if any
			bid = seatbid.bid[0];

			if (!bid || !bid.adm)
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'missing creative'});

				continue;
			}

			if (!bid.price)
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'missing or zero price'});

				continue;
			}

			if (!bid.ext || !bid.ext.signature)
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'missing signature'});

				continue;
			}

			if (bid.impid && bid.impid != auction.request.imp[0].id)
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'invalid imp id'});

				continue;
			}

			if (bid.adomain && bid.adomain.length > 0 && auction.request.badv && auction.request.badv.length > 0)
			{
				domainPattern = /^(https?:\/\/)?\.?([-a-zA-Z0-9@:%._\+~#=]+).*/;
				pass = true;

				for (var j = 0; pass && j < auction.request.badv.length; ++j)
				{
					domainForbidden = '.' + auction.request.badv[j].replace(domainPattern, '$2').toLowerCase();

					for (var k = 0; pass && k < bid.adomain.length; ++k)
					{
						domainBidder = '.' + bid.adomain[k].replace(domainPattern, '$2').toLowerCase();
						pass = domainBidder.substr(Math.max(domainBidder.length - domainForbidden.length, 0)) !== domainForbidden;
					}
				}

				if (!pass)
				{
					sendDebug('bid_error', {bidder: bidders[i].id, reason: 'blacklisted advertiser domain'});

					continue;
				}
			}

			if (!Signature.check(bid.price, auction.request.id, config.imp[0].id, config.site.publisher.id, config.imp[0].bidfloor, bidders[i].key, bid.ext.signature))
			{
				sendDebug('bid_error', {bidder: bidders[i].id, reason: 'invalid signature'});

				continue;
			}

			// Valid bid received, append to candidates list
			candidates.push({
				bidder:		bidders[i].id,
				impid:		bid.impid,
				price:		bid.price,
				signature:	bid.ext.signature
			});

			sendDebug('bid_valid', {bidder: bidders[i].id, price: bid.price});

			if (winnerBid === undefined || winnerBid.price < bid.price)
			{
				if (winnerBid !== undefined)
					secondPrice = winnerBid.price;

				winnerBid = bid;
				winnerId = bidders[i].id;
			}
			else if (secondPrice === undefined || bid.price > secondPrice)
				secondPrice = bid.price;
		}

		// Winner has been selected, display and track impression
		if (winnerBid !== undefined)
		{
			secondPrice += 0.01;

			DOM.append(document.body, Auction.renderMacro(winnerBid.adm, auction, secondPrice));

			// Append bidder notification URL if any
			if (winnerBid.nurl)
				DOM.pixel(document.body, Auction.renderMacro(winnerBid.nurl, auction, secondPrice));

			// Append publisher tracking URL if any
			if (impUrl)
				DOM.pixel(document.body, Auction.renderTrack(impUrl, config, auction, candidates));
		}

		// No winner found, display passback code if any
		else if (config.imp[0].passback)
		{
			if (true) // There should be an option to display passback inside iframe
				sendPass(config.imp[0].passback);
			else if (config.imp[0].passback)
				DOM.append(document.body, config.imp[0].passback);
		}

		// Send debug 'end' flow step
		sendDebug('end', {winner: winnerId, price: secondPrice});
	},

	send: function (config, auction, bidder)
	{
		var timeout = new Future();

		// Schedule timeout response (HTTP 408)
		setTimeout(function ()
		{
			timeout.signal(undefined, 408);
		}, config.tmax);

		// Wrap either actual bidder response or timeout
		return Future
			.first(HTTP.json(bidder.bid_ep, auction.request), timeout)
			.chain(function (response, status)
			{
				if (new Date().getTime() >= auction.timeout)
					status = 408;

				if (status >= 400 && status < 600)
					return ['error', status];

				if (status === 204)
					return ['pass', undefined];

				if (response === undefined)
					return ['empty', undefined];

				return ['take', response];
			});
	},

	renderMacro: function (template, auction, secondPrice)
	{
		return template
			.replace('${AUCTION_AD_ID}', '')
			.replace('${AUCTION_BID_ID}', '')
			.replace('${AUCTION_CURRENCY}', '')
			.replace('${AUCTION_ID}', auction.id)
			.replace('${AUCTION_IMP_ID}', '')
			.replace('${AUCTION_SEAT_ID}', '')
			.replace('${AUCTION_PRICE}', secondPrice)
			.replace('${CLICK_URL}', '');
	},

	/*
	* Render an impression tracking pixel in the bottom of the ad.
	*/
	renderTrack: function (impUrl, config, auction, candidates)
	{
		var candidate;
		var first;
		var impId;
		var parts;

		parts = {};
		parts['a'] = auction.id
		parts['p'] = config.site.publisher.id;

		for (var i = 0; i < 1 /* config.imp.length */; ++i)
		{
			impId = config.imp[i].id;

			for (var j = 0; j < candidates.length; j++)
			{
				candidate = candidates[j];

				// FIXME: only accept candidates for current impId, should be improved but multi-imp is not supported yet
				if (candidate.impid !== impId)
					continue;

				parts['d[' + i + '][' + candidate.bidder + ']'] = candidate.price + '-' + candidate.signature;
			}

			parts['f[' + i + ']'] = config.imp[i].bidfloor;
			parts['i[' + i + ']'] = impId;
		}

		first = true;

		for (var key in parts)
		{
			impUrl = impUrl + (first ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(parts[key]);
			first = false;
		}

		return impUrl;
	}
};

// Module exports
exports.Auction = Auction;
