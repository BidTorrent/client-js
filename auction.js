/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/
(function ()
{
    var start = function (event)
	{
		var config = event.data.config;
        var debug = event.data.debug;
        var id = event.data.id;

        config = config || {};
        config.slot = config.slot || {};
        config.slot.width = config.slot.width || 300;
        config.slot.height = config.slot.height || 250;
        config.base = config.base || 'http://bidtorrent.io';
        config.ep = config.ep || {};
        config.ep.bidders = config.ep.bidders || config.base + '/bidders.json';
        config.floor = config.floor || 0.01;
        config.passback = config.passback || '';
        config.publisher = config.publisher || document.location.href;
        config.timeout = config.timeout || 500;

		sendQuery(
			config.base + '/publisher.json',
			undefined,
			function(publisherConfig){
                config.publisherConfig = publisherConfig;
                publisherConfigLoaded(config, debug);
			});
	};
    
    var publisherConfigLoaded = function(config, debug)
	{
		sendQuery(
			config.ep.bidders,
			undefined,
			function(bidders){
                config.bidders = bidders;
				biddersConfigLoaded(config, debug);
			});
	}
    
    var biddersConfigLoaded = function(config, debug)
	{
        var makeGuid = function()
		{
			function S4() {
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
            request:	formatBidRequest(id, config.publisherConfig, config.slot),
			bidders:	config.bidders,
			config:		config,
			id:			id,
			pending:	0,
			results:	[],
			slot: 		config.slot.id,
			timeout:	new Date().getTime() + config.timeout,
            _debug:     debug ? id : undefined
		}

		sendDebug(auction, {
			event:		'begin',
			container:	config.slot.id,
			auction:	auction.id,
			bidders:	config.bidders
		});

		setTimeout(function ()
            {
                if (auction.pending === 0)
                    return;

                auction.pending = 0;

                auctionEnd(auction);
            },
            config.timeout);

		auctionBegin(auction);
	}
    
    var formatBidRequest = function(id, publisherConfig, slot)
	{
		var auctionRequest = {};
        var impression;

		auctionRequest["user"] = {};
		//auctionRequest["user"]["id"] = "a%3A1%3A%7Bi%3A42%3Bs%3A36%3A%22abc2ccbf-2636-4cf1-93b1-5f0f521ada22%22%3B%7D";
		//auctionRequest["user"]["buyerid"] = 1000;

		auctionRequest["site"] = {};
		auctionRequest["site"]["cat"] = publisherConfig["site"]["cat"];
		auctionRequest["site"]["domain"] = publisherConfig["site"]["domain"];
		auctionRequest["site"]["mobile"] = publisherConfig["site"]["mobile"];
		auctionRequest["site"]["publisher"] = {};
		auctionRequest["site"]["publisher"]["id"] = publisherConfig["site"]["id"];
		auctionRequest["site"]["publisher"]["name"] = publisherConfig["site"]["name"];

		auctionRequest["badv"] = publisherConfig["badv"];
		auctionRequest["bcat"] = publisherConfig["bcat"];
		auctionRequest["cur"] = publisherConfig["cur"];
        
		auctionRequest["device"] = {};
		//auctionRequest["device"]["geo"] = {};
		//auctionRequest["device"]["geo"]["country"] = myCountry;
		//auctionRequest["device"]["ip"] = myIp;
		//auctionRequest["device"]["js"] = 1;
		//auctionRequest["device"]["language"] = myLanguage;
		//auctionRequest["device"]["make"] = myMake;
		//auctionRequest["device"]["model"] = myModel;
		//auctionRequest["device"]["os"] = myOs;
		//auctionRequest["device"]["ua"] = myUa;

		auctionRequest["id"] = id;

        impression = publisherConfig["imp"]
        impression["banner"]["w"] = slot.width;
        impression["banner"]["h"] = slot.height;
        impression["banner"]["id"] = slot.id;
        auctionRequest["imp"] = [ publisherConfig["imp"] ];
        
		auctionRequest["tmax"] = publisherConfig["timeout_soft"];

		return auctionRequest;
	}
    
    var auctionEnd = function (auction)
	{
		var secondPrice;
		var winner;

		secondPrice = auction.config.floor;

		for (var i = 0; i < auction.results.length; ++i)
		{
			var result = auction.results[i];

			if (result.price === undefined || result.price <= 0)
				continue;

			if (winner === undefined || winner.price < result.price)
			{
				if (winner !== undefined)
					secondPrice = winner.price;

				winner = result;
			}
			else if (secondPrice === undefined || result.price > secondPrice)
				secondPrice = result.price;
		}

		if (winner === undefined)
		{
			document.body.innerHTML = auction.config.passback;

			return;
		}

		secondPrice += 0.01;

		sendDebug(
			auction,
			{
				event:		'end',
				container:	auction.slot,
				auction:	auction.id,
				winner:		winner.id,
				price:		secondPrice
			});

		makeSucceededHtml(
            winner.creative,
            winner,
            secondPrice,
            "www.criteo.com");
	};
    
    var auctionBegin = function (auction)
	{
        for(var bidderId in auction.bidders)
        {
            var bidder;
            
            bidder = auction.bidders[bidderId];
            
            if(acceptBidder(bidder, auction))
            {
                ++auction.pending;
            
                auctionSend(auction, bidderId, bidder);
            }
        }
	};
    
    var auctionSend = function (auction, bidderId, bidder)
	{
        sendQuery(
			bidder.bid_ep,
			auction.request,
			function (result)
			{
                var bids;
                var bid;
                
				if (auction.pending === 0)
					return;

				if (new Date().getTime() >= auction.timeout)
				{
					sendDebug(auction, {
						auction:	auction.id,
						bidder:		bidderId,
						event:		'bid_filter',
						reason:		'timeout'
					});
                    
                    return;
				}
				else if (result === undefined)
				{
					sendDebug(auction, {
						auction:	auction.id,
						bidder:		bidderId,
						event:		'bid_filter',
						reason:		'corrupted'
					});
                    
                    return;
				}
                else if(result.seatbid.length == 0)
                {
                    sendDebug(auction, {
						auction:	auction.id,
						bidder:		bidderId,
						event:		'bid_filter',
						reason:		'nobid'
					});
                    
                    return;
                }
                else if(!result.seatbid[0].hasOwnProperty("bid"))
                {
                    sendDebug(auction, {
						auction:	auction.id,
						bidder:		bidderId,
						event:		'bid_filter',
						reason:		'corrupted'
					});
                    
                    return;
                }
                
                bids = result.seatbid[0]["bid"];
                
                if(bids.length == 0)
                {
                    sendDebug(auction, {
						auction:	auction.id,
						bidder:		bidderId,
						event:		'bid_filter',
						reason:		'nobid'
					});
                    
                    return;
                }
                
                bid = bids[0];
                
                if(bid.price === undefined || bid.creative === undefined)
                {
                    sendDebug(auction, {
						auction:	auction.id,
						bidder:		bidderId,
						event:		'bid_filter',
						reason:		'nobid'
					});
                    
                    return;
                }
				else
				{
					sendDebug(auction, {
						auction:	auction.id,
						bidder:		bidderId,
						event:		'bid_valid',
						price:		bid.price
					});

					auction.results.push(
                    {
						creative:	bid.creative,
						id:			bidderId,
						notify:		bid.nurl,
						price:		bid.price
					});
				}

				if (--auction.pending === 0)
					auctionEnd(auction);
			}
		);
	};
    
    var acceptBidder = function(bidder, auction)
    {
        // TODO probably read configuration before
        /*for(var propertyKey in bidder)
        {
            if(propertyKey === "filters")
            {
                for(var filterKey in bidder["filters"])
                {
                    if(filterKey == "sampling")
                    {
                        
                    }
                }
            }
        }*/
        
        return true; 
    }
    
	var makeSucceededHtml = function(creativeCode, winner, secondPrice, clickUrl)
	{
		var creativeImg;
		var pixel;

		creativeImg = document.createElement('div');
		creativeImg.innerHTML  = creativeCode;

		pixel = document.createElement('img');
		pixel.height = '1px';
		pixel.width = '1px';

		pixel.src = winner.notify.replace('${AUCTION_PRICE}', secondPrice.toString());
        pixel.src = pixel.src.replace('${CLICK_URL}', clickUrl);

		document.body.appendChild(creativeImg);
		document.body.appendChild(pixel);
	}

	var sendDebug = function (auction, data)
	{
		if (!auction.config.debug)
			return;

		window.parent.postMessage(data, auction.config.publisher);
	};

	var sendQuery = function (url, data, complete)
	{
		var xhr;

		xhr = new XMLHttpRequest();
		
		xhr.onreadystatechange = function ()
		{
			var json;

			if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 0))
			{
				try
				{
					json = JSON.parse(xhr.responseText);
				}
				catch (e)
				{
					json = undefined;
				}

				complete(json);
			}
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
	};

	addEventListener('message', start, false);
})();
