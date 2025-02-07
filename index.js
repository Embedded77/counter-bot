const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'output.txt');

function logToFile(logMessage) {
	console.log(logMessage)
	logMessage = JSON.stringify(logMessage)

	const timestamp = new Date().toISOString();
	const logEntry = `[${timestamp}] ${logMessage}\n`;

	fs.appendFile(filePath, logEntry, (err) => {
		if (err) {
			console.error('Failed to write to file:', err);
		}
	});
}

let config = require("./config.json");
let {
	authenticator
} = require('otplib');
const e = require('express');

function extractCSRFToken(text) {
	const regex = /data-token="([^"]+)"/;
	const match = text.match(regex);
	return match ? match[1] : null;
}

function shuffleArray(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

function getCombinations(arr, length) {
	const results = [];

	function combine(tempArray, start) {
		if (tempArray.length === length) {
			results.push([...tempArray]);
			return;
		}

		for (let i = start; i < arr.length; i++) {
			tempArray.push(arr[i]);
			combine(tempArray, i + 1);
			tempArray.pop();
		}
	}

	combine([], 0);
	return results;
}

async function generateCombinations(inputArray) {
	return new Promise((resolve, reject) => {
		try {
			const allCombinations = [];
			[2, 3, 4].forEach(length => {
				allCombinations.push(...getCombinations(inputArray, length));
			});

			resolve(allCombinations);
		} catch (error) {
			reject(error);
		}
	});
}

async function loadInboundTrades(cookie) {
	return fetch("https://trades.roblox.com/v1/trades/inbound?cursor=&limit=25&sortOrder=Desc", {
			headers: {
				"accept": "application/json, text/plain, */*",
				"accept-language": "en-US,en;q=0.9",
				"cookie": cookie,
				"Referer": "https://www.roblox.com/",
				"Referrer-Policy": "strict-origin-when-cross-origin"
			},
			method: "GET"
		})
		.then(response => {
			if (!response.ok) {
				logToFile(`Error Fetching Inbounds: ${response.status} ${response.statusText}`);
				return "";
			}
			return response.json();
		});
}

async function getTrade(id, cookie) {
	return fetch("https://trades.roblox.com/v1/trades/" + id, {
			headers: {
				"accept": "application/json, text/plain, */*",
				"accept-language": "en-US,en;q=0.9",
				"cookie": cookie
			},
			body: null,
			method: "GET",
		})
		.then(response => {
			if (!response.ok) {
				logToFile(`Error Fetching Inbounds: ${response.status} ${response.statusText}`);
				return "";
			}
			return response.json();
		});
}

let myValues = {};
let othersValues = {};
async function fetchRolimonsValues() {
	return fetch("https://www.rolimons.com/itemapi/itemdetails")
		.then(res => res.json())
		.then(data => {
			let copied_data = JSON.parse(JSON.stringify(data)).items;
			Object.keys(config.myvalues).forEach(itemId => {
				data.items[itemId][3] = config.myvalues[itemId];
				data.items[itemId][4] = config.myvalues[itemId];
			});
			Object.keys(config.othersvalues).forEach(itemId => {
				copied_data[itemId][3] = config.othersvalues[itemId];
				copied_data[itemId][4] = config.othersvalues[itemId];
			});
			myValues = data.items;
			othersValues = copied_data;
			logToFile("Populated rolimons data");
		});
}

async function sumSides(trade, account) {
	let givingItems;
	let failed = false;
	let receivingItems;
	let givingRobux = 0;
	let gettingRobux = 0;
	let upgrade = false
	let downgrade = false

	if (trade.offers[0].user.id == account.UserID) {
		givingItems = trade.offers[0].userAssets;
		receivingItems = trade.offers[1].userAssets;
		givingRobux = trade.offers[0].robux;
		gettingRobux = trade.offers[1].robux;
	} else {
		receivingItems = trade.offers[1].userAssets;
		givingItems = trade.offers[0].userAssets;
		givingRobux = trade.offers[1].robux;
		gettingRobux = trade.offers[0].robux;
	}
	let giveValue = 0;
	let getValue = 0;
	for (let item of givingItems) {
		if (myValues[item.assetId]) {
			giveValue += myValues[item.assetId][4];
			if (myValues[item.assetId][4] > 0.9 * giveValue) {
				downgrade = true;
			}
		} else {
			giveValue += item.recentAveragePrice
		}
	}
	for (let item of receivingItems) {

		if (myValues[item.assetId]) {
			if (myValues[item.assetId][7] == -1) {
				getValue += othersValues[item.assetId][4];
				if (othersValues[item.assetId][4] > 0.9 * getValue) {
					upgrade = true;
				}
			}

		}
	}
	return {
		givingItems,
		receivingItems,
		give: giveValue + givingRobux,
		get: getValue + gettingRobux,
		failed,
		upgrade,
		downgrade
	};
}

async function getInventory(id, cookie) {
	try {
		const response = await fetch("https://inventory.roblox.com/v1/users/" + id + "/assets/collectibles?sortOrder=Asc&limit=100", {
			headers: {
				"accept": "*/*",
				"accept-language": "en-US,en;q=0.9",
				"priority": "u=1, i",
				"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": "\"macOS\"",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-site",
				"cookie": cookie,
				"Referer": "https://www.roblox.com/",
			},
			body: null,
			method: "GET",
		});

		if (!response.ok) {
			console.log(`Error fetching inventory: ${response.statusText}`);
            return []
		}

		const data = await response.json();
		return data.data;
	} catch (error) {
		console.error(error);
		return null;
	}
}

function moveItemToFront(array, userAssetId) {
	const index = array.findIndex(item => item.userAssetId === userAssetId);

	if (index > -1) {
		const [item] = array.splice(index, 1);
		array.unshift(item);
	}

	return array;
}

function sortByAssetId(array, myValues) {
	return array.sort((a, b) => {
		const valueA = myValues[a.assetId][4];
		const valueB = myValues[b.assetId][4];

		// Handle undefined keys gracefully
		if (valueA === undefined || valueB === undefined) {
			return 0;
		}

		return valueB - valueA;
	});
}

const url = "https://api.rolimons.com/tradeads/v1/createad";

function getRandomElements(arr) {
	const numElements = Math.min(4, arr.length);

	const randomElements = [];

	while (randomElements.length < numElements) {
		const randomIndex = Math.floor(Math.random() * arr.length);
		const randomElement = arr[randomIndex];

		if (!randomElements.includes(randomElement)) {
			randomElements.push(randomElement);
		}
	}

	return randomElements;
}

function getRandomThree(arr) {

	const numElements = Math.min(3, arr.length);

	const randomElements = [];

	while (randomElements.length < numElements) {
		const randomIndex = Math.floor(Math.random() * arr.length);
		const randomElement = arr[randomIndex];

		if (!randomElements.includes(randomElement)) {
			randomElements.push(randomElement);
		}
	}

	return randomElements;
}

async function sendRequest(account) {
	try {
		let items = await getInventory(config.accounts[0].UserID, config.accounts[0].cookie)
		let ids = getRandomElements(items).map(x => x.assetId)
		const response = await fetch(url, options = {
			headers: {
				"accept": "application/json, text/javascript, */*; q=0.01",
				"accept-language": "en-US,en;q=0.9",
				"content-type": "application/json",
				"priority": "u=1, i",
				"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": "\"macOS\"",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-site",
				"cookie": account.RoliVerification,
				"Referer": "https://www.rolimons.com/",
				"Referrer-Policy": "strict-origin-when-cross-origin"
			},
			body: JSON.stringify({
				player_id: config.accounts[0].UserID,
				offer_item_ids: ids,
				request_item_ids: getRandomThree([2409285794, 1609401184, 1213472762, 10159600649, 9255011, 19027209, 583722710, 583722932, 583721561, 162066057]), // list of demand items, i think this inceases trade input since more people will be looking for offers on these
				request_tags: ["any"]
			}),
			method: "POST"
		});
        
		const data = await response.json();
        if (!data || !data.data) {
            logToFile(`Invalid inventory response for user ${id}: ${JSON.stringify(data)}`);
            return [];
        }
		logToFile("Request successful:", data);
	} catch (error) {
		logToFile(error)
        return []
	}
}
config.accounts.forEach(account => {
	sendRequest((account))
})
config.accounts.forEach(account => {
	setInterval(function() {
		sendRequest(account)
	}, 1_440_000)
})

let checked = {}
async function init() {

	config.accounts.forEach(async account => {

		let cookie = account.cookie
        let myitems = await getInventory(account.UserID, cookie);
        for (let b = 0; b < myitems.length; b++) {
            let i = myitems[b];
            if (myValues[i.assetId] == undefined || config.nft[i.assetId] || myValues[i.assetId][4] >= config.selfeval || myValues[i.assetId][9] != -1 || (myValues[i.assetId][2] > config.overrapratio * myValues[i.assetId][4] && myValues[i.assetId][2] <= config.overrapcap)) {
                delete myitems[b];
            }
        }
        myitems = myitems.filter(function(el) {
            return el != null;
        });
    
        shuffleArray(myitems)
		fetch("https://auth.roblox.com/v2/logout", {
			headers: {
				"accept": "*/*",
				"accept-language": "en-US,en;q=0.9",
				"priority": "u=1, i",
				"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": "\"macOS\"",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-site",
				"cookie": cookie,
				"Referer": "https://www.roblox.com/",
			},
			body: null,
			method: "POST",
		}).then(async res => {
			let csrf = res.headers.get("x-csrf-token")
			await fetchRolimonsValues();
			let inbounds = (await loadInboundTrades(cookie)).data;
			for (const inbound of inbounds.slice(0, 5)) {
				if (checked[inbound.id] == undefined) {
					checked[inbound.id] = true
					let found = false
					let trade = await getTrade(inbound.id, cookie);

					let calculatedValues = (await sumSides(trade, account));

					if (!calculatedValues.failed && calculatedValues.get < config.selfeval) {

						if ((calculatedValues.get + config.upgmaxop < calculatedValues.give && calculatedValues.upgrade) || (calculatedValues.get < calculatedValues.give && calculatedValues.downgrade == false && calculatedValues.upgrade == false) || (calculatedValues.get < calculatedValues.give * config.dgminratio && calculatedValues.downgrade == true) || (calculatedValues.give - calculatedValues.get <= (250 + (calculatedValues.give / 60) * (calculatedValues.givingItems.length - 1)) && calculatedValues.upgrade)) {
							let items = await getInventory(trade.user.id, cookie);
							logToFile(items)
							logToFile("Loaded inventory of " + trade.user.name)
							for (let b = 0; b < items.length; b++) {
								let i = items[b];
								if (othersValues[i.assetId] == undefined || config.avoid[i.assetId] || othersValues[i.assetId][4] >= config.selfeval || othersValues[i.assetId][9] != -1 || othersValues[i.assetId][3] == -1 || othersValues[i.assetId][2] < config.underrapratio * othersValues[i.assetId][4] || i.isOnHold != false || myValues[i.assetId][7] != -1) {
									delete items[b];
								}
							}
							items = items.filter(function(el) {
								return el != null;
							});
							shuffleArray(items)
							let valuedCombinations = []

							let combinations = (await generateCombinations(((myitems.slice(0, 20)))))
							combinations.forEach(function(combination) {
								let sum = 0
								combination.forEach(item => {
									sum += myValues[item.assetId][4]
								})
								valuedCombinations.push({
									combination,
									value: sum
								})
							})
							let givingItems;
							let receivingItems;
							if (trade.offers[0].user.id == account.UserID) {
								givingItems = trade.offers[0].userAssets;
								receivingItems = trade.offers[1].userAssets;

							} else {
								receivingItems = trade.offers[1].userAssets;
								givingItems = trade.offers[0].userAssets;

							}

							givingItems = givingItems.filter(item => myValues[item.assetId] != undefined);
							sortByAssetId(givingItems, myValues)

							receivingItems = receivingItems.filter(item => othersValues[item.assetId] != undefined);
							sortByAssetId(receivingItems, othersValues)
							console.log(receivingItems)
							for (item of givingItems) {
								myitems = moveItemToFront(myitems, item.userAssetId)
							}

							for (item of receivingItems) {
								items = moveItemToFront(items, item.userAssetId)
							}
							console.log(items)
							// attempt an upgrade

							async function downgrade() {
								let downgradeValuedCombinations = []

								let combinations = (await generateCombinations(((items.slice(0, 15)))))
								combinations.forEach(function(combination) {
									let sum = 0
									combination.forEach(item => {
										sum += othersValues[item.assetId][4]
									})
									downgradeValuedCombinations.push({
										combination,
										value: sum
									})
								})
								for (item of ((myitems.slice(0, 25)))) {
									let targetValue = myValues[item.assetId][4]
									for (set of downgradeValuedCombinations) {
										if (set.value <= targetValue * config.dgmaxratio && set.value >= targetValue * config.dgminratio && set.value - targetValue >= config.dgminop) {
											logToFile("Trade Found With " + inbound.user.name)

											let assets = []
											let send = true;
											let included
											for (offeredItem of set.combination) {

												logToFile(othersValues[offeredItem.assetId][0])
                                                if(offeredItem.assetId==item.assetId){
                                                    send=false;
                                                }
												assets.push(offeredItem.userAssetId)
											}
											if (send == true) {
												logToFile("for")
												logToFile(myValues[item.assetId][0])
												logToFile(set.value + " vs " + targetValue)
												found = true;
												logToFile(`{\"offers\":[{\"userId\":${account.UserID},\"userAssetIds\":[${item.userAssetId}],\"robux\":0},{\"userId\":${trade.user.id},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`)
												fetch(`https://trades.roblox.com/v1/trades/${inbound.id}/counter`, {
													"headers": {
														"accept": "application/json, text/plain, */*",
														"accept-language": "en-US,en;q=0.9",
														"content-type": "application/json;charset=UTF-8",
														"priority": "u=1, i",
														"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
														"sec-ch-ua-mobile": "?0",
														"sec-ch-ua-platform": "\"macOS\"",
														"sec-fetch-dest": "empty",
														"sec-fetch-mode": "cors",
														"sec-fetch-site": "same-site",
														"x-csrf-token": csrf,
														"cookie": cookie,
														"Referer": "https://www.roblox.com/",
														"Referrer-Policy": "strict-origin-when-cross-origin"
													},
													"body": `{\"offers\":[{\"userId\":${account.UserID},\"userAssetIds\":[${item.userAssetId}],\"robux\":0},{\"userId\":${trade.user.id},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`,
													"method": "POST"
												}).then(async res => {
													let data = await res.json()
													logToFile(data)
													if (data["errors"] && data.errors[0].message.toLowerCase().search("challenge") != -1) {
														logToFile(res.headers)
														let metadata = JSON.parse(atob(res.headers.get("rblx-challenge-metadata")))
														logToFile(metadata)
														let mainID = res.headers.get("rblx-challenge-id")
														fetch("https://twostepverification.roblox.com/v1/users/" + account.UserID + "/challenges/authenticator/verify", {
															"headers": {
																"accept": "application/json, text/plain, */*",
																"accept-language": "en-US,en;q=0.9",
																"content-type": "application/json;charset=UTF-8",
																"priority": "u=1, i",
																"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
																"sec-ch-ua-mobile": "?0",
																"sec-ch-ua-platform": "\"macOS\"",
																"sec-fetch-dest": "empty",
																"sec-fetch-mode": "cors",
																"sec-fetch-site": "same-site",
																"x-csrf-token": csrf,
																"cookie": cookie,
																"Referer": "https://www.roblox.com/",
																"Referrer-Policy": "strict-origin-when-cross-origin"
															},
															"body": "{\"challengeId\":\"" + metadata.challengeId + "\",\"actionType\":\"Generic\",\"code\":\"" + authenticator.generate(account.TOTP) + "\"}",
															"method": "POST"
														}).then(res => res.json()).then(twostepdata => {
															logToFile(twostepdata)
															fetch("https://apis.roblox.com/challenge/v1/continue", {
																"headers": {
																	"accept": "application/json, text/plain, */*",
																	"accept-language": "en-US,en;q=0.9",
																	"content-type": "application/json;charset=UTF-8",
																	"priority": "u=1, i",
																	"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
																	"sec-ch-ua-mobile": "?0",
																	"sec-ch-ua-platform": "\"macOS\"",
																	"sec-fetch-dest": "empty",
																	"sec-fetch-mode": "cors",
																	"sec-fetch-site": "same-site",
																	"x-csrf-token": csrf,
																	"cookie": cookie,
																	"Referer": "https://www.roblox.com/",
																	"Referrer-Policy": "strict-origin-when-cross-origin"
																},
																"body": "{\"challengeId\":\"" + mainID + "\",\"challengeType\":\"twostepverification\",\"challengeMetadata\":\"{\\\"verificationToken\\\":\\\"" + twostepdata.verificationToken + "\\\",\\\"rememberDevice\\\":false,\\\"challengeId\\\":\\\"" + metadata.challengeId + "\\\",\\\"actionType\\\":\\\"Generic\\\"}\"}",
																"method": "POST"
															}).then(async res => {
																logToFile(await res.json())
																logToFile("Completed TOTP, resending")
																fetch(`https://trades.roblox.com/v1/trades/${inbound.id}/counter`, {
																	"headers": {
																		"accept": "application/json, text/plain, */*",
																		"accept-language": "en-US,en;q=0.9",
																		"content-type": "application/json;charset=UTF-8",
																		"priority": "u=1, i",
																		"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
																		"sec-ch-ua-mobile": "?0",
																		"sec-ch-ua-platform": "\"macOS\"",
																		"sec-fetch-dest": "empty",
																		"sec-fetch-mode": "cors",
																		"sec-fetch-site": "same-site",
																		"x-csrf-token": csrf,
																		"cookie": cookie,
																		"Referer": "https://www.roblox.com/",
																		"Referrer-Policy": "strict-origin-when-cross-origin"
																	},
																	"body": `{\"offers\":[{\"userId\":${account.UserID},\"userAssetIds\":[${item.userAssetId}],\"robux\":0},{\"userId\":${trade.user.id},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`,
																	"method": "POST"
																}).then(async res => {
																	let data = await res.json()
																	logToFile(data)
																})
															})
														})
													} else {
														logToFile(data)
													}
												})
												break;
											}
										}
									}
									if (found) {
										break;
									}
								}
							}
 
							async function upgrade() {
								for (item of ((items.slice(0, 20)))) {
									console.log(myValues[item.assetId][0])
									let targetValue = othersValues[item.assetId][4]
									for (set of valuedCombinations) {
										if ((set.value - targetValue <= config.upgmaxop) && set.value >= targetValue && set.value - targetValue <= (250 + ((set.value / 60) * (set.combination.length - 1)))) {
											logToFile("Trade Found With " + inbound.user.name)
     
											let assets = []
											let send = true;
											for (offeredItem of set.combination) {
												if (myValues[offeredItem.assetId][4] >= 0.9 * myValues[item.assetId][4] || item.assetId==offeredItem.assetId) {
													send = false
												}
												logToFile(myValues[offeredItem.assetId][0])
                                                
												assets.push(offeredItem.userAssetId)
											}
											if (send == true) {
												logToFile("for")
												logToFile(othersValues[item.assetId][0])
												logToFile(set.value + " vs " + targetValue)
												found = true;
												logToFile(`{\"offers\":[{\"userId\":${trade.user.id},\"userAssetIds\":[${item.userAssetId}],\"robux\":0},{\"userId\":${account.UserID},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`)

												fetch(`https://trades.roblox.com/v1/trades/${inbound.id}/counter`, {
													"headers": {
														"accept": "application/json, text/plain, */*",
														"accept-language": "en-US,en;q=0.9",
														"content-type": "application/json;charset=UTF-8",
														"priority": "u=1, i",
														"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
														"sec-ch-ua-mobile": "?0",
														"sec-ch-ua-platform": "\"macOS\"",
														"sec-fetch-dest": "empty",
														"sec-fetch-mode": "cors",
														"sec-fetch-site": "same-site",
														"x-csrf-token": csrf,
														"cookie": cookie,
														"Referer": "https://www.roblox.com/",
														"Referrer-Policy": "strict-origin-when-cross-origin"
													},
													"body": `{\"offers\":[{\"userId\":${trade.user.id},\"userAssetIds\":[${item.userAssetId}],\"robux\":0},{\"userId\":${account.UserID},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`,
													"method": "POST"
												}).then(async res => {
													let data = await res.json()

													if (data["errors"] != undefined && data.errors[0].message.toLowerCase().search("challenge") != -1) {
														logToFile(res.headers)
														console.log(data)
														let metadata = JSON.parse(atob(res.headers.get("rblx-challenge-metadata")))
														logToFile(metadata)
														let mainID = res.headers.get("rblx-challenge-id")
														fetch("https://twostepverification.roblox.com/v1/users/" + account.UserID + "/challenges/authenticator/verify", {
															"headers": {
																"accept": "application/json, text/plain, */*",
																"accept-language": "en-US,en;q=0.9",
																"content-type": "application/json;charset=UTF-8",
																"priority": "u=1, i",
																"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
																"sec-ch-ua-mobile": "?0",
																"sec-ch-ua-platform": "\"macOS\"",
																"sec-fetch-dest": "empty",
																"sec-fetch-mode": "cors",
																"sec-fetch-site": "same-site",
																"x-csrf-token": csrf,
																"cookie": cookie,
																"Referer": "https://www.roblox.com/",
																"Referrer-Policy": "strict-origin-when-cross-origin"
															},
															"body": "{\"challengeId\":\"" + metadata.challengeId + "\",\"actionType\":\"Generic\",\"code\":\"" + authenticator.generate(account.TOTP) + "\"}",
															"method": "POST"
														}).then(res => res.json()).then(twostepdata => {
															logToFile(twostepdata)
															fetch("https://apis.roblox.com/challenge/v1/continue", {
																"headers": {
																	"accept": "application/json, text/plain, */*",
																	"accept-language": "en-US,en;q=0.9",
																	"content-type": "application/json;charset=UTF-8",
																	"priority": "u=1, i",
																	"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
																	"sec-ch-ua-mobile": "?0",
																	"sec-ch-ua-platform": "\"macOS\"",
																	"sec-fetch-dest": "empty",
																	"sec-fetch-mode": "cors",
																	"sec-fetch-site": "same-site",
																	"x-csrf-token": csrf,
																	"cookie": cookie,
																	"Referer": "https://www.roblox.com/",
																	"Referrer-Policy": "strict-origin-when-cross-origin"
																},
																"body": "{\"challengeId\":\"" + mainID + "\",\"challengeType\":\"twostepverification\",\"challengeMetadata\":\"{\\\"verificationToken\\\":\\\"" + twostepdata.verificationToken + "\\\",\\\"rememberDevice\\\":false,\\\"challengeId\\\":\\\"" + metadata.challengeId + "\\\",\\\"actionType\\\":\\\"Generic\\\"}\"}",
																"method": "POST"
															}).then(async res => {
																logToFile(await res.json())
																logToFile("Completed TOTP, resending")
																fetch(`https://trades.roblox.com/v1/trades/${inbound.id}/counter`, {
																	"headers": {
																		"accept": "application/json, text/plain, */*",
																		"accept-language": "en-US,en;q=0.9",
																		"content-type": "application/json;charset=UTF-8",
																		"priority": "u=1, i",
																		"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
																		"sec-ch-ua-mobile": "?0",
																		"sec-ch-ua-platform": "\"macOS\"",
																		"sec-fetch-dest": "empty",
																		"sec-fetch-mode": "cors",
																		"sec-fetch-site": "same-site",
																		"x-csrf-token": csrf,
																		"cookie": cookie,
																		"Referer": "https://www.roblox.com/",
																		"Referrer-Policy": "strict-origin-when-cross-origin"
																	},
																	"body": `{\"offers\":[{\"userId\":${trade.user.id},\"userAssetIds\":[${item.userAssetId}],\"robux\":0},{\"userId\":${account.UserID},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`,
																	"method": "POST"
																}).then(async res => {
																	let data = await res.json()
																	logToFile(data)
																})
															})
														})
													} else {
														logToFile(data)
													}
												})
												break;
											}
										}
									}
									if (found) {
										break;
									}
								}
							}

							// attempt a downgrade
							if (calculatedValues.downgrade == false) {
								await upgrade()
								if (!found) {
									await downgrade()
								}
							} else {
								await downgrade()
								if (!found) {
									await upgrade()
								}
							}
							if (!found) {
								fetch("https://trades.roblox.com/v1/trades/" + inbound.id + "/decline", {
									"headers": {
										"accept": "application/json, text/plain, */*",
										"accept-language": "en-US,en;q=0.9",
										"priority": "u=1, i",
										"sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
										"sec-ch-ua-mobile": "?0",
										"sec-ch-ua-platform": "\"macOS\"",
										"sec-fetch-dest": "empty",
										"sec-fetch-mode": "cors",
										"sec-fetch-site": "same-site",
										"x-csrf-token": csrf,
										"cookie": cookie,
										"Referer": "https://www.roblox.com/",
										"Referrer-Policy": "strict-origin-when-cross-origin"
									},
									"body": null,
									"method": "POST"
								}).then(res => logToFile("Declined trade from " + inbound.user.name))
							}
						}
					}
				}
			}

		})

		logToFile("\n\n == ROUND FINISHED ==\n\n")
	})
}

setInterval(init, 20000)
init()
