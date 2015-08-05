
var Future = require('../future').Future;
var HTTP = require('../http').HTTP;

var Config = {
	fetch: function (configUrl, configLocal)
	{
		if (configUrl === undefined)
			return Future.make([configLocal, 200]); // TODO: replace this hack

		return HTTP
			.json(configUrl)
			.chain(function (configRemote, status)
			{
				if (!HTTP.isStatusValid(status) || !configRemote)
					return [configLocal, 200];

				return [Config.merge(configRemote, configLocal), 200];
			});
  	},

	merge: function (configRemote, configLocal)
	{
		var result;

		if (configLocal === undefined)
			return configRemote;

		result = {};

		if (configLocal.site !== undefined)
		{
			result.site = {};
			result.site.cat = configLocal.site.cat;
			result.site.id = configLocal.site.id;
			result.site.domain = configLocal.site.domain;
			result.site.mobile = configLocal.site.mobile;

			if (configLocal.site.publisher !== undefined)
			{
				result.site.publisher = {};
				result.site.publisher.id = configLocal.site.publisher.id;
				result.site.publisher.name = configLocal.site.publisher.name;
				result.site.publisher.country = configLocal.site.publisher.country;
			}
		}

		result.badv = configLocal.badv;
		result.bcat = configLocal.bcat;
		result.cur = configLocal.cur;
		result.tmax = configLocal.tmax;

		if (configLocal.imp !== undefined)
		{
			result.imp = [];
			result.imp = result.imp.concat(configLocal.imp);
		}

		if (configRemote.site !== undefined)
		{
			result.site = result.site || {};

			if (configRemote.site.cat !== undefined)
				result.site.cat = configRemote.site.cat;

			if (configRemote.site.domain !== undefined)
				result.site.domain = configRemote.site.domain;

			if (configRemote.site.id !== undefined)
				result.site.id = configRemote.site.id;

			if (configRemote.site.mobile !== undefined)
				result.site.mobile = configRemote.site.mobile;

			if (configRemote.site.publisher !== undefined)
			{
				result.site.publisher = result.site.publisher || {};

				if (configRemote.site.publisher.id !== undefined)
					result.site.publisher.id = configRemote.site.publisher.id;

				if (configRemote.site.publisher.name !== undefined)
					result.site.publisher.name = configRemote.site.publisher.name;

				if (configRemote.site.publisher.country !== undefined)
					result.site.publisher.country = configRemote.site.publisher.country;
			}
		}

		if (configRemote.badv !== undefined)
			result.badv = configRemote.badv;

		if (configRemote.bcat !== undefined)
			result.bcat = configRemote.bcat;

		if (configRemote.cur !== undefined)
			result.cur = configRemote.cur;

		if (configRemote.tmax !== undefined)
			result.tmax = configRemote.tmax;

		if (configRemote.imp !== undefined)
		{
			result.imp = result.imp || [];

			for (var impId = 0; impId < configRemote.imp.length; ++impId)
			{
				var resImp;
				var resImpId;
				var impRemote;

				impRemote = configRemote.imp[impId];
				resImpId = 0;

				for (; resImpId < result.imp.length; ++resImpId)
				{
					resImp = result.imp[resImpId];

					if (result.imp[resImpId].id === impRemote.id &&
						result.imp[resImpId].id !== undefined)
						break;
				}

				if (resImpId === result.imp.length)
				{
					resImp = {};
					resImp.id = impRemote.id;

					result.imp.push(resImp);
				}

				if (impRemote.bidfloor !== undefined)
					resImp.bidfloor = impRemote.bidfloor;

				if (impRemote.instl !== undefined)
					resImp.instl = impRemote.instl;

				if (impRemote.secure !== undefined)
					resImp.secure = impRemote.secure;

				if (impRemote.passback !== undefined)
					resImp.passback = impRemote.passback;

				if (impRemote.banner !== undefined)
				{
					resImp.banner = resImp.banner || {};

					if (impRemote.banner.btype !== undefined)
						resImp.banner.btype = impRemote.banner.btype;

					if (impRemote.banner.h !== undefined)
						resImp.banner.h = impRemote.banner.h;

					if (impRemote.banner.w !== undefined)
						resImp.banner.w = impRemote.banner.w;
				}
			}
		}

		return result;
	}
};

// Module exports
exports.Config = Config;
