'use strict';

var Controller = require('./Controller');

/**
 * A controller that does nothing and accepts a transition to any state.
 * @param {ClientContext} context
 * @constructor
 */
function DummyController(context)
{
        Controller.call(this, context);
}

module.exports = DummyController;
require('inherits')(DummyController, Controller);

DummyController.prototype.enter = function(state, upgrade) { /*noop*/ };
DummyController.prototype.leave = function() { /*noop*/ };