"use strict";

import * as fs from "fs";
import * as path from "path";
import * as requestDebug from "request-debug";
import * as requestJs from "request-promise";
import * as uuid from "uuid";

// if (process.env.NODE_ENV !== "production") {
// 	requestDebug(requestJs);
// }

const viewingPackageCreators = "https://api.accusoft.com/prizmdoc/v2/viewingPackageCreators";
const apiKey = "";

function enumerateFiles() {
	let files = [];

	fs.readdirSync(path.join(__dirname, "documents")).forEach(function(file) {
		files.push(path.join(__dirname, "documents", file));
	});

	return files;
}

async function createViewingPackage(file) {

	let documentId = uuid.v4();

	let displayName = file.split("\\").pop().split("/").pop();

	await requestJs({
		"method": "POST",
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
	}).then(async function(response) {
		let processId = response["processId"];

		let data = fs.readFileSync(path.join(file));

		await requestJs.put({
			"method": "PUT",
			"url": viewingPackageCreators + "/" + processId + "/SourceFile",
			"headers": {
				"Accusoft-Secret": "mysecretkey",
				"Content-Type": "application/octet-stream",
				"acs-api-key": apiKey
			},
			"body": data
		}).then(async function(response) {
			await (async function poll() {
				await requestJs({
					"method": "GET",
					"url": viewingPackageCreators + "/" + processId,
					"headers": {
						"Accusoft-Secret": "mysecretkey",
						"acs-api-key": apiKey
					}
				}).then(async function(response) {
					let parsedResponse = JSON.parse(response);

					if (parsedResponse["state"] === "processing" || parsedResponse["state"] === "queued") {
						console.log("Percent Complete: " + parsedResponse["percentComplete"] + "%");

						await new Promise(function(resolve, reject) {
							setTimeout(async function() {
								await poll();
								resolve();
							}, 2000);
						});

					} else {
						if (parsedResponse["state"] === "complete") {
							console.log("Viewing Package `" + documentId + "` created! Expiration Date: " + parsedResponse["output"]["packageExpirationDateTime"] + ".");
						} else {
							console.log("Viewing Package `" + documentId + "` creation failed because { \"errorCode\": \"" + parsedResponse["errorCode"] + "\" }.");
						}
					}
				});
			})();
		});
	});
}

(async function() {
	let files = enumerateFiles();

	for (let x = 0; x < files.length; x++) {
		console.log("Creating a Viewing Package from " + files[x] + "...");

		await createViewingPackage(files[x]);
	}
})();
