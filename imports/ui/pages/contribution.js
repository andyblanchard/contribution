import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { $ } from 'meteor/jquery';
import { Toast } from 'meteor/fourquet:jquery-toast';

import { async } from 'async';
import { assert } from 'assert';
import { BigNumber } from 'bignumber.js';
var sha256 = require('js-sha256').sha256;

import Contribution from '/imports/lib/assets/contracts/Contribution.sol.js';
import MelonToken from '/imports/lib/assets/contracts/MelonToken.sol.js';

import './contribution.html';

// Creation of contract object
Contribution.setProvider(web3.currentProvider);
MelonToken.setProvider(web3.currentProvider);
const contributionContract = Contribution.at('0x446BC4cAAcFC0Faaf2f3c0af6a665cDe5c4cCd7d');
const melonContract = MelonToken.at('0x231fA21e58d7658593cfF50883e3Ee4D6e4E4b78');

Template.contribution.onCreated(() => {
  Session.set('isECParamsSet', false);
  Session.set('isServerConnected', true);
  Meteor.call('isServerConnected', (err, result) => {
    if(!err) {
      Session.set('isServerConnected', result);
    } else {
      console.log(err);
    }
  });
  Toast.options = {
    closeButton: false,
    progressBar: false,
    positionClass: 'toast-bottom-full-width',
    showEasing: 'swing',
    hideEasing: 'linear',
    showMethod: 'fadeIn',
    hideMethod: 'fadeOut',
    timeOut: 8000,
  };
});


Template.contribution.helpers({
  isStarted() {
    return Session.get('melon-terms');
  },
  isTermsAccepted() {
    return Session.get('melon-terms') &&
      Session.get('no-equity') &&
      Session.get('workshop') &&
      Session.get('citizenChecked');
  },
  isDocumentsRead() {
    return Session.get('melon-greenpaper') && Session.get('melon-specifications');
  },
  isAllAccepted() {
    const numAllTerms = 6;
    const numAccTerms =
      Session.get('melon-terms') +
      Session.get('no-equity') +
      Session.get('workshop') +
      Session.get('citizenChecked') +
      Session.get('melon-greenpaper') +
      Session.get('melon-specifications');
    return numAccTerms === numAllTerms;
  },
  isECParamsSet() {
    return Session.get('isECParamsSet');
  },
  whenECParamsSet() {
    if (Session.get('isECParamsSet')) return 'disabled';
    return '';
  },
  getContributionAddress() {
    return Session.get('contributionAddress');
  },
  getSigV() {
    return Session.get('sig.v');
  },
  getSigR() {
    return Session.get('sig.r');
  },
  getSigS() {
    return Session.get('sig.s');
  },
  isRopstenNetwork() {
    return Session.get('network') === 'Ropsten';
  },
  isSending() {
    return Session.get('isSending');
  },
});


Template.contribution.onRendered(function contributionOnRendered() {
  this.$('input#contribution_address').characterCounter();
  this.$('.scrollspy').scrollSpy();
});


Template.contribution.events({
  'input #contribution_address': (event, templateInstance) => {
    const template = templateInstance;
    if (web3.isAddress(event.currentTarget.value) === false) {
      template.find('#contribution-text').innerHTML = '';
      template.find('#success-message').innerHTML = '';
      template.find('#error-message').innerHTML = 'Ethereum Address is invalid.';
    } else {
      template.find('#contribution-text').innerHTML = '';
      template.find('#error-message').innerHTML = '';
      template.find('#success-message').innerHTML = 'Ethereum Address is valid.';
    }
  },
  'click input': (event, templateInstance) => {
    const template = templateInstance;
    for (let i = 0; i < template.$('input').length; i += 1) {
      if (template.$('input')[i].id === 'melon-terms') {
        Session.set('melon-terms', template.$('input')[i].checked);
      } else if (template.$('input')[i].id === 'workshop') {
        Session.set('workshop', template.$('input')[i].checked);
      } else if (template.$('input')[i].id === 'no-equity') {
        Session.set('no-equity', template.$('input')[i].checked);
      } else if (template.$('input')[i].id === 'citizen') {
        Session.set('citizenChecked', template.$('input')[i].checked);
      } else if (template.$('input')[i].id === 'melon-greenpaper') {
        Session.set('melon-greenpaper', template.$('input')[i].checked);
      } else if (template.$('input')[i].id === 'melon-specifications') {
        Session.set('melon-specifications', template.$('input')[i].checked);
      }
    }
  },
  'click .disabled': (event) => {
    // Prevent default browser form submit
    event.preventDefault();
    Toast.info('Not all terms and conditions accepted.');
  },
  'submit .signature': (event) => {
    // Prevent default browser form submit
    event.preventDefault();

    // Get value from form element
    const target = event.target;
    const address = target.contribution_address.value;

    // Check Address is valid, proof of only allowed IPs
    if (web3.isAddress(address) === false) {
      Toast.info('Invalid contribution address');
      return;
    }

    Meteor.call('isUnitedStates', (err, res) => {
      if (!err) {
        if (res === true) {
          Toast.info('Unfortunately we cannot accept contributions form the United States');
        } else {
          Meteor.call('contributors.insert', address);
          // Sign Hash of Address, i.e. confirming User agreed to terms and conditions.
          const hash = '0x' + sha256(new Buffer(address.slice(2),'hex'));
          Meteor.call('sign', hash, (err, result) => {
            if(!err) {
              let sig = result;
              try {
                var r = sig.slice(0, 66);
                var s = '0x' + sig.slice(66, 130);
                var v = parseInt('0x' + sig.slice(130, 132), 16);
                if (sig.length<132) {
                  //web3.eth.sign shouldn't return a signature of length<132, but if it does...
                  sig = sig.slice(2);
                  r = '0x' + sig.slice(0, 64);
                  s = '0x00' + sig.slice(64, 126);
                  v = parseInt('0x' + sig.slice(126, 128), 16);
                }
                if (v!=27 && v!=28) v+=27;
                // Let user know
                Session.set('contributionAddress', address);
                Session.set('sig.v', v);
                Session.set('sig.r', r);
                Session.set('sig.s', s);
                Session.set('isECParamsSet', true);
                Toast.success('Signature successfully generated');
              } catch (err) {
                Toast.error('Ethereum node seems to be down, please contact: team@melonport.com. Thanks.', err);
              }
            } else {
              console.log(err);
            }
          });
        }
      }
    });
  },
  'submit .amount': (event, templateInstance) => {
    // Prevent default browser form submit
    event.preventDefault();
    const template = templateInstance;

    // Get value from form element
    const target = event.target;
    const etherAmount = target.ether_amount.value;

    template.find('#txStatus').innerHTML =
      'Sending of funds initiated. Please confirm the transaction and wait a few seconds for it to process.';
    contributionContract.buy(
      Session.get('sig.v'),
      Session.get('sig.r'),
      Session.get('sig.s'),
      { from: Session.get('contributionAddress'), value: web3.toWei(etherAmount, 'ether') })
    .then(() => {
      // TODO msg is sending
      template.find('#txStatus').innerHTML = 'Funds have been sent.';
      return melonContract.balanceOf(Session.get('contributionAddress'));
    }).then((result) => {
      const melonsBought = web3.fromWei(result.toNumber(), 'ether');
      template.find('#txStatus').innerHTML =
        `Funds have been sent! You own: ${melonsBought} MLN. Thank you for your contribution.`;
    });
  },
});
