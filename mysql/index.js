"use strict";
const connect = require("./lib/connect.js");
const sqlLoader = require("leo-connector-common/sql/loader");
const sqlLoaderJoin = require('leo-connector-common/sql/loaderJoinTable');
const sqlNibbler = require("leo-connector-common/sql/nibbler");
const snapShotter = require("leo-connector-common/sql/snapshotter");
const checksum = require("./lib/checksum");
const streamChanges = require('./lib/streamchanges');
const leo = require("leo-sdk");
const ls = leo.streams;

module.exports = {
	load: function(config, sql, domain, opts, idColumns) {
		let client = connect(config);
		if (Array.isArray(idColumns)) {
			// make sure we don't include a values keyword in the return array of ids
			opts.values = false;
			return sqlLoaderJoin(client, idColumns, sql, domain, opts);
		} else {
			return sqlLoader(client, sql, domain, opts);
		}
	},
	nibble: function(config, table, id, opts) {
		return sqlNibbler(connect(config), table, id, opts);
	},
	checksum: function(config) {
		return checksum(connect(config));
	},
	domainObjectLoader: function(bot_id, dbConfig, sql, domain, opts, callback) {
		if (opts.snapshot) {
			snapShotter(bot_id, connect(dbConfig), dbConfig.table, dbConfig.id, domain, {
				event: opts.outQueue
			}, callback);
		} else {
			let stats = ls.stats(bot_id, opts.inQueue);
			ls.pipe(leo.read(bot_id, opts.inQueue, {start: opts.start})
				, stats
				, this.load(dbConfig, sql, domain, {
						queue: opts.outQueue,
						id: bot_id,
						limit: opts.limit
					}, dbConfig.id)
				, ls.toLeo(bot_id)
				, ls.devnull('done')
				, err => {
					if (err) return callback(err);
					return stats.checkpoint(callback);
				}
			);
		}
	},
	streamChanges: function(config, tables, opts = {}) {

		// make sure we have user and database
		config.user = config.user || config.username;
		config.database = config.database || config.dbname;

		opts.config = config;
		return streamChanges(config, tables, opts);

		// @todo change this to a connection. Zongji would have to be updated to work with mysql2
		// return streamChanges(connect(config), tables, opts);
	},
	connect: connect
};
