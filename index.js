const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'output.txt');

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

function roundToTwoDecimals(num) {
    return Number(num.toFixed(2));
}

const sqlite3 = require('sqlite3').verbose();

class Ids {
    constructor(dbFile = 'ids.db') {
        this.db = new sqlite3.Database(dbFile, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database.');
                this.db.run(`CREATE TABLE IF NOT EXISTS ids (
                    id TEXT PRIMARY KEY,
                    persistent INTEGER DEFAULT 0
                )`);
            }
        });
    }

    addID(id, persistent = false) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`INSERT INTO ids (id, persistent) VALUES (?, ?)`);
            stmt.run(id, persistent ? 1 : 0, function (err) {
                if (err) {
                    reject(err.message);
                } else {
                    resolve(`ID ${id} added${persistent ? ' (persistent)' : ''}.`);
                }
            });
            stmt.finalize();
        });
    }

    checkID(id) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT id FROM ids WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    reject(err.message);
                } else {
                    resolve(row ? true : false);
                }
            });
        });
    }

    removeID(id) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`DELETE FROM ids WHERE id = ?`);
            stmt.run(id, function (err) {
                if (err) {
                    reject(err.message);
                } else if (this.changes === 0) {
                    resolve(`ID ${id} not found.`);
                } else {
                    resolve(`ID ${id} removed.`);
                }
            });
            stmt.finalize();
        });
    }

    cleanDB(validIds) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT id FROM ids WHERE persistent = 0`, [], (err, rows) => {
                if (err) {
                    return reject(err.message);
                }
                const idsToRemove = rows.map(row => row.id).filter(id => !validIds.includes(id));
                
                if (idsToRemove.length === 0) {
                    return resolve('No IDs to remove.');
                }
                
                const stmt = this.db.prepare(`DELETE FROM ids WHERE id = ? AND persistent = 0`);
                idsToRemove.forEach(id => stmt.run(id));
                stmt.finalize(err => {
                    if (err) {
                        reject(err.message);
                    } else {
                        resolve(`Removed ${idsToRemove.length} IDs.`);
                    }
                });
            });
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database closed.');
            }
        });
    }
}



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

async function loadInactiveTrades(cookie) {
	return fetch("https://trades.roblox.com/v1/trades/inactive?cursor=&limit=10&sortOrder=Desc", {
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


async function loadCompletedTrades(cookie) {
	return fetch("https://trades.roblox.com/v1/trades/completed?cursor=&limit=10&sortOrder=Desc", {
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
				logToFile(`Error Fetching Completeds: ${response.status} ${response.statusText}`);
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
async function countered(channel, givingItems,receivingItems, give, get ){
	const embed = new EmbedBuilder()
	.setTitle('Trade Countered')

	.setColor('#89cff0')
	.setTimestamp()
.setFooter({ text: 'Counter Bot by Embedded77',  });
// Dynamically add "Items you will GIVE"

	let giveText = givingItems.map(item => `- ${myValues[item][0]}: ${c(myValues[item][4])}`)
	embed.addFields({ name: '**Items you will GIVE**', value: giveText.join('\n'), inline: false });


let getText = receivingItems.map(item => `- ${othersValues[item][0]}: ${c(othersValues[item][4])}`)

embed.addFields({ name: '**Items you will GET**', value: getText.join('\n'), inline: false });

embed.addFields(
	{ name: '**Value**', value: `${c(give)} vs ${c(get)}`, inline: true },
	{ name: '**% Win**', value: `${roundToTwoDecimals((get-give)/(give)*100)}%`, inline: true }
);

channel.send({ embeds: [embed] });
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
	let giverap = 0;
	let getrap = 0;
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
	let trueget=0;
	
	for (let item of givingItems) {
		giverap+=item.recentAveragePrice;
		if (myValues[item.assetId]) {
			let value=myValues[item.assetId][4];
			if(myValues[item.assetId][3]==-1){
				value=0.95*value
			}
			
			giveValue += value;

		} else {
			giveValue += item.recentAveragePrice
		}
	}
	for (let item of givingItems) {
	if (myValues[item.assetId]!=undefined && myValues[item.assetId][4] > 0.9 * giveValue) {
		downgrade = true;
	}
}
	for (let item of receivingItems) {
		getrap+=item.recentAveragePrice;
		if (myValues[item.assetId]) {
			if (myValues[item.assetId][7] == -1) {
				getValue += othersValues[item.assetId][4];
		
			}

		}
	}
	for (let item of receivingItems) {
	if (othersValues[item.assetId]!=undefined && othersValues[item.assetId][4] > 0.9 * getValue) {
		upgrade = true;
	}
}
	return {
		givingItems,
		receivingItems,
		give: giveValue + givingRobux,
		get: getValue + gettingRobux,
		failed,
		upgrade,
		downgrade,
		giverap,
		getrap
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
        if (!data || !data.data) {
            logToFile(`Invalid inventory response: ${JSON.stringify(data)}`);
            return [];
        }
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

function getRandomTwo(arr) {

	const numElements = Math.min(2, arr.length);

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
		let filteredItems = items.filter(item => myValues[item.assetId][4]>3000 && item.isOnHold==false);

		let ids = getRandomElements(filteredItems).map(x => x.assetId)
		let sum=0
		let potentialItems=[]
		let table={

		}
		for(id of ids){
			sum+=myValues[id][4]
			table[id]=true
		}
			for(id of Object.keys(othersValues)){
				let item=othersValues[id]
				if(item[4]>=0.5*sum && item[5]>=2 && item[4]<=sum && table[id]!=true){
					potentialItems.push(parseInt(id))
				}
			}
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
				request_item_ids: getRandomTwo(potentialItems),
				request_tags: ["any","adds"]
			}),
			method: "POST"
		});
        // [494291269,1365767,33872870,51346471,439946101,20052135,439945864,553971558,628771505]
		const data = await response.json();
        console.log(data)

		logToFile("Request successful:", data);
	} catch (error) {
		logToFile(error)
        return []
	}
}


async function pingInactive(account){
	let channelId = config.channel; 
	let channel = await client.channels.fetch(channelId);
	let inbounds = (await loadInactiveTrades(account.cookie)).data;

	for (const inbound of inbounds) {

		let scanned=await IdDB.checkID(inbound.id);
		if (scanned==false) {
			
			let trade = await getTrade(inbound.id, account.cookie);
console.log(trade)
			let calculatedValues = (await sumSides(trade, account));

const embed = new EmbedBuilder()
.setTitle('Outbound '+inbound.status)
.setDescription("by "+inbound.user.name)
.setColor('#808080')
.setTimestamp()
.setFooter({ text: 'Counter Bot by Embedded77',  });


let giveText = calculatedValues.givingItems.map(item => `- ${myValues[item.assetId][0]}: ${c(myValues[item.assetId][4])}`)
embed.addFields({ name: '**Items you would have given**', value: giveText.join('\n'), inline: false });


let getText = calculatedValues.receivingItems.map(item => `- ${othersValues[item.assetId][0]}: ${c(othersValues[item.assetId][4])}`)
if(calculatedValues.givingRobux>0){
giveText.push("Robux: "+c(calculatedValues.givingRobux));
}
if(calculatedValues.gettingRobux>0){
getText.push("Robux: "+c(calculatedValues.gettingRobux));
}
embed.addFields({ name: '**Items you would have received**', value: getText.join('\n'), inline: false });

embed.addFields(
{ name: '**Value**', value: `${c(calculatedValues.give)} vs ${c(calculatedValues.get)}`, inline: true },
{ name: '**Rap**', value: `${c(calculatedValues.giverap)} vs ${c(calculatedValues.getrap)}`, inline: true },
{ name: '**% Win**', value: `${roundToTwoDecimals((calculatedValues.get-calculatedValues.give)/(calculatedValues.give)*100)}%`, inline: true }
);

await channel.send({ embeds: [embed] });
await IdDB.addID(inbound.id,true)
}

	}
}



async function pingCompleted(account){
	let channelId = config.channel; 
	let channel = await client.channels.fetch(channelId);
	let inbounds = (await loadCompletedTrades(account.cookie)).data;

	for (const inbound of inbounds) {

		let scanned=await IdDB.checkID(inbound.id);
		if (scanned==false) {
			
			let trade = await getTrade(inbound.id, account.cookie);
console.log(trade)
			let calculatedValues = (await sumSides(trade, account));

const embed = new EmbedBuilder()
.setTitle('Trade Completed')
.setDescription("with "+inbound.user.name)
.setColor('#008000')
.setTimestamp()
.setFooter({ text: 'Counter Bot by Embedded77',  });

try{

await IdDB.addID(inbound.id,true)
let giveText = calculatedValues.givingItems.map(item => `- ${item.name}`)
embed.addFields({ name: '**Items you GAVE**', value: giveText.join('\n'), inline: false });


let getText = calculatedValues.receivingItems.map(item => `- ${item.name}`)
if(calculatedValues.givingRobux>0){
giveText.push("Robux: "+c(calculatedValues.givingRobux));
}
if(calculatedValues.gettingRobux>0){
getText.push("Robux: "+c(calculatedValues.gettingRobux));
}
embed.addFields({ name: '**Items you RECEIVED**', value: getText.join('\n'), inline: false });

await channel.send({ embeds: [embed] });
}
catch(err){
	console.log(err)
}
}

	}
}

function c(x) {
	var str=x.toString().split(".")
	if(str[1]){
	  str[0]=str[0]+"."
	}else{
	  str[1]=""
	}
  
  return str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")+str[1]
  }


let IdDB = new Ids();

let checked = {}
async function init() {
	
    await fetchRolimonsValues();
	config.accounts.forEach(async account => {

		let cookie = account.cookie
        let myitems = await getInventory(account.UserID, cookie);
        for (let b = 0; b < myitems.length; b++) { let i = myitems[b];
			if (myValues[i.assetId] == undefined || config.nft[i.assetId]!=undefined || myValues[i.assetId][4] >= config.selfeval || myValues[i.assetId][9] != -1 || (myValues[i.assetId][3]!=-1 && myValues[i.assetId][2] > config.overrapratio * myValues[i.assetId][4] && myValues[i.assetId][4] <= config.overrapcap) || i.isOnHold != false) {
                delete myitems[b];
            }
        }
        myitems = myitems.filter(function(el) {
            return el != null;
        });
    
        await shuffleArray(myitems)



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
			pingInactive(account)
			pingCompleted(account)
			let csrf = res.headers.get("x-csrf-token")
			let channelId = config.channel; 
			let channel = await client.channels.fetch(channelId);
			let inbounds = (await loadInboundTrades(cookie)).data;
			let ids=inbounds.map(inbound=>inbound.id);

			for (const inbound of inbounds.slice(0, 10)) {

				let scanned=await IdDB.checkID(inbound.id);
				if (scanned==false) {
					
					let found = false
					let trade = await getTrade(inbound.id, cookie);
					console.log(trade)
					let calculatedValues = (await sumSides(trade, account));
	
		const embed = new EmbedBuilder()
		.setTitle('Trade Inbound')
		.setDescription("from "+inbound.user.name)
		.setColor('#ffc0cb')
		.setTimestamp()
	.setFooter({ text: 'Counter Bot by Embedded77',  });


		let giveText = calculatedValues.givingItems.map(item => `- ${myValues[item.assetId][0]}: ${c(myValues[item.assetId][4])}`)
		embed.addFields({ name: '**Items you will GIVE**', value: giveText.join('\n'), inline: false });


	let getText = calculatedValues.receivingItems.map(item => `- ${othersValues[item.assetId][0]}: ${c(othersValues[item.assetId][4])}`)
	if(calculatedValues.givingRobux>0){
		giveText.push("Robux: "+c(calculatedValues.givingRobux));
	}
	if(calculatedValues.gettingRobux>0){
		getText.push("Robux: "+c(calculatedValues.gettingRobux));
	}
	embed.addFields({ name: '**Items you will GET**', value: getText.join('\n'), inline: false });

	embed.addFields(
		{ name: '**Value**', value: `${c(calculatedValues.give)} vs ${c(calculatedValues.get)}`, inline: true },
		{ name: '**Rap**', value: `${c(calculatedValues.giverap)} vs ${c(calculatedValues.getrap)}`, inline: true },
		{ name: '**% Win**', value: `${roundToTwoDecimals((calculatedValues.get-calculatedValues.give)/(calculatedValues.give)*100)}%`, inline: true }
	);


	await IdDB.addID(inbound.id)
					if (!calculatedValues.failed && calculatedValues.get < config.selfeval) {
						await channel.send({ embeds: [embed] });
						console.log(calculatedValues)
						if ((calculatedValues.get + config.upgmaxop < calculatedValues.give && calculatedValues.upgrade) || (calculatedValues.get < calculatedValues.give*1.01 && calculatedValues.downgrade == false && calculatedValues.upgrade == false) || (calculatedValues.get < calculatedValues.give * (config.dgminratio-0.02) && calculatedValues.downgrade == true) || (calculatedValues.give - calculatedValues.get >= 1.5*(200 + (calculatedValues.get / 50) * (calculatedValues.givingItems.length - 1)) && calculatedValues.upgrade) ) {
							let items = await getInventory(trade.user.id, cookie);

							logToFile("Loaded inventory of " + trade.user.name)
							for (let b = 0; b < items.length; b++) {
								let i = items[b];
								if (othersValues[i.assetId] == undefined || config.avoid[i.assetId] || othersValues[i.assetId][4] >= config.selfeval || othersValues[i.assetId][9] != -1 || othersValues[i.assetId][3] == -1 || othersValues[i.assetId][2] < config.underrapratio * othersValues[i.assetId][4] || i.isOnHold != false || myValues[i.assetId][7] != -1 || othersValues[i.assetId][5]==0) {
									delete items[b];
								}
							}
							items = items.filter(function(el) {
								return el != null;
							});
							shuffleArray(items)
                            console.log(items)
							let valuedCombinations = []

							let combinations = (await generateCombinations(((myitems.slice(0, 10)))))
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
				
							for (item of givingItems) {
								myitems = moveItemToFront(myitems, item.userAssetId)
							}

							for (item of receivingItems) {
								items = moveItemToFront(items, item.userAssetId)
							}
							// attempt an upgrade
                            let downgradeValuedCombinations = []

                            let combos = (await generateCombinations(((items.slice(0, 15)))))
               
                            for(combination of combos){
                                let sum = 0
                                for(item of combination){
                                    sum += othersValues[item.assetId][4]
                                }
                                downgradeValuedCombinations.push({
                                    combination,
                                    value: sum
                                })
                            }
                            console.log(downgradeValuedCombinations.length)
							async function downgrade(overopdgratio=1) {
								for (item of ((myitems.slice(0, 25)))) {
									let targetValue = myValues[item.assetId][4]
									for (set of downgradeValuedCombinations) {
										if (set.value <= targetValue * config.dgmaxratio*overopdgratio && set.value >= targetValue * config.dgminratio && set.value - targetValue >= config.dgminop) {
											logToFile("Trade Found With " + inbound.user.name)

											let assets = []
											let send = true;
											let included
											for (offeredItem of set.combination) {

												logToFile(othersValues[offeredItem.assetId][0])
                                                if(offeredItem.assetId==item.assetId || othersValues[offeredItem.assetId][4]>=0.9*myValues[item.assetId][4]){
                                                    send=false;
                                                }
												assets.push(offeredItem.userAssetId)
											}
											if (send == true) {
												
												logToFile("for")
												logToFile(myValues[item.assetId][0])
												logToFile(set.value + " vs " + targetValue)
												countered(channel,[item.assetId],set.combination.map(x=>x.assetId),targetValue,set.value)
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
													if(data["errors"]==undefined){
														IdDB.removeID(inbound.id)				
													}
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
																	if(data["errors"]==undefined){
																		IdDB.removeID(inbound.id)				
																	}
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
 
							async function upgrade(lowballupgraderatio=1) {
								for (item of ((items.slice(0, 15)))) {
									console.log(myValues[item.assetId][0])
									let targetValue = othersValues[item.assetId][4]
									for (set of valuedCombinations) {
										console.log(set.value)
										if ((set.value - targetValue <= config.upgmaxop) && set.value >= targetValue*lowballupgraderatio && set.value - targetValue <= (200 + ((targetValue / 65) * (set.combination.length - 1)))) {
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
												countered(channel,set.combination.map(x=>x.assetId),[item.assetId],set.value,targetValue)
												found = true;
												logToFile(`{\"offers\":[{\"userId\":${trade.user.id},\"userAssetIds\":[${item.userAssetId}],\"robux\":0},{\"userId\":${account.UserID},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`)
                                                found=true
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
													if(data["errors"]==undefined){
														IdDB.removeID(inbound.id)				
													}
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
																	if(data["errors"]==undefined){
																		IdDB.removeID(inbound.id)				
																	}
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
                            async function swap(){
                                let mycombinations=valuedCombinations.slice(0,200)
                                let yourcombinations=downgradeValuedCombinations.slice(0,200)
                                console.log(mycombinations.length, yourcombinations.length)
            // Sort yourcombinations by value for efficient searching
yourcombinations.sort((a, b) => a.value - b.value);

let results = [];

for (const combination of mycombinations) {
  const lowerBound = combination.value * 1.05;
  const upperBound = combination.value * 1.12;

  // Binary search for the first valid yourcombination within the lower bound
  let left = 0;
  let right = yourcombinations.length - 1;
  let startIndex = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (yourcombinations[mid].value >= lowerBound) {
      startIndex = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Collect all combinations within the range
  if (startIndex !== -1) {
    for (let i = startIndex; i < yourcombinations.length; i++) {
      if (yourcombinations[i].value > upperBound) break;
      results.push({
        yourcombination: combination,
        mycombination: yourcombinations[i]
      });
      if(results.length>=5){
        break;
      }
    }
  }
  if(results.length>=5){
    break;
  }
}

shuffleArray(results)
console.log(results)
for (result of results){
     
    let assets = []
    let getassets=[]
    let sum=result.mycombination.value
    let getsum=result.yourcombination.value
    let present={}
    let send = true;
    console.log(result)
    for (offeredItem of result.yourcombination.combination) {
        present[offeredItem.assetId]=true
        if (myValues[offeredItem.assetId][2]/myValues[offeredItem.assetId][4] >= config.overrapratio ||  myValues[offeredItem.assetId][4]>0.7*sum){
            send = false
        }
        
        assets.push(offeredItem.userAssetId)
    }
    for (gettingItem of result.mycombination.combination) {

        if(present[gettingItem.assetId]!=undefined){
            send=false;
        }
        getassets.push(gettingItem.userAssetId)
    }
    if(send){
        found=true
        logToFile("Swap Found With " + inbound.user.name)
        for (offeredItem of result.mycombination.combination) {
            logToFile(myValues[offeredItem.assetId][0])

        }
        logToFile("for")
        for (gettingItem of result.yourcombination.combination) {
            logToFile(othersValues[gettingItem.assetId][0])
        }
        logToFile(getsum + " vs " + sum)
		countered(channel,result.yourcombination.combination.map(x=>x.assetId),result.mycombination.combination.map(x=>x.assetId),getsum,sum)
        logToFile(`{\"offers\":[{\"userId\":${trade.user.id},\"userAssetIds\":[${getassets.join(",")}],\"robux\":0},{\"userId\":${account.UserID},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`)

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
            "body": `{\"offers\":[{\"userId\":${trade.user.id},\"userAssetIds\":[${getassets.join(",")}],\"robux\":0},{\"userId\":${account.UserID},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`,
            "method": "POST"
        }).then(async res => {
            let data = await res.json()
			if(data["errors"]==undefined){
				IdDB.removeID(inbound.id)				
			}
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
                            "body": `{\"offers\":[{\"userId\":${trade.user.id},\"userAssetIds\":[${getassets.join(",")}],\"robux\":0},{\"userId\":${account.UserID},\"userAssetIds\":[${assets.join(",")}],\"robux\":0}]}`,
                            "method": "POST"
                        }).then(async res => {
                            let data = await res.json()
                            logToFile(data)
							if(data["errors"]==undefined){
								IdDB.removeID(inbound.id)				
							}
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

                         
                         
							if (calculatedValues.downgrade == false) {
								await upgrade(1)
								if (!found) {
									await downgrade(1)
								}
							} else {
								await downgrade(1)
								if (!found) {
									await upgrade(1)
								}
							}
                            if(!found){
                                await swap()
                            }
                            if(!found){
                                await upgrade(0.95)
                            }
                            if(!found){
                                await downgrade(1.05)
                            }
							if (!found ) {
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
								let embed = new EmbedBuilder()
								.setTitle('Trade Declined')
								.setDescription("from "+inbound.user.name)
								.setColor('#8b0000')
								.setTimestamp()
							.setFooter({ text: 'Counter Bot by Embedded77' });
							channel.send({ embeds: [embed] });
							}
						}
					}
					else{
						await channel.send({embeds: [embed] });
					}
				}
			}

		})

		logToFile("\n\n == ROUND FINISHED ==\n\n")
	})
}
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);


setInterval(init, 20000)

await init()
config.accounts.forEach(account => {
	sendRequest((account))
})
config.accounts.forEach(account => {
	setInterval(function() {
		sendRequest(account)
	}, 1_440_000)
})


})

client.login(config.token)
