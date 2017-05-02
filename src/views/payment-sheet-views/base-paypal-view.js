'use strict';

var BaseView = require('../base-view');
var assign = require('../../lib/assign').assign;
var btPaypal = require('braintree-web/paypal-checkout');

function BasePayPalView() {
  BaseView.apply(this, arguments);
}

BasePayPalView.prototype = Object.create(BaseView.prototype);

BasePayPalView.prototype._initialize = function (isCredit) {
  var self = this;
  var paypalConfiguration = isCredit ? this.model.merchantConfiguration.paypalCredit : this.model.merchantConfiguration.paypal;

  this.paypalConfiguration = assign({}, paypalConfiguration);

  this.model.asyncDependencyStarting();

  btPaypal.create({client: this.client}, function (err, paypalInstance) {
    var checkoutJSConfiguration;
    var buttonSelector = '[data-braintree-id="paypal-button"]';
    var environment = self.client.getConfiguration().gatewayConfiguration.environment === 'production' ? 'production' : 'sandbox';
    var locale = self.model.merchantConfiguration.locale;

    if (err) {
      self.model.asyncDependencyFailed({
        view: self.ID,
        error: err
      });
      return;
    }

    self.paypalInstance = paypalInstance;

    self.paypalConfiguration.offerCredit = Boolean(isCredit);
    checkoutJSConfiguration = {
      env: environment,
      locale: locale,
      payment: function () {
        return paypalInstance.createPayment(self.paypalConfiguration).catch(reportError);
      },
      onAuthorize: function (data) {
        return paypalInstance.tokenizePayment(data).then(function (tokenizePayload) {
          self.model.addPaymentMethod(tokenizePayload);
        }).catch(reportError);
      },
      onError: reportError
    };

    if (locale) {
      self.paypalConfiguration.locale = locale;
    }

    if (isCredit) {
      buttonSelector = '[data-braintree-id="paypal-credit-button"]';
      checkoutJSConfiguration.style = {label: 'credit'};
    }

    global.paypal.Button.render(checkoutJSConfiguration, buttonSelector).then(function () {
      self.model.asyncDependencyReady();
    });
  });

  function reportError(err) {
    self.model.reportError(err);
  }
};

module.exports = BasePayPalView;
