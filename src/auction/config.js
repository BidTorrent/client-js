
var Config = {
	fetch: function (configUrl, configLocal)
	{
		configLocal = configLocal || {};

		if (configUrl === undefined)
			return Future.make([configLocal, 200]); // TODO: replace this hack

		return Query
			.json(configUrl)
			.chain(function (configRemote, status)
			{
				if (!Query.isStatusValid(status) || !configRemote)
					return [configLocal, 200];

				return [Config.merge(configRemote, configLocal), 200];
			});
  	},

	merge = function (configRemote, configLocal)
	{
		var result;

		result = {};

		if (configLocal.site !== undefined)
		{
			result.site = {};
			result.site.cat = configLocal.site.cat;
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
			result.imp.concat(configLocal.imp);
		}

		if (configRemote.site !== undefined)
		{
			result.site = result.site || {};

			if (configRemote.site.cat !== undefined)
				result.site.cat = configRemote.site.cat;

			if (configRemote.site.domain !== undefined)
				result.site.domain = configRemote.site.domain;

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
			result.imp.concat(configRemote.imp);
		}

		return result;
	}
};

// Module exports
exports.Config = Config;
