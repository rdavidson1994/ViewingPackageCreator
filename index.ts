"use strict";

let fs = require("fs");
let path = require("path");
let requestDebug = require("request-debug");
let requestJs = require("request");
let uuid = require("uuid");

const viewingPackageCreators = "http://10.1.100.196:3000/v2/viewingPackageCreators";

function enumerateFiles() {
    let files = [];

    fs.readdirSync(path.join(__dirname, "documents")).forEach(function (file) {
        files.push(path.join(__dirname, "documents", file));
    });

    return files;
}

function createViewingPackage(file, callWhenDone) {
    let documentId = uuid.v4();
    let index = file.lastIndexOf("\\");

    if (index === -1) {
        index = file.lastIndexOf("/");
    }

    let displayName = file.substring(index + 1);

    requestJs.post({
        "url": viewingPackageCreators,
        "headers": {
            "Accusoft-Secret": "mysecretkey"
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
    }, function (error, httpResponse, body) {
        let processId = body["processId"];

        let data = fs.readFileSync(path.join(file));

        requestJs.put({
            "url": viewingPackageCreators + "/" + body["processId"] + "/SourceFile",
            "headers": {
                "Accusoft-Secret": "mysecretkey",
                "Content-Type": "application/octet-stream"
            },
            "body": data
        }, function (error, httpResponse, body) {
            (function poll() {
                requestJs.get({
                    "url": viewingPackageCreators + "/" + processId,
                    "headers": {
                        "Accusoft-Secret": "mysecretkey"
                    }
                }, async function (error, httpResponse, body) {
                    let parsedBody = JSON.parse(body)
                    let percentComplete = parsedBody["percentComplete"];

                    if (parsedBody["state"] === "processing" || parsedBody["state"] === "queued") {
                        console.log("Percent Complete: " + percentComplete + "%");

                        setTimeout(poll, 2000);
                    } else {
                        if (parsedBody["state"] === "complete") {
                            console.log("Viewing Package `" + documentId + "` created! Expiration Date: " + parsedBody["output"]["packageExpirationDateTime"] + ".");
                        } else {
                            console.log("Viewing Package `" + documentId + "` creation failed because { \"errorCode\": \"" + parsedBody["errorCode"] + "\" }.");
                        }
                        callWhenDone();
                    }
                });
            })();
        });
    });
};

(function startUpClosure() {

    let files = enumerateFiles();

    function createGreaterViewingPackages(x) {
        //Create all viewing packages greater than the given index
        function callWhenDone() {
            if (x + 1 < files.length) {
                createGreaterViewingPackages(x + 1)
            }
        }
        console.log("Creating a Viewing Package from " + files[x] + "...");
        createViewingPackage(files[x], callWhenDone)
    }
    createGreaterViewingPackages(0);
})();