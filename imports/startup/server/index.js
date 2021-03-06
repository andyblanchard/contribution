// Initialize web3 as global object for entire server side
import web3 from '/imports/lib/server/ethereum/web3.js'

// Set defaultAccount
web3.eth.defaultAccount = web3.eth.coinbase;

// This defines all the collections, publications and methods that the application provides
// as an API to the client.
import '/imports/startup/server/register-apis.js';

process.env.HTTP_FORWARDED_COUNT = 1; // See https://docs.meteor.com/api/connections.html
