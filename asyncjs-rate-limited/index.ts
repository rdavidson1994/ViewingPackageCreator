"use strict";

import * as async from "async";
import * as fs from "fs";
import * as path from "path";
import * as requestDebug from "request-debug";
import * as requestJs from "request";
import * as uuid from "uuid";

// if (process.env.NODE_ENV !== "production") {
// 	requestDebug(requestJs);
// }

const viewingPackageCreators = "https://api.accusoft.com/prizmdoc/v2/viewingPackageCreators";
const apiKey = "";

function enumerateFiles() {
	let files = [];

	fs.readdirSync(path.join(__dirname, "..", "documents")).forEach(function(file) {
		files.push(path.join(__dirname, "..", "documents", file));
	});

	return files;
}

function createViewingPackage(file, callback) {
	let documentId = uuid.v4();

	let displayName = file.split("\\").pop().split("/").pop();

	console.log("Creating a Viewing Package from " + file + "...");

	requestJs.post({
		"url": viewingPackageCreators,
		"headers": {
			"Accusoft-Secret": "mysecretkey",
			"acs-api-key": apiKey
		},
		"json": {
			"input": {
				"source": {
					"type": "upload",
					"displayName": displayName,
					"documentId": documentId
				},
				"viewingPackageLifetime": 0
			}
		}
	}, function(error, httpResponse, body) {
		let processId = body["processId"];

		let data = fs.readFileSync(path.join(file));

		requestJs.put({
			"url": viewingPackageCreators + "/" + processId + "/SourceFile",
			"headers": {
				"Accusoft-Secret": "mysecretkey",
				"Content-Type": "application/octet-stream",
				"acs-api-key": apiKey
			},
			"body": data
		}, function(error, httpResponse, body) {
			(function poll() {
				requestJs.get({
					"url": viewingPackageCreators + "/" + processId,
					"headers": {
						"Accusoft-Secret": "mysecretkey",
						"acs-api-key": apiKey
					}
				}, function(error, httpResponse, body) {
					let parsedBody = JSON.parse(body);
					let percentComplete = parsedBody["percentComplete"];

					if (parsedBody["state"] === "processing" || parsedBody["state"] === "queued") {
						console.log("Percent Complete: " + percentComplete + "%");

						setTimeout(poll, 2000);
					} else {
						if (parsedBody["state"] === "complete") {
							console.log("Viewing Package `" + documentId + "` created! Expiration Date: " + parsedBody["output"]["packageExpirationDateTime"] + ".");
						} else {
							console.error("Viewing Package `" + documentId + "` creation failed because { \"errorCode\": \"" + parsedBody["errorCode"] + "\" }.");
						}

						callback(undefined);
					}
				});
			})();
		});
	});
}

(function() {
	let files = enumerateFiles();

	async.forEachLimit(files, 2, createViewingPackage, function(error) {
		console.log(error || "Done!");
	});
})();
